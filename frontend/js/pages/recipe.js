// The recipe page: clean while cooking, with notes and reviews behind toggles.

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { formatDate, plural } from '../lib/format.js';
import { navigate } from '../router.js';
import { backLink, button, linkButton, loading, moreMenu, sectionTitle, stars, toggle } from '../ui/components.js';
import { confirmDialog, toast, toastError, withBusy } from '../ui/feedback.js';
import { addToMealPlan } from '../ui/mealPlanPicker.js';
import { metaLine, quantityText } from '../ui/recipeView.js';

const SOURCE_LABELS = { url: 'web page', photo: 'photo', pdf: 'PDF', ai: 'Claude idea', manual: '' };

function ingredientItem(recipe, ingredient, ticked, onchange) {
  const checkbox = h('input', { type: 'checkbox', checked: ticked.has(ingredient.id), 'aria-label': `Got ${ingredient.name}` });
  const item = h('li', { class: `ingredient ${ticked.has(ingredient.id) ? 'done' : ''}` });
  const noteArea = h('div', { class: 'ingredient-note', hidden: true });

  const renderEditor = () => {
    const input = h('textarea', { rows: 2, placeholder: 'e.g. buy the 70% one', 'aria-label': `Note for ${ingredient.name}` });
    input.value = ingredient.note;
    const save = button('Save note', {
      size: 'small',
      variant: 'primary',
      onclick: () =>
        withBusy(save, 'Saving…', async () => {
          const updated = await api.setIngredientNote(recipe.id, ingredient.id, input.value);
          onchange(updated);
          toast(input.value.trim() ? 'Note saved' : 'Note removed');
        }),
    });
    replace(noteArea, input, h('div', { class: 'button-row' }, save));
    input.focus();
  };

  // An existing note is shown as text first; editing is one tap away.
  const renderNote = () => {
    if (!ingredient.note) {
      renderEditor();
      return;
    }
    replace(noteArea,
      h('div', { text: ingredient.note }),
      h('div', { class: 'button-row' }, button('Edit note', { size: 'small', onclick: renderEditor })),
    );
  };

  const noteButton = h('button', {
    type: 'button',
    class: `note-toggle ${ingredient.note ? 'has-note' : ''}`,
    'aria-expanded': 'false',
    'aria-label': ingredient.note ? `Show note for ${ingredient.name}` : `Add a note to ${ingredient.name}`,
    onclick: () => {
      noteArea.hidden = !noteArea.hidden;
      noteButton.setAttribute('aria-expanded', String(!noteArea.hidden));
      if (!noteArea.hidden) renderNote();
    },
  }, ingredient.note ? 'note' : '✎');

  checkbox.addEventListener('change', () => {
    item.classList.toggle('done', checkbox.checked);
    if (checkbox.checked) ticked.add(ingredient.id);
    else ticked.delete(ingredient.id);
  });
  const amount = quantityText(ingredient);
  return replace(item,
    h('label', {},
      checkbox,
      h('span', { class: 'ingredient-text' }, amount ? h('span', { class: 'qty', text: `${amount} ` }) : null, ingredient.name),
    ),
    noteButton,
    noteArea,
  );
}

function notesSection(recipe, onchange) {
  const list = h('ul', { class: 'note-list' },
    recipe.notes.map((note) =>
      h('li', {},
        h('div', {}, h('span', { class: 'date', text: formatDate(note.createdAt) }), note.text),
        button('×', {
          variant: 'ghost',
          size: 'small',
          ariaLabel: 'Delete note',
          onclick: async () => {
            if (!(await confirmDialog('Delete this note?', { confirmLabel: 'Delete', danger: true }))) return;
            try {
              onchange(await api.deleteNote(recipe.id, note.id), { open: 'notes' });
            } catch (error) {
              toastError(error);
            }
          },
        }),
      ),
    ),
  );

  const input = h('textarea', { rows: 2, placeholder: 'Add a note', 'aria-label': 'New note' });
  const add = button('Add note', { size: 'small', variant: 'primary', type: 'submit' });
  const form = h('form', {
    class: 'form',
    onsubmit: (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      withBusy(add, 'Adding…', async () => onchange(await api.addNote(recipe.id, input.value), { open: 'notes' }));
    },
  }, input, h('div', { class: 'button-row' }, add));

  return [recipe.notes.length ? list : null, form];
}

