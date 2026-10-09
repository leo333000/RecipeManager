import { describe, expect, it } from 'vitest';
import { diffLines, diffRecipe, ingredientLine } from '../../../frontend/js/lib/diff.js';

describe('diffLines (spec 03 AC-5)', () => {
  it('marks kept, removed and added lines in reading order', () => {
    expect(diffLines(['a', 'b', 'c'], ['a', 'x', 'c', 'd'])).toEqual([
      { type: 'same', text: 'a' },
      { type: 'remove', text: 'b' },
      { type: 'add', text: 'x' },
      { type: 'same', text: 'c' },
      { type: 'add', text: 'd' },
    ]);
  });

  it('handles empty sides', () => {
    expect(diffLines([], ['a'])).toEqual([{ type: 'add', text: 'a' }]);
    expect(diffLines(['a'], [])).toEqual([{ type: 'remove', text: 'a' }]);
    expect(diffLines([], [])).toEqual([]);
  });

  it('detects a moved line as one removal and one addition', () => {
    const result = diffLines(['a', 'b', 'c'], ['b', 'c', 'a']);
    expect(result.filter((line) => line.type !== 'same')).toEqual([
      { type: 'remove', text: 'a' },
      { type: 'add', text: 'a' },
    ]);
  });
});

const recipe = (overrides = {}) => ({
  title: 'Soup',
  description: '',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: null,
  tags: ['soup'],
  ingredients: [{ name: 'leek', quantity: 1, unit: '', note: '' }, { name: 'stock', quantity: 500, unit: 'ml', note: 'hot' }],
  steps: [{ text: 'Chop.' }, { text: 'Simmer.' }],
  ...overrides,
});

describe('ingredientLine', () => {
  it('includes quantity, unit, name and note', () => {
    expect(ingredientLine({ name: 'stock', quantity: 500, unit: 'ml', note: 'hot' })).toBe('500 ml stock (hot)');
    expect(ingredientLine({ name: 'salt', quantity: null, unit: '', note: '' })).toBe('salt');
  });
});

describe('diffRecipe', () => {
  it('reports no change for identical recipes', () => {
    expect(diffRecipe(recipe(), recipe()).changed).toBe(false);
  });

  it('flags changed fields with before and after values', () => {
    const diff = diffRecipe(recipe(), recipe({ title: 'Leek soup', prepMinutes: 75 }));
    expect(diff.changed).toBe(true);
    expect(diff.fields.filter((field) => field.changed)).toEqual([
      { label: 'Title', before: 'Soup', after: 'Leek soup', changed: true },
      { label: 'Prep time', before: '10 min', after: '1 h 15 min', changed: true },
    ]);
  });

  it('diffs ingredients and steps as lines', () => {
    const after = recipe({
      ingredients: [{ name: 'leek', quantity: 2, unit: '', note: '' }, { name: 'stock', quantity: 500, unit: 'ml', note: 'hot' }],
      steps: [{ text: 'Chop.' }, { text: 'Simmer for 20 minutes.' }],
    });
    const diff = diffRecipe(recipe(), after);
    expect(diff.ingredients).toEqual([
      { type: 'remove', text: '1 leek' },
      { type: 'add', text: '2 leek' },
      { type: 'same', text: '500 ml stock (hot)' },
    ]);
    expect(diff.steps.map((line) => line.type)).toEqual(['same', 'remove', 'add']);
  });
});
