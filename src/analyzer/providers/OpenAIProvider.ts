import axios from 'axios';
import { BaseAIProvider } from './BaseAIProvider';
import { AIResponse, ChatMessage, AIFeature } from '../../types/analysis';

export class OpenAIProvider extends BaseAIProvider {
  supportsFeature(feature: AIFeature): boolean {
    const supportedFeatures = [
      AIFeature.TEXT_COMPLETION,
      AIFeature.CHAT_COMPLETION,
      AIFeature.CODE_ANALYSIS,
      AIFeature.STREAMING,
      AIFeature.FUNCTION_CALLING
    ];
    
    return supportedFeatures.includes(feature);
  }

  async sendChatCompletion(messages: ChatMessage[]): Promise<AIResponse> {
    this.validateConfig();

    try {
      const response = await axios.post(
        `${this.config.apiUrl}/chat/completions`,
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
          timeout: 60000 // 60秒超时
        }
      );

      const choice = response.data.choices[0];
      if (!choice) {
        throw new Error('AI服务返回空响应');
      }

      return {
        content: choice.message.content,
        usage: response.data.usage ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        } : undefined,
        model: response.data.model,
        finishReason: choice.finish_reason
      };

    } catch (error) {
      throw this.formatError(error);
    }
  }

  async sendTextCompletion(prompt: string): Promise<AIResponse> {
    this.validateConfig();

    try {
      const response = await axios.post(
        `${this.config.apiUrl}/completions`,
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
      if (!choice) {
        throw new Error('AI服务返回空响应');
      }

      return {
        content: choice.text,
        usage: response.data.usage ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        } : undefined,
        model: response.data.model,
        finishReason: choice.finish_reason
      };

    } catch (error) {
      throw this.formatError(error);
    }
  }
}