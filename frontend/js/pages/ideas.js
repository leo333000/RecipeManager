// What to cook: own recipes ranked by pantry coverage, plus Claude's ideas.

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { saveDraft } from '../lib/storage.js';
import { navigate } from '../router.js';
import { AI_WAIT_TEXT, button, emptyState, errorBox, linkButton, loading, pageHead, sectionTitle, tabs, toggle } from '../ui/components.js';
import { withBusy } from '../ui/feedback.js';

function ideaCard(idea) {
  const make = button('Make this recipe', {
    variant: 'primary',
    size: 'small',
    onclick: () =>
      withBusy(make, 'Writing the recipe…', async () => {
        saveDraft(await api.ideaRecipe({ title: idea.title, description: idea.description }));
        navigate('/new?draft=1');
      }),
  });
  const ingredients = [
    idea.uses.length ? h('p', { class: 'small' }, h('strong', { text: 'Uses: ' }), idea.uses.join(', ')) : null,
    idea.missing.length ? h('p', { class: 'small' }, h('strong', { text: 'To buy: ' }), idea.missing.join(', ')) : null,
  ].filter(Boolean);

  return h('article', { class: 'idea' },
    h('h3', { text: idea.title }),
    h('p', { text: idea.description }),
    ingredients.length ? toggle('Ingredients', ingredients, { variant: 'inline' }) : null,
    h('div', { class: 'button-row' }, make),
  );
}

/** A button that asks Claude for ideas and shows them below. */
function ideasBlock(mode, label) {
  const results = h('div', {});
  const ask = button(label, {
    onclick: async () => {
      ask.disabled = true;
      replace(results, loading(AI_WAIT_TEXT));
      try {
        const ideas = await api.ideas(mode);
        replace(results, ideas.length
          ? h('div', { class: 'card-grid' }, ideas.map(ideaCard))
          : h('p', { class: 'muted', text: 'No ideas this time. Try again.' }));
        ask.textContent = 'More ideas';
      } catch (error) {
        replace(results, errorBox(error));
      } finally {
        ask.disabled = false;
      }
    },
  });
  return [h('div', { class: 'button-row' }, ask), results];
}

function matchRow(match) {
  const coverage = h('div', { class: 'coverage', title: `${Math.round(match.coverage * 100)}% in your pantry` }, h('span', { style: { width: `${match.coverage * 100}%` } }));
  return h('a', { class: 'card', href: `#/recipes/${encodeURIComponent(match.id)}`, 'data-hue': match.hue },
    h('h3', { text: match.title }),
    coverage,
    h('div', { class: 'meta' },
      h('span', { text: `have ${match.have.length} of ${match.have.length + match.missing.length}` }),
      match.missing.length ? h('span', { text: `need ${match.missing.slice(0, 4).join(', ')}${match.missing.length > 4 ? '…' : ''}` }) : h('span', { text: 'nothing to buy' }),
    ),
  );
}

function pantryTab() {
  const body = h('div', {}, loading());
  Promise.all([api.getPantry(), api.pantryMatches()]).then(
    ([pantry, matches]) => {
      if (pantry.length === 0) {
        replace(body, emptyState('Your pantry is empty. Add what you have first.', linkButton('Open pantry', '#/pantry', { variant: 'primary' })));
        return;
      }
      replace(body,
        sectionTitle('Your recipes'),
        matches.length
          ? h('div', { class: 'card-grid' }, matches.map(matchRow))
          : h('p', { class: 'muted small', text: 'None of your recipes use these items yet.' }),
        sectionTitle('New ideas from Claude'),
        ideasBlock('pantry', 'Ask Claude for ideas'),
      );
    },
    (error) => replace(body, errorBox(error)),
  );
  return body;
}

function tasteTab() {
  return h('div', {},
    h('p', { class: 'lead small', text: 'Dishes Claude thinks you would enjoy, based on your recipes, ratings and reviews.' }),
    ideasBlock('taste', 'Suggest dishes'),
  );
}

export function ideasPage(container) {
  replace(container,
    pageHead('Ideas'),
    tabs([
      { id: 'pantry', label: 'From my pantry', render: pantryTab },
      { id: 'taste', label: 'You might like', render: tasteTab },
    ]),
  );
}
