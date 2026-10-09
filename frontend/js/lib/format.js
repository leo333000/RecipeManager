// Display formatting.

/** 80 -> "1 h 20 min", 45 -> "45 min", null -> "". */
export function formatMinutes(minutes) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 3.6 -> "★★★★☆" (rounded to the nearest star). */
export function starText(rating) {
  const full = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function plural(count, word, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

/** Meta line parts for a recipe or recipe summary. */
export function recipeMeta(recipe) {
  const minutes = recipe.totalMinutes ?? ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || null);
  return [
    minutes ? formatMinutes(minutes) : null,
    recipe.servings ? plural(recipe.servings, 'serving') : null,
    recipe.rating ? `★ ${recipe.rating}` : null,
  ].filter(Boolean);
}
