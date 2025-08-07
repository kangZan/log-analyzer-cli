import * as fs from 'fs-extra';
import * as path from 'path';
import { AIAnalysisResult, ErrorLogEntry, CodeLocation } from '../types';

export class MarkdownGenerator {
  static async generateReport(
    logFilePath: string,
    analysisResult: AIAnalysisResult,
    errorEntries: ErrorLogEntry[],
    codeLocations: CodeLocation[],
    providerInfo: { name: string; model: string; type: string }
  ): Promise<string> {
    const timestamp = new Date().toLocaleString('zh-CN');
    const logFileName = path.basename(logFilePath);
    const rawAIResponse = (analysisResult as any).rawAIResponse || '';
    
    let markdown = '';
    
    // 标题和基本信息
    markdown += `# 日志分析报告\n\n`;
    markdown += `**分析文件**: \`${logFileName}\`  \n`;
    markdown += `**生成时间**: ${timestamp}  \n`;
    markdown += `**AI模型**: ${providerInfo.name} (${providerInfo.model})  \n`;
    markdown += `**分析时长**: ${analysisResult.analysisTime}ms  \n`;
    markdown += `**置信度**: ${(analysisResult.confidence * 100).toFixed(0)}%  \n\n`;
    
    markdown += `---\n\n`;
    
    // 错误摘要
    markdown += `## 📊 错误摘要\n\n`;
    if (errorEntries.length > 0) {
      markdown += `发现 **${errorEntries.length}** 个错误条目：\n\n`;
      
      errorEntries.slice(0, 5).forEach((error, index) => {
        markdown += `### 错误 ${index + 1}\n`;
        markdown += `- **位置**: 行 ${error.lineNumber}\n`;
        markdown += `- **级别**: ${error.level}\n`;
        if (error.errorType) {
          markdown += `- **类型**: ${error.errorType}\n`;
        }
        markdown += `- **消息**: ${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}\n`;
        
        if (error.stackTrace && error.stackTrace.length > 0) {
          markdown += `- **堆栈层数**: ${error.stackTrace.length}\n`;
          markdown += `- **首层调用**: ${error.stackTrace[0].methodName || error.stackTrace[0].fileName}\n`;
        }
        markdown += `\n`;
      });
      
      if (errorEntries.length > 5) {
        markdown += `*... 还有 ${errorEntries.length - 5} 个错误未显示*\n\n`;
      }
    } else {
      markdown += `✅ 未发现错误日志\n\n`;
    }
    
    // 代码定位结果
    if (codeLocations && codeLocations.length > 0) {
      markdown += `## 📍 代码定位结果\n\n`;
      codeLocations.slice(0, 3).forEach((location, index) => {
        const relativePath = path.relative(process.cwd(), location.filePath);
        markdown += `### 位置 ${index + 1}\n`;
        markdown += `- **文件**: \`${relativePath}\`\n`;
        if (location.lineNumber) {
          markdown += `- **行号**: ${location.lineNumber}\n`;
        }
        if (location.className) {
          markdown += `- **类**: ${location.className}\n`;
        }
        if (location.methodName) {
          markdown += `- **方法**: ${location.methodName}\n`;
        }
        markdown += `- **置信度**: ${(location.confidence * 100).toFixed(0)}%\n`;
        markdown += `- **匹配原因**: ${location.matchReason}\n\n`;
      });
    }
    
    markdown += `---\n\n`;
    
    // AI分析结果
    markdown += `## 🤖 AI分析结果\n\n`;
    
    // 如果有原始AI响应，优先使用
    if (rawAIResponse && rawAIResponse.trim()) {
      // 检查AI响应是否已经是markdown格式
      if (rawAIResponse.includes('#') || rawAIResponse.includes('**') || rawAIResponse.includes('```')) {
        markdown += rawAIResponse;
      } else {
        // 如果不是markdown格式，进行简单的格式化
        markdown += this.formatPlainTextToMarkdown(rawAIResponse);
      }
    } else {
      // 使用解析后的结构化结果
      if (analysisResult.summary) {
        markdown += `### 📋 问题摘要\n\n${analysisResult.summary}\n\n`;
      }
      
      if (analysisResult.rootCause) {
        markdown += `### 🔍 根本原因\n\n${analysisResult.rootCause}\n\n`;
      }
      
      if (analysisResult.errorAnalysis && analysisResult.errorAnalysis.length > 0) {
        markdown += `### 📊 详细错误分析\n\n`;
        analysisResult.errorAnalysis.forEach((analysis, index) => {
          markdown += `#### ${index + 1}. ${analysis.errorType} (${analysis.severity})\n\n`;
          markdown += `${analysis.description}\n\n`;
          if (analysis.likelyCause) {
            markdown += `**可能原因**: ${analysis.likelyCause}\n\n`;
          }
        });
      }
      
      if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
        markdown += `### 💡 解决建议\n\n`;
        analysisResult.recommendations.forEach((rec, index) => {
          const typeIcon = rec.type === 'immediate' ? '🚨' : rec.type === 'short-term' ? '⏱️' : '🔮';
          markdown += `#### ${typeIcon} ${index + 1}. ${rec.title}\n\n`;
          markdown += `${rec.description}\n\n`;
          
          if (rec.actionItems && rec.actionItems.length > 0) {
            markdown += `**行动项**:\n`;
            rec.actionItems.forEach(item => {
              markdown += `- ${item}\n`;
            });
            markdown += `\n`;
          }
          
          if (rec.estimatedEffort && rec.estimatedEffort !== '未指定') {
            markdown += `**预估工作量**: ${rec.estimatedEffort}\n\n`;
          }
        });
      }
      
      if (analysisResult.codeImprovements && analysisResult.codeImprovements.length > 0) {
        markdown += `### ⚡ 代码改进建议\n\n`;
        analysisResult.codeImprovements.forEach((improvement, index) => {
          markdown += `#### ${index + 1}. ${path.basename(improvement.filePath)}`;
          if (improvement.lineNumber) {
            markdown += `:${improvement.lineNumber}`;
          }
          markdown += `\n\n`;
          markdown += `${improvement.description}\n\n`;
          if (improvement.explanation) {
            markdown += `**说明**: ${improvement.explanation}\n\n`;
          }
        });
      }
    }
    
