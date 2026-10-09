// Earlier versions of a recipe: read, compare with the current one, restore.

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { formatDate } from '../lib/format.js';
import { navigate } from '../router.js';
import { backLink, button, loading, pageHead, tabs, toggle } from '../ui/components.js';
import { compareView } from '../ui/compare.js';
import { confirmDialog, toast, withBusy } from '../ui/feedback.js';
import { recipeBody } from '../ui/recipeView.js';

const REASONS = {
  created: 'Created',
  edit: 'Edited',
  'ai-format': 'AI formatting',
  'review-improvement': 'Improved from reviews',
  restore: 'Restored',
};

export const reasonLabel = (reason) => REASONS[reason] ?? reason;

export async function historyPage(container, { id }) {
  replace(container, loading());
  const [recipe, history] = await Promise.all([api.getRecipe(id), api.listVersions(id)]);
  const recipePath = `/recipes/${encodeURIComponent(id)}`;
  container.closest('main').dataset.hue = recipe.hue;

  const versionDetails = (summary) => {
    const body = h('div', {}, loading());
    api.getVersion(id, summary.version).then(
      (snapshot) => {
        const restore = button('Restore this version', {
          onclick: async () => {
            const ok = await confirmDialog(`Make version ${summary.version} the current recipe? The current version stays in the history.`, {
              confirmLabel: 'Restore',
            });
            if (!ok) return;
            await withBusy(restore, 'Restoring…', async () => {
              const saved = await api.restoreVersion(id, summary.version, recipe.version);
              toast(`Restored as version ${saved.version}`);
              navigate(recipePath);
            });
          },
        });
        replace(body,
          tabs([
            { id: 'read', label: `Version ${summary.version}`, render: () => recipeBody(snapshot.recipe) },
            {
              id: 'compare',
              label: 'Compare with current',
              render: () => compareView(snapshot.recipe, recipe, { beforeLabel: `Version ${summary.version}`, afterLabel: 'Current' }),
            },
          ]),
          h('div', { class: 'button-row' }, restore),
        );
      },
      (error) => replace(body, h('p', { class: 'muted', text: error.message })),
    );
    return body;
  };

  replace(container,
    backLink(`#${recipePath}`, recipe.title),
    pageHead('History'),
    h('p', { class: 'lead small', text: `Current: version ${recipe.version} · ${reasonLabel(recipe.changeReason)} · ${formatDate(recipe.updatedAt)}` }),
    history.versions.length
      ? h('div', {},
          history.versions.map((summary) =>
            toggle(`v${summary.version} · ${reasonLabel(summary.reason)} · ${formatDate(summary.savedAt)}`, () => versionDetails(summary)),
          ),
        )
      : h('p', { class: 'muted', text: 'No earlier versions yet. Each edit keeps the previous version here.' }),
  );
}
