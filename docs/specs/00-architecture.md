# 00: Architecture

Status: ready

Leo's recipes is a private, single-user recipe manager hosted on Netlify. It must work equally well on phone, tablet and computer.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Front end | Plain HTML, CSS and JavaScript (ES modules), bundled by Vite | No framework needed; Vite resolves the `@fontsource` imports in `tokens.css` |
| Back end | One Netlify Function (`backend/functions/api.js`, Functions v2 API) serving every `/api/*` route | Free tier, no server to run |
| Storage | Netlify Blobs, one store named `leos-recipes`, JSON documents keyed by path | "Recipes stored as JSON files on a database": each recipe is one JSON blob |
| AI | Claude API via `@anthropic-ai/sdk`, called only from the back end | Key stays server-side |
| Tests | Vitest (node environment; jsdom for DOM tests) | Same toolchain as Vite |

## Platform limits that shape the design

- A synchronous Netlify Function runs for at most **60 s**. Every Claude call uses a 55 s client timeout and no automatic retry, so the function always answers before Netlify kills it.
- A request body is at most **6 MB**. Images are resized in the browser (JPEG, longest edge 1568 px) before upload; PDFs are limited to 4 MB.
- Netlify Blobs is eventually consistent by default. The store is opened with `consistency: "strong"` so a page reload always shows the latest write.

## Folder layout

```
frontend/            Vite root: index.html, styles/, js/  (owner: frontend-developer)
  styles/tokens.css  Design tokens supplied by Leo. Do not edit values.
  js/api.js          The only module that calls fetch()
  js/lib/            Pure logic (unit tested)
  js/ui/             Reusable DOM components
  js/pages/          One module per route
shared/              Pure JS used by both sides (owner: backend-developer)
backend/             (owner: backend-developer)
  functions/api.js   Netlify entry point
  app.js             Auth gate + router + error mapping
  routes/            HTTP only: parse, validate, call a service, respond
  services/          Feature logic. No HTTP, no storage keys
  db/                Store adapter (Netlify Blobs or in-memory) and repositories
  ai/                Every Claude call. Services call these functions only
  lib/               Pure helpers (JSON-LD parsing, URL guard, HTML to text)
tests/               Mirrors the source layout (owner: tester)
docs/specs/          Specs (owner: spec-writer)
```

## Data model

All documents live in the `leos-recipes` blob store.

| Key | Content |
|---|---|
| `recipes/<id>` | Recipe (current version) |
| `index/recipes` | `{ recipes: RecipeSummary[] }`, kept in sync on every recipe or review write |
| `versions/<id>/<n>` | `{ version, savedAt, reason, recipe }`: snapshot of version `n` (zero-padded to 6 digits) |
| `reviews/<recipeId>` | `{ reviews: Review[] }` |
| `images/<id>` | Binary image, metadata `{ contentType }` |
| `pantry` | `{ items: PantryItem[] }` |
| `meals/<id>` | MealSelection |

```ts
Recipe {
  id: string                 // uuid
  title: string              // 1..120 chars
  description: string        // <= 2000
  servings: number | null    // integer 1..100
  prepMinutes: number | null // integer 0..2880
  cookMinutes: number | null
  tags: string[]             // lowercase, unique, <= 20 tags of <= 30 chars
  hue: Hue                   // red|orange|yellow|green|teal|blue|violet|grape|pink (default violet)
  ingredients: Ingredient[]  // <= 200
  steps: Step[]              // <= 100
  notes: Note[]              // recipe notes, newest first
  source: { type: "manual"|"url"|"photo"|"pdf"|"ai", url: string }
  version: number            // starts at 1
  changeReason: string       // why this version exists: created|edit|ai-format|review-improvement|restore
  createdAt: string          // ISO 8601
  updatedAt: string
}
Ingredient { id, name (1..120), quantity: number | null, unit: string (<= 20), note: string (<= 500) }
Step       { id, text (1..2000) }
Note       { id, text (1..2000), createdAt }
RecipeSummary { id, title, tags, hue, servings, totalMinutes, ingredientNames: string[], rating: number | null, reviewCount, updatedAt }
Review     { id, createdAt, rating (integer 1..5), notes, improvements, images: { id, caption }[] }
PantryItem { id, name }
MealSelection { id, name, createdAt, updatedAt, items: MealItem[] }
MealItem   = { id, type: "recipe", recipeId, title }
           | { id, type: "external", title, servings, ingredients: Ingredient[] }
RecipeDraft = Recipe input without id, notes, version, timestamps
```

## API conventions

- Base path `/api`. JSON in, JSON out.
- Errors: `{ "error": { "code": string, "message": string } }` with status 400 (invalid input), 401 (not signed in), 404, 409 (version conflict), 413 (body too large), 422 (AI found nothing usable), 502 (AI or remote site failed), 503 (AI not configured).
- Every route except `POST /api/login` requires the session cookie.

## Security

- **Access:** one password (`APP_PASSWORD`). `POST /api/login` sets an HMAC-signed, `HttpOnly; Secure; SameSite=Strict` cookie valid for 30 days. The signing key is `SESSION_SECRET`, or derived from `APP_PASSWORD` when that is not set.
- **CSRF:** `SameSite=Strict` plus JSON-only bodies.
- **XSS:** the front end never inserts user or AI text with `innerHTML`; everything goes through `textContent`. A strict Content-Security-Policy is set in `netlify.toml`.
- **Untrusted input:** imported web pages, photos and PDFs are data. Prompts tell Claude to ignore instructions inside them, and every AI response is validated against a schema, then normalized like user input.
- **SSRF:** URL import accepts only `http`/`https` URLs on public hostnames.
- **Not indexed:** `X-Robots-Tag: noindex`.

## Claude usage

- Model `claude-opus-5-5` (override with `CLAUDE_MODEL`), structured JSON output via `output_config.format`, server-side refusal fallback (`fallbacks: "default"`).
- Effort `low` for extraction and formatting, `medium` for suggestions and review-based improvements.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `APP_PASSWORD` | yes | The password to open the app |
| `ANTHROPIC_API_KEY` | yes, for AI features | Claude API key |
| `SESSION_SECRET` | no | Separate cookie-signing key |
| `CLAUDE_MODEL` | no | Override the model |

## UI conventions

- Design tokens from `frontend/styles/tokens.css` (IBM Plex Mono, 2 px radius, nine hues). Each recipe has a hue that tints its page via `data-hue`.
- Minimal by default: one primary action per screen, secondary actions in a "more" menu, and details (notes, reviews, sources, ingredient notes) behind toggles (`<details>` or toggle buttons).
- Phone (< 640 px): bottom navigation bar, single column. Tablet and desktop: top navigation, content max 760 px, recipe grid.
- Hash routing (`#/recipes/…`), so Netlify needs no redirect rules.
