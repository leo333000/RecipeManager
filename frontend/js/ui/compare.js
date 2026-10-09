// Before/after view for AI proposals and history comparisons.

import { h } from '../dom.js';
import { diffRecipe } from '../lib/diff.js';
import { tabs, toggle } from './components.js';
import { recipeBody } from './recipeView.js';

const WIDE_QUERY = '(min-width: 900px)';

function diffList(lines) {
  return h('ul', { class: 'diff' }, lines.map((line) => h('li', { class: line.type, text: line.text })));
}

function fieldChange(field) {
  const lines = [];
  if (field.before) lines.push({ type: 'remove', text: field.before });
  if (field.after) lines.push({ type: 'add', text: field.after });
  return h('div', { class: 'change' }, h('h4', { text: field.label }), diffList(lines));
}

function changesView(diff) {
  if (!diff.changed) return h('p', { class: 'muted', text: 'No differences.' });

  const changedFields = diff.fields.filter((field) => field.changed);
  const unchangedFields = diff.fields.filter((field) => !field.changed && field.after);
  const listChanged = (lines) => lines.some((line) => line.type !== 'same');

  return h(
    'div',
    {},
    changedFields.map(fieldChange),
    listChanged(diff.ingredients) ? h('div', { class: 'change' }, h('h4', { text: 'Ingredients' }), diffList(diff.ingredients)) : null,
    listChanged(diff.steps) ? h('div', { class: 'change' }, h('h4', { text: 'Steps' }), diffList(diff.steps)) : null,
    unchangedFields.length
      ? toggle('Show unchanged', () =>
          unchangedFields.map((field) =>
            h('div', { class: 'field-change change' }, h('h4', { text: field.label }), h('span', { text: field.after })),
          ),
        { variant: 'inline' })
      : null,
  );
}

function column(title, recipe) {
  return h('div', {}, h('div', { class: 'column-label', text: title }), recipeBody(recipe));
}

/**
 * Compares `before` with `after`. Optional `summary` and `changes` (from Claude)
 * are shown on top. Wide screens get a side-by-side tab.
 */
export function compareView(before, after, { summary, changes = [], beforeLabel = 'Before', afterLabel = 'After' } = {}) {
  const diff = diffRecipe(before, after);
  const wide = window.matchMedia?.(WIDE_QUERY).matches ?? false;

  const items = [
    { id: 'changes', label: 'Changes', render: () => changesView(diff) },
    wide && {
      id: 'side',
      label: 'Side by side',
      render: () => h('div', { class: 'compare-columns side-by-side' }, column(beforeLabel, before), column(afterLabel, after)),
    },
    { id: 'before', label: beforeLabel, render: () => recipeBody(before) },
    { id: 'after', label: afterLabel, render: () => recipeBody(after) },
  ].filter(Boolean);

  return h(
    'div',
    { class: 'compare' },
    summary || changes.length
      ? h('div', { class: 'compare-summary' },
          summary ? h('p', { text: summary }) : null,
          changes.length ? h('ul', {}, changes.map((change) => h('li', { text: change }))) : null,
        )
      : null,
    tabs(items, 'changes'),
  );
}
