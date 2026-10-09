// One meal plan: its dishes, adding recipes or outside dishes, and the shopping list link.

import { formatIngredient } from '../../../shared/ingredients.js';
import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { filterRecipes } from '../lib/search.js';
import { navigate } from '../router.js';
import { backLink, button, field, linkButton, loading, moreMenu, pageHead, sectionTitle, toggle } from '../ui/components.js';
import { confirmDialog, promptDialog, toast, toastError, withBusy } from '../ui/feedback.js';

const PICKER_LIMIT = 8;

function itemRow(selection, item, onchange) {
  const remove = button('×', {
    variant: 'ghost',
    size: 'small',
    ariaLabel: `Remove ${item.title}`,
    onclick: () => withBusy(remove, '…', async () => onchange(await api.removeMealItem(selection.id, item.id))),
  });

  const label = item.type === 'recipe'
    ? h('a', { href: `#/recipes/${encodeURIComponent(item.recipeId)}`, text: item.title })
    : h('div', {},
        h('span', { text: `${item.title} ` }),
        h('span', { class: 'badge', title: 'Ingredients listed by Claude', text: 'AI' }),
        toggle(`${item.ingredients.length} ingredients · ${item.servings} servings`, () =>
          h('ul', { class: 'small' }, item.ingredients.map((ingredient) => h('li', { text: formatIngredient(ingredient) }))),
        { variant: 'inline' }),
      );

  return h('li', {}, h('div', { class: 'list-row' }, label, remove));
}

function recipePicker(selection, recipes, onchange) {
  const results = h('div', { class: 'rows' });
  const search = h('input', { type: 'search', placeholder: 'Search your recipes', 'aria-label': 'Search recipes to add' });

  const render = () => {
    const included = new Set(selection.items.filter((item) => item.type === 'recipe').map((item) => item.recipeId));
    const matches = filterRecipes(recipes, { query: search.value }).filter((recipe) => !included.has(recipe.id)).slice(0, PICKER_LIMIT);
    results.replaceChildren(
      ...(matches.length
        ? matches.map((recipe) => {
            const add = button(`+ ${recipe.title}`, {
              onclick: () =>
                withBusy(add, 'Adding…', async () => {
                  onchange(await api.addMealRecipe(selection.id, recipe.id), 'recipe');
                }),
            });
            return add;
          })
        : [h('p', { class: 'muted small', text: 'No more recipes match.' })]),
    );
  };
  search.addEventListener('input', render);
  render();
  return [search, results];
}

function dishForm(selection, onchange) {
  const title = h('input', { required: true, maxlength: 120, placeholder: "e.g. Grandma's lasagne" });
  const servings = h('input', { type: 'number', min: 1, max: 100, value: '4', inputmode: 'numeric' });
  const add = button('Add dish', { variant: 'primary', type: 'submit' });
  return h('form', {
    class: 'form',
    onsubmit: (event) => {
      event.preventDefault();
      if (!title.value.trim()) return;
      withBusy(add, 'Claude is listing ingredients…', async () => {
        onchange(await api.addMealDish(selection.id, { title: title.value, servings: Number(servings.value) }), 'dish');
        toast('Dish added');
      });
    },
  },
    h('p', { class: 'small muted', text: "For a dish that isn't in the app. Claude lists its ingredients so it appears on the shopping list." }),
    h('div', { class: 'field-row' }, field('Dish', title), field('Servings', servings)),
    h('div', { class: 'button-row' }, add),
  );
}

export async function mealPage(container, { id }) {
  replace(container, loading());
  let [selection, recipes] = await Promise.all([api.getMeal(id), api.listRecipes()]);

  const render = (openSection) => {
    const onchange = (updated, section) => {
      selection = updated;
      render(section);
    };

    const menu = moreMenu([
      {
        label: 'Rename',
        onclick: async () => {
          const name = await promptDialog('Name', selection.name);
          if (!name) return;
          try {
            onchange(await api.renameMeal(selection.id, name));
          } catch (error) {
            toastError(error);
          }
        },
      },
      {
        label: 'Delete meal plan',
        danger: true,
        onclick: async () => {
          if (!(await confirmDialog(`Delete "${selection.name}"?`, { confirmLabel: 'Delete', danger: true }))) return;
          try {
            await api.deleteMeal(selection.id);
            toast('Meal plan deleted');
            navigate('/meals');
          } catch (error) {
            toastError(error);
          }
        },
      },
    ]);

    replace(container,
      backLink('#/meals', 'Meal plans'),
      pageHead(selection.name, menu),
      h('div', { class: 'button-row' },
        linkButton('Shopping list', `#/meals/${encodeURIComponent(selection.id)}/shopping`, { variant: 'primary' }),
      ),
      sectionTitle('Dishes'),
      selection.items.length
        ? h('ul', { class: 'list' }, selection.items.map((item) => itemRow(selection, item, onchange)))
        : h('p', { class: 'muted', text: 'No dishes yet. Add some below.' }),
      h('div', { class: 'sections' },
        toggle('Add a recipe', () => recipePicker(selection, recipes, onchange), { open: openSection === 'recipe' }),
        toggle('Add another dish', () => dishForm(selection, onchange), { open: openSection === 'dish' }),
      ),
    );
  };

  render();
}
