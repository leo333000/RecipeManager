import { describe, expect, it } from 'vitest';
import { checkPublicUrl } from '../../../backend/lib/urlGuard.js';

describe('checkPublicUrl (spec 07 AC-1)', () => {
  it.each([
    'https://www.bbcgoodfood.com/recipes/x',
    'http://example.com/recipe',
    'https://example.com:443/a',
    'https://8.8.8.8/recipe',
  ])('accepts %s', (url) => {
    expect(checkPublicUrl(url)).toBeInstanceOf(URL);
  });

  it.each([
    'http://localhost/x',
    'http://localhost:8888/x',
    'http://127.0.0.1/x',
    'http://2130706433/',
    'http://10.0.0.5/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://printer.local/',
    'http://db.internal/',
    'http://intranet/',
    'ftp://example.com/x',
    'javascript:alert(1)',
    'https://user:pass@example.com/',
    'https://example.com:8080/',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(checkPublicUrl(url)).toBeNull();
  });
});
