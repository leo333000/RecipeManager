// Importing recipes from a web page, photos or a PDF. Every import returns a
// draft for the editor; nothing is saved until Leo presses Save.

import { fitToLimits, validateRecipe } from '../../shared/recipe.js';
import { badRequest, HttpError } from '../http.js';
import { fetchPage } from '../lib/fetchPage.js';
import { htmlToText } from '../lib/html.js';
import { findJsonLdRecipe, jsonLdToDraft } from '../lib/jsonld.js';
import { decodeImage } from './images.js';

export const IMPORT_LIMITS = { photos: 4, pdfBytes: 4_000_000 };

const noRecipe = () => new HttpError(422, 'no_recipe_found', 'No recipe was found in that content.');

/** Validates a draft Claude extracted. */
function extractedDraft(answer, source) {
  if (!answer.found) throw noRecipe();
  const { value, error } = validateRecipe({ ...fitToLimits(answer.recipe), source });
  if (error) throw new HttpError(422, 'ai_bad_output', `The recipe Claude read was not valid (${error}).`);
  if (value.ingredients.length === 0 && value.steps.length === 0) throw noRecipe();
  return value;
}

export function createImportService({ ai, fetch: fetchImpl }) {
  async function fromUrl(rawUrl) {
    const { html, url } = await fetchPage(rawUrl, fetchImpl);
    const source = { type: 'url', url };

    const node = findJsonLdRecipe(html);
    if (node) {
      const { value } = validateRecipe(jsonLdToDraft(node, url));
      if (value && value.ingredients.length > 0) return { draft: value, method: 'json-ld' };
    }

    const text = htmlToText(html);
    if (!text) throw noRecipe();
    return { draft: extractedDraft(await ai.extractFromText(text, url), source), method: 'ai' };
  }

  async function fromPhotos(images) {
    if (!Array.isArray(images) || images.length === 0) throw badRequest('bad_image', 'Add at least one photo');
    if (images.length > IMPORT_LIMITS.photos) throw badRequest('bad_image', `Use at most ${IMPORT_LIMITS.photos} photos`);
    images.forEach(decodeImage);
    return extractedDraft(await ai.extractFromImages(images), { type: 'photo', url: '' });
  }

  async function fromPdf(data) {
    if (typeof data !== 'string' || !data) throw badRequest('bad_pdf', 'Choose a PDF file');
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length > IMPORT_LIMITS.pdfBytes) throw badRequest('bad_pdf', 'The PDF is larger than 4 MB');
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw badRequest('bad_pdf', 'That file is not a PDF');
    return extractedDraft(await ai.extractFromPdf(data), { type: 'pdf', url: '' });
  }

  return { fromUrl, fromPhotos, fromPdf };
}
