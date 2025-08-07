import axios from 'axios';
import { BaseAIProvider } from './BaseAIProvider';
import { AIResponse, ChatMessage, AIFeature } from '../../types/analysis';

export class OllamaProvider extends BaseAIProvider {
  supportsFeature(feature: AIFeature): boolean {
    const supportedFeatures = [
      AIFeature.TEXT_COMPLETION,
      AIFeature.CHAT_COMPLETION,
      AIFeature.CODE_ANALYSIS,
      AIFeature.STREAMING
    ];
    
    return supportedFeatures.includes(feature);
  }

  async sendChatCompletion(messages: ChatMessage[]): Promise<AIResponse> {
    this.validateConfig();

    // 对于localhost的ollama，直接使用原生API，更可靠
    if (this.config.apiUrl.includes('localhost') || this.config.apiUrl.includes('127.0.0.1')) {
      return await this.sendOllamaNativeCompletion(messages);
    }

    // 对于远程ollama，先尝试OpenAI兼容格式
    try {
      return await this.sendOpenAICompatibleCompletion(messages);
    } catch (error: any) {
      // 如果失败，尝试Ollama原生API
      console.warn('OpenAI兼容API失败，尝试Ollama原生API...');
      return await this.sendOllamaNativeCompletion(messages);
    }
  }

  private async sendOpenAICompatibleCompletion(messages: ChatMessage[]): Promise<AIResponse> {
    const response = await axios.post(
      `${this.config.apiUrl}/v1/chat/completions`,
      {
        model: this.config.modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: false,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      },
      {
        headers: this.buildHeaders(),
        timeout: 120000
      }
    );

    const choice = response.data.choices[0];
    if (!choice) {
      throw new Error('API服务返回空响应');
    }

    return {
      content: choice.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens || 0,
        completionTokens: response.data.usage.completion_tokens || 0,
        totalTokens: response.data.usage.total_tokens || 0
      } : undefined,
      model: response.data.model || this.config.modelId,
      finishReason: choice.finish_reason || 'stop'
    };
  }

  async sendTextCompletion(prompt: string): Promise<AIResponse> {
    this.validateConfig();

    try {
      // 确保URL格式正确
      const baseUrl = this.config.apiUrl.replace(/\/$/, '');
      const response = await axios.post(
        `${baseUrl}/api/generate`,
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
          timeout: 120000
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

    } catch (error: any) {
      throw this.formatError(error);
    }
  }

  private async sendOllamaNativeCompletion(messages: ChatMessage[]): Promise<AIResponse> {
    // 尝试Ollama的chat API
    try {
      // 确保URL格式正确，去掉尾部斜杠再添加API路径
      const baseUrl = this.config.apiUrl.replace(/\/$/, '');
      const response = await axios.post(
        `${baseUrl}/api/chat`,
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
          timeout: 120000
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
    } catch (error: any) {
      // 最后尝试使用generate API
      const prompt = messages.map(msg => {
        switch (msg.role) {
          case 'system':
            return `System: ${msg.content}`;
          case 'user':
            return `User: ${msg.content}`;
          case 'assistant':
            return `Assistant: ${msg.content}`;
          default:
            return msg.content;
        }
      }).join('\n\n') + '\n\nAssistant: ';

      return this.sendTextCompletion(prompt);
    }
  }

  protected formatError(error: any): Error {
    // Ollama特定的错误处理
    if (error.response?.data?.error) {
      const errorMsg = error.response.data.error;
      if (errorMsg.includes('model not found')) {
        return new Error(`模型 '${this.config.modelId}' 未找到，请确保已下载该模型`);
      }
      if (errorMsg.includes('connection refused')) {
        return new Error('无法连接到Ollama服务，请确保Ollama正在运行');
      }
    }
    
    // 检查是否是连接错误
    if (error.code === 'ECONNREFUSED') {
      return new Error('无法连接到Ollama服务，请确保:\n  1. Ollama已安装并正在运行\n  2. 使用命令 "ollama serve" 启动服务\n  3. 检查端口11434是否可用');
    }
    
    if (error.response?.status === 404) {
      return new Error(`API端点未找到，请确保Ollama版本支持 /api/chat 接口`);
    }
    
    if (error.response?.status === 405) {
      return new Error('请求方法不被支持，可能是Ollama版本过旧，请尝试升级Ollama');
    }
    
    return super.formatError(error);
  }

  // 添加网络连接检查
  async checkNetworkConnectivity(): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = this.config.apiUrl.replace(/\/$/, '');
      // 使用最简单的请求来测试连接
      const response = await axios.get(`${baseUrl}/api/tags`, {
        timeout: 5000,
        validateStatus: () => true  // 接受任何状态码，只关心连接性
      });
      
      if (response.status === 200) {
        return { success: true };
      } else if (response.status === 404) {
        // 404通常意味着连接成功但端点不存在，这对ollama来说可能是正常的
        return { success: true };
      }
      
      return { success: true };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        return { 
          success: false, 
          error: 'Ollama服务未运行，请启动Ollama服务 (ollama serve)' 
        };
      } else if (error.code === 'ENOTFOUND') {
        return { 
          success: false, 
          error: '无法解析localhost，请检查网络配置' 
        };
      }
      return { 
        success: false, 
        error: `连接测试失败: ${error.message}` 
      };
    }
  }
}