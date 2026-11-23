import { Loader2, Pause, Play, Plus, Trash2, Upload, Video } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAllProducts } from "@/hooks/use-demo-store";
import { checkImageFile } from "@/lib/image-upload";
import { adminContent, type AdminReview, type ReviewMediaItem } from "@/services/adminContentService";
import { absoluteMediaUrl } from "@/services/liveStories";
import { testimonialCategories, testimonialPlacements, type TestimonialCategory, type TestimonialPlacement } from "@/services/testimonialService";
import { LiveState, useLive } from "./shared";

const ta = `${adminInput} h-auto py-2`;

interface Draft {
  id: string | null;
  category: TestimonialCategory;
  name: string;
  city: string;
  quote: string;
  rating: number | null;
  productId: string | null;
  placements: TestimonialPlacement[];
  verified: boolean;
  consent: boolean;
  published: boolean;
  /** status before this editing session — decides between "back to pending" and "hidden". */
  wasPublished: boolean;
  media: ReviewMediaItem[];
}

const blank = (): Draft => ({ id: null, category: "Skin", name: "", city: "", quote: "", rating: null, productId: null, placements: ["home"], verified: false, consent: false, published: false, wasPublished: false, media: [] });

const fromReview = (r: AdminReview): Draft => ({
  id: r.id,
  category: testimonialCategories.find((c) => c.toLowerCase() === (r.category ?? "").toLowerCase()) ?? "General Experience",
  name: r.authorName,
  city: r.city ?? "",
  quote: r.body,
  rating: r.rating,
  productId: r.productId,
  placements: (r.placements?.length ? r.placements : ["home"]) as TestimonialPlacement[],
  verified: r.verifiedPurchase,
  consent: r.consentGiven,
  published: r.status === "PUBLISHED",
  wasPublished: r.status !== "PENDING",
  media: r.media ?? [],
});

const liveLabel = (r: AdminReview) =>
  r.status === "PUBLISHED" && r.consentGiven && r.verifiedPurchase
    ? { live: true, text: `Live · ${(r.placements?.length ? r.placements : ["home"]).map((k) => testimonialPlacements.find((x) => x.key === k)?.label).join(", ")}` }
    : { live: false, text: `Not public · ${[!r.verifiedPurchase && "not verified", !r.consentGiven && "no consent", r.status !== "PUBLISHED" && (r.status === "HIDDEN" ? "hidden" : "unpublished")].filter(Boolean).join(", ")}` };

/** Admin preview player with explicit play / pause — play() stays inside the click handler. */
function VideoPreview({ src, poster }: { src: string; poster?: string | undefined }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="space-y-2">
      <video ref={ref} src={src} poster={poster} controls playsInline preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} className="aspect-video w-full rounded bg-primary" />
      {failed ? <p role="alert" className="text-xs text-destructive">This video couldn't be loaded from the server.</p> : (
        <Button type="button" size="sm" variant="outline" onClick={() => { const v = ref.current; if (!v) return; if (v.paused) { void v.play().catch(() => setFailed(true)); } else v.pause(); }}>
          {playing ? <><Pause /> Pause</> : <><Play /> Play</>}
        </Button>
      )}
    </div>
  );
}

/** Customer stories kept in the store database. A story only goes public when it is verified,
 *  the customer has given permission, and it is published — the server enforces the same rule. */
export function LiveTestimonials() {
  const { data, error, loading, reload } = useLive(() => adminContent.listReviews(), []);
  if (!data) return <AdminPage title="Customer stories"><LiveState error={error} loading={loading} onRetry={() => void reload()} /></AdminPage>;
  return <Stories key={data.length ? data.map((r) => `${r.id}:${r.updatedAt}`).join(",") : "empty"} reviews={data} onChanged={() => void reload()} />;
}

