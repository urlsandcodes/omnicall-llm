import { ProviderName, GenerateOptions, OmniCallResponse, FallbackItem } from './types.js';
import { PROVIDERS, callProviderAPI } from './providers.js';

export * from './types';

export interface OmniCallConfig {
  apiKeys?: Partial<Record<ProviderName, string>>;
  defaultFallbackOrder?: ProviderName[];
}

const DEFAULT_PRIORITY: ProviderName[] = [
  'gemini',
  'groq',
  'sambanova',
  'cerebras',
  'openrouter',
  'mistral',
  'openai',
];

export class OmniCall {
  private apiKeys: Partial<Record<ProviderName, string>> = {};
  private defaultFallbackOrder: ProviderName[];

  constructor(config?: OmniCallConfig) {
    // Initialize API keys from config or process.env
    for (const provider of DEFAULT_PRIORITY) {
      const configKey = PROVIDERS[provider].envKey;
      this.apiKeys[provider] =
        config?.apiKeys?.[provider] ||
        (typeof process !== 'undefined' ? process.env[configKey] : undefined);
    }

    this.defaultFallbackOrder = config?.defaultFallbackOrder || DEFAULT_PRIORITY;
  }

  /**
   * Generates text content using the configured providers and fallback logic.
   * @param prompt The prompt to send to the LLM.
   * @param options Execution options including custom fallbacks, temperature, etc.
   */
  async generate(
    prompt: string,
    options?: GenerateOptions & { provider?: ProviderName }
  ): Promise<OmniCallResponse> {
    const errors: Array<{ provider: ProviderName; model: string; error: string }> = [];

    // 1. Resolve the sequence of provider/model attempts
    let queue: FallbackItem[] = [];

    if (options?.fallback && options.fallback.length > 0) {
      // Use user-provided fallback sequence
      queue = options.fallback.map((item) => ({
        provider: item.provider,
        model: item.model || PROVIDERS[item.provider].defaultModel,
      }));
    } else {
      // Build fallback queue dynamically
      const primaryProvider = options?.provider;
      const primaryModel = options?.model;

      if (primaryProvider) {
        queue.push({
          provider: primaryProvider,
          model: primaryModel || PROVIDERS[primaryProvider].defaultModel,
        });
      }

      // Find all other providers that have keys available, in priority order
      const availableProviders = this.defaultFallbackOrder.filter((p) => {
        // Don't duplicate the primary provider if it was already added
        if (p === primaryProvider) return false;
        const key = this.apiKeys[p];
        return !!key;
      });

      for (const p of availableProviders) {
        queue.push({
          provider: p,
          model: PROVIDERS[p].defaultModel,
        });
      }
    }

    // If queue is empty, check if we can add any provider just in case the key is provided in options.apiKey
    if (queue.length === 0) {
      if (options?.provider) {
        queue.push({
          provider: options.provider,
          model: options.model || PROVIDERS[options.provider].defaultModel,
        });
      } else {
        // Try all default priorities as a fallback, hoping at least one has a key
        for (const p of this.defaultFallbackOrder) {
          queue.push({
            provider: p,
            model: PROVIDERS[p].defaultModel,
          });
        }
      }
    }

    // 2. Iterate and attempt calls in sequence
    for (const attempt of queue) {
      const { provider, model } = attempt;
      const resolvedModel = model || PROVIDERS[provider].defaultModel;

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
        const response = await callProviderAPI(provider, resolvedModel, prompt, apiKey, {
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
        });

        return {
          success: true,
          provider,
          model: resolvedModel,
          text: response.text,
          usage: response.usage,
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
    return {
      success: false,
      provider: queue[0]?.provider || 'gemini',
      model: queue[0]?.model || PROVIDERS.gemini.defaultModel,
      text: '',
      errors,
    };
  }
}
