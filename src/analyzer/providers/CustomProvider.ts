import axios from 'axios';
import { BaseAIProvider } from './BaseAIProvider';
import { AIResponse, ChatMessage, AIFeature } from '../../types/analysis';

export class CustomProvider extends BaseAIProvider {
  supportsFeature(feature: AIFeature): boolean {
    const supportedFeatures = [
      AIFeature.TEXT_COMPLETION,
      AIFeature.CHAT_COMPLETION,
      AIFeature.CODE_ANALYSIS
    ];
    
    return supportedFeatures.includes(feature);
  }

  async sendChatCompletion(messages: ChatMessage[]): Promise<AIResponse> {
    this.validateConfig();

    // 首先检查是否有缓存的成功方法
    if (this.successMethod) {
      try {
        return await this.callMethod(this.successMethod, messages);
      } catch (error: any) {
        // 如果缓存的方法失败，清除缓存并继续尝试其他方法
        this.successMethod = null;
      }
    }

    // 基于URL特征智能排序尝试方法
    const attempts = this.getOptimizedAttempts(messages);
    let lastError: any;

    for (const attempt of attempts) {
      try {
        const result = await attempt.method();
        this.successMethod = attempt.name; // 缓存成功的方法
        return result;
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        
        // 如果是明确的认证或权限错误，不要继续尝试
        if (status === 401 || status === 403) {
          throw this.formatError(error);
        }
        
        // 405方法不允许错误通常意味着端点不支持该HTTP方法，继续尝试
        if (status !== 405 && status >= 400 && status < 500) {
          // 其他4xx错误可能表明API格式不对，继续尝试
          continue;
        }
      }
    }

    // 所有尝试都失败了
    throw this.formatError(lastError);
  }

  private getOptimizedAttempts(messages: ChatMessage[]): Array<{ name: string; method: () => Promise<AIResponse> }> {
    const url = this.config.apiUrl.toLowerCase();
    
    // 基于URL特征优化尝试顺序
    if (url.includes('ollama') || url.includes('11434')) {
      // 看起来是Ollama服务，优先尝试Ollama格式
      return [
        { name: 'ollama-chat', method: () => this.tryOllamaChatFormat(messages) },
        { name: 'ollama-v1', method: () => this.tryOllamaV1Format(messages) },
        { name: 'generate', method: () => this.tryGenerateFormat(messages) },
        { name: 'openai-v1', method: () => this.tryOpenAIFormat(messages) }
      ];
    } else if (url.includes('openai') || url.includes('api.openai')) {
      // 看起来是OpenAI服务
      return [
        { name: 'openai-v1', method: () => this.tryOpenAIFormat(messages) },
        { name: 'generate', method: () => this.tryGenerateFormat(messages) }
      ];
    } else {
      // 通用端点，按兼容性排序
      return [
        { name: 'generate', method: () => this.tryGenerateFormat(messages) },
        { name: 'ollama-chat', method: () => this.tryOllamaChatFormat(messages) },
        { name: 'openai-v1', method: () => this.tryOpenAIFormat(messages) },
        { name: 'ollama-v1', method: () => this.tryOllamaV1Format(messages) }
      ];
    }
  }

  private successMethod: string | null = null;

  private async callMethod(methodName: string, messages: ChatMessage[]): Promise<AIResponse> {
    switch (methodName) {
      case 'openai-v1':
        return this.tryOpenAIFormat(messages);
      case 'generate':
        return this.tryGenerateFormat(messages);
      case 'ollama-v1':
        return this.tryOllamaV1Format(messages);
      case 'ollama-chat':
        return this.tryOllamaChatFormat(messages);
      case 'anthropic':
        return this.tryAnthropicFormat(messages);
      default:
        throw new Error(`未知方法: ${methodName}`);
    }
  }

  private async tryOpenAIFormat(messages: ChatMessage[]): Promise<AIResponse> {
    const response = await axios.post(
      `${this.config.apiUrl}/v1/chat/completions`,
      {
        model: this.config.modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false
      },
      {
        headers: this.buildHeaders(),
        timeout: 60000
      }
    );

    const choice = response.data.choices[0];
    return {
      content: choice.message.content,
      usage: response.data.usage,
      model: response.data.model || this.config.modelId,
      finishReason: choice.finish_reason || 'stop'
    };
  }

