export type ProviderName =
  | 'gemini'
  | 'groq'
  | 'sambanova'
  | 'cerebras'
  | 'openrouter'
  | 'mistral'
  | 'openai';

export interface ProviderConfig {
  name: ProviderName;
  defaultModel: string;
  envKey: string;
  baseUrl?: string;
}

export interface FallbackItem {
  provider: ProviderName;
  model?: string;
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  fallback?: FallbackItem[];
}

export interface OmniCallResponse {
  success: boolean;
  provider: ProviderName;
  model: string;
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  errors: Array<{
    provider: ProviderName;
    model: string;
    error: string;
  }>;
}
