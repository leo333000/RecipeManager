# 06: Ideas (what to cook)

Status: ready

## Overview
Two kinds of suggestions: recipes Leo can make with what he already owns, and new dishes he might like based on what he rates highly. Any idea can be turned into a full draft recipe.

## Acceptance criteria
- AC-1: `GET /api/ideas/pantry-matches` ranks Leo's own recipes by the share of their ingredients covered by the pantry (same matching as spec 05, AC-8). It returns `{ matches: [{ id, title, hue, coverage, have, missing }] }`, leaving out recipes with 0 coverage, sorted by coverage (highest first), then by fewest missing.
- AC-2: `POST /api/ideas { mode: "pantry" }` asks Claude for up to 6 new dish ideas that mainly use pantry items. An empty pantry returns 400 `empty_pantry`.
- AC-3: `POST /api/ideas { mode: "taste" }` asks Claude for up to 6 new dishes Leo might like, based on his recipes (titles, tags, ratings) and review notes, excluding dishes he already has. With no recipes it returns 400 `no_recipes`.
- AC-4: Each idea is `{ title, description, uses: string[], missing: string[] }`.
- AC-5: `POST /api/ideas/recipe { title, description }` returns `{ draft }`, a complete RecipeDraft with `source.type: "ai"`. The front end stores it in `sessionStorage['recipe-draft']` and opens `#/new?draft=1`. Nothing is saved until Leo presses Save.
- AC-6: The Ideas page has two tabs: "From my pantry" (own matches first, missing items behind a toggle, then an "Ask Claude for new ideas" button) and "You might like" (a "Suggest" button). Each idea card shows the title and description, uses and missing items behind a toggle, and a "Make this recipe" button.

## Back end (for backend-developer)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/ideas/pantry-matches` | | `{ matches }` |
| POST | `/api/ideas` | `{ mode }` | `{ ideas }` |
| POST | `/api/ideas/recipe` | `{ title, description }` | `{ draft }` |

- Effort `medium` for ideas, `low` for the recipe draft.

## Test notes (for tester)
- Ranking order and tie-breaks; the empty pantry and no-recipes errors; mock the AI for idea output.
