// Per-device conveniences kept in the browser. Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

const DRAFT_KEY = 'recipe-draft';
const CHECKS_PREFIX = 'shopping-checks:';

function read(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/** Keeps an imported or AI-made draft until the editor opens it. */
export function saveDraft(draft) {
  return write(window.sessionStorage, DRAFT_KEY, draft);
}

/** Returns the saved draft once, then forgets it. */
export function takeDraft() {
  const draft = read(window.sessionStorage, DRAFT_KEY);
  remove(window.sessionStorage, DRAFT_KEY);
  return draft;
}

/** Ticked shopping-list lines for one meal selection. */
export function loadChecks(selectionId) {
  return new Set(read(window.localStorage, CHECKS_PREFIX + selectionId) ?? []);
}

export function saveChecks(selectionId, checks) {
  write(window.localStorage, CHECKS_PREFIX + selectionId, [...checks]);
}
