import { ProviderName, ProviderConfig, GenerateOptions } from './types.js';

export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  gemini: {
    name: 'gemini',
    defaultModel: 'gemini-2.5-flash',
    defaultEmbeddingModel: 'text-embedding-004',
    envKey: 'GEMINI_API_KEY',
  },
  groq: {
    name: 'groq',
    defaultModel: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  sambanova: {
    name: 'sambanova',
    defaultModel: 'Meta-Llama-3.1-70B-Instruct',
    envKey: 'SAMBANOVA_API_KEY',
    baseUrl: 'https://api.sambanova.ai/v1',
  },
  cerebras: {
    name: 'cerebras',
    defaultModel: 'llama-3.3-70b',
    envKey: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
  },
  openrouter: {
    name: 'openrouter',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  mistral: {
    name: 'mistral',
    defaultModel: 'mistral-large-latest',
    defaultEmbeddingModel: 'mistral-embed',
    envKey: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  openai: {
    name: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultEmbeddingModel: 'text-embedding-3-small',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
  },
  huggingface: {
    name: 'huggingface',
    defaultEmbeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
    envKey: 'HUGGINGFACE_API_KEY',
    baseUrl: 'https://api-inference.huggingface.co/pipeline/feature-extraction',
  },
  cohere: {
    name: 'cohere',
    defaultEmbeddingModel: 'embed-english-v3.0',
    envKey: 'COHERE_API_KEY',
    baseUrl: 'https://api.cohere.ai/v1',
  },
  jina: {
    name: 'jina',
    defaultEmbeddingModel: 'jina-embeddings-v2-base-en',
    envKey: 'JINA_API_KEY',
    baseUrl: 'https://api.jina.ai/v1',
  },
};

export interface APIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function callProviderAPI(
  provider: ProviderName,
  model: string,
  prompt: string,
  apiKey: string,
  options: Omit<GenerateOptions, 'apiKey' | 'model' | 'fallback'>
): Promise<APIResponse> {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body: any = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    if (options.temperature !== undefined || options.maxTokens !== undefined) {
      body.generationConfig = {};
      if (options.temperature !== undefined) {
        body.generationConfig.temperature = options.temperature;
      }
      if (options.maxTokens !== undefined) {
        body.generationConfig.maxOutputTokens = options.maxTokens;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (HTTP ${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (text === undefined || text === null) {
      throw new Error(`Invalid or empty response from Gemini: ${JSON.stringify(data)}`);
    }

    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  } else {
    // OpenAI-compatible providers
    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      throw new Error(`Missing base URL for OpenAI-compatible provider: ${provider}`);
    }

    const url = `${baseUrl}/chat/completions`;
    const body: any = {
      model,
      messages: [{ role: 'user', content: prompt }],
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/omnicall-llm/omnicall';
      headers['X-Title'] = 'Omnicall LLM';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${provider} API error (HTTP ${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (text === undefined || text === null) {
      throw new Error(`Invalid or empty response from ${provider}: ${JSON.stringify(data)}`);
    }

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;

    return {
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }
}

export async function callEmbeddingAPI(
  provider: ProviderName,
  model: string,
  prompt: string,
  apiKey: string
): Promise<number[]> {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: prompt }],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Embedding API error (HTTP ${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    const values = data.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error(`Invalid embedding response from Gemini: ${JSON.stringify(data)}`);
    }
    return values;
  }

  if (provider === 'huggingface') {
    const baseUrl = config.baseUrl;
    const url = `${baseUrl}/${model}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face Embedding error (HTTP ${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    const embedding = Array.isArray(data[0]) ? data[0] : data;
    if (!Array.isArray(embedding) || typeof embedding[0] !== 'number') {
      throw new Error(`Invalid embedding response from Hugging Face: ${JSON.stringify(data)}`);
    }
    return embedding;
  }

  if (provider === 'cohere') {
    const baseUrl = config.baseUrl;
    const url = `${baseUrl}/embed`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        texts: [prompt],
        input_type: 'search_document',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cohere Embedding error (HTTP ${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    const embedding = data.embeddings?.[0];
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error(`Invalid embedding response from Cohere: ${JSON.stringify(data)}`);
    }
    return embedding;
  }

  // OpenAI, Jina AI, or other OpenAI-compatible embedding formats
  const baseUrl = config.baseUrl;
  if (!baseUrl) {
    throw new Error(`Missing base URL for provider: ${provider}`);
  }

  const url = `${baseUrl}/embeddings`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider} Embedding error (HTTP ${response.status}): ${errorText}`);
  }

  const data: any = await response.json();
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error(`Invalid embedding response from ${provider}: ${JSON.stringify(data)}`);
  }
  return embedding;
}
