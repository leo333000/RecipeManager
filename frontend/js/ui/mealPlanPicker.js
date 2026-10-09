// Dialog for adding a recipe to an existing or new meal plan.

import { api } from '../api.js';
import { h } from '../dom.js';
import { button } from './components.js';
import { toast, toastError } from './feedback.js';

/** Dialog to pick a meal selection (or create one) and add the recipe to it. */
export async function addToMealPlan(recipe) {
  const selections = await api.listMeals();
  const dialog = h('dialog', { 'aria-label': 'Add to meal plan' });
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  const add = async (getSelection) => {
    try {
      const selection = await getSelection();
      close();
      toast(`Added to ${selection.name}`);
    } catch (error) {
      toastError(error);
    }
  };

  dialog.append(
    h('p', { text: `Add "${recipe.title}" to:` }),
    h('div', { class: 'rows' },
      selections.map((selection) =>
        button(selection.name, { onclick: () => add(() => api.addMealRecipe(selection.id, recipe.id)) }),
      ),
      button('+ New meal plan', { variant: 'primary', onclick: () => add(() => api.createMeal({ recipeIds: [recipe.id] })) }),
    ),
    h('div', { class: 'button-row' }, button('Cancel', { variant: 'ghost', onclick: close })),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
