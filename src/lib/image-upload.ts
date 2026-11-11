// Demo-mode photo upload: shrinks the chosen file in the browser and returns a
// data URL the admin can assign to a product. Replace with a real upload to the
// Hostinger media endpoint once storage is connected.
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const DEMO_IMAGE_MAX_SIDE = 900;

export function checkImageFile(f: File): string | null {
  if (!f.type.startsWith("image/")) return "Please choose an image file (JPG, PNG or WebP).";
  if (f.size > MAX_UPLOAD_BYTES) return "That image is larger than 15 MB — please choose a smaller file.";
  return null;
}

export async function fileToDemoImage(f: File, maxSide = DEMO_IMAGE_MAX_SIDE): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL("image/webp", 0.82);
    return out.startsWith("data:image/webp") ? out : c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
