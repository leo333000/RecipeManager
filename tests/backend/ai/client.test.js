import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AiError, createClaude, DEFAULT_MODEL, toAiError } from '../../../backend/ai/client.js';

const Schema = z.object({ answer: z.string() });

function fakeSdk(result) {
  const parse = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { sdk: { beta: { messages: { parse } } }, parse };
}

describe('createClaude', () => {
  it('sends a structured-output request and returns the parsed answer', async () => {
    const { sdk, parse } = fakeSdk({ stop_reason: 'end_turn', parsed_output: { answer: 'yes' } });
    const call = createClaude({ sdk });

    await expect(call({ system: 'sys', content: 'hello', schema: Schema, effort: 'medium' })).resolves.toEqual({ answer: 'yes' });

    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: DEFAULT_MODEL,
      system: 'sys',
      messages: [{ role: 'user', content: 'hello' }],
      output_config: { effort: 'medium', format: expect.objectContaining({ type: 'json_schema' }) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  });

  it('leaves out refusal fallbacks for models that do not support them', async () => {
    const { sdk, parse } = fakeSdk({ stop_reason: 'end_turn', parsed_output: { answer: 'ok' } });
    await createClaude({ sdk, model: 'claude-haiku-5-5' })({ system: '', content: 'x', schema: Schema });
    expect(parse.mock.calls[0][0]).not.toHaveProperty('fallbacks');
  });

  it('fails with ai_not_configured when there is no API key', async () => {
    await expect(createClaude({})({ system: '', content: 'x', schema: Schema })).rejects.toMatchObject({ code: 'ai_not_configured' });
  });

  it('maps a refusal to ai_refused', async () => {
    const { sdk } = fakeSdk({ stop_reason: 'refusal', parsed_output: null });
    await expect(createClaude({ sdk })({ system: '', content: 'x', schema: Schema })).rejects.toMatchObject({ code: 'ai_refused' });
  });

  it('maps a truncated or missing answer to ai_bad_output', async () => {
    const truncated = fakeSdk({ stop_reason: 'max_tokens', parsed_output: null });
    await expect(createClaude({ sdk: truncated.sdk })({ system: '', content: 'x', schema: Schema })).rejects.toMatchObject({ code: 'ai_bad_output' });
    const empty = fakeSdk({ stop_reason: 'end_turn', parsed_output: null });
    await expect(createClaude({ sdk: empty.sdk })({ system: '', content: 'x', schema: Schema })).rejects.toMatchObject({ code: 'ai_bad_output' });
  });

  it('maps SDK errors thrown by the request', async () => {
    const { sdk } = fakeSdk(new Anthropic.APIConnectionTimeoutError());
    await expect(createClaude({ sdk })({ system: '', content: 'x', schema: Schema })).rejects.toMatchObject({ code: 'ai_unavailable' });
  });
});

describe('toAiError (spec 03 AC-8)', () => {
  const apiError = (ErrorClass, status) => new ErrorClass(status, { error: { message: 'x' } }, 'x', new Headers());

  it.each([
    ['authentication', () => apiError(Anthropic.AuthenticationError, 401), 'ai_not_configured'],
    ['rate limit', () => apiError(Anthropic.RateLimitError, 429), 'ai_unavailable'],
    ['server error', () => apiError(Anthropic.InternalServerError, 500), 'ai_unavailable'],
    ['bad request', () => apiError(Anthropic.BadRequestError, 400), 'ai_unavailable'],
    ['timeout', () => new Anthropic.APIConnectionTimeoutError(), 'ai_unavailable'],
    ['connection', () => new Anthropic.APIConnectionError({ message: 'down' }), 'ai_unavailable'],
    ['unparseable output', () => new Anthropic.AnthropicError('Failed to parse structured output'), 'ai_bad_output'],
  ])('maps %s to %s', (_, makeError, code) => {
    const mapped = toAiError(makeError());
    expect(mapped).toBeInstanceOf(AiError);
    expect(mapped.code).toBe(code);
  });

  it('passes through unrelated errors', () => {
    const error = new TypeError('bug');
    expect(toAiError(error)).toBe(error);
  });
});
