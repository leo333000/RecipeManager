// Small HTTP helpers shared by every route.

export const MAX_BODY_BYTES = 6_000_000;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code, message) => new HttpError(400, code, message);
export const notFound = (what) => new HttpError(404, 'not_found', `${what} not found`);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function noContent(headers = {}) {
  return new Response(null, { status: 204, headers });
}

export function errorBody(code, message) {
  return { error: { code, message } };
}

/** Reads a JSON object body. Rejects other content types, bad JSON and bodies over the size limit. */
export async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'The request is too large');

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new HttpError(415, 'unsupported_type', 'Send the request as JSON');
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw badRequest('bad_json', 'The request body is not valid JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw badRequest('bad_json', 'The request body must be a JSON object');
  }
  return data;
}

/** Parses a route parameter that must be a positive whole number. */
export function readPositiveInt(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw badRequest('bad_param', `${name} must be a positive whole number`);
  return number;
}
