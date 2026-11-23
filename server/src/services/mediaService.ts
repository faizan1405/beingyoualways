import { createHash, randomBytes } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import Busboy from "busboy";
import type { MediaAsset, MediaKind, PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import sharp from "sharp";

import type { Config } from "../config.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { logActivity } from "./activity.js";

const IMAGE_KINDS = new Set<MediaKind>(["PRODUCT_IMAGE", "GALLERY_SLIDE", "CONTENT_IMAGE"]);

/** What a file really is, decided by its first bytes — never by the name or the browser's label. */
const SIGNATURES = [
  { mime: "image/jpeg", ext: ".jpg", kind: "image" as const, test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: ".png", kind: "image" as const, test: (b: Buffer) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/gif", ext: ".gif", kind: "image" as const, test: (b: Buffer) => b.subarray(0, 3).toString("latin1") === "GIF" },
  { mime: "image/webp", ext: ".webp", kind: "image" as const, test: (b: Buffer) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { mime: "video/mp4", ext: ".mp4", kind: "video" as const, test: (b: Buffer) => b.subarray(4, 8).toString("latin1") === "ftyp" },
];

export interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mime: string;
}

export interface MediaActor {
  userId: string;
  ip?: string | undefined;
}

export type MediaRow = MediaAsset & { review?: { status: string; consentGiven: boolean; verifiedPurchase: boolean } | null };

/** Reads exactly one file out of a multipart request, with a hard size ceiling. */
function readUpload(req: Request, maxBytes: number): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    if (!/multipart\/form-data/i.test(String(req.headers["content-type"] ?? ""))) {
      return reject(badRequest("Send the file as a form upload."));
    }
    const bb = Busboy({ headers: req.headers, limits: { fileSize: maxBytes, files: 1, fields: 4 } });
    let file: UploadedFile | null = null;
    let failed = false;
    const fail = (e: unknown) => {
      if (failed) return;
      failed = true;
      reject(e instanceof Error ? e : badRequest("That upload couldn't be read."));
    };
    bb.on("file", (_field, stream, info) => {
      const chunks: Buffer[] = [];
      let total = 0;
      stream.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.destroy();
          fail(badRequest("That file is too large."));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("limit", () => fail(badRequest("That file is too large.")));
      stream.on("error", fail);
      stream.on("close", () => {
        if (!failed) file = { buffer: Buffer.concat(chunks), filename: info.filename, mime: info.mimeType };
      });
    });
    bb.on("error", fail);
    bb.on("finish", () => {
      if (failed) return;
      if (!file) return reject(badRequest("No file was uploaded."));
      return resolve(file);
    });
    req.on("aborted", () => fail(badRequest("The upload was interrupted.")));
    req.pipe(bb);
  });
}

/**
 * Files live under MEDIA_ROOT on the server's own disk; MySQL holds the metadata and decides who may
 * see them. Nothing is ever served straight from the folder — every read goes through this service, so
 * an unapproved or archived file can't be fetched by guessing a path.
 */
