// Write a meal review: stars, notes, improvements and captioned photos.

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { preparePhoto } from '../lib/files.js';
import { navigate } from '../router.js';
import { backLink, button, errorBox, field, loading, pageHead, starInput } from '../ui/components.js';
import { toast, toastError, withBusy } from '../ui/feedback.js';

const MAX_PHOTOS = 6;

export async function reviewPage(container, { id }) {
  replace(container, loading());
  const recipe = await api.getRecipe(id);
  const recipePath = `/recipes/${encodeURIComponent(id)}`;
  container.closest('main').dataset.hue = recipe.hue;

  const photos = [];
  const photoList = h('div', { class: 'rows' });
  const problems = h('div', {});

  const renderPhotos = () => {
    photoList.replaceChildren(
      ...photos.map((photo) =>
        h('div', { class: 'photo-row' },
          h('img', { src: photo.previewUrl, alt: '' }),
          photo.caption,
          button('×', {
            variant: 'ghost',
            size: 'small',
            ariaLabel: 'Remove photo',
            onclick: () => {
              photos.splice(photos.indexOf(photo), 1);
              renderPhotos();
            },
          }),
        ),
      ),
    );
    picker.disabled = photos.length >= MAX_PHOTOS;
  };

  const picker = h('input', {
    type: 'file',
    accept: 'image/*',
    multiple: true,
    'aria-label': 'Add photos',
    onchange: async (event) => {
      const files = [...event.target.files].slice(0, MAX_PHOTOS - photos.length);
      event.target.value = '';
      for (const file of files) {
        try {
          const prepared = await preparePhoto(file);
          photos.push({ ...prepared, caption: h('input', { placeholder: 'Caption (optional)', maxlength: 200, 'aria-label': 'Photo caption' }) });
        } catch (error) {
          toastError(error);
        }
      }
      renderPhotos();
    },
  });

  const notes = h('textarea', { rows: 3, maxlength: 4000, placeholder: 'How did it turn out?' });
  const improvements = h('textarea', { rows: 3, maxlength: 4000, placeholder: 'e.g. less salt, bake 5 minutes longer' });
  const save = button('Save review', { variant: 'primary', type: 'submit' });

  const form = h('form', {
    class: 'form',
    novalidate: true,
    onsubmit: (event) => {
      event.preventDefault();
      const rating = Number(form.elements.rating.value);
      if (!rating) {
        replace(problems, errorBox({ message: 'Choose a star rating.' }));
        return;
      }
      problems.replaceChildren();
      withBusy(save, 'Saving…', async () => {
        const images = [];
        for (const [index, photo] of photos.entries()) {
          save.textContent = `Uploading photo ${index + 1} of ${photos.length}…`;
          const imageId = await api.uploadImage({ data: photo.data, mediaType: photo.mediaType });
          images.push({ id: imageId, caption: photo.caption.value });
        }
        save.textContent = 'Saving…';
        await api.addReview(id, { rating, notes: notes.value, improvements: improvements.value, images });
        toast('Review saved');
        navigate(recipePath);
      });
    },
  },
    h('fieldset', {}, h('legend', { text: 'Rating' }), starInput('rating')),
    field('Notes', notes),
    field('Improvements for next time', improvements, 'Claude can apply these to the recipe later.'),
    h('fieldset', {}, h('legend', { text: `Photos (up to ${MAX_PHOTOS})` }), picker, photoList),
    problems,
    h('div', { class: 'sticky-actions' }, button('Cancel', { variant: 'ghost', onclick: () => navigate(recipePath) }), save),
  );

  replace(container, backLink(`#${recipePath}`, recipe.title), pageHead('Review'), form);
}
