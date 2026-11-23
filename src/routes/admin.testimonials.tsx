import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, Plus, Trash2, Upload, Video } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import story1 from "@/assets/testimonials/story-1.webp";
import story2 from "@/assets/testimonials/story-2.webp";
import story3 from "@/assets/testimonials/story-3.webp";
import resultBefore from "@/assets/testimonials/result-before.webp";
import resultAfter from "@/assets/testimonials/result-after.webp";
import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { LiveTestimonials } from "@/components/admin/live/LiveTestimonials";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAllProducts, useDemoStore } from "@/hooks/use-demo-store";
import { checkImageFile, fileToDemoImage } from "@/lib/image-upload";
import { newId } from "@/lib/demo-store";
import { isBackendConfigured } from "@/services/api";
import {
  customerMediaService, isPublic, isPublicMedia, isTemporaryVideo, testimonialCategories, testimonialPlacements, testimonialService, testimonialStore,
  type Testimonial, type TestimonialCategory, type TestimonialPlacement,
} from "@/services/testimonialService";

export const Route = createFileRoute("/admin/testimonials")({ component: () => (isBackendConfigured() ? <LiveTestimonials /> : <Testimonials />) });

/** Client-supplied photos — selectable here; never public until permission is confirmed. */
const suppliedPhotos = [
  { src: story1, label: "Customer photo 1" },
  { src: story2, label: "Customer photo 2" },
  { src: story3, label: "Customer photo 3" },
  { src: resultBefore, label: "Before/after — left" },
  { src: resultAfter, label: "Before/after — right" },
];

const blank = (): Testimonial => ({ id: newId("t"), category: "Skin", name: "", city: "", quote: "", verified: false, consent: false, published: false, placements: ["home"], type: "text" });

function ImageField({ label, value, onChange, id }: { label: string; value?: string | undefined; onChange: (v: string | undefined) => void; id: string }) {
  return (
    <div>
      <p className={adminLabel}>{label}</p>
      <div className="mt-1 grid grid-cols-6 gap-2">
        <button type="button" onClick={() => onChange(undefined)} className={`aspect-square rounded border text-[10px] ${!value ? "border-primary ring-2 ring-primary" : "border-border"}`}>None</button>
        {suppliedPhotos.map((p) => (
          <button key={p.label} type="button" title={p.label} onClick={() => onChange(p.src)} className={`overflow-hidden rounded border ${value === p.src ? "border-primary ring-2 ring-primary" : "border-border"}`}>
            <img src={p.src} alt={p.label} className="aspect-square w-full object-cover object-top" />
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {value && !suppliedPhotos.some((p) => p.src === value) && <img src={value} alt="" className="size-12 rounded object-cover" />}
        <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs hover:border-primary"><Upload className="size-3.5" /> Upload</label>
        <input id={id} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          const bad = checkImageFile(f); if (bad) { toast.error(bad); return; }
          try { onChange(await fileToDemoImage(f, 700)); } catch { toast.error("That image couldn't be read."); }
        }} />
      </div>
    </div>
  );
}

/** Admin preview player with explicit play / pause. */
function VideoPreview({ src, poster }: { src: string; poster?: string | undefined }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="space-y-2">
      <video ref={ref} src={src} poster={poster} controls playsInline preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} className="aspect-video w-full rounded bg-primary" />
      {failed ? <p role="alert" className="text-xs text-destructive">This video couldn't be loaded. Check the link is a direct .mp4 or .webm file.</p> : (
        <Button type="button" size="sm" variant="outline" onClick={() => { const v = ref.current; if (!v) return; if (v.paused) { void v.play().catch(() => setFailed(true)); } else v.pause(); }}>
          {playing ? <><Pause /> Pause</> : <><Play /> Play</>}
        </Button>
      )}
    </div>
  );
}