  private async tryOllamaV1Format(messages: ChatMessage[]): Promise<AIResponse> {
    const response = await axios.post(
      `${this.config.apiUrl}v1/chat/completions`,
      {
        model: this.config.modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false
      },
      {
        headers: this.buildHeaders(),
        timeout: 60000
      }
    );

    const choice = response.data.choices[0];
    return {
      content: choice.message.content,
      usage: response.data.usage,
      model: response.data.model || this.config.modelId,
      finishReason: choice.finish_reason || 'stop'
    };
  }

  private async tryOllamaChatFormat(messages: ChatMessage[]): Promise<AIResponse> {
    const response = await axios.post(
      `${this.config.apiUrl}/api/chat`,
      {
        model: this.config.modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      },
      {
        headers: this.buildHeaders(),
        timeout: 60000
      }
    );

    return {
      content: response.data.message.content,
      usage: {
        promptTokens: response.data.prompt_eval_count || 0,
        completionTokens: response.data.eval_count || 0,
        totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
      },
      model: response.data.model || this.config.modelId,
      finishReason: response.data.done ? 'stop' : 'length'
    };
  }

  private async tryAnthropicFormat(messages: ChatMessage[]): Promise<AIResponse> {
    const systemMessage = messages.find(msg => msg.role === 'system');
    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    const requestBody: any = {
      model: this.config.modelId,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: conversationMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    };

    if (systemMessage) {
      requestBody.system = systemMessage.content;
    }

    const response = await axios.post(
      `${this.config.apiUrl}/v1/messages`,
      requestBody,
      {
        headers: this.buildHeaders(),
        timeout: 60000
      }
    );

    return {
      content: response.data.content[0].text,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.input_tokens,
        completionTokens: response.data.usage.output_tokens,
        totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens
      } : undefined,
      model: response.data.model,
      finishReason: response.data.stop_reason
    };
  }

  private async tryGenerateFormat(messages: ChatMessage[]): Promise<AIResponse> {
    const prompt = messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return `System: ${msg.content}`;
        case 'user':
          return `Human: ${msg.content}`;
        case 'assistant':
          return `Assistant: ${msg.content}`;
        default:
          return msg.content;
      }
    }).join('\n\n') + '\n\nAssistant: ';

    return this.sendTextCompletion(prompt);
  }

  async sendTextCompletion(prompt: string): Promise<AIResponse> {
    this.validateConfig();

    // 尝试多种文本补全格式
    const attempts = [
      () => this.tryOpenAITextCompletion(prompt),
      () => this.tryOllamaGenerate(prompt)
    ];

    let lastError: any;

    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error: any) {
        lastError = error;
        console.warn(`文本补全尝试失败: ${error.response?.status || error.message}`);
      }
    }

    throw this.formatError(lastError);
  }

  private async tryOpenAITextCompletion(prompt: string): Promise<AIResponse> {
    const response = await axios.post(
      `${this.config.apiUrl}/v1/completions`,
      {
        model: this.config.modelId,
        prompt: prompt,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false
      },
      {
        headers: this.buildHeaders(),
        timeout: 60000
      }
    );

    const choice = response.data.choices[0];
    return {
      content: choice.text,
      usage: response.data.usage,
      model: response.data.model || this.config.modelId,
      finishReason: choice.finish_reason
    };
  }

  private async tryOllamaGenerate(prompt: string): Promise<AIResponse> {
    const response = await axios.post(
      `${this.config.apiUrl}/api/generate`,
      {
        model: this.config.modelId,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      },
      {
        headers: this.buildHeaders(),
        timeout: 30000  // 减少超时时间
      }
    );

    return {
      content: response.data.response,
      usage: {
        promptTokens: response.data.prompt_eval_count || 0,
        completionTokens: response.data.eval_count || 0,
        totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
      },
      model: response.data.model || this.config.modelId,
      finishReason: response.data.done ? 'stop' : 'length'
    };
  }

  // 添加网络连接检查
  async checkNetworkConnectivity(): Promise<{ success: boolean; error?: string }> {
    try {
      // 使用最简单的请求来测试连接
      const response = await axios.get(this.config.apiUrl, {
        timeout: 10000,
        validateStatus: () => true  // 接受任何状态码，只关心连接性
      });
      
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.code === 'ENOTFOUND' 
          ? '域名解析失败，请检查网络连接和API地址' 
          : error.message 
      };
    }
  }
}