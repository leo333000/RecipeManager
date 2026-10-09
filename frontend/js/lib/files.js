// Preparing files for upload. Photos are shrunk in the browser so they fit
// the server's 6 MB request limit and Claude's preferred image size.

export const PHOTO_MAX_EDGE = 1568;
export const PDF_MAX_BYTES = 4_000_000;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`"${file.name}" could not be read as an image`));
    };
    image.src = url;
  });
}

/** Resizes a photo to at most `maxEdge` px and returns { data (base64 JPEG), mediaType, previewUrl }. */
export async function preparePhoto(file, maxEdge = PHOTO_MAX_EDGE) {
  const image = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { data: previewUrl.split(',')[1], mediaType: 'image/jpeg', previewUrl };
}

/** Reads any file as base64 (without the data: prefix). */
export function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error(`"${file.name}" could not be read`));
    reader.readAsDataURL(file);
  });
}