function reviewItem(recipe, review, onremoved) {
  const details = [
    review.improvements ? h('p', {}, h('strong', { text: 'Next time: ' }), review.improvements) : null,
    review.images.length
      ? h('div', { class: 'thumbs' },
          review.images.map((image) =>
            h('figure', {},
              h('a', { href: api.imageUrl(image.id), target: '_blank', rel: 'noopener' },
                h('img', { src: api.imageUrl(image.id), alt: image.caption || `Photo of ${recipe.title}`, loading: 'lazy' }),
              ),
              image.caption ? h('figcaption', { text: image.caption }) : null,
            ),
          ),
        )
      : null,
  ].filter(Boolean);

  const remove = button('Delete', {
    variant: 'ghost',
    size: 'small',
    onclick: async () => {
      if (!(await confirmDialog('Delete this review and its photos?', { confirmLabel: 'Delete', danger: true }))) return;
      await withBusy(remove, 'Deleting…', async () => {
        await api.deleteReview(recipe.id, review.id);
        await onremoved();
      });
    },
  });

  return h('div', { class: 'review' },
    h('div', { class: 'review-head' }, h('span', {}, stars(review.rating), ' ', h('span', { class: 'muted small', text: formatDate(review.createdAt) })), remove),
    review.notes ? h('p', { text: review.notes }) : null,
    details.length ? toggle(review.images.length ? `More (${plural(review.images.length, 'photo')})` : 'More', details, { variant: 'inline' }) : null,
  );
}

function reviewsSection(recipe, reviews, onremoved) {
  return [
    reviews.length
      ? reviews.map((review) => reviewItem(recipe, review, onremoved))
      : h('p', { class: 'muted small', text: 'No reviews yet.' }),
    h('div', { class: 'button-row' }, linkButton('Review this meal', `#/recipes/${encodeURIComponent(recipe.id)}/review`, { size: 'small' })),
  ];
}

function reviewsLabel(reviews) {
  if (reviews.length === 0) return 'Reviews';
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return `Reviews (${reviews.length}) · ★ ${Math.round(average * 10) / 10}`;
}

const isWebLink = (url) => /^https?:\/\//i.test(url ?? '');

export async function recipePage(container, { id }) {
  replace(container, loading());
  let [recipe, reviews] = await Promise.all([api.getRecipe(id), api.listReviews(id)]);
  const recipePath = `/recipes/${encodeURIComponent(id)}`;
  const ticked = new Set();

  const render = (openSection) => {
    container.closest('main').dataset.hue = recipe.hue;

    const onchange = (updated, options = {}) => {
      recipe = updated;
      render(options.open);
    };
    const onReviewRemoved = async () => {
      reviews = await api.listReviews(recipe.id);
      toast('Review deleted');
      render('reviews');
    };

    const actions = h('div', { class: 'button-row' },
      linkButton('Edit', `#${recipePath}/edit`, { variant: 'primary' }),
      moreMenu([
        { label: 'Change with AI…', onclick: () => navigate(`${recipePath}/ai`) },
        { label: 'Add to meal plan…', onclick: () => addToMealPlan(recipe).catch(toastError) },
        { label: 'Review this meal', onclick: () => navigate(`${recipePath}/review`) },
        { label: 'History', onclick: () => navigate(`${recipePath}/history`) },
        {
          label: 'Delete recipe',
          danger: true,
          onclick: async () => {
            const ok = await confirmDialog(`Delete "${recipe.title}" with its notes, reviews and history? This cannot be undone.`, {
              confirmLabel: 'Delete',
              danger: true,
            });
            if (!ok) return;
            try {
              await api.deleteRecipe(recipe.id);
              toast('Recipe deleted');
              navigate('/recipes');
            } catch (error) {
              toastError(error);
            }
          },
        },
      ]),
    );

    const sourceLabel = SOURCE_LABELS[recipe.source.type];
    replace(container,
      backLink('#/recipes', 'Recipes'),
      h('div', { class: 'page-head' },
        h('div', { class: 'recipe-head' },
          h('h1', { text: recipe.title }),
          recipe.description ? h('p', { text: recipe.description }) : null,
          metaLine(recipe),
        ),
      ),
      actions,

      sectionTitle(recipe.servings ? `Ingredients · ${plural(recipe.servings, 'serving')}` : 'Ingredients'),
      recipe.ingredients.length
        ? h('ul', { class: 'ingredients' }, recipe.ingredients.map((ingredient) => ingredientItem(recipe, ingredient, ticked, onchange)))
        : h('p', { class: 'muted', text: 'No ingredients yet.' }),

      sectionTitle('Steps'),
      recipe.steps.length
        ? h('ol', { class: 'steps' }, recipe.steps.map((step) => h('li', { text: step.text })))
        : h('p', { class: 'muted', text: 'No steps yet.' }),

      h('div', { class: 'sections' },
        toggle(`Notes (${recipe.notes.length})`, () => notesSection(recipe, onchange), { open: openSection === 'notes' }),
        toggle(reviewsLabel(reviews), () => reviewsSection(recipe, reviews, onReviewRemoved), { open: openSection === 'reviews' }),
      ),

      h('p', { class: 'muted small' },
        `Version ${recipe.version} · updated ${formatDate(recipe.updatedAt)}`,
        sourceLabel ? ' · from ' : '',
        isWebLink(recipe.source.url)
          ? h('a', { href: recipe.source.url, target: '_blank', rel: 'noopener noreferrer', text: sourceLabel })
          : sourceLabel,
      ),
    );
  };

  render();
}
