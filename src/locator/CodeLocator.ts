import * as path from 'path';
import * as fs from 'fs-extra';
import { ProjectScanner } from './ProjectScanner';
import { CodeMatcher } from './CodeMatcher';
import { LanguageDetector } from './LanguageDetector';
import {
  ErrorLogEntry,
  StackTraceEntry,
  CodeLocation,
  ProjectIndex,
  CodeLocationResult,
  CodeSearchOptions
} from '../types';

export class CodeLocator {
  private projectScanner: ProjectScanner;
  private codeMatcher: CodeMatcher;
  private projectIndex: ProjectIndex | null = null;
  private projectRoot: string | null = null;

  constructor() {
    this.projectScanner = new ProjectScanner();
    this.codeMatcher = new CodeMatcher();
  }

  async initialize(projectRoot: string): Promise<void> {
    this.projectRoot = path.resolve(projectRoot);
    
    console.log(`🏗️  初始化代码定位器: ${this.projectRoot}`);
    
    // 扫描项目并建立索引
    try {
      this.projectIndex = await this.projectScanner.scanProject(this.projectRoot);
      
      this.codeMatcher.setProjectIndex(this.projectIndex);
      
      console.log(`✅ 项目索引完成: ${this.projectIndex.totalFiles} 个文件`);
    } catch (error: any) {
      console.warn(`⚠️  项目索引失败: ${error.message}`);
      // 不抛出错误，继续使用非索引模式
    }
  }

  async autoDetectProjectRoot(logFilePath?: string): Promise<string | null> {
    let searchPath = process.cwd();
    
    if (logFilePath) {
      const logDir = path.dirname(path.resolve(logFilePath));
      if (await fs.pathExists(logDir)) {
        searchPath = logDir;
      }
    }

    console.log(`🔍 自动检测项目根目录，从 ${searchPath} 开始...`);
    
    const detectedRoot = await this.projectScanner.findProjectRoot(searchPath);
    
    if (detectedRoot) {
      console.log(`📁 检测到项目根目录: ${detectedRoot}`);
      await this.initialize(detectedRoot);
      return detectedRoot;
    } else {
      console.log(`⚠️  未找到项目根目录，使用当前目录: ${searchPath}`);
      await this.initialize(searchPath);
      return searchPath;
    }
  }

  async locateErrorSources(
    errorEntries: ErrorLogEntry[],
    options: CodeSearchOptions = {}
  ): Promise<Map<ErrorLogEntry, CodeLocationResult>> {
    if (!this.projectRoot) {
      throw new Error('代码定位器未初始化，请先调用 initialize() 或 autoDetectProjectRoot()');
    }

    const results = new Map<ErrorLogEntry, CodeLocationResult>();

    console.log(`🎯 开始定位 ${errorEntries.length} 个错误的源码位置...`);

    for (let i = 0; i < errorEntries.length; i++) {
      const error = errorEntries[i];
      console.log(`📍 定位错误 ${i + 1}/${errorEntries.length}: 行 ${error.lineNumber}`);

      try {
        if (error.stackTrace && error.stackTrace.length > 0) {
          const locationResult = await this.codeMatcher.findCodeLocations(
            error.stackTrace,
            this.projectRoot,
            options
          );
          results.set(error, locationResult);
        } else {
          // 没有堆栈跟踪的情况，尝试从错误消息中提取信息
          const syntheticStack = this.extractStackFromMessage(error.message);
          if (syntheticStack.length > 0) {
            const locationResult = await this.codeMatcher.findCodeLocations(
              syntheticStack,
              this.projectRoot,
              options
            );
            results.set(error, locationResult);
          } else {
            results.set(error, {
              locations: [],
              relatedFiles: [],
              searchTime: 0,
              indexUsed: this.projectIndex !== null
            });
          }
        }
      } catch (error: any) {
        console.warn(`⚠️  定位错误失败: ${error.message}`);
        results.set(errorEntries[i], {
          locations: [],
          relatedFiles: [],
          searchTime: 0,
          indexUsed: false
        });
      }
    }

    console.log(`✅ 错误定位完成`);
    return results;
  }

