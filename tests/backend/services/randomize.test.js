import { describe, expect, it } from 'vitest';
import { pickRandom } from '../../../backend/services/randomize.js';

const items = ['a', 'b', 'c', 'd', 'e'];

describe('pickRandom (spec 05 AC-3)', () => {
  it('returns the requested number of different items', () => {
    const picks = pickRandom(items, 3);
    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
    picks.forEach((pick) => expect(items).toContain(pick));
  });

  it('returns every item when asked for more than exist', () => {
    expect(pickRandom(items, 10).sort()).toEqual(items);
  });

  it('is deterministic with an injected random()', () => {
    expect(pickRandom(items, 2, () => 0)).toEqual(['a', 'b']);
    // Always picking the last remaining slot: swap a<->e, then b<->a.
    expect(pickRandom(items, 2, () => 0.999)).toEqual(['e', 'a']);
  });

  it('does not modify the input', () => {
    const copy = [...items];
    pickRandom(copy, 3, () => 0.5);
    expect(copy).toEqual(items);
  });

  it('returns nothing for zero or negative counts', () => {
    expect(pickRandom(items, 0)).toEqual([]);
    expect(pickRandom(items, -2)).toEqual([]);
  });
});
