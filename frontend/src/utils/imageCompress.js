export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_LOGO_INPUT_BYTES = 2 * 1024 * 1024; 

export function fileToCompressedDataUrl(file, maxSize = 192) {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return reject(new Error("Please choose a PNG, JPG or WEBP image."));
    }
    if (file.size > MAX_LOGO_INPUT_BYTES) {
      return reject(new Error("Image is too large. Please choose one under 2MB."));
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);

      let dataUrl = canvas.toDataURL("image/webp", 0.9);
      if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/png");

      if (dataUrl.length > 300000) return reject(new Error("Image is still too large after resizing. Try a simpler logo."));
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}
