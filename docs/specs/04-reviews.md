# 04: Meal reviews

Status: ready

## Overview
After cooking, Leo records a review: a star rating, notes, ideas for improvement, and photos with captions. Reviews feed the average rating, the "improve from reviews" feature (spec 03) and the "you might like" ideas (spec 06).

## User stories
- As Leo, I want to rate a meal and note what to change next time, with a photo of how it turned out.

## Acceptance criteria
- AC-1: `POST /api/images { data, mediaType }` (base64 JPEG, PNG, WebP or GIF, at most 4.5 MB decoded) stores the image and returns 201 `{ id }`. Other types return 400 `bad_image`.
- AC-2: `GET /api/images/:id` returns the bytes with the stored content type and `Cache-Control: private, max-age=31536000, immutable`, or 404.
- AC-3: `POST /api/recipes/:id/reviews { rating, notes, improvements, images: [{ id, caption }] }` requires an integer `rating` from 1 to 5, accepts at most 6 images, and returns 201 `{ review }`. Reviews are listed newest first.
- AC-4: Adding or deleting a review updates `rating` (average, one decimal place) and `reviewCount` in the recipe index.
- AC-5: `DELETE /api/recipes/:id/reviews/:reviewId` deletes the review and its images and returns 204.
- AC-6: `GET /api/recipes/:id/reviews` returns `{ reviews }` (an empty list if there are none; 404 if the recipe does not exist).
- AC-7: The review form (`#/recipes/:id/review`) has a 5-star input (keyboard accessible radio group), notes, improvements, and photo pickers that resize images in the browser before upload. Each photo has a caption field.
- AC-8: On the recipe page, the collapsed "Reviews (n) ★avg" section lists each review (date, stars, notes); improvements and photos are behind a per-review toggle.

## Back end (for backend-developer)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/images` | `{ data, mediaType }` | 201 `{ id }` |
| GET | `/api/images/:id` | | image bytes |
| GET | `/api/recipes/:id/reviews` | | `{ reviews }` |
| POST | `/api/recipes/:id/reviews` | `{ rating, notes, improvements, images }` | 201 `{ review }` |
| DELETE | `/api/recipes/:id/reviews/:reviewId` | | 204 |

- Notes and improvements are at most 4000 characters each; captions at most 200.

## Test notes (for tester)
- Rating bounds (0, 6, 3.5 are invalid), the average after add and delete, and image cleanup on review delete and on recipe delete.

## Out of scope
Editing a review (delete and re-add instead).
