import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Confirms the media folder exists and the app can write to it before the server accepts traffic, so a
 * wrong path or missing permission shows up at start — not later as a failed photo upload.
 */
export async function checkMediaFolder(root: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const probe = join(root, `.write-check-${randomBytes(6).toString("hex")}`);
  try {
    await mkdir(root, { recursive: true });
    await writeFile(probe, "ok", "utf8");
    await rm(probe, { force: true });
    return { ok: true };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? "unknown";
    return { ok: false, message: `MEDIA_ROOT can't be written to (${code}) — create the folder and give the app's user write access` };
  }
}
