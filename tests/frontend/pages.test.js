// @vitest-environment jsdom
// Pure helpers exported by pages.
import { describe, expect, it } from 'vitest';
import { splitItems } from '../../frontend/js/pages/pantry.js';
import { lineKey, shoppingText } from '../../frontend/js/pages/shopping.js';
import { reasonLabel } from '../../frontend/js/pages/history.js';

describe('splitItems (spec 05 AC-5)', () => {
  it('splits on commas, semicolons and new lines', () => {
    expect(splitItems('eggs, flour\nolive oil;  ;salt ')).toEqual(['eggs', 'flour', 'olive oil', 'salt']);
    expect(splitItems('  ')).toEqual([]);
  });
});

describe('shopping list text (spec 05 AC-10)', () => {
  const lines = [
    { name: 'Eggs', quantity: 6, unit: '', sources: [] },
    { name: 'flour', quantity: 500, unit: 'g', sources: [] },
  ];

  it('builds a key from the lower-cased name and unit', () => {
    expect(lineKey(lines[0])).toBe('eggs|');
    expect(lineKey(lines[1])).toBe('flour|g');
  });

  it('copies only lines that are not ticked', () => {
    expect(shoppingText(lines, new Set())).toBe('- 6 Eggs\n- 500 g flour');
    expect(shoppingText(lines, new Set(['eggs|']))).toBe('- 500 g flour');
  });
});

describe('reasonLabel (spec 02 AC-18)', () => {
  it('names each version reason', () => {
    expect(reasonLabel('ai-format')).toBe('AI formatting');
    expect(reasonLabel('review-improvement')).toBe('Improved from reviews');
    expect(reasonLabel('something-new')).toBe('something-new');
  });
});
