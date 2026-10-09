import { describe, expect, it } from 'vitest';
import { rankRecipesByPantry } from '../../../backend/services/pantryMatch.js';

const summary = (id, title, ingredientNames) => ({ id, title, hue: 'violet', ingredientNames });

describe('rankRecipesByPantry (spec 06 AC-1)', () => {
  const recipes = [
    summary('1', 'Omelette', ['eggs', 'butter', 'salt']),
    summary('2', 'Pancakes', ['eggs', 'flour', 'milk', 'butter']),
    summary('3', 'Steak', ['beef']),
    summary('4', 'Boiled egg', ['egg', 'water']),
    summary('5', 'Empty', []),
  ];

  it('ranks by coverage, then by fewest missing, and leaves out 0% recipes', () => {
    const ranked = rankRecipesByPantry(recipes, ['Eggs', 'butter']);
    expect(ranked.map((match) => [match.title, match.coverage])).toEqual([
      ['Boiled egg', 1],
      ['Omelette', 0.67],
      ['Pancakes', 0.5],
    ]);
  });

  it('lists what is owned and what is missing', () => {
    const [omelette] = rankRecipesByPantry([recipes[0]], ['eggs', 'butter']);
    expect(omelette).toMatchObject({ have: ['eggs', 'butter'], missing: ['salt'] });
  });

  it('breaks coverage ties by fewer missing ingredients', () => {
    const ranked = rankRecipesByPantry(
      [summary('a', 'Big', ['egg', 'milk', 'x', 'y']), summary('b', 'Small', ['egg', 'z'])],
      ['egg', 'milk'],
    );
    // Both are 50% covered; Small needs 1 more item, Big needs 2.
    expect(ranked.map((match) => match.title)).toEqual(['Small', 'Big']);
    expect(ranked.map((match) => match.coverage)).toEqual([0.5, 0.5]);
  });

  it('returns an empty list for an empty pantry (only water is owned)', () => {
    expect(rankRecipesByPantry([recipes[0], recipes[2]], [])).toEqual([]);
  });
});
