// Create (#/new, optionally from a saved draft) or edit (#/recipes/:id/edit) a recipe.

import { validateRecipe } from '../../../shared/recipe.js';
import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { takeDraft } from '../lib/storage.js';
import { navigate } from '../router.js';
import { backLink, button, errorBox, loading, pageHead } from '../ui/components.js';
import { toast, withBusy } from '../ui/feedback.js';
import { recipeForm } from '../ui/recipeForm.js';

export async function editPage(container, params, query) {
  replace(container, loading());
  const existing = params.id ? await api.getRecipe(params.id) : null;
  if (existing) container.closest('main').dataset.hue = existing.hue;
  const draft = !existing && query.get('draft') ? takeDraft() : null;
  const form = recipeForm(existing ?? draft ?? {});
  const problems = h('div', {});

  const cancelPath = existing ? `/recipes/${encodeURIComponent(existing.id)}` : '/recipes';
  const save = button('Save', { variant: 'primary', type: 'submit' });

  const onsubmit = (event) => {
    event.preventDefault();
    const value = form.getValue();
    const { error } = validateRecipe(value);
    if (error) {
      replace(problems, errorBox({ message: `Check the recipe: ${error}.` }));
      problems.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    problems.replaceChildren();

    withBusy(save, 'Saving…', async () => {
      const saved = existing
        ? await api.updateRecipe(existing.id, value, existing.version, 'edit')
        : await api.createRecipe(value);
      toast(existing ? `Saved as version ${saved.version}` : 'Recipe saved');
      navigate(`/recipes/${encodeURIComponent(saved.id)}`);
    });
  };

  replace(container,
    backLink(`#${cancelPath}`, existing ? existing.title : 'Recipes'),
    pageHead(existing ? 'Edit recipe' : draft ? 'Check the imported recipe' : 'New recipe'),
    draft ? h('p', { class: 'lead small', text: 'Review what was read, fix anything that looks wrong, then save.' }) : null,
    problems,
    h('form', { onsubmit, novalidate: true },
      form.element,
      h('div', { class: 'sticky-actions' }, button('Cancel', { variant: 'ghost', onclick: () => navigate(cancelPath) }), save),
    ),
  );
  if (!existing) form.focus();
}
