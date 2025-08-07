import axios from 'axios';
import { BaseAIProvider } from './BaseAIProvider';
import { AIResponse, ChatMessage, AIFeature } from '../../types/analysis';

export class AnthropicProvider extends BaseAIProvider {
  supportsFeature(feature: AIFeature): boolean {
    const supportedFeatures = [
      AIFeature.CHAT_COMPLETION,
      AIFeature.CODE_ANALYSIS,
      AIFeature.STREAMING
    ];
    
    return supportedFeatures.includes(feature);
  }

  async sendChatCompletion(messages: ChatMessage[]): Promise<AIResponse> {
    this.validateConfig();

    try {
      // 分离系统消息和用户消息
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

      // 添加系统消息
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

      if (!response.data.content || response.data.content.length === 0) {
        throw new Error('AI服务返回空响应');
      }

      const content = response.data.content[0].text;

      return {
        content,
        usage: response.data.usage ? {
          promptTokens: response.data.usage.input_tokens,
          completionTokens: response.data.usage.output_tokens,
          totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens
        } : undefined,
        model: response.data.model,
        finishReason: response.data.stop_reason
      };

    } catch (error) {
      throw this.formatError(error);
    }
  }

  async sendTextCompletion(prompt: string): Promise<AIResponse> {
    // Anthropic不支持文本补全，转换为聊天补全
    return this.sendChatCompletion([
      {
        role: 'user',
        content: prompt
      }
    ]);
  }
}