function Stories({ reviews, onChanged }: { reviews: AdminReview[]; onChanged: () => void }) {
  const products = useAllProducts().filter((p) => p.status === "active");
  const [draft, setDraft] = useState<Draft>(blank);
  const [del, setDel] = useState<AdminReview | null>(null);
  const [filter, setFilter] = useState<TestimonialCategory | "">("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const up = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const editing = draft.id !== null;
  const shown = reviews.filter((r) => !filter || (r.category ?? "").toLowerCase() === filter.toLowerCase());

  const save = async () => {
    if (draft.name.trim().length < 2) { toast.error("Add the customer's name."); return; }
    if (draft.quote.trim().length < 10) { toast.error("Add the customer's exact words (at least a sentence)."); return; }
    if (draft.published && !(draft.verified && draft.consent)) { toast.error("A story can only be published once it is verified and the customer has given permission."); return; }
    if (draft.published && draft.placements.length === 0) { toast.error("Choose at least one place for it to appear."); return; }
    setBusy(true);
    const body = {
      authorName: draft.name.trim(), body: draft.quote.trim(), category: draft.category, city: draft.city.trim() || null,
      rating: draft.rating, productId: draft.productId,
      verifiedPurchase: draft.verified, consentGiven: draft.consent,
      status: (draft.published ? "PUBLISHED" : draft.wasPublished ? "HIDDEN" : "PENDING") as "PENDING" | "PUBLISHED" | "HIDDEN",
      placements: draft.placements, media: draft.media,
    };
    try {
      const saved = editing
        ? await adminContent.updateReview(draft.id!, body)
        : await adminContent.createReview(body);
      toast.success(saved.status === "PUBLISHED" ? "Saved — now visible on the storefront." : "Saved — not shown publicly.");
      setDraft(fromReview(saved));
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); }
    finally { setBusy(false); }
  };

  const upload = async (f: File | undefined, item: Omit<ReviewMediaItem, "url" | "mediaId">) => {
    if (!f || !draft.id) return;
    const isVideo = item.type === "video";
    if (isVideo ? !f.type.startsWith("video/") : checkImageFile(f)) { toast.error(isVideo ? "Please choose a video file." : checkImageFile(f)!); return; }
    setUploading(item.role ?? item.type);
    try {
      const kind = isVideo ? "REVIEW_VIDEO" : item.role === "poster" ? "POSTER" : "REVIEW_PHOTO";
      const media = await adminContent.uploadMedia(f, { kind, reviewId: draft.id, alt: `${draft.name} — customer story` });
      const next = [...draft.media.filter((m) => !(m.type === item.type && m.role === item.role)), { ...item, url: media.url, mediaId: media.id }];
      const saved = await adminContent.updateReview(draft.id, { media: next });
      setDraft({ ...draft, media: saved.media ?? [] });
      toast.success("File uploaded to the server.");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "The upload failed."); }
    finally { setUploading(null); }
  };

  const removeMedia = async (m: ReviewMediaItem) => {
    if (!draft.id) return;
    setBusy(true);
    try {
      const saved = await adminContent.updateReview(draft.id, { media: draft.media.filter((x) => x !== m) });
      setDraft({ ...draft, media: saved.media ?? [] });
      if (m.mediaId) await adminContent.archiveMedia(m.mediaId).catch(() => {});
      toast("File removed from the story.");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't remove it."); }
    finally { setBusy(false); }
  };

  const mediaOf = (type: "photo" | "video", role?: "before" | "after" | "poster") => draft.media.find((m) => m.type === type && m.role === role);

  const mediaButton = (label: string, item: Omit<ReviewMediaItem, "url" | "mediaId">, accept: string, id: string) => (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={`inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs ${draft.id ? "cursor-pointer hover:border-primary" : "opacity-50"}`}>
        {uploading === (item.role ?? item.type) ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {label}
      </label>
      <input id={id} type="file" accept={accept} className="sr-only" disabled={!draft.id || uploading !== null} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void upload(f, item); }} />
    </div>
  );

  const mediaRow = (type: "photo" | "video", role: "before" | "after" | "poster" | undefined, label: string, accept: string, id: string) => {
    const m = mediaOf(type, role);
    return (
      <div className="flex items-center justify-between gap-3 rounded-md bg-secondary/60 p-2">
        <div className="flex items-center gap-2">
          {m ? (type === "video" ? <Video className="size-4 text-muted-foreground" /> : <img src={absoluteMediaUrl(m.url)} alt="" className="size-10 rounded object-cover" />) : <span className="grid size-10 place-items-center rounded border border-dashed border-input text-[9px] text-muted-foreground">None</span>}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {mediaButton(m ? "Replace" : "Upload", role ? { type, role } : { type }, accept, id)}
          {m && <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Remove ${label}`} onClick={() => void removeMedia(m)}><Trash2 className="size-3.5 text-destructive" /></Button>}
        </div>
      </div>
    );
  };

  const video = mediaOf("video");
  const poster = mediaOf("photo", "poster");

  return (
    <AdminPage title="Customer stories" subtitle="Stored in the store database. Only verified + consented + published stories appear on the storefront — the server enforces this too.">
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Panel title={`Stories (${reviews.length})`} action={
          <select aria-label="Filter by category" className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as TestimonialCategory)}>
            <option value="">All categories</option>{testimonialCategories.map((c) => <option key={c}>{c}</option>)}
          </select>}>
          {shown.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{reviews.length === 0 ? "No reviews yet" : "No reviews in this category"}</p>
              <p className="mt-1">The storefront shows an empty state until a verified, consented review is published here. Never add invented names, ratings or results.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {shown.map((r) => {
                const s = liveLabel(r);
                const thumb = r.media?.find((m) => m.type === "photo");
                return (
                  <li key={r.id} className="flex gap-3 rounded-md bg-secondary/60 p-3">
                    {thumb && <img src={absoluteMediaUrl(thumb.url)} alt="" className="size-14 rounded object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{r.authorName} <span className="font-normal text-muted-foreground">· {r.category ?? "General"}{r.media?.some((m) => m.type === "video") && <> · <Video className="inline size-3" /> video</>}</span></p>
                      <p className="truncate text-sm text-muted-foreground">“{r.body}”</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider">{s.live ? <span className="text-primary">{s.text}</span> : <span className="text-muted-foreground">{s.text}</span>}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" onClick={() => setDraft(fromReview(r))}>Edit</Button>
                      <Button size="sm" variant="ghost" aria-label={`Delete story from ${r.authorName}`} onClick={() => setDel(r)}><Trash2 /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={editing ? "Edit story" : "Add story"} action={<Button size="sm" variant="outline" onClick={() => setDraft(blank())}><Plus /> New</Button>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={adminLabel} htmlFor="t-cat">Category</label>
                <select id="t-cat" className={adminInput} value={draft.category} onChange={(e) => up({ category: e.target.value as TestimonialCategory })}>{testimonialCategories.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className={adminLabel} htmlFor="t-name">Customer name</label><input id="t-name" className={adminInput} value={draft.name} onChange={(e) => up({ name: e.target.value })} /></div>
              <div><label className={adminLabel} htmlFor="t-city">City</label><input id="t-city" className={adminInput} value={draft.city} onChange={(e) => up({ city: e.target.value })} /></div>
              <div><label className={adminLabel} htmlFor="t-rating">Customer's own rating</label>
                <select id="t-rating" className={adminInput} value={draft.rating ?? ""} onChange={(e) => up({ rating: e.target.value ? Number(e.target.value) : null })}><option value="">No rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select></div>
            </div>
            <div><label className={adminLabel} htmlFor="t-quote">Their exact words</label><textarea id="t-quote" rows={4} maxLength={4000} className={ta} value={draft.quote} onChange={(e) => up({ quote: e.target.value })} /></div>
            <div><label className={adminLabel} htmlFor="t-prod">Linked product</label>
              <select id="t-prod" className={adminInput} value={draft.productId ?? ""} onChange={(e) => up({ productId: e.target.value || null })}><option value="">None</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>

            <fieldset><legend className={adminLabel}>Photos & video {editing ? "" : "(save the story first)"}</legend>
              <div className="space-y-2">
                {mediaRow("photo", undefined, "Customer photo", "image/*", "m-photo")}
                {mediaRow("photo", "before", "Before photo", "image/*", "m-before")}
                {mediaRow("photo", "after", "After photo", "image/*", "m-after")}
                {mediaRow("video", undefined, "Video story", "video/mp4", "m-video")}
                {mediaRow("photo", "poster", "Video thumbnail", "image/*", "m-poster")}
              </div>
              {!editing && <p className="mt-1 text-[11px] text-muted-foreground">Files upload to the server's storage once the story exists — press Save story first.</p>}
            </fieldset>
            {video && <VideoPreview key={video.url} src={absoluteMediaUrl(video.url)} poster={poster ? absoluteMediaUrl(poster.url) : undefined} />}

            <fieldset><legend className={adminLabel}>Show on</legend>
              <div className="flex flex-wrap gap-4">{testimonialPlacements.map((pl) => <label key={pl.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.placements.includes(pl.key)} onChange={() => up({ placements: draft.placements.includes(pl.key) ? draft.placements.filter((x) => x !== pl.key) : [...draft.placements, pl.key] })} /> {pl.label}</label>)}</div>
            </fieldset>
            {([["verified", "Review verified as genuine"], ["consent", "Customer gave permission to publish (incl. photo/video)"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm"><span>{l}</span><Switch checked={draft[k]} onCheckedChange={(v) => up({ [k]: v })} /></label>
            ))}
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Show on storefront {!(draft.verified && draft.consent) && <span className="block text-[11px] font-normal text-muted-foreground">Needs verification and permission first.</span>}</span>
              <Switch checked={draft.published} disabled={!(draft.verified && draft.consent)} onCheckedChange={(v) => up({ published: v })} aria-label="Show on storefront" />
            </label>
            <Button className="w-full" disabled={busy || uploading !== null} onClick={() => void save()}>{editing ? "Save changes" : "Save story"}</Button>
          </div>
        </Panel>
      </div>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete the story from ${del?.authorName ?? ""}?`} confirmLabel="Delete"
        description="It is removed from the database and the storefront. Files uploaded for it stay hidden in storage."
        onConfirm={() => { if (del) { void adminContent.deleteReview(del.id).then(() => { if (draft.id === del.id) setDraft(blank()); toast("Story deleted"); onChanged(); }, (e: Error) => toast.error(e.message)); } }} />
    </AdminPage>
  );
}