function Testimonials() {
  const list = useDemoStore(testimonialStore);
  const products = useAllProducts().filter((p) => p.status === "active");
  const [draft, setDraft] = useState<Testimonial>(blank);
  const [del, setDel] = useState<Testimonial | null>(null);
  const [filter, setFilter] = useState<TestimonialCategory | "">("");
  const up = (patch: Partial<Testimonial>) => setDraft({ ...draft, ...patch });
  const photoStories = useSyncExternalStore(customerMediaService.subscribe, customerMediaService.photoStories, customerMediaService.serverPhotoStories);
  const videos = useSyncExternalStore(customerMediaService.subscribe, customerMediaService.videoReviews, customerMediaService.serverVideoReviews);
  const editing = list.some((t) => t.id === draft.id);
  const shown = list.filter((t) => !filter || t.category === filter);

  const save = () => {
    try {
      testimonialService.save(draft);
      toast.success(isPublic(draft) ? "Saved — now visible on the storefront." : "Saved as draft — not shown publicly.");
      setDraft(blank());
    } catch (e) { toast.error((e as Error).message); }
  };
  const placements = draft.placements ?? ["home"];
  const togglePlace = (k: TestimonialPlacement) => up({ placements: placements.includes(k) ? placements.filter((x) => x !== k) : [...placements, k] });

  return (
    <AdminPage title="Customer stories" subtitle="Add genuine, permission-cleared reviews. Only verified + consented + published entries appear on the storefront. Kept for this browser tab (reviews can hold personal details).">
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Panel title={`Stories (${list.length})`} action={
          <select aria-label="Filter by category" className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as TestimonialCategory)}>
            <option value="">All categories</option>{testimonialCategories.map((c) => <option key={c}>{c}</option>)}
          </select>}>
          {shown.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{list.length === 0 ? "No reviews yet" : "No reviews in this category"}</p>
              <p className="mt-1">The storefront shows an empty state until a verified, consented review is published here. Never add invented names, ratings or results.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {shown.map((t) => (
                <li key={t.id} className="flex gap-3 rounded-md bg-secondary/60 p-3">
                  {(t.photo ?? t.poster ?? t.afterPhoto) && <img src={t.photo ?? t.poster ?? t.afterPhoto} alt="" className="size-14 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{t.name} <span className="font-normal text-muted-foreground">· {t.category}{t.type === "video" && <> · <Video className="inline size-3" /> video</>}{t.beforePhoto && t.afterPhoto ? " · before/after" : ""}</span></p>
                    <p className="truncate text-sm text-muted-foreground">“{t.quote}”</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider">{isPublic(t) ? <span className="text-primary">Live · {(t.placements?.length ? t.placements : ["home"]).map((k) => testimonialPlacements.find((x) => x.key === k)?.label).join(", ")}</span> : <span className="text-muted-foreground">Draft · {[!t.verified && "not verified", !t.consent && "no consent", !t.published && "unpublished", t.type === "video" && !t.videoUrl && "video file cleared — add a hosted link"].filter(Boolean).join(", ")}</span>}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => setDraft(t)}>Edit</Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete story from ${t.name}`} onClick={() => setDel(t)}><Trash2 /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={editing ? "Edit story" : "Add story"} action={<Button size="sm" variant="outline" onClick={() => setDraft(blank())}><Plus /> New</Button>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={adminLabel} htmlFor="t-cat">Category</label>
                <select id="t-cat" className={adminInput} value={draft.category} onChange={(e) => up({ category: e.target.value as TestimonialCategory })}>{testimonialCategories.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className={adminLabel} htmlFor="t-type">Review type</label>
                <select id="t-type" className={adminInput} value={draft.type ?? "text"} onChange={(e) => up({ type: e.target.value as Testimonial["type"] })}><option value="text">Text</option><option value="photo">Photo</option><option value="video">Video</option></select></div>
              <div><label className={adminLabel} htmlFor="t-name">Customer name</label><input id="t-name" className={adminInput} value={draft.name} onChange={(e) => up({ name: e.target.value })} /></div>
              <div><label className={adminLabel} htmlFor="t-city">City</label><input id="t-city" className={adminInput} value={draft.city} onChange={(e) => up({ city: e.target.value })} /></div>
            </div>
            <div><label className={adminLabel} htmlFor="t-quote">Their exact words</label><textarea id="t-quote" rows={4} maxLength={600} className={`${adminInput} h-auto py-2`} value={draft.quote} onChange={(e) => up({ quote: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={adminLabel} htmlFor="t-prod">Linked product</label>
                <select id="t-prod" className={adminInput} value={draft.productSlug ?? ""} onChange={(e) => up({ productSlug: e.target.value || undefined })}><option value="">None</option>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></div>
              <div><label className={adminLabel} htmlFor="t-rating">Customer's own rating</label>
                <select id="t-rating" className={adminInput} value={draft.rating ?? ""} onChange={(e) => up({ rating: e.target.value ? Number(e.target.value) : undefined })}><option value="">No rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select></div>
            </div>
            {draft.type === "video" ? (
              <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                <div><label className={adminLabel} htmlFor="t-vurl">Video link (kept)</label><input id="t-vurl" className={adminInput} placeholder="https://… (hosted .mp4)" value={isTemporaryVideo(draft.videoUrl) ? "" : draft.videoUrl ?? ""} onChange={(e) => up({ videoUrl: e.target.value.trim() || undefined, videoFileName: undefined })} /></div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input p-3 text-xs hover:border-primary">
                  <Upload className="size-4" /> Or choose a video file (temporary preview)
                  <input type="file" accept="video/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (!f.type.startsWith("video/")) { toast.error("Please choose a video file."); return; } up({ videoUrl: URL.createObjectURL(f), videoFileName: f.name }); toast("Video loaded for preview on this page only — it isn't uploaded or saved."); }} />
                </label>
                {isTemporaryVideo(draft.videoUrl) && <p className="rounded bg-accent/15 px-2 py-1 text-[11px]"><strong>Temporary:</strong> {draft.videoFileName} plays only until this page is refreshed. Add a hosted link to keep it. Permanent video storage comes with the Hostinger backend.</p>}
                {draft.videoUrl && <VideoPreview key={draft.videoUrl} src={draft.videoUrl} poster={draft.poster} />}
                <ImageField id="t-poster" label="Thumbnail" value={draft.poster} onChange={(v) => up({ poster: v })} />
              </div>
            ) : (
              <ImageField id="t-photo" label="Customer photo (only with written permission)" value={draft.photo} onChange={(v) => up({ photo: v })} />
            )}
            <details className="rounded-md border border-border p-3" open={!!(draft.beforePhoto || draft.afterPhoto)}>
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider">Before & after photos (optional)</summary>
              <div className="mt-3 space-y-3">
                <ImageField id="t-before" label="Before" value={draft.beforePhoto} onChange={(v) => up({ beforePhoto: v })} />
                <ImageField id="t-after" label="After" value={draft.afterPhoto} onChange={(v) => up({ afterPhoto: v })} />
                <p className="text-[11px] text-muted-foreground">Shown side by side, with no result claims added. Use only the customer's own photos with their permission.</p>
              </div>
            </details>
            <fieldset><legend className={adminLabel}>Show on</legend>
              <div className="flex flex-wrap gap-4">{testimonialPlacements.map((pl) => <label key={pl.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={placements.includes(pl.key)} onChange={() => togglePlace(pl.key)} /> {pl.label}</label>)}</div>
            </fieldset>
            {([["verified", "Review verified as genuine"], ["consent", "Customer gave permission to publish (incl. photo/video)"], ["published", "Show on storefront"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm"><span>{l}</span><Switch checked={draft[k]} onCheckedChange={(v) => up({ [k]: v })} /></label>
            ))}
            <Button className="w-full" onClick={save}>{editing ? "Save changes" : "Save story"}</Button>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[380px_1fr]">
        <Panel title="Customer photo stories">
          <ul className="space-y-3">
            {photoStories.map((st) => (
              <li key={st.id} className="flex items-center gap-3 rounded-md bg-secondary/60 p-3">
                <div className="flex gap-1">{st.photos.map((ph) => <img key={ph.label} src={ph.src} alt="" className="h-14 w-9 rounded object-cover" />)}</div>
                <div className="min-w-0 flex-1 text-sm"><p className="font-semibold">{st.city} · {st.photos.length} photos</p><p className="text-[11px] text-muted-foreground">{st.source}</p></div>
                <label className="flex items-center gap-2 text-xs">{isPublicMedia(st) ? "Live" : "Hidden"}<Switch checked={st.published} onCheckedChange={(v) => customerMediaService.setPhotoPublished(st.id, v)} aria-label={`Show ${st.city} photo story`} /></label>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`Customer videos (${videos.filter(isPublicMedia).length}/${videos.length} live)`}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {videos.map((v, i) => (
              <li key={v.id} className="overflow-hidden rounded-md bg-secondary/60">
                <video src={v.src} poster={v.poster} controls preload="none" playsInline className="aspect-[9/16] w-full bg-primary object-cover" aria-label={`Preview ${v.title} ${i + 1}`} />
                <label className="flex items-center justify-between gap-2 p-2 text-[11px]"><span className="truncate">{v.title}</span><Switch checked={v.published} onCheckedChange={(on) => customerMediaService.setVideoPublished(v.id, on)} aria-label={`Show ${v.title} ${i + 1} on storefront`} /></label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">Migrated from beingyoualways.com, where they are already public. Shown on the homepage and Explore by Concern. Visibility is saved in this browser.</p>
        </Panel>
      </div>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete the story from ${del?.name ?? ""}?`} confirmLabel="Delete"
        description="It will be removed from the storefront and this list." onConfirm={() => { if (del) { testimonialService.remove(del.id); if (draft.id === del.id) setDraft(blank()); toast("Story deleted"); } }} />
    </AdminPage>
  );
}
