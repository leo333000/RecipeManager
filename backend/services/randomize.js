// Random selection with an injectable random() so tests are repeatable.

/** Returns up to `count` different items in random order. Does not modify `items`. */
export function pickRandom(items, count, random = Math.random) {
  const pool = [...items];
  const picks = Math.min(Math.max(count, 0), pool.length);
  for (let i = 0; i < picks; i += 1) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, picks);
}
