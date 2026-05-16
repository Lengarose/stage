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

    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
    let width = Math.max(1, Math.round(originalWidth * scale));
    let height = Math.max(1, Math.round(originalHeight * scale));
    let nextQuality = quality;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    let blob = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", nextQuality));
      if (!blob || blob.size <= maxBytes) break;
      if (nextQuality > 0.68) {
        nextQuality -= 0.08;
      } else {
        width = Math.max(1, Math.round(width * 0.85));
        height = Math.max(1, Math.round(height * 0.85));
      }
    }

    if (!blob) return file;
    const name = String(file.name || fallbackName).replace(/\.[^.]+$/, "") || fallbackName.replace(/\.[^.]+$/, "");
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
