import { ArrowLeft, ArrowRight, Eye, ImagePlus, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ProductVisual } from "@/components/shop/ProductVisual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { checkImageFile, fileToDemoImage } from "@/lib/image-upload";
import { infographicImages, movedImage, originalImages, slotLabel, withExtraImage, withImageAt, withoutImageAt } from "@/lib/product-images";
import type { Product } from "@/lib/types";

/**
 * Four-slide gallery manager (Product photo · Who is it for? · What's inside? · How to use).
 * Only the image list changes — never the product's id, prices or sizes. Uploads are resized
 * data URLs kept in this browser until the Hostinger media API is connected.
 */
export function ProductImageManager({ product, onChange }: { product: Product; onChange: (images: string[]) => void }) {
  const images = product.images ?? [];
  const file = useRef<HTMLInputElement>(null);
  const target = useRef<number | null>(null); // slot being replaced; null = add new
  const [view, setView] = useState<number | null>(null);
  const slides = infographicImages(product.slug);
  const originals = originalImages(product.slug);

  const pick = (slot: number | null) => { target.current = slot; file.current?.click(); };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const bad = checkImageFile(f); if (bad) { toast.error(bad); return; }
    try {
      const src = await fileToDemoImage(f);
      const slot = target.current;
      onChange(slot == null ? withExtraImage(images, src) : withImageAt(images, slot, src));
      toast(slot == null ? "Photo added — press Save changes to keep it" : `${slotLabel(slot)} replaced — press Save changes to keep it`);
    } catch { toast.error("That image couldn't be read — try a JPG or PNG."); }
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
                    <Button type="button" variant="ghost" size="icon" className="size-7" disabled={images.length === 1} aria-label={`Remove ${slotLabel(i)}`} onClick={() => onChange(withoutImageAt(images, i))}><Trash2 className="size-3.5 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 grid gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => pick(null)}><Upload /> Upload new photo</Button>
        {slides.length === 4 && !slides.every((x, i) => images[i] === x) && (
          <Button type="button" variant="outline" size="sm" onClick={() => { onChange([...slides]); toast("Original four slides restored — press Save changes to keep them"); }}><RotateCcw /> Restore the original four slides</Button>
        )}
        {originals.length > 0 && !originals.every((x, i) => images[i] === x) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { onChange([...originals]); toast("Original website photos restored — press Save changes to keep them"); }}><ImagePlus /> Use original website photos</Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">The first photo is the shop card and main image. Demo: uploads stay in this browser until media storage is connected.</p>
      <Dialog open={view != null} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-xl p-3">
          <DialogTitle className="px-2 pt-1 text-sm font-semibold">{view != null ? `${view + 1}. ${slotLabel(view)}` : "Preview"}</DialogTitle>
          {view != null && images[view] && <img src={images[view]} alt={slotLabel(view)} className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
