export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiUrl: string;
  apiKey: string;
  modelId: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AppConfig {
  ai: AIConfig;
  version: string;
  lastUpdated: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

export const DEFAULT_CONFIG: Partial<AppConfig> = {
  version: '1.0.0',
  ai: {
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelId: 'gpt-3.5-turbo',
    maxTokens: 4000,
    temperature: 0.7
  }
};