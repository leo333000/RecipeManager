// Ask Claude to format a recipe or apply review improvements, then compare and confirm.

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { plural } from '../lib/format.js';
import { navigate } from '../router.js';
import { AI_WAIT_TEXT, backLink, button, errorBox, field, loading, pageHead } from '../ui/components.js';
import { compareView } from '../ui/compare.js';
import { toast, withBusy } from '../ui/feedback.js';

export async function aiChangePage(container, { id }) {
  replace(container, loading());
  const [recipe, reviews] = await Promise.all([api.getRecipe(id), api.listReviews(id)]);
  const recipePath = `/recipes/${encodeURIComponent(id)}`;
  container.closest('main').dataset.hue = recipe.hue;

  const result = h('div', {});

  const showProposal = (proposal, reason) => {
    const apply = button('Apply changes', {
      variant: 'primary',
      onclick: () =>
        withBusy(apply, 'Saving…', async () => {
          const saved = await api.updateRecipe(id, proposal.proposed, proposal.baseVersion, reason);
          toast(`Saved as version ${saved.version}`);
          navigate(recipePath);
        }),
    });
    replace(result,
      compareView(recipe, proposal.proposed, { summary: proposal.summary, changes: proposal.changes }),
      h('div', { class: 'sticky-actions' }, button('Discard', { variant: 'ghost', onclick: () => navigate(recipePath) }), apply),
    );
  };

  const run = async (request, reason) => {
    choices.hidden = true;
    replace(result, loading(AI_WAIT_TEXT));
    try {
      showProposal(await request(), reason);
    } catch (error) {
      replace(result, errorBox(error, () => run(request, reason)));
      choices.hidden = false;
    }
  };

  const instructions = h('textarea', {
    rows: 3,
    maxlength: 1000,
    placeholder: 'Optional, e.g. convert to grams, make it vegetarian, shorter steps',
  });

  const choices = h('div', {},
    h('div', { class: 'panel' },
      h('h2', { class: 'section-title', text: 'Format with AI' }),
      h('p', { class: 'small muted', text: 'Tidies wording, structure and units. Nothing is saved until you approve the changes.' }),
      field('Instruction', instructions),
      button('Format', { variant: 'primary', onclick: () => run(() => api.aiFormat(id, instructions.value), 'ai-format') }),
    ),
    h('div', { class: 'panel' },
      h('h2', { class: 'section-title', text: 'Improve from reviews' }),
      h('p', { class: 'small muted', text: reviews.length
        ? `Applies the improvements from your ${plural(reviews.length, 'review')}.`
        : 'Add a review after cooking, then Claude can apply your improvements.' }),
      button('Improve', { disabled: reviews.length === 0, onclick: () => run(() => api.aiImprove(id), 'review-improvement') }),
    ),
  );

  replace(container,
    backLink(`#${recipePath}`, recipe.title),
    pageHead('Change with AI'),
    choices,
    result,
  );
}
