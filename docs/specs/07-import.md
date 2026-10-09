# 07: Import recipes (website, photo, PDF)

Status: ready

## Overview
Leo can bring in a recipe from a web page, a photo (cookbook page or handwritten card) or a PDF. Each import produces a draft that opens in the editor so he can check it before saving.

## Acceptance criteria
- AC-1: `POST /api/import/url { url }` accepts only absolute `http`/`https` URLs whose host is not `localhost`, a `.local`/`.internal` name, or a private or loopback IP address; anything else returns 400 `bad_url`.
- AC-2: The page is fetched with a 10 s timeout and a 3 MB cap. Network errors, timeouts and non-2xx responses return 502 `fetch_failed`.
- AC-3: If the page has schema.org `Recipe` JSON-LD (including inside `@graph` or arrays, and `@type` given as an array), the draft is built from it without Claude: name, description, recipeYield (first number) to servings, prepTime and cookTime (ISO 8601 durations) to minutes, recipeIngredient lines parsed into ingredients, recipeInstructions (string, HowToStep or HowToSection) to steps, and keywords, recipeCategory and recipeCuisine to tags. The response is `{ draft, method: "json-ld" }`.
- AC-4: Otherwise the page's visible text (scripts, styles and navigation removed, at most 60,000 characters) goes to Claude, and the response is `{ draft, method: "ai" }`. If Claude reports no recipe, it returns 422 `no_recipe_found`.
- AC-5: `POST /api/import/photo { images: [{ data, mediaType }] }` accepts 1 to 4 images (pages of the same recipe) and returns `{ draft }` read by Claude.
- AC-6: `POST /api/import/pdf { data }` accepts a base64 PDF of at most 4 MB and returns `{ draft }` read by Claude.
- AC-7: Drafts set `source` to `{ type: "url", url }`, `{ type: "photo" }` or `{ type: "pdf" }`.
- AC-8: The Add page (`#/add`) offers four buttons: Write a recipe, From a website, From a photo, From a PDF. Each import page has one input and an "Import" button, shows the loading line, then opens the editor with the draft.
- AC-9: On phones, the photo input offers the camera (`capture="environment"`) as well as the library.

## Back end (for backend-developer)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/import/url` | `{ url }` | `{ draft, method }` |
| POST | `/api/import/photo` | `{ images }` | `{ draft }` |
| POST | `/api/import/pdf` | `{ data }` | `{ draft }` |

- Page text and file contents are untrusted. The prompt tells Claude to ignore any instructions inside them.
- JSON-LD mapping (`lib/jsonld.js`) and the URL guard (`lib/urlGuard.js`) are pure functions.

## Test notes (for tester)
- JSON-LD fixtures: plain object, `@graph`, `@type: ["Recipe"]`, HowToSection instructions, missing optional fields, a page with no recipe.
- URL guard: `http://localhost`, `http://127.0.0.1`, `http://10.0.0.5`, `http://192.168.1.1`, `http://[::1]`, `ftp://x.com` and `javascript:` are rejected; `https://www.bbcgoodfood.com/x` is accepted.
- Use a fake `fetch` in tests; never call the network.
