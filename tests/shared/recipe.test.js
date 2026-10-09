import { describe, expect, it } from 'vitest';
import { fitToLimits, validateRecipe } from '../../shared/recipe.js';

const valid = (overrides = {}) => ({ title: 'Pancakes', ...overrides });

describe('validateRecipe (spec 02 AC-4, AC-5, AC-9)', () => {
  it('normalizes a minimal recipe with defaults', () => {
    const { value, error } = validateRecipe(valid());
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      title: 'Pancakes',
      description: '',
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      tags: [],
      hue: 'violet',
      ingredients: [],
      steps: [],
      source: { type: 'manual', url: '' },
    });
  });

  it('requires a title', () => {
    expect(validateRecipe(valid({ title: '   ' })).error).toBe('title is required');
  });

  it('rejects a 121-character title', () => {
    expect(validateRecipe(valid({ title: 'x'.repeat(121) })).error).toMatch(/title must be at most 120/);
  });

  it('rejects servings outside 1..100', () => {
    expect(validateRecipe(valid({ servings: 0 })).error).toMatch(/servings/);
    expect(validateRecipe(valid({ servings: 101 })).error).toMatch(/servings/);
  });

  it('accepts numeric strings for times and servings', () => {
    const { value } = validateRecipe(valid({ servings: '4', prepMinutes: '15', cookMinutes: '' }));
    expect(value).toMatchObject({ servings: 4, prepMinutes: 15, cookMinutes: null });
  });

  it('trims, lower-cases and de-duplicates tags from a string or a list', () => {
    expect(validateRecipe(valid({ tags: 'Dinner, pasta ,dinner,' })).value.tags).toEqual(['dinner', 'pasta']);
    expect(validateRecipe(valid({ tags: ['Quick', 'quick'] })).value.tags).toEqual(['quick']);
  });

  it('falls back to violet for an unknown hue', () => {
    expect(validateRecipe(valid({ hue: 'black' })).value.hue).toBe('violet');
    expect(validateRecipe(valid({ hue: 'teal' })).value.hue).toBe('teal');
  });

  it('parses ingredient quantities and drops blank rows', () => {
    const { value } = validateRecipe(valid({
      ingredients: [
        { name: 'flour', quantity: '1 1/2', unit: 'cup' },
        { name: '', quantity: '', unit: '', note: '' },
        { name: 'salt', quantity: '' },
      ],
    }));
    expect(value.ingredients).toHaveLength(2);
    expect(value.ingredients[0]).toMatchObject({ name: 'flour', quantity: 1.5, unit: 'cup', note: '' });
    expect(value.ingredients[0].id).toEqual(expect.any(String));
    expect(value.ingredients[1].quantity).toBeNull();
  });

  it('keeps valid ingredient ids', () => {
    const { value } = validateRecipe(valid({ ingredients: [{ id: 'abc-1', name: 'egg' }] }));
    expect(value.ingredients[0].id).toBe('abc-1');
  });

  it('rejects an ingredient with a quantity but no name', () => {
    expect(validateRecipe(valid({ ingredients: [{ quantity: 2 }] })).error).toBe('ingredient 1 name is required');
  });

  it('rejects a quantity that is not a number', () => {
    expect(validateRecipe(valid({ ingredients: [{ name: 'egg', quantity: 'some' }] })).error).toMatch(/not a number/);
  });

  it('rejects negative quantities', () => {
    expect(validateRecipe(valid({ ingredients: [{ name: 'egg', quantity: -1 }] })).error).toMatch(/not a number/);
  });

  it('rejects more than 200 ingredients', () => {
    const ingredients = Array.from({ length: 201 }, (_, index) => ({ name: `item ${index}` }));
    expect(validateRecipe(valid({ ingredients })).error).toMatch(/at most 200 ingredients/);
  });

  it('accepts steps as plain strings and skips blank steps', () => {
    const { value } = validateRecipe(valid({ steps: ['Mix', '  ', { text: 'Bake' }] }));
    expect(value.steps.map((step) => step.text)).toEqual(['Mix', 'Bake']);
  });

  it('rejects a missing recipe', () => {
    expect(validateRecipe(null).error).toBe('recipe is required');
  });
});

describe('fitToLimits', () => {
  it('drops values that would fail validation', () => {
    const fitted = fitToLimits({
      title: 'x'.repeat(200),
      servings: 0,
      prepMinutes: 5000,
      tags: ['Good', 'a-very-long-tag-that-is-way-over-thirty-characters'],
      ingredients: [{ name: 'egg', quantity: -1, unit: 'x'.repeat(30), note: '' }],
      steps: ['Do it'],
    });
    expect(fitted.title).toHaveLength(120);
    expect(fitted.servings).toBeNull();
    expect(fitted.prepMinutes).toBeNull();
    expect(fitted.tags).toEqual(['good']);
    expect(fitted.ingredients[0]).toMatchObject({ quantity: null, unit: 'x'.repeat(20) });
    expect(validateRecipe(fitted).error).toBeUndefined();
  });
});
