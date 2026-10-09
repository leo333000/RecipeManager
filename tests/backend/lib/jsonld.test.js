import { describe, expect, it } from 'vitest';
import { findJsonLdRecipe, jsonLdToDraft, parseIsoDuration } from '../../../backend/lib/jsonld.js';
import { validateRecipe } from '../../../shared/recipe.js';

const page = (...blocks) =>
  `<html><head>${blocks.map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`).join('')}</head><body></body></html>`;

const RECIPE = {
  '@type': 'Recipe',
  name: 'Banana bread &amp; walnuts',
  description: '<p>Moist and easy.</p>',
  recipeYield: ['8', '8 slices'],
  prepTime: 'PT15M',
  cookTime: 'PT1H',
  keywords: 'baking, banana',
  recipeCategory: 'Dessert',
  recipeCuisine: ['British'],
  recipeIngredient: ['3 ripe bananas', '250 g flour', '1 tsp baking soda'],
  recipeInstructions: [
    { '@type': 'HowToSection', name: 'Batter', itemListElement: [{ '@type': 'HowToStep', text: 'Mash the bananas.' }, { '@type': 'HowToStep', text: 'Mix in the flour.' }] },
    { '@type': 'HowToStep', text: 'Bake for 1 hour.' },
  ],
};

describe('findJsonLdRecipe (spec 07 AC-3)', () => {
  it('finds a plain Recipe object', () => {
    expect(findJsonLdRecipe(page(RECIPE))?.name).toBe(RECIPE.name);
  });

  it('finds a Recipe inside @graph', () => {
    const html = page({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, RECIPE] });
    expect(findJsonLdRecipe(html)?.name).toBe(RECIPE.name);
  });

  it('finds a Recipe in a top-level array and with @type as an array', () => {
    const html = page([{ '@type': 'Organization' }, { ...RECIPE, '@type': ['Recipe', 'NewsArticle'] }]);
    expect(findJsonLdRecipe(html)?.name).toBe(RECIPE.name);
  });

  it('skips broken JSON-LD blocks', () => {
    const html = `<script type="application/ld+json">{ broken</script>${page(RECIPE)}`;
    expect(findJsonLdRecipe(html)?.name).toBe(RECIPE.name);
  });

  it('returns null for a page without a recipe', () => {
    expect(findJsonLdRecipe(page({ '@type': 'Article', name: 'News' }))).toBeNull();
    expect(findJsonLdRecipe('<html><body>Hello</body></html>')).toBeNull();
  });
});

describe('jsonLdToDraft', () => {
  const draft = jsonLdToDraft(RECIPE, 'https://example.com/banana-bread');

  it('maps the main fields', () => {
    expect(draft).toMatchObject({
      title: 'Banana bread & walnuts',
      description: 'Moist and easy.',
      servings: 8,
      prepMinutes: 15,
      cookMinutes: 60,
      tags: ['baking', 'banana', 'dessert', 'british'],
      source: { type: 'url', url: 'https://example.com/banana-bread' },
    });
  });

  it('parses ingredient lines', () => {
    expect(draft.ingredients).toEqual([
      { name: 'ripe bananas', quantity: 3, unit: '', note: '' },
      { name: 'flour', quantity: 250, unit: 'g', note: '' },
      { name: 'baking soda', quantity: 1, unit: 'tsp', note: '' },
    ]);
  });

  it('flattens HowToSection and HowToStep instructions', () => {
    expect(draft.steps).toEqual(['Mash the bananas.', 'Mix in the flour.', 'Bake for 1 hour.']);
  });

  it('splits string instructions into lines', () => {
    const fromString = jsonLdToDraft({ ...RECIPE, recipeInstructions: '<p>Mash.</p><p>Bake.</p>' }, 'https://x.com');
    expect(fromString.steps).toEqual(['Mash.', 'Bake.']);
  });

  it('copes with missing optional fields and still validates', () => {
    const minimal = jsonLdToDraft({ '@type': 'Recipe', name: 'Toast', recipeIngredient: ['1 slice bread'] }, 'https://x.com');
    expect(minimal).toMatchObject({ servings: null, prepMinutes: null, tags: [], steps: [] });
    expect(validateRecipe(minimal).error).toBeUndefined();
  });
});

describe('parseIsoDuration', () => {
  it.each([
    ['PT1H20M', 80],
    ['PT90M', 90],
    ['P0DT0H35M', 35],
    ['P1D', 1440],
    ['PT45S', 1],
  ])('%s -> %d minutes', (input, expected) => {
    expect(parseIsoDuration(input)).toBe(expected);
  });

  it.each([[''], [null], ['PT'], ['P'], ['20 minutes'], ['PT0M']])('returns null for %j', (input) => {
    expect(parseIsoDuration(input)).toBeNull();
  });
});
