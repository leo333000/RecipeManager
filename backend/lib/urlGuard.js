// Only lets the URL importer fetch public web pages (no local or private network addresses).

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

function isPrivateIPv4(host) {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Returns the parsed URL when it is a public http(s) address, otherwise null. */
export function checkPublicUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '80' && url.port !== '443') return null;

  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost') return null;
  if (host.startsWith('[')) return null; // IPv6 literal
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null;
  if (/^[\d.]+$/.test(host) && isPrivateIPv4(host)) return null;
  return url;
}
