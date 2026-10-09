// What Leo already has at home.

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { button, chip, linkButton, loading, moreMenu, pageHead } from '../ui/components.js';
import { confirmDialog, toastError, withBusy } from '../ui/feedback.js';

/** "eggs, flour\nolive oil" -> ["eggs", "flour", "olive oil"] */
export function splitItems(text) {
  return text.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
}

export async function pantryPage(container) {
  replace(container, loading());
  let items = await api.getPantry();

  const chips = h('div', { class: 'chips' });
  const renderChips = () => {
    chips.replaceChildren(
      ...(items.length
        ? items.map((item) =>
            chip(item.name, {
              onremove: async () => {
                try {
                  items = await api.removePantry(item.id);
                  renderChips();
                } catch (error) {
                  toastError(error);
                }
              },
            }),
          )
        : [h('p', { class: 'muted small', text: 'Nothing here yet.' })]),
    );
  };
  renderChips();

  const input = h('input', { placeholder: 'eggs, flour, olive oil', 'aria-label': 'Items to add', autocomplete: 'off' });
  const add = button('Add', { variant: 'primary', type: 'submit' });
  const form = h('form', {
    class: 'inline-form',
    onsubmit: (event) => {
      event.preventDefault();
      const names = splitItems(input.value);
      if (!names.length) return;
      withBusy(add, 'Adding…', async () => {
        items = await api.addPantry(names);
        input.value = '';
        renderChips();
        input.focus();
      });
    },
  }, input, add);

  const menu = moreMenu([
    {
      label: 'Clear all',
      danger: true,
      onclick: async () => {
        if (!(await confirmDialog('Remove everything from the pantry?', { confirmLabel: 'Clear', danger: true }))) return;
        try {
          items = await api.clearPantry();
          renderChips();
        } catch (error) {
          toastError(error);
        }
      },
    },
  ]);

  replace(container,
    pageHead('Pantry', menu),
    h('p', { class: 'lead small', text: 'What you already have at home. Shopping lists leave these out. Separate items with commas.' }),
    form,
    h('div', { class: 'sections' }, chips),
    h('div', { class: 'sections' }, linkButton('What can I cook? →', '#/ideas')),
  );
}
