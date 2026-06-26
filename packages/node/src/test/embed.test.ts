import test from 'node:test';
import assert from 'node:assert';
import { OmniEmbed } from '../embed.js';

test('OmniEmbed fallback logic works on API failure', async () => {
  const originalFetch = global.fetch;
  const calls: string[] = [];

  global.fetch = (async (url: any, options: any) => {
    const urlString = String(url);
    calls.push(urlString);

    if (urlString.includes('api-inference.huggingface.co')) {
      // Simulate Hugging Face failure
      return {
        ok: false,
        status: 503,
        text: async () => 'Model is loading',
      } as any;
    }

    if (urlString.includes('api.openai.com')) {
      // Simulate OpenAI success
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              embedding: [0.1, 0.2, 0.3],
            },
          ],
        }),
      } as any;
    }

    throw new Error('Unexpected call');
  }) as any;

  try {
    const embedder = new OmniEmbed({
      apiKeys: {
        huggingface: 'fake-hf-key',
        openai: 'fake-openai-key',
      },
    });

    const response = await embedder.embed('test query');

    assert.strictEqual(response.success, true);
    assert.strictEqual(response.provider, 'openai');
    assert.deepStrictEqual(response.embedding, [0.1, 0.2, 0.3]);
    assert.strictEqual(response.dimensions, 3);
    assert.strictEqual(response.errors.length, 1);
    assert.match(response.errors[0].error, /Hugging Face Embedding error/);

    assert.strictEqual(calls.length, 2);
    assert.ok(calls[0].includes('api-inference.huggingface.co'));
    assert.ok(calls[1].includes('api.openai.com'));
  } finally {
    global.fetch = originalFetch;
  }
});
