import { ProviderName, EmbeddingOptions, EmbeddingResponse, FallbackItem } from './types.js';
import { PROVIDERS, callEmbeddingAPI } from './providers.js';

export interface OmniEmbedConfig {
  apiKeys?: Partial<Record<ProviderName, string>>;
  defaultFallbackOrder?: ProviderName[];
}

const DEFAULT_EMBEDDING_PRIORITY: ProviderName[] = [
  'huggingface',
  'openai',
  'gemini',
  'cohere',
  'jina',
];

export class OmniEmbed {
  private apiKeys: Partial<Record<ProviderName, string>> = {};
  private defaultFallbackOrder: ProviderName[];

  constructor(config?: OmniEmbedConfig) {
    // Initialize API keys from config or process.env
    for (const provider of DEFAULT_EMBEDDING_PRIORITY) {
      const configKey = PROVIDERS[provider].envKey;
      this.apiKeys[provider] =
        config?.apiKeys?.[provider] ||
        (typeof process !== 'undefined' ? process.env[configKey] : undefined);
    }

    this.defaultFallbackOrder = config?.defaultFallbackOrder || DEFAULT_EMBEDDING_PRIORITY;
  }

  /**
   * Generates a vector embedding using the configured providers and fallback logic.
   * @param prompt The text prompt to embed.
   * @param options Execution options including custom fallbacks, model choice, etc.
   */
  async embed(
    prompt: string,
    options?: EmbeddingOptions & { provider?: ProviderName }
  ): Promise<EmbeddingResponse> {
    const errors: Array<{ provider: ProviderName; model: string; error: string }> = [];

    // 1. Resolve the sequence of provider/model attempts
    let queue: FallbackItem[] = [];

    if (options?.fallback && options.fallback.length > 0) {
      // Use user-provided fallback sequence
      queue = options.fallback.map((item) => ({
        provider: item.provider,
        model: item.model || PROVIDERS[item.provider].defaultEmbeddingModel,
      }));
    } else {
      // Build fallback queue dynamically
      const primaryProvider = options?.provider;
      const primaryModel = options?.model;

      if (primaryProvider) {
        queue.push({
          provider: primaryProvider,
          model: primaryModel || PROVIDERS[primaryProvider].defaultEmbeddingModel,
        });
      }

      // Find all other providers that have keys available, in priority order
      const availableProviders = this.defaultFallbackOrder.filter((p) => {
        if (p === primaryProvider) return false;
        const key = this.apiKeys[p];
        return !!key && !!PROVIDERS[p].defaultEmbeddingModel;
      });

      for (const p of availableProviders) {
        queue.push({
          provider: p,
          model: PROVIDERS[p].defaultEmbeddingModel,
        });
      }
    }

    // If queue is empty, fallback to default order
    if (queue.length === 0) {
      if (options?.provider) {
        queue.push({
          provider: options.provider,
          model: options.model || PROVIDERS[options.provider].defaultEmbeddingModel,
        });
      } else {
        for (const p of this.defaultFallbackOrder) {
          if (PROVIDERS[p].defaultEmbeddingModel) {
            queue.push({
              provider: p,
              model: PROVIDERS[p].defaultEmbeddingModel,
            });
          }
        }
      }
    }

    // 2. Iterate and attempt calls in sequence
    for (const attempt of queue) {
      const { provider, model } = attempt;
      const resolvedModel = model || PROVIDERS[provider].defaultEmbeddingModel;

      if (!resolvedModel) {
        errors.push({
          provider,
          model: '',
          error: `Provider ${provider} does not support embeddings.`,
        });
        continue;
      }

      // Determine API key for this provider
      const apiKey =
        (provider === options?.provider ? options?.apiKey : undefined) ||
        this.apiKeys[provider];

      if (!apiKey) {
        errors.push({
          provider,
          model: resolvedModel,
          error: `Missing API key for provider ${provider}. Check your env (${PROVIDERS[provider].envKey}) or constructor configuration.`,
        });
        continue;
      }

      try {
        const embedding = await callEmbeddingAPI(provider, resolvedModel, prompt, apiKey);

        return {
          success: true,
          provider,
          model: resolvedModel,
          embedding,
          dimensions: embedding.length,
          errors,
        };
      } catch (err: any) {
        errors.push({
          provider,
          model: resolvedModel,
          error: err?.message || String(err),
        });
      }
    }

    // 3. If all attempts failed
    const fallbackProvider = queue[0]?.provider || 'huggingface';
    return {
      success: false,
      provider: fallbackProvider,
      model: queue[0]?.model || PROVIDERS[fallbackProvider].defaultEmbeddingModel || '',
      embedding: [],
      dimensions: 0,
      errors,
    };
  }
}
