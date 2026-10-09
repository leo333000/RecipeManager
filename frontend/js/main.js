// App entry: checks the session, then renders the page for the current hash.

import { api, AUTH_REQUIRED_EVENT } from './api.js';
import { matchRoute, navigate, parseHash } from './router.js';
import { errorBox, loading } from './ui/components.js';
import { renderNav, updateNav } from './ui/shell.js';
import { addPage } from './pages/add.js';
import { aiChangePage } from './pages/aiChange.js';
import { editPage } from './pages/edit.js';
import { historyPage } from './pages/history.js';
import { ideasPage } from './pages/ideas.js';
import { importPage } from './pages/import.js';
import { loginPage } from './pages/login.js';
import { mealPage } from './pages/meal.js';
import { mealsPage } from './pages/meals.js';
import { pantryPage } from './pages/pantry.js';
import { recipePage } from './pages/recipe.js';
import { recipeListPage } from './pages/recipes.js';
import { reviewPage } from './pages/review.js';
import { shoppingPage } from './pages/shopping.js';

const ROUTES = [
  { pattern: '/login', page: loginPage, isPublic: true },
  { pattern: '/recipes', page: recipeListPage, wide: true },
  { pattern: '/recipes/:id', page: recipePage },
  { pattern: '/recipes/:id/edit', page: editPage },
  { pattern: '/recipes/:id/ai', page: aiChangePage, wide: true },
  { pattern: '/recipes/:id/history', page: historyPage, wide: true },
  { pattern: '/recipes/:id/review', page: reviewPage },
  { pattern: '/new', page: editPage },
  { pattern: '/add', page: addPage },
  { pattern: '/import/:kind', page: importPage },
  { pattern: '/meals', page: mealsPage },
  { pattern: '/meals/:id', page: mealPage },
  { pattern: '/meals/:id/shopping', page: shoppingPage },
  { pattern: '/pantry', page: pantryPage },
  { pattern: '/ideas', page: ideasPage, wide: true },
];

const view = document.getElementById('view');
const nav = document.getElementById('nav');
let signedIn = false;
let firstRender = true;

const app = {
  /** Called by the sign-in page. */
  signedIn(next) {
    signedIn = true;
    navigate(next && next.startsWith('/') && !next.startsWith('/login') ? next : '/recipes');
  },
  signOut() {
    signedIn = false;
    navigate('/login');
  },
};

function currentLocation() {
  return window.location.hash.replace(/^#/, '') || '/recipes';
}

async function render() {
  const { path, query } = parseHash(window.location.hash);
  const found = matchRoute(ROUTES, path);
  if (!found) {
    navigate('/recipes');
    return;
  }
  if (!found.route.isPublic && !signedIn) {
    navigate(`/login?next=${encodeURIComponent(currentLocation())}`);
    return;
  }

  view.className = found.route.wide ? 'wide' : '';
  delete view.dataset.hue;
  updateNav(nav, path, signedIn);

  const container = document.createElement('div');
  view.replaceChildren(container);
  window.scrollTo(0, 0);
  if (!firstRender) view.focus({ preventScroll: true });
  firstRender = false;

  try {
    await found.route.page(container, found.params, query, app);
  } catch (error) {
    if (error?.status !== 401) container.replaceChildren(errorBox(error, render));
  }
}

window.addEventListener(AUTH_REQUIRED_EVENT, () => {
  if (!signedIn) return;
  signedIn = false;
  if (!parseHash(window.location.hash).path.startsWith('/login')) {
    navigate(`/login?next=${encodeURIComponent(currentLocation())}`);
  }
});

window.addEventListener('hashchange', render);

async function start() {
  renderNav(nav);
  view.replaceChildren(loading());
  try {
    await api.session();
    signedIn = true;
  } catch {
    signedIn = false;
  }
  render();
}

start();