    // 页脚
    markdown += `\n---\n\n`;
    markdown += `*本报告由 [log-analyzer-cli](https://github.com/your-repo) 自动生成*  \n`;
    markdown += `*生成时间: ${timestamp}*\n`;
    
    return markdown;
  }
  
  private static formatPlainTextToMarkdown(text: string): string {
    let formatted = text;
    
    // 简单的格式化规则
    formatted = formatted
      .replace(/^(\d+\.\s+.*)/gm, '\n### $1\n') // 数字列表转标题
      .replace(/^([一二三四五六七八九十]+[、.].*)/gm, '\n#### $1\n') // 中文数字列表
      .replace(/^(问题类型|主要问题|根本原因|解决建议|建议|推荐|总结)[:：]\s*/gm, '\n### $1\n\n') // 关键词转标题
      .replace(/\*\*([^*]+)\*\*/g, '**$1**') // 保持粗体
      .replace(/^[-•]\s+/gm, '- ') // 统一列表符号
      .trim();
    
    return formatted;
  }
  
  static generateFileName(logFilePath: string): string {
    const baseName = path.basename(logFilePath, path.extname(logFilePath));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${baseName}_分析报告_${timestamp}.md`;
  }
  
  static async saveReport(
    logFilePath: string,
    analysisResult: AIAnalysisResult,
    errorEntries: ErrorLogEntry[],
    codeLocations: CodeLocation[],
    providerInfo: { name: string; model: string; type: string },
    outputDir?: string
  ): Promise<string> {
    const markdown = await this.generateReport(
      logFilePath,
      analysisResult,
      errorEntries,
      codeLocations,
      providerInfo
    );
    
    const fileName = this.generateFileName(logFilePath);
    const outputPath = outputDir ? path.join(outputDir, fileName) : fileName;
    
    // 确保输出目录存在
    if (outputDir) {
      await fs.ensureDir(outputDir);
    }
    
    await fs.writeFile(outputPath, markdown, 'utf-8');
    
    return outputPath;
  }
}