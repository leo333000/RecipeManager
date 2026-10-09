# 02: Recipes, notes and history

Status: ready

## Overview
The core of the app: browse, read, create, edit and delete recipes; add notes to a recipe and to individual ingredients; see and restore earlier versions.

## User stories
- As Leo, I want to find a recipe in a couple of taps by searching or filtering by tag.
- As Leo, I want a clean recipe page while cooking, with extra detail (notes, reviews) hidden until I ask for it.
- As Leo, I want to jot a note on a recipe or on one ingredient ("use less salt", "buy the 70% one") without opening the full editor.
- As Leo, I want every edit to keep the previous version so I can compare and go back.

## Acceptance criteria
**List and search**
- AC-1: `GET /api/recipes` returns `{ recipes: RecipeSummary[] }` sorted by title.
- AC-2: The list page filters as I type by title, tag or ingredient name (case-insensitive), can filter by one tag, and can sort by title, recently updated or rating. Filters live behind a "Filter" toggle.
- AC-3: With no recipes, the list shows an empty state with "Write a recipe" and "Import" buttons.

**Create and edit**
- AC-4: `POST /api/recipes { recipe }` validates and normalizes the input (rules in `00-architecture.md`), assigns `id`, `version: 1`, `changeReason: "created"` and timestamps, returns 201 `{ recipe }`, and adds it to the index.
- AC-5: Invalid input returns 400 `invalid_recipe` with a message naming the first bad field (for example "title is required").
- AC-6: `PUT /api/recipes/:id { recipe, baseVersion, reason }` saves a snapshot of the current version, then stores the new content as `version + 1` with `changeReason` = `reason` (default `edit`). Notes, `id`, `createdAt` and `source` are kept from the stored recipe.
- AC-7: If `baseVersion` differs from the stored version, `PUT` returns 409 `version_conflict` and changes nothing.
- AC-8: The editor accepts quantities as `1/2`, `1 1/2`, `½`, `0.5` or `0,5`. A "Paste as text" toggle turns lines such as `200 g flour, sifted` into ingredient rows (quantity 200, unit g, name flour, note sifted).
- AC-9: Tags are trimmed, lower-cased and de-duplicated. Hue defaults to violet.

**Delete**
- AC-10: `DELETE /api/recipes/:id` removes the recipe, its versions, reviews and review images, and its index entry, then returns 204. The UI asks for confirmation first.

**Notes**
- AC-11: `POST /api/recipes/:id/notes { text }` adds a note (newest first) without creating a new version and returns `{ recipe }`. Empty text returns 400.
- AC-12: `DELETE /api/recipes/:id/notes/:noteId` removes the note and returns `{ recipe }`.
- AC-13: `PATCH /api/recipes/:id/ingredients/:ingredientId { note }` sets that ingredient's note (empty string clears it) without creating a new version, and returns `{ recipe }`. An unknown ingredient returns 404.
- AC-14: On the recipe page, notes are in a collapsed "Notes (n)" section. Ingredients that have a note show a small marker; tapping the ingredient's note button reveals the note and an edit field.

**History**
- AC-15: `GET /api/recipes/:id/versions` returns `{ current, versions: [{ version, savedAt, reason }] }` for all earlier versions, newest first.
- AC-16: `GET /api/recipes/:id/versions/:n` returns `{ version: { version, savedAt, reason, recipe } }`, or 404.
- AC-17: `POST /api/recipes/:id/versions/:n/restore { baseVersion }` makes version n's content the new current version (`changeReason: "restore"`), keeping the current notes. It returns `{ recipe }`.
- AC-18: The history page lists versions. Each one can be expanded to read it, compared with the current version (the same before/after view as spec 03), or restored after confirmation.

## Front end (for frontend-developer)
- `#/recipes`: search box, a "Filter" toggle (tag chips and sort), and a grid of cards (hue edge, title, time, servings, ★ rating).
- `#/recipes/:id`: page tinted with the recipe hue. It shows the title, description and a meta line (servings, prep, cook, tags, rating). The primary action is "Edit". A "More" menu holds "Change with AI", "History", "Add to meal plan", "Review this meal" and "Delete". Ingredients are tick-able while cooking (not saved). Steps are numbered. Notes and reviews are collapsed sections.
- `#/new` and `#/recipes/:id/edit`: title, description, servings, prep and cook minutes, tags (comma separated), hue swatches, ingredient rows (quantity, unit, name, note toggle, move up and down, remove), steps (move and remove), and the paste toggle. When `#/new?draft=1` is opened, the form is pre-filled from `sessionStorage['recipe-draft']`, which import and ideas set.
- `#/recipes/:id/history`: as described in AC-18.

## Back end (for backend-developer)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/recipes` | | `{ recipes: RecipeSummary[] }` |
| POST | `/api/recipes` | `{ recipe: RecipeDraft }` | 201 `{ recipe }` |
| GET | `/api/recipes/:id` | | `{ recipe }` |
| PUT | `/api/recipes/:id` | `{ recipe, baseVersion, reason? }` | `{ recipe }` / 409 |
| DELETE | `/api/recipes/:id` | | 204 |
| POST | `/api/recipes/:id/notes` | `{ text }` | 201 `{ recipe }` |
| DELETE | `/api/recipes/:id/notes/:noteId` | | `{ recipe }` |
| PATCH | `/api/recipes/:id/ingredients/:ingredientId` | `{ note }` | `{ recipe }` |
| GET | `/api/recipes/:id/versions` | | `{ current, versions }` |
| GET | `/api/recipes/:id/versions/:n` | | `{ version }` |
| POST | `/api/recipes/:id/versions/:n/restore` | `{ baseVersion }` | `{ recipe }` |

- `reason` must be one of `edit`, `ai-format`, `review-improvement`; anything else becomes `edit`.
- Ingredient and step ids sent by the client are kept when they are valid strings; missing ids are generated.

## Test notes (for tester)
- Validation edge cases: blank title, 121-character title, negative quantity, servings 0, more than 200 ingredients, steps given as plain strings.
- Version flow: create, edit twice, list versions (2 entries), restore v1 (becomes v4, keeps notes), stale `baseVersion` returns 409.

## Out of scope
Scaling servings, cooking timers, sharing recipes.
