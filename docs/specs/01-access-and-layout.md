# 01: Access and layout

Status: ready

## Overview
The app is private: one password opens it. Every screen shares one minimal shell (navigation, page header, toasts) that adapts to phone, tablet and computer.

## User stories
- As Leo, I want to sign in once on each device and stay signed in, so that opening the app is instant.
- As Leo, I want the same app to feel natural on my phone in the kitchen and on my computer when planning.

## Acceptance criteria
- AC-1: Given no valid session cookie, when any `/api/*` route other than `POST /api/login` is called, then it returns 401 with code `unauthorized`.
- AC-2: Given the correct password, when `POST /api/login` is called, then it returns 204 and sets an `HttpOnly; Secure; SameSite=Strict` session cookie with `Max-Age` of 30 days.
- AC-3: Given a wrong or missing password, when `POST /api/login` is called, then it returns 401 with code `bad_password` and sets no cookie.
- AC-4: Given a cookie whose signature is wrong or whose expiry has passed, when any protected route is called, then it returns 401.
- AC-5: Given `APP_PASSWORD` is not set, when `POST /api/login` is called, then it returns 503 with code `not_configured`.
- AC-6: When `POST /api/logout` is called, then the cookie is cleared (`Max-Age=0`).
- AC-7: Given the front end receives a 401 from any call, then it shows the sign-in screen, and after signing in it returns to the page the user was on.
- AC-8: On screens narrower than 640 px, navigation is a fixed bottom bar with Recipes, Meals, Add, Pantry and Ideas. On wider screens it is a top bar. No page scrolls horizontally at 320 px.
- AC-9: The colour scheme follows the system light or dark setting using the tokens in `tokens.css`.

## Front end (for frontend-developer)
- Routes: `#/login`, `#/recipes` (default), `#/recipes/:id`, `#/recipes/:id/edit`, `#/recipes/:id/ai`, `#/recipes/:id/history`, `#/recipes/:id/review`, `#/new`, `#/add`, `#/import/:kind`, `#/meals`, `#/meals/:id`, `#/meals/:id/shopping`, `#/pantry`, `#/ideas`.
- Shell: a 3 px rainbow stripe (`--rainbow`) at the top, the wordmark "leo's recipes", and the navigation. The active nav item uses `--accent`.
- Shared UI: a toast for success and error messages, a confirm dialog (native `<dialog>`) for destructive actions, a loading line for slow AI calls ("Claude is working… up to a minute").
- Sign-in page: one password field and a "Sign in" button; shows "Wrong password" on 401.

## Back end (for backend-developer)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/login` | `{ password }` | 204 + `Set-Cookie` / 401 `bad_password` / 503 `not_configured` |
| POST | `/api/logout` | none | 204 + cleared cookie |
| GET | `/api/session` | none | 200 `{ authenticated: true }` / 401 |

- Cookie value: `<expiryEpochSeconds>.<base64url HMAC-SHA256(expiry)>`. Compare signatures and passwords in constant time.

## Test notes (for tester)
- Use a fixed `now()` to test expiry. Check both a tampered signature and a tampered expiry.

## Out of scope
Multiple users, password reset, rate limiting of sign-in attempts (use a long password).
