// Parsing and formatting of ingredient quantities ("1 1/2", "½", "0,5"...).

const UNICODE_FRACTIONS = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅕': 1 / 5, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
};

const DISPLAY_FRACTIONS = [
  [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4'],
];

const FRACTION_TOLERANCE = 0.01;

export const UNICODE_FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

/** Returns a non-negative number, or null when the text is blank or not a quantity. */
export function parseQuantity(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : null;

  const text = String(input).trim().replace(',', '.');
  if (!text) return null;

  const unicode = text.match(new RegExp(`^(\\d+)?\\s*([${UNICODE_FRACTION_CHARS}])$`));
  if (unicode) return (unicode[1] ? Number(unicode[1]) : 0) + UNICODE_FRACTIONS[unicode[2]];

  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return fraction(Number(mixed[2]), Number(mixed[3]), Number(mixed[1]));

  const simple = text.match(/^(\d+)\/(\d+)$/);
  if (simple) return fraction(Number(simple[1]), Number(simple[2]), 0);

  if (/^(\d+(\.\d+)?|\.\d+)$/.test(text)) return Number(text);
  return null;
}

function fraction(numerator, denominator, whole) {
  if (denominator === 0) return null;
  return whole + numerator / denominator;
}

/** Formats 1.5 as "1 1/2", 0.333 as "1/3" and 1200 as "1200". Returns "" for null. */
export function formatQuantity(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';

  const whole = Math.floor(value);
  const rest = value - whole;
  if (rest < FRACTION_TOLERANCE) return String(whole);
  if (rest > 1 - FRACTION_TOLERANCE) return String(whole + 1);

  const match = DISPLAY_FRACTIONS.find(([amount]) => Math.abs(rest - amount) < FRACTION_TOLERANCE);
  if (match) return whole ? `${whole} ${match[1]}` : match[1];

  return String(Math.round(value * 100) / 100);
}
