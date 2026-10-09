// Builds the request handler: wires services together, checks the session,
// routes the request and turns errors into JSON responses.

import { createClaude, AiError } from './ai/client.js';
import { createRecipeAi } from './ai/recipeAi.js';
import { isAuthenticated } from './auth.js';
import { createRepos } from './db/repos.js';
import { errorBody, HttpError, json } from './http.js';
import { createRouter } from './router.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerIdeaRoutes } from './routes/ideas.js';
import { registerImageRoutes } from './routes/images.js';
import { registerImportRoutes } from './routes/imports.js';
import { registerMealRoutes } from './routes/meals.js';
import { registerRecipeRoutes } from './routes/recipes.js';
import { createAiChangeService } from './services/aiChanges.js';
import { createIdeaService } from './services/ideas.js';
import { createImageService } from './services/images.js';
import { createImportService } from './services/imports.js';
import { createMealService } from './services/meals.js';
import { createPantryService } from './services/pantry.js';
import { createRecipeIndex } from './services/recipeIndex.js';
import { createRecipeService } from './services/recipes.js';
import { createReviewService } from './services/reviews.js';

const AI_ERROR_STATUS = {
  ai_not_configured: 503,
  ai_unavailable: 502,
  ai_refused: 422,
  ai_bad_output: 422,
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

export function createServices({ store, env, now, random, fetch, ai }) {
  const repos = createRepos(store);
  const recipeAi = ai ?? createRecipeAi(createClaude({ apiKey: env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || undefined }));
  const recipeIndex = createRecipeIndex({ repos });
  const recipes = createRecipeService({ repos, recipeIndex, now });
  const pantry = createPantryService({ repos });

  return {
    recipes,
    pantry,
    reviews: createReviewService({ repos, recipeIndex, now }),
    images: createImageService({ repos }),
    aiChanges: createAiChangeService({ repos, recipes, ai: recipeAi }),
    meals: createMealService({ repos, ai: recipeAi, pantry, now, random }),
    ideas: createIdeaService({ repos, recipeIndex, pantry, ai: recipeAi }),
    imports: createImportService({ ai: recipeAi, fetch }),
  };
}

export function errorResponse(error) {
  if (error instanceof HttpError) return json(errorBody(error.code, error.message), error.status);
  if (error instanceof AiError) return json(errorBody(error.code, error.message), AI_ERROR_STATUS[error.code] ?? 502);
  if (error instanceof URIError) return json(errorBody('bad_path', 'Malformed address'), 400);
  console.error(error);
  return json(errorBody('internal', 'Something went wrong on the server'), 500);
}

/**
 * deps: { store, env, now?, random?, fetch?, ai? }
 * `ai` replaces the Claude-backed recipe AI (used by tests).
 */
export function createApp(deps) {
  const context = {
    env: deps.env ?? {},
    now: deps.now ?? (() => new Date()),
    random: deps.random ?? Math.random,
    fetch: deps.fetch ?? globalThis.fetch,
  };
  const services = createServices({ ...deps, ...context });

  const router = createRouter();
  registerAuthRoutes(router, context);
  registerRecipeRoutes(router, services);
  registerImageRoutes(router, services);
  registerMealRoutes(router, services);
  registerIdeaRoutes(router, services);
  registerImportRoutes(router, services);

  return async function handle(request) {
    let response;
    try {
      const { pathname } = new URL(request.url);
      const route = router.match(request.method, pathname);
      if (!route) throw new HttpError(404, 'not_found', 'No such endpoint');
      if (route.methodNotAllowed) throw new HttpError(405, 'method_not_allowed', 'Method not allowed');
      if (!route.isPublic && !isAuthenticated(request, context.env, context.now().getTime())) {
        throw new HttpError(401, 'unauthorized', 'Please sign in');
      }
      response = await route.handler({ request, params: route.params });
    } catch (error) {
      response = errorResponse(error);
    }

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(name)) response.headers.set(name, value);
    }
    return response;
  };
}
