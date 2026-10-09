import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { button, pageHead } from '../ui/components.js';
import { toastError } from '../ui/feedback.js';

const OPTIONS = [
  { href: '#/new', title: 'Write a recipe', text: 'Type it in yourself.' },
  { href: '#/import/url', title: 'From a website', text: 'Paste the address of a recipe page.' },
  { href: '#/import/photo', title: 'From a photo', text: 'A cookbook page or a handwritten card.' },
  { href: '#/import/pdf', title: 'From a PDF', text: 'A saved or scanned recipe.' },
];

export function addPage(container, params, query, app) {
  replace(container,
    pageHead('Add a recipe'),
    h('div', { class: 'big-options' },
      OPTIONS.map((option) =>
        h('a', { class: 'big-option', href: option.href }, h('strong', { text: option.title }), h('span', { text: option.text })),
      ),
    ),
    h('p', { class: 'muted small sections' },
      'Signed in on this device. ',
      button('Sign out', {
        variant: 'ghost',
        size: 'small',
        onclick: async () => {
          try {
            await api.logout();
            app.signOut();
          } catch (error) {
            toastError(error);
          }
        },
      }),
    ),
  );
}
