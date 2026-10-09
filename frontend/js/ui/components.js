// Small reusable pieces of UI.

import { append, h } from '../dom.js';
import { starText } from '../lib/format.js';

export function button(label, { variant = '', size = '', onclick, type = 'button', disabled, title, ariaLabel } = {}) {
  const classes = ['btn', variant, size].filter(Boolean).join(' ');
  return h('button', { class: classes, type, onclick, disabled, title, 'aria-label': ariaLabel }, label);
}

export function linkButton(label, href, { variant = '', size = '' } = {}) {
  return h('a', { class: ['btn', variant, size].filter(Boolean).join(' '), href }, label);
}

export function backLink(href, label = 'Back') {
  return h('a', { class: 'back', href }, `← ${label}`);
}

export function pageHead(title, ...actions) {
  return h('div', { class: 'page-head' }, h('h1', { text: title }), actions.length ? h('div', { class: 'actions' }, actions) : null);
}

export function sectionTitle(text) {
  return h('h2', { class: 'section-title', text });
}

export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { text: label }), control, hint ? h('span', { class: 'hint', text: hint }) : null);
}

/** A collapsible section. `content` can be a node, a list of nodes, or a function called on first open. */
export function toggle(summary, content, { open = false, variant = 'toggle' } = {}) {
  const body = h('div', { class: 'toggle-body' });
  const details = h('details', { class: variant, open }, h('summary', {}, summary), body);
  let rendered = false;
  const render = () => {
    if (rendered) return;
    rendered = true;
    append(body, typeof content === 'function' ? content() : content);
  };
  if (open) render();
  details.addEventListener('toggle', () => details.open && render());
  return details;
}

/** "More" dropdown. items: [{ label, onclick, danger, disabled }] */
export function moreMenu(items, label = 'More') {
  const list = h('div', { class: 'menu-list', role: 'menu' });
  const menu = h('details', { class: 'menu' }, h('summary', { class: 'btn', 'aria-haspopup': 'menu' }, label), list);

  for (const item of items.filter(Boolean)) {
    list.append(
      h('button', {
        type: 'button',
        role: 'menuitem',
        class: item.danger ? 'danger' : '',
        disabled: item.disabled,
        title: item.title,
        onclick: () => {
          menu.open = false;
          item.onclick();
        },
      }, item.label),
    );
  }

  const closeOnOutside = (event) => {
    if (!menu.isConnected) document.removeEventListener('click', closeOnOutside);
    else if (menu.open && !menu.contains(event.target)) menu.open = false;
  };
  document.addEventListener('click', closeOnOutside);
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  return menu;
}

export function chip(text, { onremove, removeLabel } = {}) {
  return h(
    'span',
    { class: 'chip' },
    text,
    onremove ? h('button', { type: 'button', class: 'remove', 'aria-label': removeLabel ?? `Remove ${text}`, onclick: onremove }, '×') : null,
  );
}

export function toggleChip(text, pressed, onclick) {
  return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pressed), onclick }, text);
}

export function stars(rating) {
  return h('span', { class: 'stars', 'aria-label': `${rating} out of 5 stars`, text: starText(rating) });
}

/** Keyboard-accessible 1-5 star radio group. Read the value with `form.elements[name].value`. */
export function starInput(name, value = 0) {
  const group = h('fieldset', { class: 'star-input' }, h('legend', { class: 'visually-hidden', text: 'Rating' }));
  // Reverse order lets CSS highlight the chosen star and every star before it.
  for (let rating = 5; rating >= 1; rating -= 1) {
    const id = `${name}-${rating}`;
    group.append(
      h('input', { type: 'radio', name, id, value: String(rating), checked: rating === value, required: rating === 5 }),
      h('label', { for: id, title: `${rating} star${rating > 1 ? 's' : ''}` }, '★', h('span', { class: 'visually-hidden', text: `${rating} stars` })),
    );
  }
  return group;
}

export function emptyState(message, ...actions) {
  return h('div', { class: 'empty' }, h('p', { text: message }), actions.length ? h('div', { class: 'button-row' }, actions) : null);
}

export function errorBox(error, onretry) {
  return h(
    'div',
    { class: 'error-box', role: 'alert' },
    h('span', { text: error?.message ?? String(error) }),
    onretry ? button('Try again', { size: 'small', onclick: onretry }) : null,
  );
}

export function loading(text = 'Loading…') {
  return h('div', { class: 'loading', role: 'status' }, h('div', { class: 'loading-bar' }), h('span', { text }));
}

export const AI_WAIT_TEXT = 'Claude is working… this can take up to a minute.';

/** Tabs: [{ id, label, render: () => Node }]. Returns the tab bar and panel together. */
export function tabs(items, selectedId = items[0].id) {
  const panel = h('div', { role: 'tabpanel' });
  const bar = h('div', { class: 'tabs', role: 'tablist' });

  const select = (id) => {
    for (const tab of bar.children) tab.setAttribute('aria-selected', String(tab.dataset.id === id));
    panel.replaceChildren(items.find((item) => item.id === id).render());
  };

  for (const item of items) {
    bar.append(h('button', { type: 'button', role: 'tab', dataset: { id: item.id }, onclick: () => select(item.id) }, item.label));
  }
  select(selectedId);
  return h('div', {}, bar, panel);
}
