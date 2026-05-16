export async function prepareImageForUpload(file, {
  maxDimension = 1200,
  quality = 0.86,
  maxBytes = 2.5 * 1024 * 1024,
  fallbackName = "stage-image.jpg",
} = {}) {
  if (!file || !file.type?.startsWith("image/")) return file;
  if (file.size <= maxBytes && !/heic|heif/i.test(file.type)) return file;

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read this image. Try another file."));
      img.src = imageUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    const name = String(file.name || fallbackName).replace(/\.[^.]+$/, "") || fallbackName.replace(/\.[^.]+$/, "");
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
