import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import story1 from "@/assets/testimonials/story-1.webp";
import story2 from "@/assets/testimonials/story-2.webp";
import story3 from "@/assets/testimonials/story-3.webp";
import resultBefore from "@/assets/testimonials/result-before.webp";
import resultAfter from "@/assets/testimonials/result-after.webp";
import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isPublic, testimonialCategories, testimonialService, type Testimonial, type TestimonialCategory } from "@/services/testimonialService";

export const Route = createFileRoute("/admin/testimonials")({ component: Testimonials });

/** Client-supplied photos — shown here only; not public until permission is confirmed. */
const uploadedPhotos = [
  { src: story1, label: "Customer photo 1" },
  { src: story2, label: "Customer photo 2" },
  { src: story3, label: "Customer photo 3" },
  { src: resultBefore, label: "Before/after — left" },
  { src: resultAfter, label: "Before/after — right" },
];

const blank = (): Testimonial => ({ id: `t${Date.now()}`, category: "Skin", name: "", city: "", quote: "", verified: false, consent: false, published: false });

function Testimonials() {
  const list = useSyncExternalStore(testimonialService.subscribe, testimonialService.all, testimonialService.all);
  const [draft, setDraft] = useState<Testimonial>(blank);
  const up = (patch: Partial<Testimonial>) => setDraft({ ...draft, ...patch });

  const save = () => {
    if (!draft.name.trim() || !draft.quote.trim()) { toast.error("Add the customer's name and their exact words."); return; }
    if (draft.published && !(draft.verified && draft.consent)) { toast.error("A review can only be published once it is verified and the customer has given permission."); return; }
    testimonialService.save(draft);
    toast.success(isPublic(draft) ? "Saved — now visible on the homepage (demo, resets on reload)." : "Saved as draft — not shown publicly.");
    setDraft(blank());
  };

  return (
    <AdminPage title="Customer stories" subtitle="Add genuine, permission-cleared reviews. Only verified + consented + published entries appear on the storefront. Demo storage — resets on reload.">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel title={`Stories (${list.length})`}>
          {list.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Placeholder — no real reviews yet</p>
              <p className="mt-1">The storefront shows "Verified stories coming soon" in each category until you add one here.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((t) => (
                <li key={t.id} className="flex gap-3 rounded-md bg-secondary/60 p-3">
                  {t.photo && <img src={t.photo} alt="" className="size-14 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{t.name} <span className="font-normal text-muted-foreground">· {t.category}</span></p>
                    <p className="truncate text-sm text-muted-foreground">“{t.quote}”</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider">{isPublic(t) ? <span className="text-primary">Live</span> : <span className="text-muted-foreground">Draft · {[!t.verified && "not verified", !t.consent && "no consent", !t.published && "unpublished"].filter(Boolean).join(", ")}</span>}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => setDraft(t)}>Edit</Button>
                    <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => testimonialService.remove(t.id)}><Trash2 /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Add / edit story" action={<Button size="sm" variant="outline" onClick={() => setDraft(blank())}><Plus /> New</Button>}>
          <div className="space-y-3">
            <div><label className={adminLabel} htmlFor="t-cat">Category</label>
              <select id="t-cat" className={adminInput} value={draft.category} onChange={(e) => up({ category: e.target.value as TestimonialCategory })}>
                {testimonialCategories.map((c) => <option key={c}>{c}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={adminLabel} htmlFor="t-name">Customer name</label><input id="t-name" className={adminInput} value={draft.name} onChange={(e) => up({ name: e.target.value })} /></div>
              <div><label className={adminLabel} htmlFor="t-city">City</label><input id="t-city" className={adminInput} value={draft.city} onChange={(e) => up({ city: e.target.value })} /></div>
            </div>
            <div><label className={adminLabel} htmlFor="t-quote">Their exact words</label><textarea id="t-quote" rows={4} className={adminInput} value={draft.quote} onChange={(e) => up({ quote: e.target.value })} /></div>
            <div><label className={adminLabel} htmlFor="t-rating">Rating given by customer (optional)</label>
              <select id="t-rating" className={adminInput} value={draft.rating ?? ""} onChange={(e) => up({ rating: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">No rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
              </select></div>
            <div>
              <p className={adminLabel}>Photo (only with written permission)</p>
              <div className="mt-1 grid grid-cols-6 gap-2">
                <button type="button" onClick={() => up({ photo: undefined })} className={`aspect-square rounded border text-[10px] ${!draft.photo ? "border-primary ring-2 ring-primary" : "border-border"}`}>None</button>
                {uploadedPhotos.map((p) => (
                  <button key={p.label} type="button" title={p.label} onClick={() => up({ photo: p.src })} className={`overflow-hidden rounded border ${draft.photo === p.src ? "border-primary ring-2 ring-primary" : "border-border"}`}>
                    <img src={p.src} alt={p.label} className="aspect-square w-full object-cover object-top" />
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Uploaded client photos · permission pending</p>
            </div>
            {([["verified", "Review verified as genuine"], ["consent", "Customer gave permission to publish (incl. photo)"], ["published", "Show on storefront"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm"><span>{l}</span><Switch checked={draft[k]} onCheckedChange={(v) => up({ [k]: v })} /></label>
            ))}
            <Button className="w-full" onClick={save}>Save story</Button>
          </div>
        </Panel>
      </div>
    </AdminPage>
  );
}
