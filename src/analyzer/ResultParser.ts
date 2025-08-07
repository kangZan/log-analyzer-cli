import { AIAnalysisResult, ErrorAnalysis, Recommendation, CodeImprovement } from '../types/analysis';

export class ResultParser {
  static parseAnalysisResult(aiResponse: string, analysisTime: number): AIAnalysisResult {
    try {
      // 尝试解析结构化的AI响应
      const result = this.parseStructuredResponse(aiResponse);
      result.analysisTime = analysisTime;
      return result;
    } catch (error) {
      // 如果解析失败，返回基础结果
      return this.createFallbackResult(aiResponse, analysisTime);
    }
  }

  private static parseStructuredResponse(response: string): AIAnalysisResult {
    const result: AIAnalysisResult = {
      summary: '',
      rootCause: '',
      errorAnalysis: [],
      recommendations: [],
      codeImprovements: [],
      confidence: 0.8,
      analysisTime: 0
    };

    // 首先尝试提取结构化内容
    const sections = this.extractSections(response);

    result.summary = this.extractSummary(sections);
    result.rootCause = this.extractRootCause(sections);
    result.errorAnalysis = this.extractErrorAnalysis(sections);
    result.recommendations = this.extractRecommendations(sections);
    result.codeImprovements = this.extractCodeImprovements(sections);

    // 如果结构化解析失败，尝试智能内容提取
    if (!result.summary || result.summary === '未找到问题摘要') {
      result.summary = this.extractSmartSummary(response);
    }

    if (!result.rootCause || result.rootCause === '未找到根本原因分析') {
      result.rootCause = this.extractSmartRootCause(response);
    }

    if (result.recommendations.length === 0) {
      result.recommendations = this.extractSmartRecommendations(response);
    }

    result.confidence = this.calculateConfidence(result);

    return result;
  }

