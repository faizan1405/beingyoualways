import { ArrowLeft, ArrowRight, Eye, ImagePlus, Loader2, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ProductVisual } from "@/components/shop/ProductVisual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { checkImageFile, fileToDemoImage } from "@/lib/image-upload";
import { isBackendConfigured } from "@/services/api";
import { adminContent } from "@/services/adminContentService";
import { absoluteMediaUrl } from "@/services/liveStories";
import { infographicImages, movedImage, originalImages, slotLabel, withExtraImage, withImageAt, withoutImageAt } from "@/lib/product-images";
import type { Product } from "@/lib/types";

/** The server's own file URLs look like …/api/media/<id> — the id lets us archive the file. */
const serverMediaId = (src: string): string | null => /\/api\/media\/([A-Za-z0-9_-]+)$/.exec(src)?.[1] ?? null;

/**
 * Four-slide gallery manager (Product photo · Who is it for? · What's inside? · How to use).
 * Only the image list changes — never the product's id, prices or sizes.
 * Demo: uploads are resized data URLs kept in this browser. Live (serverProductId set): files
 * upload to the server's storage, the product keeps the file's URL, and removed files are
 * archived on the server (hidden everywhere, bytes kept until purged).
 */
export function ProductImageManager({ product, onChange, serverProductId }: { product: Product; onChange: (images: string[]) => void; serverProductId?: string | undefined }) {
  const images = product.images ?? [];
  const file = useRef<HTMLInputElement>(null);
  const target = useRef<number | null>(null); // slot being replaced; null = add new
  const [view, setView] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const slides = infographicImages(product.slug);
  const originals = originalImages(product.slug);
  const live = isBackendConfigured();

  const pick = (slot: number | null) => { target.current = slot; file.current?.click(); };

  const archiveQuietly = (src: string | undefined) => {
    const id = src ? serverMediaId(src) : null;
    if (id) adminContent.archiveMedia(id).catch(() => toast.error("The old file couldn't be hidden on the server — it's unused but still stored."));
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const slot = target.current;
    if (live) {
      if (!serverProductId) { toast.error("Save the product first — then its photos can be uploaded to the server."); return; }
      const bad = checkImageFile(f); if (bad) { toast.error(bad); return; }
      setProgress(0);
      try {
        const media = await adminContent.uploadMedia(f, { kind: "PRODUCT_IMAGE", productId: serverProductId, alt: `${product.name} — ${slotLabel(slot ?? images.length)}`, position: slot ?? images.length }, setProgress);
        const url = absoluteMediaUrl(media.url);
        const old = slot == null ? undefined : images[slot];
        onChange(slot == null ? withExtraImage(images, url) : withImageAt(images, slot, url));
        archiveQuietly(old);
        toast.success(slot == null ? "Photo uploaded to the server — press Save changes to keep it" : `${slotLabel(slot)} replaced — press Save changes to keep it`);
      } catch (e) { toast.error(e instanceof Error ? e.message : "The upload failed."); }
      finally { setProgress(null); }
      return;
    }
    const bad = checkImageFile(f); if (bad) { toast.error(bad); return; }
    try {
      const src = await fileToDemoImage(f);
      onChange(slot == null ? withExtraImage(images, src) : withImageAt(images, slot, src));
      toast(slot == null ? "Photo added — press Save changes to keep it" : `${slotLabel(slot)} replaced — press Save changes to keep it`);
    } catch { toast.error("That image couldn't be read — try a JPG or PNG."); }
  };

  const removeAt = (i: number) => {
    if (live) archiveQuietly(images[i]);
    onChange(withoutImageAt(images, i));
  };

  return (
    <div>
      <input ref={file} type="file" accept="image/*" className="sr-only" aria-label="Choose an image" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void onFile(f); }} />
      {images.length === 0 ? (
        <ProductVisual shape={product.shape} tint={product.tint} label={product.name || "New product"} className="rounded-md" />
      ) : (
        <ol className="grid grid-cols-2 gap-3">
          {images.map((src, i) => (
            <li key={`${i}-${src.slice(-24)}`} className={`overflow-hidden rounded-md border ${i === 0 ? "border-primary" : "border-border"} bg-card`}>
              <button type="button" onClick={() => setView(i)} className="group relative block w-full" aria-label={`Preview ${slotLabel(i)}`}>
                <img src={src} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                <span className="absolute inset-0 grid place-items-center bg-foreground/0 opacity-0 transition group-hover:bg-foreground/20 group-hover:opacity-100"><Eye className="size-5 text-background" /></span>
              </button>
              <div className="p-2">
                <p className="truncate text-[11px] font-semibold"><span className="text-muted-foreground">{i + 1}.</span> {slotLabel(i)}</p>
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex">
                    <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} aria-label={`Move ${slotLabel(i)} earlier`} onClick={() => onChange(movedImage(images, i, i - 1))}><ArrowLeft className="size-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === images.length - 1} aria-label={`Move ${slotLabel(i)} later`} onClick={() => onChange(movedImage(images, i, i + 1))}><ArrowRight className="size-3.5" /></Button>
                  </div>
                  <div className="flex">
                    <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Replace ${slotLabel(i)}`} onClick={() => pick(i)}><RefreshCw className="size-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-7" disabled={images.length === 1} aria-label={`Remove ${slotLabel(i)}`} onClick={() => removeAt(i)}><Trash2 className="size-3.5 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {progress != null && (
        <div className="mt-3" role="status" aria-label="Upload progress">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Uploading to the server… {progress}%</p>
        </div>
      )}
      <div className="mt-3 grid gap-2">
        <Button type="button" variant="outline" size="sm" disabled={progress != null} onClick={() => pick(null)}><Upload /> Upload new photo</Button>
        {slides.length === 4 && !slides.every((x, i) => images[i] === x) && (
          <Button type="button" variant="outline" size="sm" onClick={() => { onChange([...slides]); toast("Original four slides restored — press Save changes to keep them"); }}><RotateCcw /> Restore the original four slides</Button>
        )}
        {originals.length > 0 && !originals.every((x, i) => images[i] === x) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { onChange([...originals]); toast("Original website photos restored — press Save changes to keep them"); }}><ImagePlus /> Use original website photos</Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {live
          ? "The first photo is the shop card and main image. Uploads go to the server's storage; removed files are hidden, not erased."
          : "The first photo is the shop card and main image. Demo: uploads stay in this browser until media storage is connected."}
      </p>
      <Dialog open={view != null} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-xl p-3">
          <DialogTitle className="px-2 pt-1 text-sm font-semibold">{view != null ? `${view + 1}. ${slotLabel(view)}` : "Preview"}</DialogTitle>
          {view != null && images[view] && <img src={images[view]} alt={slotLabel(view)} className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
