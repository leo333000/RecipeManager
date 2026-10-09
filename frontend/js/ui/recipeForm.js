// The recipe editor form, used for new recipes, drafts and edits.

import { parseIngredientLine } from '../../../shared/ingredients.js';
import { formatQuantity } from '../../../shared/quantity.js';
import { DEFAULT_HUE, HUES } from '../../../shared/recipe.js';
import { h } from '../dom.js';
import { button, field, sectionTitle, toggle } from './components.js';

const COMMON_UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pinch', 'clove', 'can', 'slice', 'bunch', 'oz', 'lb'];

function moveButtons(rows, row, render) {
  const move = (offset) => {
    const index = rows.indexOf(row);
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    render();
  };
  return [
    button('↑', { variant: 'ghost', size: 'small', ariaLabel: 'Move up', onclick: () => move(-1) }),
    button('↓', { variant: 'ghost', size: 'small', ariaLabel: 'Move down', onclick: () => move(1) }),
    button('×', {
      variant: 'ghost',
      size: 'small',
      ariaLabel: 'Remove',
      onclick: () => {
        rows.splice(rows.indexOf(row), 1);
        render();
      },
    }),
  ];
}

function ingredientRow(ingredient, rows, render) {
  const row = { id: ingredient.id };
  row.quantity = h('input', { value: formatQuantity(ingredient.quantity ?? null), placeholder: 'qty', 'aria-label': 'Quantity', inputmode: 'decimal' });
  row.unit = h('input', { value: ingredient.unit ?? '', placeholder: 'unit', 'aria-label': 'Unit', list: 'unit-options' });
  row.name = h('input', { value: ingredient.name ?? '', placeholder: 'ingredient', 'aria-label': 'Ingredient' });
  row.note = h('input', { value: ingredient.note ?? '', placeholder: 'note (optional)', 'aria-label': 'Ingredient note' });

  const noteWrap = h('div', { class: 'row-note', hidden: !ingredient.note }, row.note);
  const noteButton = button('✎', {
    variant: 'ghost',
    size: 'small',
    ariaLabel: 'Ingredient note',
    onclick: () => {
      noteWrap.hidden = !noteWrap.hidden;
      if (!noteWrap.hidden) row.note.focus();
    },
  });

  row.element = h('div', { class: 'ing-row' },
    row.quantity, row.unit, row.name,
    h('div', { class: 'row-actions' }, noteButton, moveButtons(rows, row, render)),
    noteWrap,
  );
  row.read = () => ({ id: row.id, quantity: row.quantity.value, unit: row.unit.value, name: row.name.value, note: row.note.value });
  return row;
}

/** Grows a textarea to fit its text, so long steps are fully visible. */
function autoGrow(textarea) {
  const fit = () => {
    textarea.style.height = 'auto';
    if (textarea.scrollHeight) textarea.style.height = `${textarea.scrollHeight + 2}px`;
  };
  textarea.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return textarea;
}

function stepRow(step, rows, render) {
  const row = { id: step.id };
  row.text = h('textarea', { 'aria-label': 'Step', placeholder: 'What to do', rows: 2 });
  row.text.value = step.text ?? '';
  autoGrow(row.text);
  row.number = h('span', { class: 'num' });
  row.element = h('div', { class: 'step-row' }, row.number, row.text, h('div', { class: 'row-actions' }, moveButtons(rows, row, render)));
  row.read = () => ({ id: row.id, text: row.text.value });
  return row;
}

function huePicker(selected) {
  return h('fieldset', {},
    h('legend', { text: 'Colour' }),
    h('div', { class: 'hue-picker' },
      HUES.map((hue) =>
        h('label', { class: 'hue-swatch', 'data-hue': hue, title: hue },
          h('input', { type: 'radio', name: 'hue', value: hue, checked: hue === selected, 'aria-label': hue }),
          h('span', {}),
        ),
      ),
    ),
  );
}

function pasteBox(placeholder, onadd) {
  const area = h('textarea', { placeholder, rows: 5, 'aria-label': placeholder });
  return toggle('Paste as text', () => [
    area,
    h('div', { class: 'button-row' },
      button('Add lines', {
        size: 'small',
        onclick: () => {
          const lines = area.value.split('\n').map((line) => line.trim()).filter(Boolean);
          onadd(lines);
          area.value = '';
        },
      }),
    ),
  ], { variant: 'inline' });
}

