// Netlify Function entry point: every /api/* request lands here.

import { createApp } from '../app.js';
import { createBlobStore } from '../db/store.js';

export default async function handler(request) {
  const handle = createApp({ store: createBlobStore(), env: process.env });
  return handle(request);
}

export const config = { path: '/api/*' };
