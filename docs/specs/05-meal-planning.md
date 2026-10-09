# 05: Meal planning, pantry and shopping list

Status: ready

## Overview
Leo builds meal selections from his recipes (by hand or at random), can add dishes that aren't in the app (Claude generates their ingredient list), records what he already has at home, and gets a shopping list for a selection that leaves out what he already owns.

## User stories
- As Leo, I want to plan this week's meals and get one combined shopping list.
- As Leo, I want the app to pick meals for me when I can't decide.
- As Leo, I want to add "Grandma's lasagne", which isn't in the app, and still get its ingredients on the list.
- As Leo, I want the list to skip what's already in my cupboard.

## Acceptance criteria
**Selections**
- AC-1: `POST /api/meals { name, recipeIds? }` creates a selection (name defaults to "Meals <date>"); unknown recipe ids return 400. `GET /api/meals` lists `{ selections: [{ id, name, itemCount, updatedAt }] }`, newest first.
- AC-2: `POST /api/meals/:id/items { recipeId }` adds a recipe item (the same recipe can't be added twice: 409 `duplicate`). `DELETE /api/meals/:id/items/:itemId` removes an item. `PATCH /api/meals/:id { name }` renames. `DELETE /api/meals/:id` deletes.
- AC-3: `POST /api/meals/random { count, tag?, name? }` picks `count` (1 to 14) different recipes at random, optionally only recipes with `tag`, and creates a selection. If fewer recipes match than requested, it uses all of them; if none match, it returns 400 `no_recipes`.
- AC-4: `POST /api/meals/:id/external { title, servings }` asks Claude for that dish's ingredient list and adds an `external` item with those ingredients.

**Pantry**
- AC-5: `POST /api/pantry { names: string[] }` adds items, ignoring blanks and names already present (matched after normalization: case, punctuation and simple plurals, so "Tomatoes" equals "tomato"). It returns `{ items }` sorted by name. `DELETE /api/pantry/:itemId` removes one; `DELETE /api/pantry` clears all.

**Shopping list**
- AC-6: `GET /api/meals/:id/shopping-list` returns `{ toBuy, alreadyHave, missingRecipes }`. Each entry is `{ name, quantity, unit, sources: string[] }`.
- AC-7: Ingredients with the same normalized name and compatible units are merged and their quantities summed (kg converts to g and l to ml; unit synonyms such as "tablespoons" and "tbsp" merge). Totals of 1000 g or ml or more are shown in kg or l. Different units for the same ingredient stay as separate lines. Lines without a quantity merge with each other.
- AC-8: An ingredient goes to `alreadyHave` when a pantry item's words all appear in the ingredient's normalized name ("olive oil" covers "extra virgin olive oil"). Water is always treated as owned.
- AC-9: Recipe items whose recipe was deleted are listed by title in `missingRecipes` and skipped.
- AC-10: The shopping page shows `toBuy` with tick boxes (ticks are remembered on this device), a "Copy list" button, sources behind a "Show sources" toggle, and a collapsed "Already have (n)" section.

## Front end (for frontend-developer)
- `#/meals`: the list of selections, a "New" button, and a "Random" toggle (count, optional tag, "Pick for me").
- `#/meals/:id`: editable name, items (recipe items link to the recipe; external items show an "AI" badge and an ingredient toggle), an "Add recipe" toggle (search and pick), an "Add other dish" toggle (title and servings), and a "Shopping list" primary button. Deleting the selection is in the More menu.
- The recipe page's "Add to meal plan" lets you pick an existing selection or create a new one.
- `#/pantry`: one input that accepts comma or newline separated items, chips with remove buttons, "Clear all" in the More menu, and a link to "What can I cook?" (Ideas).

## Back end (for backend-developer)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/meals` | | `{ selections }` |
| POST | `/api/meals` | `{ name?, recipeIds? }` | 201 `{ selection }` |
| POST | `/api/meals/random` | `{ count, tag?, name? }` | 201 `{ selection }` |
| GET | `/api/meals/:id` | | `{ selection }` |
| PATCH | `/api/meals/:id` | `{ name }` | `{ selection }` |
| DELETE | `/api/meals/:id` | | 204 |
| POST | `/api/meals/:id/items` | `{ recipeId }` | 201 `{ selection }` |
| POST | `/api/meals/:id/external` | `{ title, servings }` | 201 `{ selection }` |
| DELETE | `/api/meals/:id/items/:itemId` | | `{ selection }` |
| GET | `/api/meals/:id/shopping-list` | | `{ toBuy, alreadyHave, missingRecipes }` |
| GET | `/api/pantry` | | `{ items }` |
| POST | `/api/pantry` | `{ names }` | `{ items }` |
| DELETE | `/api/pantry/:itemId` | | `{ items }` |
| DELETE | `/api/pantry` | | `{ items: [] }` |

- Shopping-list building, random picking and name normalization are pure functions (`services/shoppingList.js`, `services/randomize.js`, `shared/ingredients.js`) so they can be unit tested.
- Random picking takes an injectable `random()` so tests are deterministic.

## Test notes (for tester)
- Merging: "2 tbsp olive oil" + "1 tablespoon olive oil" makes 3 tbsp; "1 kg flour" + "200 g flour" makes 1.2 kg; "1 cup milk" + "200 ml milk" stays as two lines.
- Pantry: "salt" covers "sea salt"; "pepper" does not cover "peppercorn" (word match, not substring).

## Out of scope
Scaling quantities by servings, grouping the list by supermarket aisle.
