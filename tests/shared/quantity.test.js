import { describe, expect, it } from 'vitest';
import { formatQuantity, parseQuantity } from '../../shared/quantity.js';

describe('parseQuantity (spec 02 AC-8)', () => {
  it.each([
    ['2', 2],
    ['0.5', 0.5],
    ['0,5', 0.5],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['½', 0.5],
    ['1½', 1.5],
    ['1 ¼', 1.25],
    ['.25', 0.25],
    [3, 3],
  ])('reads %j as %d', (input, expected) => {
    expect(parseQuantity(input)).toBeCloseTo(expected);
  });

  it.each([[''], ['  '], [null], [undefined], ['abc'], ['1/0'], [-2], ['2 eggs'], [Number.NaN]])('returns null for %j', (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe('formatQuantity', () => {
  it.each([
    [2, '2'],
    [1.5, '1 1/2'],
    [0.5, '1/2'],
    [1 / 3, '1/3'],
    [0.75, '3/4'],
    [2.999, '3'],
    [1200, '1200'],
    [0.15, '0.15'],
  ])('formats %d as %s', (input, expected) => {
    expect(formatQuantity(input)).toBe(expected);
  });

  it('returns an empty string for null', () => {
    expect(formatQuantity(null)).toBe('');
  });
});
