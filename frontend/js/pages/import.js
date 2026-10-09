// Import a recipe from a web page, photos or a PDF, then open it in the editor.

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { PDF_MAX_BYTES, preparePhoto, readAsBase64 } from '../lib/files.js';
import { saveDraft } from '../lib/storage.js';
import { navigate } from '../router.js';
import { AI_WAIT_TEXT, backLink, button, errorBox, field, loading, pageHead } from '../ui/components.js';
import { toast, toastError } from '../ui/feedback.js';

const MAX_PHOTOS = 4;

function openDraft(draft, message) {
  saveDraft(draft);
  if (message) toast(message);
  navigate('/new?draft=1');
}

/** Runs an import with a loading state; shows the error and re-enables the form on failure. */
function importRunner(form, status) {
  return async (task) => {
    form.hidden = true;
    replace(status, loading(AI_WAIT_TEXT));
    try {
      await task();
    } catch (error) {
      replace(status, errorBox(error));
      form.hidden = false;
    }
  };
}

function urlImport() {
  const input = h('input', { type: 'url', required: true, placeholder: 'https://…', inputmode: 'url', autocomplete: 'off' });
  const status = h('div', {});
  const form = h('form', {
    class: 'form',
    onsubmit: (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      run(async () => {
        const { draft, method } = await api.importUrl(input.value.trim());
        openDraft(draft, method === 'json-ld' ? 'Recipe found on the page' : 'Claude read the page');
      });
    },
  }, field('Web address', input), h('div', { class: 'button-row' }, button('Import', { variant: 'primary', type: 'submit' })));
  const run = importRunner(form, status);
  return [form, status];
}

function photoImport() {
  const photos = [];
  const previews = h('div', { class: 'thumbs' });
  const status = h('div', {});
  const importButton = button('Import', { variant: 'primary', type: 'submit', disabled: true });

  const renderPreviews = () => {
    previews.replaceChildren(...photos.map((photo, index) => h('figure', {}, h('img', { src: photo.previewUrl, alt: `Page ${index + 1}` }))));
    importButton.disabled = photos.length === 0;
  };

  const addFiles = async (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    for (const file of files.slice(0, MAX_PHOTOS - photos.length)) {
      try {
        photos.push(await preparePhoto(file));
      } catch (error) {
        toastError(error);
      }
    }
    renderPreviews();
  };

  const camera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'visually-hidden', id: 'photo-camera', onchange: addFiles });
  const library = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden', id: 'photo-library', onchange: addFiles });

  const form = h('form', {
    class: 'form',
    onsubmit: (event) => {
      event.preventDefault();
      run(async () => {
        const draft = await api.importPhotos(photos.map(({ data, mediaType }) => ({ data, mediaType })));
        openDraft(draft, 'Claude read the photo');
      });
    },
  },
    h('p', { class: 'small muted', text: `Up to ${MAX_PHOTOS} photos of the same recipe, in page order.` }),
    h('div', { class: 'button-row' },
      camera, h('label', { class: 'btn', for: 'photo-camera' }, 'Take a photo'),
      library, h('label', { class: 'btn', for: 'photo-library' }, 'Choose photos'),
      button('Clear', { variant: 'ghost', onclick: () => { photos.length = 0; renderPreviews(); } }),
    ),
    previews,
    h('div', { class: 'button-row' }, importButton),
  );
  const run = importRunner(form, status);
  return [form, status];
}

function pdfImport() {
  const input = h('input', { type: 'file', accept: 'application/pdf', required: true, 'aria-label': 'PDF file' });
  const status = h('div', {});
  const form = h('form', {
    class: 'form',
    onsubmit: (event) => {
      event.preventDefault();
      const file = input.files[0];
      if (!file) return;
      if (file.size > PDF_MAX_BYTES) {
        replace(status, errorBox({ message: 'That PDF is larger than 4 MB. Try a smaller file or a photo of the page.' }));
        return;
      }
      run(async () => {
        const draft = await api.importPdf(await readAsBase64(file));
        openDraft(draft, 'Claude read the PDF');
      });
    },
  }, field('PDF file', input, 'Up to 4 MB.'), h('div', { class: 'button-row' }, button('Import', { variant: 'primary', type: 'submit' })));
  const run = importRunner(form, status);
  return [form, status];
}

const KINDS = {
  url: { title: 'From a website', build: urlImport },
  photo: { title: 'From a photo', build: photoImport },
  pdf: { title: 'From a PDF', build: pdfImport },
};

export function importPage(container, { kind }) {
  const config = KINDS[kind];
  if (!config) {
    navigate('/add');
    return;
  }
  replace(container, backLink('#/add', 'Add'), pageHead(config.title), config.build());
}
