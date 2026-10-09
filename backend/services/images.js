// Uploaded images (review photos). Only common photo formats are accepted,
// checked by their first bytes as well as the declared type.

import { createId } from '../../shared/recipe.js';
import { badRequest, notFound } from '../http.js';

export const MAX_IMAGE_BYTES = 4_500_000;

const SIGNATURES = {
  'image/jpeg': (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
  'image/gif': (bytes) => bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46,
  'image/webp': (bytes) => bytes.slice(8, 12).toString('ascii') === 'WEBP',
};

export const IMAGE_TYPES = Object.keys(SIGNATURES);

/** Decodes a base64 image and checks its type and size. Returns a Buffer. */
export function decodeImage({ data, mediaType }) {
  if (!IMAGE_TYPES.includes(mediaType)) throw badRequest('bad_image', 'Use a JPEG, PNG, WebP or GIF image');
  if (typeof data !== 'string' || !data) throw badRequest('bad_image', 'The image is empty');

  const bytes = Buffer.from(data, 'base64');
  if (bytes.length === 0) throw badRequest('bad_image', 'The image is empty');
  if (bytes.length > MAX_IMAGE_BYTES) throw badRequest('bad_image', 'The image is larger than 4.5 MB');
  if (!SIGNATURES[mediaType](bytes)) throw badRequest('bad_image', 'The file is not a valid image');
  return bytes;
}

export function createImageService({ repos }) {
  async function save(input) {
    const bytes = decodeImage(input);
    const id = createId();
    await repos.images.save(id, bytes, input.mediaType);
    return id;
  }

  async function get(id) {
    const image = await repos.images.get(id);
    if (!image) throw notFound('Image');
    return { data: image.data, contentType: image.metadata?.contentType ?? 'application/octet-stream' };
  }

  return { save, get };
}
