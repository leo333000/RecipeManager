// Recipe features powered by Claude. Services call these functions only, so
// tests can replace this whole module with a fake.

import {
  DRAFT_FROM_IDEA_SYSTEM,
  EXTRACT_SYSTEM,
  FORMAT_SYSTEM,
  IMPROVE_SYSTEM,
  INGREDIENTS_SYSTEM,
  PANTRY_IDEAS_SYSTEM,
  TASTE_IDEAS_SYSTEM,
} from './prompts.js';
import { Extraction, IdeaList, IngredientList, RecipeChange, RecipeDraft } from './schemas.js';

/** The editable parts of a recipe, as shown to Claude. */
export function recipeForPrompt(recipe) {
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    tags: recipe.tags,
    ingredients: recipe.ingredients.map(({ name, quantity, unit, note }) => ({ name, quantity, unit, note })),
    steps: recipe.steps.map((step) => step.text),
  };
}

const asJson = (value) => JSON.stringify(value, null, 2);
const bulletList = (items) => (items.length ? items.map((item) => `- ${item}`).join('\n') : '(none)');

export function createRecipeAi(callStructured) {
  return {
    formatRecipe(recipe, instructions) {
      return callStructured({
        system: FORMAT_SYSTEM,
        schema: RecipeChange,
        effort: 'low',
        content: `<recipe>\n${asJson(recipeForPrompt(recipe))}\n</recipe>\n\nLeo's instruction: ${instructions || 'none, just tidy it up'}`,
      });
    },

    improveFromReviews(recipe, reviews) {
      const reviewData = reviews.map(({ createdAt, rating, notes, improvements }) => ({
        date: createdAt.slice(0, 10),
        rating,
        notes,
        improvements,
      }));
      return callStructured({
        system: IMPROVE_SYSTEM,
        schema: RecipeChange,
        effort: 'medium',
        content: `<recipe>\n${asJson(recipeForPrompt(recipe))}\n</recipe>\n\n<reviews newest_first="true">\n${asJson(reviewData)}\n</reviews>`,
      });
    },

    generateIngredients(title, servings) {
      return callStructured({
        system: INGREDIENTS_SYSTEM,
        schema: IngredientList,
        effort: 'low',
        content: `Dish: ${title}\nServings: ${servings}`,
      });
    },

    extractFromText(text, url) {
      return callStructured({
        system: EXTRACT_SYSTEM,
        schema: Extraction,
        effort: 'low',
        content: `<source_page url="${url}">\n${text}\n</source_page>\n\nExtract the recipe from this page.`,
      });
    },

    extractFromImages(images) {
      return callStructured({
        system: EXTRACT_SYSTEM,
        schema: Extraction,
        effort: 'low',
        content: [
          ...images.map(({ data, mediaType }) => ({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data },
          })),
          { type: 'text', text: 'These photos show one recipe, possibly across several pages. Extract it.' },
        ],
      });
    },

    extractFromPdf(data) {
      return callStructured({
        system: EXTRACT_SYSTEM,
        schema: Extraction,
        effort: 'low',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
          { type: 'text', text: 'Extract the recipe from this PDF.' },
        ],
      });
    },

    suggestFromPantry({ pantry, existingTitles }) {
      return callStructured({
        system: PANTRY_IDEAS_SYSTEM,
        schema: IdeaList,
        effort: 'medium',
        content: `Pantry:\n${bulletList(pantry)}\n\nAlready in the collection:\n${bulletList(existingTitles)}`,
      });
    },

    suggestForTaste({ recipes, reviewNotes }) {
      const collection = recipes.map(
        ({ title, tags, rating }) => `${title} | ${tags.join(', ') || 'no tags'} | ${rating ?? 'not rated'}`,
      );
      return callStructured({
        system: TASTE_IDEAS_SYSTEM,
        schema: IdeaList,
        effort: 'medium',
        content: `Collection (title | tags | average rating out of 5):\n${bulletList(collection)}\n\nReview notes from his best-rated meals:\n${bulletList(reviewNotes)}`,
      });
    },

    draftFromIdea({ title, description, pantry }) {
      return callStructured({
        system: DRAFT_FROM_IDEA_SYSTEM,
        schema: RecipeDraft,
        effort: 'low',
        content: `Dish: ${title}\nDescription: ${description || '(none)'}\nPantry:\n${bulletList(pantry)}`,
      });
    },
  };
}
