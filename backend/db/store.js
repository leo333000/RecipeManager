// Storage adapters. Both expose the same small interface so services and
// tests do not depend on Netlify Blobs directly.

import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'leos-recipes';

export function createBlobStore() {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  return {
    getJSON: (key) => store.get(key, { type: 'json' }),
    setJSON: (key, value) => store.setJSON(key, value),
    async getBinary(key) {
      const entry = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      return entry ? { data: entry.data, metadata: entry.metadata } : null;
    },
    setBinary: (key, data, metadata) => store.set(key, data, { metadata }),
    async exists(key) {
      return (await store.getMetadata(key)) !== null;
    },
    delete: (key) => store.delete(key),
    async listKeys(prefix) {
      const { blobs } = await store.list({ prefix });
      return blobs.map((blob) => blob.key);
    },
  };
}

/** In-memory store with the same interface, for tests. */
export function createMemoryStore() {
  const entries = new Map();

  return {
    async getJSON(key) {
      return entries.has(key) ? structuredClone(entries.get(key).value) : null;
    },
    async setJSON(key, value) {
      entries.set(key, { value: structuredClone(value) });
    },
    async getBinary(key) {
      const entry = entries.get(key);
      return entry ? { data: entry.value, metadata: entry.metadata } : null;
    },
    async setBinary(key, data, metadata) {
      entries.set(key, { value: data, metadata });
    },
    async exists(key) {
      return entries.has(key);
    },
    async delete(key) {
      entries.delete(key);
    },
    async listKeys(prefix) {
      return [...entries.keys()].filter((key) => key.startsWith(prefix)).sort();
    },
  };
}
