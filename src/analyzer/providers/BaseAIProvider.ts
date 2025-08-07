import { AIProvider, AIResponse, ChatMessage, AIFeature } from '../../types/analysis';

export abstract class BaseAIProvider {
  protected config: AIProvider;

  constructor(config: AIProvider) {
    this.config = config;
  }

  abstract supportsFeature(feature: AIFeature): boolean;
  abstract sendChatCompletion(messages: ChatMessage[]): Promise<AIResponse>;
  abstract sendTextCompletion(prompt: string): Promise<AIResponse>;

  // 可选的网络连接检查方法，子类可以重写
  async checkNetworkConnectivity?(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }
  
  protected validateConfig(): void {
    if (!this.config.apiUrl) {
      throw new Error(`API URL is required for ${this.config.name}`);
    }
    
    if (!this.config.modelId) {
      throw new Error(`Model ID is required for ${this.config.name}`);
    }
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      switch (this.config.type) {
        case 'openai':
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          break;
        case 'anthropic':
          headers['x-api-key'] = this.config.apiKey;
          headers['anthropic-version'] = '2023-06-01';
          break;
        default:
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
    }

    return headers;
  }

  protected formatError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.response.statusText;
      
      switch (status) {
        case 401:
          return new Error('API密钥无效或已过期');
        case 403:
          return new Error('API访问被拒绝，请检查权限');
        case 429:
          return new Error('API调用频率限制，请稍后重试');
        case 500:
          return new Error('AI服务内部错误');
        default:
          return new Error(`AI服务错误 (${status}): ${message}`);
      }
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new Error('无法连接到AI服务，请检查网络和API地址');
    }
    
    return new Error(`AI分析失败: ${error.message}`);
  }

  getConfig(): AIProvider {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AIProvider>): void {
    this.config = { ...this.config, ...updates };
  }
}