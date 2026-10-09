// Downloads a web page for import: public URLs only (checked again on every
// redirect), a time limit, and a size cap.

import { HttpError } from '../http.js';
import { checkPublicUrl } from './urlGuard.js';

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_PAGE_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;

const fetchFailed = (message) => new HttpError(502, 'fetch_failed', message);

async function readLimited(response, maxBytes) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

/** Returns { html, url } where url is the final address after redirects. */
export async function fetchPage(rawUrl, fetchImpl = fetch) {
  let url = checkPublicUrl(rawUrl);
  if (!url) throw new HttpError(400, 'bad_url', 'Enter a full public web address starting with https://');

  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response;
    try {
      response = await fetchImpl(url.href, {
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LeosRecipes/1.0; recipe import)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch {
      throw fetchFailed('The page could not be loaded. Check the address or try again.');
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = checkPublicUrl(new URL(response.headers.get('location'), url).href);
      if (!url) throw fetchFailed('The page redirected to an address that cannot be imported.');
      continue;
    }
    if (!response.ok) throw fetchFailed(`The site answered with an error (${response.status}).`);
    return { html: await readLimited(response, MAX_PAGE_BYTES), url: url.href };
  }
  throw fetchFailed('The page redirected too many times.');
}
