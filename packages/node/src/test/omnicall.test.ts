import test from 'node:test';
import assert from 'node:assert';
import { OmniCall } from '../index.js';

test('OmniCall fallback logic works when a provider fails', async () => {
  const originalFetch = global.fetch;
  const calls: string[] = [];

  // Mock global.fetch
  global.fetch = (async (url: any, options: any) => {
    const urlString = String(url);
    calls.push(urlString);

    if (urlString.includes('generativelanguage.googleapis.com')) {
      // Fail the first provider (Gemini)
      return {
        ok: false,
        status: 429,
        text: async () => 'Quota exceeded',
      } as any;
    }

    if (urlString.includes('api.groq.com')) {
      // Succeed on the second provider (Groq)
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Hello from Groq Mock!',
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
          },
        }),
      } as any;
    }

    throw new Error('Unexpected call');
  }) as any;

  try {
    const client = new OmniCall({
      apiKeys: {
        gemini: 'fake-gemini-key',
        groq: 'fake-groq-key',
      },
    });

    const response = await client.generate('test prompt');

    assert.strictEqual(response.success, true);
    assert.strictEqual(response.provider, 'groq');
    assert.strictEqual(response.text, 'Hello from Groq Mock!');
    assert.strictEqual(response.errors.length, 1);
    assert.match(response.errors[0].error, /Gemini API error/);

    assert.strictEqual(calls.length, 2);
    assert.ok(calls[0].includes('generativelanguage.googleapis.com'));
    assert.ok(calls[1].includes('api.groq.com'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('OmniCall returns success: false if all providers fail', async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () => {
    return {
      ok: false,
      status: 500,
      text: async () => 'Internal Error',
    } as any;
  }) as any;

  try {
    const client = new OmniCall({
      apiKeys: {
        gemini: 'fake-gemini-key',
        groq: 'fake-groq-key',
      },
      defaultFallbackOrder: ['gemini', 'groq'],
    });

    const response = await client.generate('test prompt');

    assert.strictEqual(response.success, false);
    assert.strictEqual(response.errors.length, 2);
    assert.match(response.errors[0].error, /Gemini API error/);
    assert.match(response.errors[1].error, /groq API error/);
  } finally {
    global.fetch = originalFetch;
  }
});
