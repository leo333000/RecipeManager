// The single place that talks to the Claude API. Every call asks for JSON that
// matches a Zod schema and turns SDK failures into AiError codes the app maps
// to HTTP responses.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

export const DEFAULT_MODEL = 'claude-opus-5-5';

// Netlify stops a function after 60 s, so give up on Claude before that and
// do not retry: the user can press "Try again".
const REQUEST_TIMEOUT_MS = 55_000;
const MAX_OUTPUT_TOKENS = 16_000;

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Server-side refusal fallback is supported on these model families only.
function fallbackOptions(model) {
  return /^claude-(opus|sonnet|fable)-/.test(model)
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
    : {};
}

export function toAiError(error) {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError('ai_not_configured', 'The Claude API key was rejected. Check ANTHROPIC_API_KEY.');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError('ai_unavailable', 'Claude is busy right now. Try again in a minute.');
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError('ai_unavailable', 'Claude took too long to answer. Try again.');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError('ai_unavailable', 'Could not reach Claude. Check the connection and try again.');
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError('ai_unavailable', 'Claude could not process this request. The file may be too large or unreadable.');
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError('ai_unavailable', 'Claude is having trouble right now. Try again shortly.');
  }
  if (error instanceof Anthropic.AnthropicError) {
    return new AiError('ai_bad_output', 'Claude returned an answer the app could not read. Try again.');
  }
  return error;
}

/**
 * Returns callStructured({ system, content, schema, effort }) -> parsed object.
 * `sdk` can be injected for tests; otherwise a client is created on first use.
 */
export function createClaude({ apiKey, model = DEFAULT_MODEL, sdk } = {}) {
  let client = sdk;

  return async function callStructured({ system, content, schema, effort = 'low' }) {
    if (!client) {
      if (!apiKey) throw new AiError('ai_not_configured', 'AI features need ANTHROPIC_API_KEY to be set on Netlify.');
      client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
    }

    let response;
    try {
      response = await client.beta.messages.parse({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages: [{ role: 'user', content }],
        output_config: { effort, format: betaZodOutputFormat(schema) },
        ...fallbackOptions(model),
      });
    } catch (error) {
      throw toAiError(error);
    }

    if (response.stop_reason === 'refusal') {
      throw new AiError('ai_refused', 'Claude declined this request.');
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new AiError('ai_bad_output', 'Claude returned an incomplete answer. Try again.');
    }
    return response.parsed_output;
  };
}
