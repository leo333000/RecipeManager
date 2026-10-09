# Leo's recipes

A private recipe manager for phone, tablet and computer, hosted on Netlify.

- Browse, search, write and edit recipes, with notes on recipes and on single ingredients
- Every edit keeps the previous version: read, compare and restore old versions
- Meal reviews with stars, notes, improvements and captioned photos
- Claude can tidy a recipe, or apply the improvements from your reviews. You see a before/after comparison and confirm before anything is saved
- Meal plans (by hand or at random), dishes that aren't in the app (Claude lists their ingredients), a pantry of what you already own, and a shopping list that leaves those out
- Ideas: your recipes ranked by what's in the pantry, new dishes from your pantry, and dishes you might like
- Import recipes from a web page, photos or a PDF

The behaviour of each part is specified in [`docs/specs/`](docs/specs/), starting with [`00-architecture.md`](docs/specs/00-architecture.md).

## How it is built

| Part | Where | Notes |
|---|---|---|
| Front end | `frontend/` | Plain HTML, CSS and JavaScript, bundled by Vite. Styling comes from `frontend/styles/tokens.css` |
| API | `backend/` | One Netlify Function (`backend/functions/api.js`) serving `/api/*` |
| Storage | Netlify Blobs | Every recipe is a JSON document in the `leos-recipes` store |
| AI | `backend/ai/` | Claude API via `@anthropic-ai/sdk`, called only from the server |
| Shared logic | `shared/` | Validation, quantities and ingredient parsing, used by both sides |
| Tests | `tests/` | Vitest; Claude and storage are replaced by fakes |

## Run it locally

You need Node.js 20 or newer and the Netlify CLI (`npm install -g netlify-cli`).

```bash
npm install
cp .env.example .env    # then set APP_PASSWORD and ANTHROPIC_API_KEY
npm run dev             # http://localhost:8888
```

`netlify dev` runs the front end, the function and a local Blobs store together. Local data is separate from the live site.

## Tests

```bash
npm test
```

## Deploy to Netlify

1. Put the project in a Git repository and push it to GitHub, GitLab or Bitbucket.
2. In Netlify, choose **Add new project → Import an existing project** and pick the repository. The build settings come from `netlify.toml`.
3. Under **Project configuration → Environment variables**, set:
   - `APP_PASSWORD`: the password that opens the app. Use a long one; it's the only thing protecting your data.
   - `ANTHROPIC_API_KEY`: your Claude API key, from [platform.claude.com](https://platform.claude.com).
   - Optional: `SESSION_SECRET` (a separate cookie-signing secret) and `CLAUDE_MODEL` (default `claude-opus-5-5`).
4. Deploy. Netlify Blobs needs no setup.

Alternatively, run `netlify deploy --build --prod` from this folder.

### Claude costs

Each AI action is one request to the Claude API, billed to your Anthropic account. The default model is Claude Opus 5.5 at low or medium effort. Setting `CLAUDE_MODEL=claude-sonnet-5-5` is cheaper, and `claude-haiku-5-5` is cheaper still.

## Limits

- Netlify stops a function after 60 seconds. Claude calls give up after 55 seconds, and the app shows a "Try again" button.
- Uploads: photos are shrunk in the browser before upload; PDFs can be up to 4 MB.

## Working with the agents

`.claude/agents/` defines five Claude Code subagents: `spec-writer`, `frontend-developer`, `backend-developer`, `tester` and `code-reviewer`. To add a feature, ask Claude Code to have spec-writer write or update a spec in `docs/specs/`, then run the developers, the tester and the reviewer in turn.
