import { describe, expect, it } from 'vitest';
import { buildShoppingList } from '../../../backend/services/shoppingList.js';

const source = (title, ...ingredients) => ({
  title,
  ingredients: ingredients.map(([quantity, unit, name]) => ({ quantity, unit, name })),
});

describe('buildShoppingList (spec 05 AC-6 to AC-8)', () => {
  it('sums the same ingredient across recipes, merging unit synonyms', () => {
    const { toBuy } = buildShoppingList([source('Salad', [2, 'tbsp', 'olive oil']), source('Pasta', [1, 'tablespoon', 'Olive oil'])], []);
    expect(toBuy).toEqual([{ name: 'olive oil', quantity: 3, unit: 'tbsp', sources: ['Salad', 'Pasta'] }]);
  });

  it('converts kg to g before adding, and shows large totals in kg', () => {
    const { toBuy } = buildShoppingList([source('Bread', [1, 'kg', 'flour']), source('Cake', [200, 'g', 'flour'])], []);
    expect(toBuy).toEqual([{ name: 'flour', quantity: 1.2, unit: 'kg', sources: ['Bread', 'Cake'] }]);
  });

  it('keeps totals under 1000 in g or ml', () => {
    const { toBuy } = buildShoppingList([source('A', [0.5, 'l', 'milk']), source('B', [200, 'ml', 'milk'])], []);
    expect(toBuy[0]).toMatchObject({ quantity: 700, unit: 'ml' });
  });

  it('keeps different kinds of unit as separate lines', () => {
    const { toBuy } = buildShoppingList([source('A', [1, 'cup', 'milk']), source('B', [200, 'ml', 'milk'])], []);
    expect(toBuy.map((line) => `${line.quantity} ${line.unit}`)).toEqual(['1 cup', '200 ml']);
  });

  it('merges plural and singular names', () => {
    const { toBuy } = buildShoppingList([source('A', [2, '', 'eggs']), source('B', [1, '', 'egg'])], []);
    expect(toBuy).toEqual([{ name: 'eggs', quantity: 3, unit: '', sources: ['A', 'B'] }]);
  });

  it('keeps quantity null when no line has a quantity', () => {
    const { toBuy } = buildShoppingList([source('A', [null, '', 'salt']), source('B', [null, '', 'Salt'])], []);
    expect(toBuy).toEqual([{ name: 'salt', quantity: null, unit: '', sources: ['A', 'B'] }]);
  });

  it('moves owned items to alreadyHave, including water', () => {
    const list = buildShoppingList([source('Soup', [1, 'l', 'water'], [2, 'tbsp', 'extra virgin olive oil'], [1, '', 'onion'])], ['olive oil']);
    expect(list.toBuy.map((line) => line.name)).toEqual(['onion']);
    expect(list.alreadyHave.map((line) => line.name)).toEqual(['extra virgin olive oil', 'water']);
  });

  it('lists a recipe once in sources even when it repeats an ingredient', () => {
    const { toBuy } = buildShoppingList([source('A', [1, '', 'egg'], [1, '', 'egg'])], []);
    expect(toBuy[0]).toMatchObject({ quantity: 2, sources: ['A'] });
  });

  it('sorts lines by name and avoids float noise', () => {
    const { toBuy } = buildShoppingList([source('A', [0.1, 'kg', 'rice'], [0.2, 'kg', 'rice'], [1, '', 'apple'])], []);
    expect(toBuy.map((line) => [line.name, line.quantity])).toEqual([['apple', 1], ['rice', 300]]);
  });
});
