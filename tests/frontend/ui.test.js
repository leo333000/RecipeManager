// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { validateRecipe } from '../../shared/recipe.js';
import { compareView } from '../../frontend/js/ui/compare.js';
import { starInput, toggle } from '../../frontend/js/ui/components.js';
import { recipeForm } from '../../frontend/js/ui/recipeForm.js';

const recipe = {
  title: 'Soup',
  description: 'Warm',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  tags: ['soup', 'winter'],
  hue: 'teal',
  ingredients: [{ id: 'i1', name: 'leek', quantity: 1.5, unit: '', note: 'washed' }],
  steps: [{ id: 's1', text: 'Chop.' }],
  source: { type: 'url', url: 'https://example.com' },
};

describe('recipeForm (spec 02 AC-8)', () => {
  it('round-trips a recipe into valid API input, keeping ids and source', () => {
    const value = recipeForm(recipe).getValue();
    expect(value).toMatchObject({
      title: 'Soup',
      servings: '2',
      tags: 'soup, winter',
      hue: 'teal',
      ingredients: [{ id: 'i1', name: 'leek', quantity: '1 1/2', unit: '', note: 'washed' }],
      steps: [{ id: 's1', text: 'Chop.' }],
      source: recipe.source,
    });
    const { value: validated, error } = validateRecipe(value);
    expect(error).toBeUndefined();
    expect(validated.ingredients[0].quantity).toBe(1.5);
  });

  it('starts a new recipe with three empty ingredient rows that validation drops', () => {
    const form = recipeForm();
    expect(form.getValue().ingredients).toHaveLength(3);
    const { value } = validateRecipe({ ...form.getValue(), title: 'New' });
    expect(value.ingredients).toEqual([]);
    expect(value.hue).toBe('violet');
  });

  it('turns pasted lines into ingredient rows, replacing empty rows', () => {
    const form = recipeForm();
    document.body.replaceChildren(form.element);
    const paste = form.element.querySelector('details');
    paste.open = true;
    paste.dispatchEvent(new Event('toggle'));
    paste.querySelector('textarea').value = '200 g flour, sifted\n2 eggs';
    [...paste.querySelectorAll('button')].find((button) => button.textContent === 'Add lines').click();

    expect(form.getValue().ingredients.map(({ quantity, unit, name, note }) => ({ quantity, unit, name, note }))).toEqual([
      { quantity: '200', unit: 'g', name: 'flour', note: 'sifted' },
      { quantity: '2', unit: '', name: 'eggs', note: '' },
    ]);
  });
});

describe('compareView (spec 03 AC-5)', () => {
  it('shows the summary and a line diff of changed ingredients', () => {
    const after = { ...recipe, ingredients: [{ ...recipe.ingredients[0], quantity: 2 }] };
    const view = compareView(recipe, after, { summary: 'More leek.', changes: ['Leek 1.5 → 2'] });
    expect(view.querySelector('.compare-summary').textContent).toContain('More leek.');
    expect([...view.querySelectorAll('.diff li')].map((line) => `${line.className}:${line.textContent}`)).toEqual([
      'remove:1 1/2 leek (washed)',
      'add:2 leek (washed)',
    ]);
  });

  it('says when there are no differences', () => {
    expect(compareView(recipe, recipe).textContent).toContain('No differences.');
  });
});

describe('components', () => {
  it('starInput is a required radio group of five', () => {
    const group = starInput('rating', 3);
    const radios = group.querySelectorAll('input[type=radio]');
    expect(radios).toHaveLength(5);
    expect(group.querySelector('input:checked').value).toBe('3');
    expect([...radios].some((radio) => radio.required)).toBe(true);
  });

  it('toggle renders lazy content only when opened', () => {
    let calls = 0;
    const details = toggle('More', () => {
      calls += 1;
      return document.createTextNode('body');
    });
    expect(calls).toBe(0);
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    details.dispatchEvent(new Event('toggle'));
    expect(calls).toBe(1);
    expect(details.textContent).toContain('body');
  });
});
