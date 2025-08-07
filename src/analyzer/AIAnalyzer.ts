import { BaseAIProvider } from './providers/BaseAIProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { CustomProvider } from './providers/CustomProvider';
import { PromptTemplates } from './PromptTemplates';
import { ContextBuilder } from './ContextBuilder';
import { ResultParser } from './ResultParser';
import { 
  AIAnalysisRequest, 
  AIAnalysisResult, 
  AIProvider, 
  ChatMessage,
  ErrorLogEntry,
  CodeLocation 
} from '../types';

export class AIAnalyzer {
  private provider: BaseAIProvider;
  private providerConfig: AIProvider;

  constructor(providerConfig: AIProvider) {
    this.providerConfig = providerConfig;
    this.provider = this.createProvider(providerConfig);
  }

  private createProvider(config: AIProvider): BaseAIProvider {
    switch (config.type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'ollama':
        // 对于ollama，如果不是标准localhost地址，使用自定义提供商
        if (config.apiUrl.includes('localhost') || config.apiUrl.includes('127.0.0.1')) {
          return new OllamaProvider(config);
        } else {
          return new CustomProvider(config);
        }
      case 'custom':
        return new CustomProvider(config);
      default:
        throw new Error(`不支持的AI提供商类型: ${config.type}`);
    }
  }

  async analyzeErrors(
    errorEntries: ErrorLogEntry[],
    codeLocations: CodeLocation[],
    projectRoot?: string,
    options: {
      templateName?: string;
      maxErrors?: number;
    } = {}
  ): Promise<AIAnalysisResult> {
    const startTime = Date.now();

    try {
      // 限制分析的错误数量以控制token使用
      const maxErrors = options.maxErrors || 5;
      const limitedErrors = errorEntries.slice(0, maxErrors);

      // 构建分析请求上下文
      const analysisRequest = await ContextBuilder.buildAnalysisRequest(
        limitedErrors,
        codeLocations,
        projectRoot
      );

      // 选择合适的分析模板
      const templateName = options.templateName || this.selectBestTemplate(limitedErrors);
      
      // 构建AI提示
      const prompt = this.buildAnalysisPrompt(analysisRequest, templateName);

      // 发送到AI进行分析
      let aiResponse;
      try {
        aiResponse = await this.provider.sendChatCompletion([
          {
            role: 'system',
            content: '你是一个专业的系统运维和软件开发专家，擅长分析日志错误和诊断系统问题。请使用完整的markdown格式输出分析结果，包含详细的章节标题和结构化内容。'
          },
          {
            role: 'user',
            content: prompt
          }
        ]);
      } catch (error: any) {
        // 如果复杂分析失败，尝试简化分析
        console.warn('复杂分析失败，尝试简化分析...');
        const simplifiedPrompt = this.buildSimplifiedPrompt(limitedErrors);
        aiResponse = await this.provider.sendChatCompletion([
          {
            role: 'user',
            content: simplifiedPrompt
          }
        ]);
      }

      const analysisTime = Date.now() - startTime;

      // 解析AI响应
      const result = ResultParser.parseAnalysisResult(aiResponse.content, analysisTime);

      // 添加元数据
      result.confidence = this.calculateOverallConfidence(result, aiResponse);
      
      // 保存原始AI响应以便生成markdown
      (result as any).rawAIResponse = aiResponse.content;
      
      return result;

    } catch (error: any) {
      const analysisTime = Date.now() - startTime;
      
      throw new Error(`AI分析失败: ${error.message}`);
    }
  }

  private selectBestTemplate(errorEntries: ErrorLogEntry[]): string {
    // 根据错误特征选择最合适的模板
    
    if (errorEntries.length === 1) {
      return 'QUICK_DIAGNOSIS';
    }

    const hasStackTraces = errorEntries.some(error => 
      error.stackTrace && error.stackTrace.length > 0
    );

    const hasMultipleTypes = new Set(errorEntries.map(e => e.errorType)).size > 1;

    if (hasStackTraces || hasMultipleTypes) {
      return 'LOG_ANALYSIS'; // 详细分析模板
    }

    return 'QUICK_DIAGNOSIS'; // 快速诊断模板
  }

