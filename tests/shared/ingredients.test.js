import { describe, expect, it } from 'vitest';
import {
  findPantryMatch,
  formatIngredient,
  normalizeIngredientName,
  normalizeUnit,
  parseIngredientLine,
  toBaseUnit,
  toDisplayUnit,
} from '../../shared/ingredients.js';

describe('normalizeUnit', () => {
  it.each([
    ['Tablespoons', 'tbsp'],
    ['tbsp.', 'tbsp'],
    ['grams', 'g'],
    ['Litre', 'l'],
    ['cups', 'cup'],
    ['handful', 'handful'],
    ['', ''],
    ['bowl', 'bowl'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeUnit(input)).toBe(expected);
  });
});

describe('toBaseUnit', () => {
  it('converts kg to g and l to ml', () => {
    expect(toBaseUnit(1.2, 'kg')).toEqual({ quantity: 1200, unit: 'g' });
    expect(toBaseUnit(2, 'l')).toEqual({ quantity: 2000, unit: 'ml' });
    expect(toBaseUnit(5, 'cl')).toEqual({ quantity: 50, unit: 'ml' });
  });

  it('keeps other units and null quantities', () => {
    expect(toBaseUnit(2, 'tbsp')).toEqual({ quantity: 2, unit: 'tbsp' });
    expect(toBaseUnit(null, 'kg')).toEqual({ quantity: null, unit: 'g' });
  });
});

describe('toDisplayUnit', () => {
  it('shows 1000 g or ml and more as kg or l', () => {
    expect(toDisplayUnit(1500, 'g')).toEqual({ quantity: 1.5, unit: 'kg' });
    expect(toDisplayUnit(1000, 'ml')).toEqual({ quantity: 1, unit: 'l' });
    expect(toDisplayUnit(999, 'g')).toEqual({ quantity: 999, unit: 'g' });
    expect(toDisplayUnit(2000, 'tbsp')).toEqual({ quantity: 2000, unit: 'tbsp' });
    expect(toDisplayUnit(null, 'g')).toEqual({ quantity: null, unit: 'g' });
  });
});

describe('normalizeIngredientName (spec 05 AC-5)', () => {
  it.each([
    ['Tomatoes', 'tomato'],
    ['tomato', 'tomato'],
    ['Cherries', 'cherry'],
    ['Peaches', 'peach'],
    ['Eggs', 'egg'],
    ['  Olive   Oil! ', 'olive oil'],
    ['Crème fraîche', 'creme fraiche'],
    ['hummus', 'hummus'],
    ['glass', 'glass'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeIngredientName(input)).toBe(expected);
  });
});

describe('findPantryMatch (spec 05 AC-8)', () => {
  it('matches when every pantry word is in the ingredient', () => {
    expect(findPantryMatch('extra virgin olive oil', ['olive oil'])).toBe('olive oil');
    expect(findPantryMatch('sea salt', ['salt'])).toBe('salt');
    expect(findPantryMatch('Tomatoes', ['tomato'])).toBe('tomato');
  });

  it('matches whole words, not substrings', () => {
    expect(findPantryMatch('peppercorns', ['pepper'])).toBeNull();
    expect(findPantryMatch('olive oil', ['extra virgin olive oil'])).toBeNull();
  });

  it('always treats water as owned', () => {
    expect(findPantryMatch('cold water', [])).toBe('water');
  });

  it('returns null for blank names', () => {
    expect(findPantryMatch('', ['salt'])).toBeNull();
  });
});

describe('parseIngredientLine (spec 02 AC-8)', () => {
  it.each([
    ['200 g flour, sifted', { name: 'flour', quantity: 200, unit: 'g', note: 'sifted' }],
    ['200g flour', { name: 'flour', quantity: 200, unit: 'g', note: '' }],
    ['1 1/2 cups of milk', { name: 'milk', quantity: 1.5, unit: 'cup', note: '' }],
    ['½ tsp salt', { name: 'salt', quantity: 0.5, unit: 'tsp', note: '' }],
    ['2 large eggs', { name: 'large eggs', quantity: 2, unit: '', note: '' }],
    ['1 (400 g) can chickpeas, drained', { name: 'chickpeas', quantity: 1, unit: 'can', note: '400 g, drained' }],
    ['- 3 cloves garlic', { name: 'garlic', quantity: 3, unit: 'clove', note: '' }],
    ['2-3 carrots', { name: 'carrots', quantity: 2, unit: '', note: '' }],
    ['Salt and pepper', { name: 'Salt and pepper', quantity: null, unit: '', note: '' }],
    ['1 tomato', { name: 'tomato', quantity: 1, unit: '', note: '' }],
    ['butter (softened)', { name: 'butter', quantity: null, unit: '', note: 'softened' }],
  ])('parses %j', (line, expected) => {
    expect(parseIngredientLine(line)).toEqual(expected);
  });

  it('returns null for blank lines', () => {
    expect(parseIngredientLine('   ')).toBeNull();
    expect(parseIngredientLine('-')).toBeNull();
  });
});

describe('formatIngredient', () => {
  it('joins quantity, unit and name', () => {
    expect(formatIngredient({ quantity: 1.5, unit: 'cup', name: 'milk' })).toBe('1 1/2 cup milk');
    expect(formatIngredient({ quantity: null, unit: '', name: 'salt' })).toBe('salt');
  });
});