  private static extractSections(response: string): Map<string, string> {
    const sections = new Map<string, string>();
    
    // 定义章节标题的正则表达式
    const sectionPatterns = [
      { name: 'summary', patterns: [/#{1,3}\s*问题摘要/i, /#{1,3}\s*摘要/i, /#{1,3}\s*概述/i] },
      { name: 'rootCause', patterns: [/#{1,3}\s*根本原因/i, /#{1,3}\s*原因分析/i] },
      { name: 'errorAnalysis', patterns: [/#{1,3}\s*详细错误分析/i, /#{1,3}\s*错误分析/i] },
      { name: 'recommendations', patterns: [/#{1,3}\s*解决建议/i, /#{1,3}\s*建议/i, /#{1,3}\s*解决方案/i] },
      { name: 'codeImprovements', patterns: [/#{1,3}\s*代码改进/i, /#{1,3}\s*代码建议/i] },
      { name: 'prevention', patterns: [/#{1,3}\s*预防措施/i, /#{1,3}\s*预防/i] }
    ];

    const lines = response.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      let foundSection = false;

      // 检查是否是新的章节标题
      for (const section of sectionPatterns) {
        for (const pattern of section.patterns) {
          if (pattern.test(line)) {
            // 保存之前的章节内容
            if (currentSection && currentContent.length > 0) {
              sections.set(currentSection, currentContent.join('\n').trim());
            }
            
            currentSection = section.name;
            currentContent = [];
            foundSection = true;
            break;
          }
        }
        if (foundSection) break;
      }

      if (!foundSection && currentSection) {
        currentContent.push(line);
      }
    }

    // 保存最后一个章节
    if (currentSection && currentContent.length > 0) {
      sections.set(currentSection, currentContent.join('\n').trim());
    }

    return sections;
  }

  private static extractSummary(sections: Map<string, string>): string {
    const summaryContent = sections.get('summary') || '';
    return this.cleanText(summaryContent) || '未找到问题摘要';
  }

  private static extractRootCause(sections: Map<string, string>): string {
    const rootCauseContent = sections.get('rootCause') || '';
    return this.cleanText(rootCauseContent) || '未找到根本原因分析';
  }

  private static extractErrorAnalysis(sections: Map<string, string>): ErrorAnalysis[] {
    const content = sections.get('errorAnalysis') || '';
    const analyses: ErrorAnalysis[] = [];

    // 尝试解析结构化的错误分析
    const errorBlocks = content.split(/(?=错误\s*\d+|Error\s*\d+)/i);
    
    errorBlocks.forEach((block, index) => {
      if (block.trim()) {
        const analysis = this.parseErrorBlock(block, index);
        if (analysis) {
          analyses.push(analysis);
        }
      }
    });

    // 如果没有找到结构化的错误，创建一个通用的
    if (analyses.length === 0 && content.trim()) {
      analyses.push({
        errorId: 'general-1',
        errorType: 'General Error',
        description: this.cleanText(content),
        severity: 'medium',
        likelyCause: '需要进一步分析',
        affectedComponents: [],
        relatedErrors: []
      });
    }

    return analyses;
  }

  private static parseErrorBlock(block: string, index: number): ErrorAnalysis | null {
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) return null;

    const analysis: ErrorAnalysis = {
      errorId: `error-${index + 1}`,
      errorType: 'Unknown',
      description: '',
      severity: 'medium',
      likelyCause: '',
      affectedComponents: [],
      relatedErrors: []
    };

    let description: string[] = [];
    
    for (const line of lines) {
      if (line.match(/类型|type/i)) {
        analysis.errorType = this.extractValueAfterColon(line) || analysis.errorType;
      } else if (line.match(/严重程度|severity|级别/i)) {
        const severity = this.extractValueAfterColon(line)?.toLowerCase();
        if (severity) {
          analysis.severity = this.mapSeverity(severity);
        }
      } else if (line.match(/原因|cause/i)) {
        analysis.likelyCause = this.extractValueAfterColon(line) || analysis.likelyCause;
      } else {
        description.push(line);
      }
    }

    analysis.description = description.join(' ').trim();
    
    return analysis.description ? analysis : null;
  }

  private static extractRecommendations(sections: Map<string, string>): Recommendation[] {
    const content = sections.get('recommendations') || '';
    const recommendations: Recommendation[] = [];

    // 按编号或标题分割建议
    const recBlocks = content.split(/(?=\d+\.|#{1,4}\s*\w+|[*-]\s*)/);

    recBlocks.forEach((block, index) => {
      const rec = this.parseRecommendationBlock(block, index);
      if (rec) {
        recommendations.push(rec);
      }
    });

    return recommendations;
  }

  private static parseRecommendationBlock(block: string, index: number): Recommendation | null {
    const cleanBlock = block.trim();
    if (!cleanBlock) return null;

    const lines = cleanBlock.split('\n').map(line => line.trim()).filter(line => line);
    
    const recommendation: Recommendation = {
      id: `rec-${index + 1}`,
      type: 'short-term',
      priority: index + 1,
      title: '',
      description: '',
      actionItems: [],
      estimatedEffort: '未指定',
      benefits: []
    };

    // 提取标题（通常是第一行）
    if (lines.length > 0) {
      recommendation.title = lines[0].replace(/^\d+\.\s*|^[*-]\s*|^#{1,4}\s*/, '').trim();
    }

    // 提取描述和其他信息
    const description: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.match(/立即|immediate|urgent/i)) {
        recommendation.type = 'immediate';
      } else if (line.match(/长期|long.?term/i)) {
        recommendation.type = 'long-term';
      } else if (line.match(/行动|action|步骤|step/i)) {
        // 提取行动项
        const actionMatch = line.match(/[:：](.+)/);
        if (actionMatch) {
          recommendation.actionItems.push(actionMatch[1].trim());
        }
      } else {
        description.push(line);
      }
    }

    recommendation.description = description.join(' ').trim();

    return recommendation.title ? recommendation : null;
  }

  private static extractCodeImprovements(sections: Map<string, string>): CodeImprovement[] {
    const content = sections.get('codeImprovements') || '';
    const improvements: CodeImprovement[] = [];

    // 查找代码块和相关说明
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const lines = content.split('\n');

    let currentImprovement: Partial<CodeImprovement> = {};
    
    for (const line of lines) {
      if (line.match(/文件|file/i)) {
        if (currentImprovement.description) {
          improvements.push(this.completeCodeImprovement(currentImprovement));
        }
        currentImprovement = {
          filePath: this.extractValueAfterColon(line) || 'unknown',
          type: 'bug-fix'
        };
      } else if (line.match(/行号|line/i)) {
        const lineNum = this.extractValueAfterColon(line);
        if (lineNum && !isNaN(parseInt(lineNum))) {
          currentImprovement.lineNumber = parseInt(lineNum);
        }
      } else if (line.trim() && !line.startsWith('#')) {
        currentImprovement.description = (currentImprovement.description || '') + line + ' ';
      }
    }

    // 添加最后一个改进
    if (currentImprovement.description) {
      improvements.push(this.completeCodeImprovement(currentImprovement));
    }

    return improvements;
  }

  private static completeCodeImprovement(partial: Partial<CodeImprovement>): CodeImprovement {
    return {
      filePath: partial.filePath || 'unknown',
      lineNumber: partial.lineNumber,
      type: partial.type || 'bug-fix',
      description: partial.description?.trim() || '无详细描述',
      suggestedCode: partial.suggestedCode,
      explanation: partial.explanation || '需要进一步分析'
    };
  }

  private static extractValueAfterColon(text: string): string | null {
    const match = text.match(/[:：]\s*(.+)/);
    return match ? match[1].trim() : null;
  }

  private static mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    if (severity.match(/低|low/)) return 'low';
    if (severity.match(/高|high/)) return 'high';
    if (severity.match(/严重|critical|fatal/)) return 'critical';
    return 'medium';
  }

  private static calculateConfidence(result: AIAnalysisResult): number {
    let score = 0.5; // 基础分数

    // 根据内容质量调整置信度
    if (result.summary && result.summary.length > 50) score += 0.1;
    if (result.rootCause && result.rootCause.length > 50) score += 0.1;
    if (result.errorAnalysis.length > 0) score += 0.1;
    if (result.recommendations.length > 0) score += 0.1;
    if (result.codeImprovements.length > 0) score += 0.1;

    return Math.min(0.95, score);
  }

  private static cleanText(text: string): string {
    return text
      .replace(/^#+\s*/, '') // 移除markdown标题
      .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
      .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
      .trim();
  }

  // 智能提取摘要
  private static extractSmartSummary(response: string): string {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line);
    
    // 查找包含关键词的句子作为摘要
    const summaryKeywords = ['问题', '错误', 'Exception', 'Error', '主要', '概述', '分析'];
    
    for (const line of lines) {
      if (summaryKeywords.some(keyword => line.includes(keyword)) && line.length > 20 && line.length < 200) {
        return this.cleanText(line);
      }
    }
    
    // 如果找不到合适的摘要，使用前几行作为摘要
    const firstFewLines = lines.slice(0, 3).join(' ');
    return firstFewLines.length > 300 ? firstFewLines.substring(0, 300) + '...' : firstFewLines;
  }

  // 智能提取根本原因
  private static extractSmartRootCause(response: string): string {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line);
    
    // 查找包含原因关键词的句子
    const causeKeywords = ['原因', '因为', '由于', '导致', 'cause', 'because', 'due to', '造成'];
    
    for (const line of lines) {
      if (causeKeywords.some(keyword => line.toLowerCase().includes(keyword.toLowerCase())) && line.length > 20) {
        return this.cleanText(line);
      }
    }
    
    // 如果找不到明确的原因描述，从中间部分提取
    const middleLines = lines.slice(Math.floor(lines.length / 3), Math.floor(lines.length * 2 / 3));
    return middleLines.length > 0 ? middleLines.join(' ').substring(0, 200) + '...' : '需要进一步分析原因';
  }

  // 智能提取建议
  private static extractSmartRecommendations(response: string): Recommendation[] {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line);
    const recommendations: Recommendation[] = [];
    
    // 查找包含建议关键词的句子
    const recommendationKeywords = ['建议', '应该', '可以', '需要', '修复', '解决', 'recommend', 'should', 'fix'];
    
    lines.forEach((line, index) => {
      if (recommendationKeywords.some(keyword => line.toLowerCase().includes(keyword.toLowerCase())) && line.length > 15) {
        recommendations.push({
          id: `smart-rec-${recommendations.length + 1}`,
          type: 'short-term',
          priority: recommendations.length + 1,
          title: `建议 ${recommendations.length + 1}`,
          description: this.cleanText(line),
          actionItems: [this.cleanText(line)],
          estimatedEffort: '未指定',
          benefits: ['改善系统稳定性']
        });
      }
    });
    
    // 如果没有找到明确的建议，创建一个通用建议
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'general-rec-1',
        type: 'short-term',
        priority: 1,
        title: '根据分析结果采取行动',
        description: '请根据AI分析的具体内容采取相应的修复措施',
        actionItems: ['查看完整分析内容', '识别关键问题', '制定修复计划'],
        estimatedEffort: '30分钟 - 2小时',
        benefits: ['解决当前问题', '提升系统稳定性']
      });
    }
    
    return recommendations.slice(0, 5); // 限制建议数量
  }

  private static createFallbackResult(response: string, analysisTime: number): AIAnalysisResult {
    return {
      summary: 'AI分析完成，但结果解析可能不完整',
      rootCause: response.length > 500 ? response.substring(0, 500) + '...' : response,
      errorAnalysis: [{
        errorId: 'general-1',
        errorType: 'General Analysis',
        description: '请查看完整的AI响应内容',
        severity: 'medium',
        likelyCause: '需要手动审查AI响应',
        affectedComponents: [],
        relatedErrors: []
      }],
      recommendations: [{
        id: 'rec-1',
        type: 'short-term',
        priority: 1,
        title: '查看完整AI响应',
        description: '建议查看完整的AI分析响应以获取更多信息',
        actionItems: ['查看完整响应内容', '手动分析关键信息'],
        estimatedEffort: '5-10分钟',
        benefits: ['获得更准确的分析结果']
      }],
      codeImprovements: [],
      confidence: 0.6,
      analysisTime
    };
  }
}