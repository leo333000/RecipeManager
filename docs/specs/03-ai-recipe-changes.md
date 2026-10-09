# 03: AI recipe changes (formatting and review-based improvements)

Status: ready

## Overview
Claude can rewrite a recipe in two ways: **format** (clean up wording, structure and units, optionally following an instruction such as "make it vegetarian") and **improve from reviews** (apply the improvements Leo wrote in his meal reviews). Nothing is saved until Leo has compared the before and after and confirmed.

## User stories
- As Leo, I want Claude to tidy a messy recipe I typed quickly.
- As Leo, I want the "improvements" I noted after cooking to flow back into the recipe automatically, but only after I approve the exact changes.

## Acceptance criteria
- AC-1: `POST /api/recipes/:id/ai/format { instructions? }` returns `{ proposed: Recipe, summary, changes: string[], baseVersion }` and does not modify stored data.
- AC-2: `POST /api/recipes/:id/ai/improve` uses the recipe and all its reviews (ratings, notes, improvements). If the recipe has no reviews, it returns 400 `no_reviews`.
- AC-3: In `proposed`, ingredients whose name matches an existing ingredient keep that ingredient's `id`, and their `note` is kept when Claude returns an empty note. `id`, `notes`, `hue`, `source`, `createdAt` and `version` are carried over from the stored recipe.
- AC-4: The proposal is validated with the same rules as a manual edit. An invalid or empty proposal returns 422 `ai_bad_output`.
- AC-5: The before/after view shows Claude's summary and change list, then every field that changed. Ingredients and steps are shown as a line diff (removed lines struck through on `--red-1`, added lines on `--green-1`). Unchanged fields are hidden behind a "Show unchanged" toggle.
- AC-6: On wide screens Before and After sit side by side; on phones a toggle switches between "Changes", "Before" and "After".
- AC-7: "Apply" sends `PUT /api/recipes/:id` with `baseVersion` from the proposal and reason `ai-format` or `review-improvement`. "Discard" returns to the recipe without saving.
- AC-8: Claude failures map to clear errors: 503 `ai_not_configured` (no API key), 502 `ai_unavailable` (network, timeout, rate limit, server error), 422 `ai_refused` (declined), 422 `ai_bad_output`. The page shows the message and a "Try again" button.

## Front end (for frontend-developer)
- `#/recipes/:id/ai`: two choices, "Format with AI" (optional instruction textarea) and "Improve from reviews" (disabled with a hint when there are no reviews). Show the loading line while waiting, then the before/after view with Apply and Discard.
- The before/after view is a reusable component, also used by History's "Compare with current".

## Back end (for backend-developer)
- `ai/recipeAi.js`: `formatRecipe(recipe, instructions)` and `improveFromReviews(recipe, reviews)` return `{ recipe: RecipeDraft, summary, changes }`.
- Prompts: keep the recipe's language and units unless the instruction says otherwise; don't invent ingredients; keep ingredient notes; for improvements, change only what the reviews justify and list each change.
- Effort: `low` for format, `medium` for improve.

## Test notes (for tester)
- Mock the AI module. Check the id and note carry-over (AC-3), that nothing is stored, the `no_reviews` 400, and the mapping of each AI error code.
- Test the line diff and recipe diff as pure functions.

## Out of scope
Partial acceptance of individual changes (accept all or discard).