  async analyzeCodeContext(locations: CodeLocation[]): Promise<{
    relatedFiles: string[];
    importedModules: string[];
    callerMethods: string[];
    suggestions: string[];
  }> {
    const context = {
      relatedFiles: [] as string[],
      importedModules: [] as string[],
      callerMethods: [] as string[],
      suggestions: [] as string[]
    };

    for (const location of locations.slice(0, 5)) { // 限制分析前5个位置
      try {
        const content = await fs.readFile(location.filePath, 'utf-8');
        const analysis = this.analyzeFileContent(content, location);
        
        context.relatedFiles.push(...analysis.relatedFiles);
        context.importedModules.push(...analysis.imports);
        context.suggestions.push(...analysis.suggestions);
      } catch (error) {
        console.warn(`分析文件上下文失败: ${location.filePath}`);
      }
    }

    // 去重
    context.relatedFiles = [...new Set(context.relatedFiles)];
    context.importedModules = [...new Set(context.importedModules)];
    context.suggestions = [...new Set(context.suggestions)];

    return context;
  }

  private analyzeFileContent(content: string, location: CodeLocation): {
    relatedFiles: string[];
    imports: string[];
    suggestions: string[];
  } {
    const result = {
      relatedFiles: [] as string[],
      imports: [] as string[],
      suggestions: [] as string[]
    };

    const lines = content.split('\n');
    
    // 分析导入语句
    for (const line of lines) {
      // Java imports
      const javaImport = line.match(/^import\s+([\w.]+);/);
      if (javaImport) {
        result.imports.push(javaImport[1]);
      }

      // JavaScript/TypeScript imports
      const jsImport = line.match(/^import\s+.+\s+from\s+['"]([^'"]+)['"]/);
      if (jsImport) {
        result.imports.push(jsImport[1]);
      }

      // Python imports
      const pyImport = line.match(/^(?:from\s+([\w.]+)\s+)?import\s+([\w.,\s]+)/);
      if (pyImport) {
        result.imports.push(pyImport[1] || pyImport[2]);
      }

      // C# using
      const csUsing = line.match(/^using\s+([\w.]+);/);
      if (csUsing) {
        result.imports.push(csUsing[1]);
      }
    }

    // 简单的错误模式分析和建议
    if (content.includes('NullPointerException') || content.includes('null')) {
      result.suggestions.push('检查空值检查：确保对象不为null');
    }

    if (content.includes('IndexOutOfBoundsException') || content.includes('length')) {
      result.suggestions.push('检查数组/列表边界：确保索引在有效范围内');
    }

    if (content.includes('SQLException') || content.includes('database')) {
      result.suggestions.push('检查数据库连接和SQL语句');
    }

    if (content.includes('IOException') || content.includes('file')) {
      result.suggestions.push('检查文件路径和权限');
    }

    return result;
  }

  private extractStackFromMessage(message: string): StackTraceEntry[] {
    const stack: StackTraceEntry[] = [];

    // 尝试从错误消息中提取文件信息
    // 例如: "Error in UserService.java:42"
    const fileLineMatch = message.match(/(\w+\.java):(\d+)/);
    if (fileLineMatch) {
      stack.push({
        fileName: fileLineMatch[1],
        lineNumber: parseInt(fileLineMatch[2]),
        rawLine: message
      });
    }

    // 尝试提取类名
    const classMatch = message.match(/\b([A-Z]\w+(?:\.[A-Z]\w+)*)\b/);
    if (classMatch) {
      stack.push({
        className: classMatch[1],
        rawLine: message
      });
    }

    return stack;
  }

  getProjectStats(): {
    totalFiles: number;
    languages: Record<string, number>;
    hasIndex: boolean;
  } {
    if (!this.projectIndex) {
      return {
        totalFiles: 0,
        languages: {},
        hasIndex: false
      };
    }

    const languageStats: Record<string, number> = {};
    
    for (const file of this.projectIndex.files) {
      const langName = LanguageDetector.getLanguageDisplayName(file.language);
      languageStats[langName] = (languageStats[langName] || 0) + 1;
    }

    return {
      totalFiles: this.projectIndex.totalFiles,
      languages: languageStats,
      hasIndex: true
    };
  }

  async refreshIndex(): Promise<void> {
    if (this.projectRoot) {
      await this.initialize(this.projectRoot);
    }
  }
}