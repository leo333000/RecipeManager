import { describe, expect, it } from 'vitest';
import { formatDate, formatMinutes, plural, recipeMeta, starText } from '../../../frontend/js/lib/format.js';

describe('formatMinutes', () => {
  it.each([
    [45, '45 min'],
    [60, '1 h'],
    [80, '1 h 20 min'],
    [null, ''],
    [0, ''],
  ])('%j -> %j', (input, expected) => {
    expect(formatMinutes(input)).toBe(expected);
  });
});

describe('starText', () => {
  it('rounds to whole stars and clamps', () => {
    expect(starText(3.6)).toBe('★★★★☆');
    expect(starText(0)).toBe('☆☆☆☆☆');
    expect(starText(9)).toBe('★★★★★');
    expect(starText(null)).toBe('☆☆☆☆☆');
  });
});

describe('plural', () => {
  it('picks the right form', () => {
    expect(plural(1, 'dish', 'dishes')).toBe('1 dish');
    expect(plural(3, 'dish', 'dishes')).toBe('3 dishes');
    expect(plural(2, 'serving')).toBe('2 servings');
  });
});

describe('formatDate', () => {
  it('formats valid dates and returns "" for invalid ones', () => {
    expect(formatDate('2026-10-09T12:00:00Z')).toMatch(/2026/);
    expect(formatDate('nope')).toBe('');
  });
});

describe('recipeMeta', () => {
  it('lists time, servings and rating when present', () => {
    expect(recipeMeta({ totalMinutes: 90, servings: 1, rating: 4.5 })).toEqual(['1 h 30 min', '1 serving', '★ 4.5']);
    expect(recipeMeta({ prepMinutes: 5, cookMinutes: 10, servings: null, rating: null })).toEqual(['15 min']);
    expect(recipeMeta({ servings: null, rating: null })).toEqual([]);
  });
});