/**
 * Builds the editor for `recipe` (any partial recipe or draft).
 * Returns { element, getValue } where getValue() gives the recipe input for the API.
 */
export function recipeForm(recipe = {}) {
  const title = h('input', { value: recipe.title ?? '', required: true, maxlength: 120, autocomplete: 'off' });
  const description = h('textarea', { rows: 2, maxlength: 2000 });
  description.value = recipe.description ?? '';
  const servings = h('input', { type: 'number', min: 1, max: 100, value: recipe.servings ?? '', inputmode: 'numeric' });
  const prep = h('input', { type: 'number', min: 0, max: 2880, value: recipe.prepMinutes ?? '', inputmode: 'numeric' });
  const cook = h('input', { type: 'number', min: 0, max: 2880, value: recipe.cookMinutes ?? '', inputmode: 'numeric' });
  const tags = h('input', { value: (recipe.tags ?? []).join(', '), placeholder: 'dinner, pasta, quick' });
  const hues = huePicker(recipe.hue ?? DEFAULT_HUE);

  const ingredientRows = [];
  const ingredientList = h('div', { class: 'rows' });
  const renderIngredients = () => ingredientList.replaceChildren(...ingredientRows.map((row) => row.element));
  const addIngredient = (ingredient = {}) => {
    const row = ingredientRow(ingredient, ingredientRows, renderIngredients);
    ingredientRows.push(row);
    return row;
  };

  const stepRows = [];
  const stepList = h('div', { class: 'rows' });
  const renderSteps = () => {
    stepRows.forEach((row, index) => {
      row.number.textContent = `${index + 1}.`;
    });
    stepList.replaceChildren(...stepRows.map((row) => row.element));
  };
  const addStep = (step = {}) => {
    const row = stepRow(step, stepRows, renderSteps);
    stepRows.push(row);
    return row;
  };

  (recipe.ingredients?.length ? recipe.ingredients : [{}, {}, {}]).forEach((ingredient) => addIngredient(ingredient));
  (recipe.steps?.length ? recipe.steps : [{}]).forEach((step) => addStep(typeof step === 'string' ? { text: step } : step));
  renderIngredients();
  renderSteps();

  const element = h('div', { class: 'form' },
    field('Title', title),
    field('Description', description, 'Optional. One or two sentences.'),
    h('div', { class: 'field-row' }, field('Servings', servings), field('Prep (min)', prep), field('Cook (min)', cook)),
    field('Tags', tags, 'Comma separated'),
    hues,

    sectionTitle('Ingredients'),
    h('datalist', { id: 'unit-options' }, COMMON_UNITS.map((unit) => h('option', { value: unit }))),
    ingredientList,
    h('div', { class: 'button-row' },
      button('+ Ingredient', {
        size: 'small',
        onclick: () => {
          const row = addIngredient();
          renderIngredients();
          row.name.focus();
        },
      }),
    ),
    pasteBox('One ingredient per line, e.g. 200 g flour, sifted', (lines) => {
      lines.map(parseIngredientLine).filter(Boolean).forEach((ingredient) => addIngredient(ingredient));
      removeEmptyRows(ingredientRows, (row) => !row.name.value && !row.quantity.value && !row.unit.value);
      renderIngredients();
    }),

    sectionTitle('Steps'),
    stepList,
    h('div', { class: 'button-row' },
      button('+ Step', {
        size: 'small',
        onclick: () => {
          const row = addStep();
          renderSteps();
          row.text.focus();
        },
      }),
    ),
    pasteBox('One step per line', (lines) => {
      lines.forEach((text) => addStep({ text: text.replace(/^\d+[.)]\s*/, '') }));
      removeEmptyRows(stepRows, (row) => !row.text.value.trim());
      renderSteps();
    }),
  );

  function getValue() {
    return {
      title: title.value,
      description: description.value,
      servings: servings.value,
      prepMinutes: prep.value,
      cookMinutes: cook.value,
      tags: tags.value,
      hue: hues.querySelector('input:checked')?.value ?? DEFAULT_HUE,
      ingredients: ingredientRows.map((row) => row.read()),
      steps: stepRows.map((row) => row.read()),
      source: recipe.source,
    };
  }

  return { element, getValue, focus: () => title.focus() };
}

function removeEmptyRows(rows, isEmpty) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (isEmpty(rows[i])) rows.splice(i, 1);
  }
}
