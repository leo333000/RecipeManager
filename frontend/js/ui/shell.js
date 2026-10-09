// Main navigation: a top bar on wide screens, a bottom bar on phones (see app.css).

import { h } from '../dom.js';

const NAV_ITEMS = [
  { path: '/recipes', label: 'Recipes', glyph: '≡', match: ['recipes'] },
  { path: '/meals', label: 'Meals', glyph: '▦', match: ['meals'] },
  { path: '/add', label: 'Add', glyph: '+', match: ['add', 'new', 'import'] },
  { path: '/pantry', label: 'Pantry', glyph: '◫', match: ['pantry'] },
  { path: '/ideas', label: 'Ideas', glyph: '✦', match: ['ideas'] },
];

export function renderNav(nav) {
  nav.replaceChildren(
    ...NAV_ITEMS.map((item) =>
      h('a', { href: `#${item.path}`, dataset: { section: item.match.join(' ') } },
        h('span', { class: 'glyph', 'aria-hidden': 'true', text: item.glyph }),
        h('span', { text: item.label }),
      ),
    ),
  );
}

export function updateNav(nav, path, visible) {
  nav.hidden = !visible;
  const section = path.split('/')[1] ?? '';
  for (const link of nav.querySelectorAll('a')) {
    if (link.dataset.section.split(' ').includes(section)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}
