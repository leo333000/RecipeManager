import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToText, stripTags } from '../../../backend/lib/html.js';

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Fish &amp; chips &#39;n&#x27; &frac12; cup &unknown;')).toBe("Fish & chips 'n' ½ cup &unknown;");
  });
});

describe('stripTags', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripTags('<p>Hello <b>there</b></p>\n\n')).toBe('Hello there');
  });
});

describe('htmlToText (spec 07 AC-4)', () => {
  const html = `
    <html><head><style>body{}</style><script>alert('x')</script></head>
    <body>
      <nav>Home | Recipes</nav>
      <h1>Lentil soup</h1>
      <ul><li>200 g lentils</li><li>1 onion</li></ul>
      <p>Simmer for 30 minutes.</p>
      <footer>© 2026</footer>
    </body></html>`;

  it('keeps visible content, one block per line', () => {
    expect(htmlToText(html)).toBe('Lentil soup\n- 200 g lentils\n- 1 onion\nSimmer for 30 minutes.');
  });

  it('drops scripts, styles, navigation and footers', () => {
    const text = htmlToText(html);
    expect(text).not.toMatch(/alert|body\{\}|Home|©/);
  });

  it('truncates to the character limit', () => {
    expect(htmlToText(`<p>${'a'.repeat(100)}</p>`, 10)).toHaveLength(10);
  });
});