  private buildAnalysisPrompt(request: AIAnalysisRequest, templateName: string): string {
    const variables: Record<string, string> = {
      projectType: request.projectContext.projectType,
      primaryLanguage: request.projectContext.primaryLanguage,
      frameworks: request.projectContext.frameworks.join(', ') || '未知',
      projectStructure: request.projectContext.projectStructure,
      errorLogs: ContextBuilder.formatErrorLogs(request.errorEntries),
      codeLocations: ContextBuilder.formatCodeLocations(request.codeLocations),
      codeContext: request.codeContext.join('\n\n---\n\n')
    };

    return PromptTemplates.renderTemplate(templateName, variables);
  }

  private buildSimplifiedPrompt(errorEntries: ErrorLogEntry[]): string {
    const errorMessages = errorEntries.slice(0, 3).map((error, index) => {
      return `错误${index + 1}: ${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}`;
    }).join('\n\n');

    return `请分析以下Java Spring Boot项目的错误日志，提供简洁的解决建议：

${errorMessages}

请简要回答：
1. 主要问题是什么？
2. 可能的原因？
3. 如何修复？

请用中文回答，保持简洁。`;
  }

  private calculateOverallConfidence(result: AIAnalysisResult, aiResponse: any): number {
    let confidence = result.confidence;

    // 根据AI响应质量调整置信度
    if (aiResponse.usage) {
      const tokenRatio = aiResponse.usage.completionTokens / aiResponse.usage.totalTokens;
      if (tokenRatio > 0.3) { // 如果响应相对较长，增加置信度
        confidence += 0.05;
      }
    }

    // 根据内容结构化程度调整
    if (result.errorAnalysis.length > 0 && result.recommendations.length > 0) {
      confidence += 0.05;
    }

    return Math.min(0.95, confidence);
  }

  async quickDiagnosis(
    errorMessage: string,
    context: { language?: string; framework?: string } = {}
  ): Promise<string> {
    const variables = {
      errorLogs: errorMessage,
      primaryLanguage: context.language || 'Unknown',
      frameworks: context.framework || 'Unknown'
    };

    const prompt = PromptTemplates.renderTemplate('QUICK_DIAGNOSIS', variables);

    try {
      const response = await this.provider.sendChatCompletion([
        {
          role: 'system',
          content: '你是一个经验丰富的软件工程师，请提供快速准确的错误诊断。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      return response.content;
    } catch (error: any) {
      throw new Error(`快速诊断失败: ${error.message}`);
    }
  }

  async reviewCode(
    errorMessage: string,
    codeSnippet: string,
    filePath: string,
    lineNumber?: number,
    context: { language?: string; framework?: string } = {}
  ): Promise<string> {
    const variables = {
      errorMessage,
      codeSnippet,
      filePath,
      lineNumber: lineNumber?.toString() || '未知',
      primaryLanguage: context.language || 'Unknown',
      frameworks: context.framework || 'Unknown'
    };

    const prompt = PromptTemplates.renderTemplate('CODE_REVIEW', variables);

    try {
      const response = await this.provider.sendChatCompletion([
        {
          role: 'system',
          content: '你是一个代码审查专家，请提供专业的代码改进建议。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      return response.content;
    } catch (error: any) {
      throw new Error(`代码审查失败: ${error.message}`);
    }
  }

  async assessSystemHealth(
    totalErrors: number,
    errorDistribution: Record<string, number>,
    majorErrors: string[],
    timeRange: string
  ): Promise<string> {
    const variables = {
      totalErrors: totalErrors.toString(),
      errorDistribution: JSON.stringify(errorDistribution, null, 2),
      timeRange,
      majorErrors: majorErrors.join('\n'),
      techStack: this.providerConfig.name,
      environment: 'Production' // 可以从配置获取
    };

    const prompt = PromptTemplates.renderTemplate('SYSTEM_HEALTH', variables);

    try {
      const response = await this.provider.sendChatCompletion([
        {
          role: 'system',
          content: '你是一个系统架构师，请提供专业的系统健康评估。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      return response.content;
    } catch (error: any) {
      throw new Error(`系统健康评估失败: ${error.message}`);
    }
  }

  getProviderInfo(): { name: string; model: string; type: string } {
    return {
      name: this.providerConfig.name,
      model: this.providerConfig.modelId,
      type: this.providerConfig.type
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      // 使用快速诊断的相同模式进行连接测试
      const testPrompt = '测试';
      const response = await this.quickDiagnosis(testPrompt, { language: 'Test', framework: 'Test' });

      return typeof response === 'string' && response.length > 0;
    } catch (error: any) {
      console.warn('连接测试失败:', error.message);
      return false;
    }
  }

  updateProvider(config: AIProvider): void {
    this.providerConfig = config;
    this.provider = this.createProvider(config);
  }
}