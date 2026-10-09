// Shapes of every answer we ask Claude for. Answers are validated against
// these before use, then normalized with shared/recipe.js like user input.

import { z } from 'zod';

export const IngredientDraft = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string(),
  note: z.string(),
});

export const RecipeDraft = z.object({
  title: z.string(),
  description: z.string(),
  servings: z.number().nullable(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  tags: z.array(z.string()),
  ingredients: z.array(IngredientDraft),
  steps: z.array(z.string()),
});

export const RecipeChange = z.object({
  summary: z.string(),
  changes: z.array(z.string()),
  recipe: RecipeDraft,
});

export const Extraction = z.object({
  found: z.boolean(),
  recipe: RecipeDraft,
});

export const IngredientList = z.object({
  ingredients: z.array(IngredientDraft),
});

export const IdeaList = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      uses: z.array(z.string()),
      missing: z.array(z.string()),
    }),
  ),
});
