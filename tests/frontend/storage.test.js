// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadChecks, saveChecks, saveDraft, takeDraft } from '../../frontend/js/lib/storage.js';

// Node 25 ships its own (non-functional without a file) localStorage global,
// which shadows jsdom's. Provide a simple Web Storage stand-in instead.
class MemoryStorage {
  #items = new Map();
  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }
  setItem(key, value) {
    this.#items.set(key, String(value));
  }
  removeItem(key) {
    this.#items.delete(key);
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('drafts (spec 06 AC-5, spec 07)', () => {
  it('returns a saved draft once', () => {
    expect(saveDraft({ title: 'Imported' })).toBe(true);
    expect(takeDraft()).toEqual({ title: 'Imported' });
    expect(takeDraft()).toBeNull();
  });

  it('copes with storage being unavailable', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(blocked);
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(blocked);
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(blocked);
    expect(saveDraft({ title: 'x' })).toBe(false);
    expect(takeDraft()).toBeNull();
    expect(loadChecks('m1')).toEqual(new Set());
  });

  it('ignores corrupted stored data', () => {
    window.sessionStorage.setItem('recipe-draft', '{not json');
    expect(takeDraft()).toBeNull();
  });
});

describe('shopping ticks (spec 05 AC-10)', () => {
  it('remembers ticks per meal plan', () => {
    saveChecks('m1', new Set(['eggs|']));
    expect(loadChecks('m1')).toEqual(new Set(['eggs|']));
    expect(loadChecks('m2')).toEqual(new Set());
  });
});