export function createMediaService(prisma: PrismaClient, config: Config) {
  const root = join(process.cwd(), config.media.root);
  const keyOf = (id: string) => `/api/media/${id}`;

  const absOf = (storageKey: string) => {
    const abs = join(root, storageKey);
    // the key is server-generated, but a stored path must still stay inside the media folder
    if (!abs.startsWith(root + sep)) throw forbidden("That file can't be read.");
    return abs;
  };

  const variantKeys = (a: MediaAsset) => {
    const v = (a.variants ?? {}) as { webp?: string; thumb?: string };
    return [v.webp, v.thumb].filter((k): k is string => typeof k === "string");
  };

  async function writeBytes(abs: string, data: Buffer) {
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, data);
  }

  /** Uploads one file: checks what it really is, stores it, and records it. */
  async function upload(req: Request, input: { kind: MediaKind; productId?: string; reviewId?: string; alt?: string; position?: number }, actor: MediaActor) {
    const isVideo = input.kind === "REVIEW_VIDEO";
    const maxBytes = isVideo ? config.media.maxVideoBytes : config.media.maxImageBytes;
    const { buffer, filename, mime } = await readUpload(req, maxBytes);
    if (!buffer.length) throw badRequest("That file is empty.");

    const sig = SIGNATURES.find((s) => s.test(buffer));
    if (!sig) throw badRequest("That file isn't a supported image or video. Use JPEG, PNG, WebP, GIF or MP4.");
    if (sig.kind === "video" && isVideo === false) throw badRequest("A video can only be uploaded as a customer story video.");
    if (sig.kind === "image" && isVideo) throw badRequest("A customer story video has to be a video file.");

    const checksum = createHash("sha256").update(buffer).digest("hex");
    const at = new Date();
    const folder = `${input.kind.toLowerCase()}/${at.getUTCFullYear()}/${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
    const storageKey = `${folder}/${randomBytes(12).toString("hex")}${sig.ext}`;
    await writeBytes(absOf(storageKey), buffer);

    const variants: { webp?: string; thumb?: string } = {};
    let width: number | null = null;
    let height: number | null = null;
    if (sig.kind === "image") {
      try {
        const meta = await sharp(buffer).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
        if (meta.format !== "webp") {
          const webpKey = `${folder}/${randomBytes(12).toString("hex")}.webp`;
          await writeBytes(absOf(webpKey), await sharp(buffer).webp({ quality: 82 }).toBuffer());
          variants.webp = webpKey;
        }
        if ((meta.width ?? 0) > 480) {
          const thumbKey = `${folder}/${randomBytes(12).toString("hex")}.thumb.webp`;
          await writeBytes(absOf(thumbKey), await sharp(buffer).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer());
          variants.thumb = thumbKey;
        }
      } catch {
        // A file that opens but won't be re-encoded is still stored as-is; the original is what the
        // shopper sees, so a missing thumbnail is never a reason to reject the upload.
      }
    }

    const row = await prisma.mediaAsset.create({
      data: {
        kind: input.kind,
        storageKey,
        originalName: (filename || "upload").slice(0, 200),
        mime: sig.mime,
        bytes: buffer.length,
        checksum,
        width,
        height,
        alt: input.alt?.slice(0, 300) ?? null,
        variants: Object.keys(variants).length ? (variants as never) : undefined,
        productId: input.productId ?? null,
        reviewId: input.reviewId ?? null,
        uploadedBy: actor.userId,
        position: input.position ?? 0,
      },
    });
    await logActivity(prisma, actor, {
      action: "media.upload",
      entityType: "media",
      entityId: row.id,
      summary: `Uploaded ${input.kind.toLowerCase().replace(/_/g, " ")} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`,
    });
    return view(row);
  }

  const view = (a: MediaAsset) => ({
    id: a.id,
    kind: a.kind,
    url: keyOf(a.id),
    originalName: a.originalName,
    mime: a.mime,
    bytes: a.bytes,
    width: a.width,
    height: a.height,
    alt: a.alt,
    status: a.status,
    position: a.position,
    productId: a.productId,
    reviewId: a.reviewId,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    archivedAt: a.archivedAt?.toISOString() ?? null,
  });

  async function load(id: string): Promise<MediaRow> {
    const a = await prisma.mediaAsset.findUnique({
      where: { id },
      include: { review: { select: { status: true, consentGiven: true, verifiedPurchase: true } } },
    });
    if (!a) throw notFound("That file isn't available.");
    return a as MediaRow;
  }

  /**
   * Who may see a file. Story photos and videos are only public once the story itself is published,
   * consented and from a verified purchase; everything else that is active is shop imagery.
   */
  function isPublic(a: MediaRow) {
    if (a.status !== "ACTIVE") return false;
    if (a.reviewId) {
      const r = a.review;
      return Boolean(r && r.status === "PUBLISHED" && r.consentGiven && r.verifiedPurchase);
    }
    return true;
  }

  /** Streams a file, honouring byte ranges so video playback can seek. */
  async function serve(id: string, req: Request, res: Response, isAdmin: boolean) {
    const a = await load(id);
    if (!isAdmin && !isPublic(a)) throw notFound("That file isn't available.");
    const abs = absOf(a.storageKey);
    if (!existsSync(abs)) {
      // the row says the file should be there but the disk says otherwise — say so, don't 500
      throw notFound("That file isn't available.");
    }
    const size = (await stat(abs)).size;
    const etag = `"${a.checksum.slice(0, 32)}"`;
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", a.mime);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (req.headers["if-none-match"] === etag) {
      res.status(304);
      return res.end();
    }

    const range = req.headers.range;
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (m) {
      const start = m[1] ? Number.parseInt(m[1], 10) : 0;
      const end = m[2] ? Number.parseInt(m[2], 10) : size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start > end || end >= size) {
        res.status(416);
        res.setHeader("Content-Range", `bytes */${size}`);
        return res.end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      return createReadStream(abs, { start, end }).pipe(res);
    }
    res.setHeader("Content-Length", String(size));
    return createReadStream(abs).pipe(res);
  }

  async function list(filter: { productId?: string; reviewId?: string; status?: "ACTIVE" | "ARCHIVED"; kind?: MediaKind }) {
    const rows = await prisma.mediaAsset.findMany({
      where: {
        ...(filter.productId ? { productId: filter.productId } : {}),
        ...(filter.reviewId ? { reviewId: filter.reviewId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.kind ? { kind: filter.kind } : {}),
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });
    return { media: rows.map(view) };
  }

  async function update(id: string, input: { alt?: string; position?: number }, actor: MediaActor) {
    const a = await load(id);
    const row = await prisma.mediaAsset.update({
      where: { id: a.id },
      data: { ...(input.alt !== undefined ? { alt: input.alt.slice(0, 300) } : {}), ...(input.position !== undefined ? { position: input.position } : {}) },
    });
    await logActivity(prisma, actor, { action: "media.update", entityType: "media", entityId: id, summary: "Updated file details" });
    return view(row);
  }

  /**
   * Archiving hides a file everywhere: it stops being served, and it is dropped from the product's
   * picture list so no page is left showing a broken image. The bytes stay until an admin purges them.
   */
  async function archive(id: string, actor: MediaActor) {
    const a = await load(id);
    if (a.status === "ARCHIVED") return view(a);
    await prisma.$transaction(async (tx) => {
      await tx.mediaAsset.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
      if (a.productId) {
        await tx.productImage.deleteMany({ where: { productId: a.productId, url: keyOf(id) } });
      }
    });
    await logActivity(prisma, actor, { action: "media.archive", entityType: "media", entityId: id, summary: "Hid a file (kept on disk until purged)" });
    return view(await load(id));
  }

  /** Permanent removal — only for files that are already hidden and no longer referenced. */
  async function purge(id: string, actor: MediaActor) {
    const a = await load(id);
    if (a.status !== "ARCHIVED") throw conflict("Hide the file first — purging removes the copy on disk.");
    if (a.productId && (await prisma.productImage.count({ where: { url: keyOf(id) } }))) {
      throw conflict("A product still shows this file, so it can't be purged yet.");
    }
    if (a.reviewId && (await prisma.review.count({ where: { id: a.reviewId, media: { path: "$", array_contains: [{ mediaId: id }] } } }))) {
      throw conflict("A customer story still shows this file, so it can't be purged yet.");
    }
    for (const key of [a.storageKey, ...variantKeys(a)]) {
      await rm(absOf(key), { force: true });
    }
    await prisma.mediaAsset.delete({ where: { id } });
    await logActivity(prisma, actor, { action: "media.purge", entityType: "media", entityId: id, summary: "Purged a hidden file from disk" });
    return { purged: true };
  }

  /** Attaches an uploaded file to a product's pictures (the admin editor can then reorder or replace). */
  async function attachToProduct(productId: string, id: string, actor: MediaActor) {
    const a = await load(id);
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!p) throw notFound("Product not found.");
    const url = keyOf(id);
    const already = await prisma.productImage.findFirst({ where: { productId, url } });
    if (!already) {
      const last = await prisma.productImage.aggregate({ where: { productId }, _max: { position: true } });
      await prisma.productImage.create({ data: { productId, url, position: (last._max.position ?? -1) + 1, alt: a.alt ?? undefined } });
      await prisma.mediaAsset.update({ where: { id }, data: { productId } });
    }
    await logActivity(prisma, actor, { action: "media.attach", entityType: "product", entityId: productId, summary: "Added an uploaded file to the product pictures" });
    return { url, id };
  }

  /**
   * Integrity check for the approvals screen: rows whose bytes are missing, and files on disk that no
   * row refers to. Nothing is deleted here — the admin decides.
   */
  async function inspect() {
    const rows = await prisma.mediaAsset.findMany({ select: { id: true, storageKey: true, status: true, variants: true } });
    const missing: string[] = [];
    const known = new Set<string>();
    for (const r of rows) {
      for (const key of [r.storageKey, ...variantKeys(r as MediaAsset)]) {
        known.add(relative(root, absOf(key)).split(sep).join("/"));
        if (!existsSync(absOf(key))) missing.push(r.id);
      }
    }
    const orphans: string[] = [];
    async function walk(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "outbox" || entry.name === "tmp") continue;
          await walk(abs);
        } else {
          const key = relative(root, abs).split(sep).join("/");
          if (!known.has(key)) orphans.push(key);
        }
      }
    }
    if (existsSync(root)) await walk(root);
    return { rowsWithoutFile: [...new Set(missing)], filesWithoutRow: orphans, tracked: rows.length };
  }

  /** Reads a stored file's bytes (used by the seed import for the project's own media). */
  async function readStored(storageKey: string) {
    return readFile(absOf(storageKey));
  }

  return {
    root,
    keyOf,
    upload,
    list,
    load,
    update,
    archive,
    purge,
    attachToProduct,
    inspect,
    serve,
    readStored,
    isVideoKind: (k: MediaKind) => k === "REVIEW_VIDEO",
    imageKinds: IMAGE_KINDS,
    view,
  };
}

export type MediaService = ReturnType<typeof createMediaService>;
