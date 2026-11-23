import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ExternalLink, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { collections } from "@/components/home/HomeSections";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAllProducts, useDemoStore } from "@/hooks/use-demo-store";
import { homeCategoryGroups } from "@/lib/concerns";
import { checkImageFile, fileToDemoImage } from "@/lib/image-upload";
import { HOME_SECTIONS, PROMO_LINKS, contentService, contentStore, type PromoLink, type SiteContent } from "@/services/contentService";
import { productService } from "@/services/productService";

export const Route = createFileRoute("/admin/content")({
  head: () => ({
    meta: [
      { title: "Website Content (Demo) | Being You – Always Admin" },
      { name: "description", content: "Edit homepage sections, About Us, contact details and FAQs (demo)." },
      { property: "og:title", content: "Website Content | Being You – Always Admin" },
      { property: "og:description", content: "Storefront content manager (demo)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ContentAdmin,
});

const ta = `${adminInput} h-auto py-2`;
const swap = <T,>(list: T[], i: number, d: -1 | 1) => { const o = [...list]; const [x] = o.splice(i, 1); o.splice(i + d, 0, x!); return o; };

function ContentAdmin() {
  const saved = useDemoStore(contentStore);
  const [c, setC] = useState<SiteContent>(saved);
  useEffect(() => { setC(saved); }, [saved]);
  const [restoring, setRestoring] = useState(false);
  const products = useAllProducts().filter((p) => p.status === "active");
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);
  const set = <K extends keyof SiteContent>(k: K, v: SiteContent[K]) => setC({ ...c, [k]: v });
  const order = c.categoryOrder.filter((k) => homeCategoryGroups.some((g) => g.key === k)).concat(homeCategoryGroups.map((g) => g.key).filter((k) => !c.categoryOrder.includes(k)));

  const save = () => { try { contentService.save(c); toast.success("Content saved — open the storefront to see it (this browser)."); } catch (e) { toast.error((e as Error).message); } };

  return (
    <AdminPage title="Website content" subtitle="Edit storefront text and homepage sections. Saved in this browser and shown on the storefront here; layout and design stay the same. Legal policies aren't edited here."
      actions={<div className="flex flex-wrap gap-2">
        <Button variant="luxOutline" size="xl" asChild><Link to="/" target="_blank"><ExternalLink /> Preview storefront</Link></Button>
        <Button variant="lux" size="xl" disabled={!dirty} onClick={save}>Save content</Button>
      </div>}>
      {dirty && <p role="status" className="rounded-md bg-accent/15 px-3 py-2 text-xs">You have unsaved changes. <button type="button" className="underline" onClick={() => setC(saved)}>Discard</button></p>}
      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <Panel title="Homepage announcement">
          <label className="flex items-center justify-between text-sm">Show a slim announcement line above the header <Switch checked={c.announcement.enabled} onCheckedChange={(v) => set("announcement", { ...c.announcement, enabled: v })} aria-label="Show announcement" /></label>
          <label htmlFor="an" className={`${adminLabel} mt-3`}>Text</label>
          <input id="an" maxLength={120} className={adminInput} value={c.announcement.text} placeholder="e.g. New hair care launches this week" onChange={(e) => set("announcement", { ...c.announcement, text: e.target.value })} />
          <p className="mt-1 text-[11px] text-muted-foreground">Off by default — the client asked for the old top strip to be removed. Don't announce offers or shipping rules that aren't confirmed.</p>
        </Panel>

        <Panel title="Promotional banner">
          <label className="flex items-center justify-between text-sm">Show below the homepage hero <Switch checked={c.promo.enabled} onCheckedChange={(v) => set("promo", { ...c.promo, enabled: v })} aria-label="Show promotional banner" /></label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="ph" className={adminLabel}>Heading</label><input id="ph" maxLength={70} className={adminInput} value={c.promo.heading} onChange={(e) => set("promo", { ...c.promo, heading: e.target.value })} /></div>
            <div className="sm:col-span-2"><label htmlFor="pt" className={adminLabel}>Text</label><textarea id="pt" rows={2} maxLength={200} className={ta} value={c.promo.text} onChange={(e) => set("promo", { ...c.promo, text: e.target.value })} /></div>
            <div><label htmlFor="pl" className={adminLabel}>Button goes to</label><select id="pl" className={adminInput} value={c.promo.linkTo} onChange={(e) => set("promo", { ...c.promo, linkTo: e.target.value as PromoLink })}>{PROMO_LINKS.map((l) => <option key={l.to} value={l.to}>{l.label}</option>)}</select></div>
            <div><label htmlFor="pb" className={adminLabel}>Button label</label><input id="pb" maxLength={24} className={adminInput} value={c.promo.linkLabel} onChange={(e) => set("promo", { ...c.promo, linkLabel: e.target.value })} /></div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {c.promo.image ? <img src={c.promo.image} alt="Promotional banner" className="h-16 w-28 rounded object-cover" /> : <div className="grid h-16 w-28 place-items-center rounded border border-dashed border-input text-[10px] text-muted-foreground">No image</div>}
            <label htmlFor="pi" className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs hover:border-primary"><Upload className="size-3.5" /> Upload promotional image</label>
            <input id="pi" type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const bad = checkImageFile(f); if (bad) { toast.error(bad); return; } try { set("promo", { ...c.promo, image: await fileToDemoImage(f, 1400) }); } catch { toast.error("That image couldn't be read."); } }} />
            {c.promo.image && <Button type="button" variant="ghost" size="sm" onClick={() => set("promo", { ...c.promo, image: null })}>Remove</Button>}
          </div>
        </Panel>

        <Panel title="Homepage sections">
          <p className="mb-3 text-xs text-muted-foreground">Hide a section without deleting it. The hero is always shown.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {HOME_SECTIONS.map((s) => <li key={s.key}><label className="flex items-center justify-between gap-3 rounded-md bg-secondary/60 px-3 py-2 text-sm">{s.label}<Switch checked={c.sections[s.key] !== false} onCheckedChange={(v) => set("sections", { ...c.sections, [s.key]: v })} aria-label={`Show ${s.label}`} /></label></li>)}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">Testimonial visibility: “Customer stories” and “Customer videos” switch whole sections. Individual stories are managed in <Link to="/admin/testimonials" className="underline">Customer stories</Link>.</p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Category display order (Shop by category)">
            <ol className="space-y-2">
              {order.map((k, i) => { const g = homeCategoryGroups.find((x) => x.key === k)!; return (
                <li key={k} className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm"><span><span className="mr-2 text-muted-foreground">{i + 1}.</span>{g.label}</span>
                  <span><Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move ${g.label} up`} disabled={i === 0} onClick={() => set("categoryOrder", swap(order, i, -1))}><ArrowUp className="size-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move ${g.label} down`} disabled={i === order.length - 1} onClick={() => set("categoryOrder", swap(order, i, 1))}><ArrowDown className="size-3.5" /></Button></span></li>
              ); })}
            </ol>
          </Panel>
          <Panel title="Featured collections">
            <ul className="space-y-2">
              {collections.map((col) => { const on = !c.hiddenCollections.includes(col.name); return (
                <li key={col.name}><label className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm">{col.name}<Switch checked={on} onCheckedChange={(v) => set("hiddenCollections", v ? c.hiddenCollections.filter((x) => x !== col.name) : [...c.hiddenCollections, col.name])} aria-label={`Show ${col.name} collection`} /></label></li>
              ); })}
            </ul>
          </Panel>
        </div>

        <Panel title="High Demand (Best Seller) selections">
          <p className="mb-3 text-xs text-muted-foreground">Changes here apply straight away (same switch as on the Products page).</p>
          <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {products.map((p) => <li key={p.id}><label className="flex items-center justify-between gap-2 rounded-md bg-secondary/60 px-3 py-2 text-sm"><span className="truncate">{p.name}</span><Switch checked={!!p.bestSeller} onCheckedChange={(on) => productService.setHighDemand(p.id, on).then(() => toast(on ? `${p.name} added to Best Seller` : `${p.name} removed from Best Seller`), (e: Error) => toast.error(e.message))} aria-label={`${p.name} in Best Seller`} /></label></li>)}
          </ul>
        </Panel>

        <Panel title="Contact information">
          <div className="space-y-2">
            {c.contact.phones.map((ph, i) => (
              <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-2">
                <input aria-label={`Label for number ${i + 1}`} className={adminInput} value={ph.label} onChange={(e) => set("contact", { ...c.contact, phones: c.contact.phones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <input aria-label={`Phone number ${i + 1}`} className={adminInput} value={ph.display} onChange={(e) => set("contact", { ...c.contact, phones: c.contact.phones.map((x, j) => (j === i ? { ...x, display: e.target.value } : x)) })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove number" disabled={c.contact.phones.length === 1} onClick={() => set("contact", { ...c.contact, phones: c.contact.phones.filter((_, j) => j !== i) })}><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => set("contact", { ...c.contact, phones: [...c.contact.phones, { label: "Other", display: "", tel: "" }] })}><Plus /> Add number</Button>
          </div>
          <label htmlFor="ce" className={`${adminLabel} mt-3`}>Email</label><input id="ce" type="email" className={adminInput} value={c.contact.email} onChange={(e) => set("contact", { ...c.contact, email: e.target.value })} />
          <label htmlFor="ca" className={`${adminLabel} mt-3`}>Business address (one line each)</label><textarea id="ca" rows={3} className={ta} value={c.contact.addressLines.join("\n")} onChange={(e) => set("contact", { ...c.contact, addressLines: e.target.value.split("\n") })} />
          <p className="mt-1 text-[11px] text-muted-foreground">Used in the footer, Contact page, homepage and policy pages. Only enter details the client has confirmed.</p>
        </Panel>

        <Panel title="About Us">
          <label htmlFor="as" className={adminLabel}>Story (blank line between paragraphs; the first is the intro)</label>
          <textarea id="as" rows={7} className={ta} value={c.about.story.join("\n\n")} onChange={(e) => set("about", { ...c.about, story: e.target.value.split(/\n\s*\n/) })} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="am" className={adminLabel}>Mission</label><textarea id="am" rows={3} className={ta} value={c.about.mission} onChange={(e) => set("about", { ...c.about, mission: e.target.value })} /></div>
            <div><label htmlFor="av" className={adminLabel}>Vision</label><textarea id="av" rows={3} className={ta} value={c.about.vision} onChange={(e) => set("about", { ...c.about, vision: e.target.value })} /></div>
          </div>
          <label htmlFor="ag" className={`${adminLabel} mt-3`}>Sign-off line</label><input id="ag" className={adminInput} value={c.about.signoff} onChange={(e) => set("about", { ...c.about, signoff: e.target.value })} />
        </Panel>

        <Panel title={`FAQs (${c.faqs.length})`} className="xl:col-span-2" action={<Button type="button" size="sm" variant="outline" onClick={() => set("faqs", [...c.faqs, { q: "", a: "" }])}><Plus /> Add question</Button>}>
          <ol className="space-y-3">
            {c.faqs.map((f, i) => (
              <li key={i} className="grid gap-2 rounded-md bg-secondary/60 p-3 sm:grid-cols-[1fr_1.4fr_auto]">
                <input aria-label={`Question ${i + 1}`} className={adminInput} value={f.q} placeholder="Question" onChange={(e) => set("faqs", c.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                <textarea aria-label={`Answer ${i + 1}`} rows={2} className={ta} value={f.a} placeholder="Answer" onChange={(e) => set("faqs", c.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                <div className="flex gap-1 sm:flex-col">
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Move up" disabled={i === 0} onClick={() => set("faqs", swap(c.faqs, i, -1))}><ArrowUp className="size-3.5" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Move down" disabled={i === c.faqs.length - 1} onClick={() => set("faqs", swap(c.faqs, i, 1))}><ArrowDown className="size-3.5" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Remove question" onClick={() => set("faqs", c.faqs.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-muted-foreground">The homepage shows the first four. Keep answers provisional until shipping, COD and return rules are confirmed.</p>
        </Panel>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="lux" size="xl" disabled={!dirty} onClick={save}>Save content</Button>
        <Button variant="ghost" onClick={() => setRestoring(true)}><RotateCcw /> Restore original content</Button>
      </div>
      <ConfirmDialog open={restoring} onOpenChange={setRestoring} title="Restore the original content?" confirmLabel="Restore" description="All content edits saved in this browser are discarded and the verified original text comes back." onConfirm={() => { contentStore.reset(); toast("Original content restored"); }} />
    </AdminPage>
  );
}
