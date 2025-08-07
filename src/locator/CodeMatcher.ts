import * as fs from 'fs-extra';
import * as path from 'path';
import { 
  CodeLocation, 
  ProjectFile, 
  ProjectIndex, 
  ProgrammingLanguage,
  CodeSearchOptions,
  CodeLocationResult
} from '../types/codeLocation';
import { StackTraceEntry } from '../types/log';

export class CodeMatcher {
  private projectIndex: ProjectIndex | null = null;

  constructor(projectIndex?: ProjectIndex) {
    this.projectIndex = projectIndex || null;
  }

  setProjectIndex(index: ProjectIndex): void {
    this.projectIndex = index;
  }

  async findCodeLocations(
    stackTrace: StackTraceEntry[],
    projectRoot: string,
    options: CodeSearchOptions = {}
  ): Promise<CodeLocationResult> {
    const startTime = Date.now();
    const locations: CodeLocation[] = [];
    const relatedFiles: string[] = [];

    for (const trace of stackTrace) {
      const traceLocations = await this.findLocationForStackTrace(trace, projectRoot, options);
      locations.push(...traceLocations);
    }

    // 去重和排序
    const uniqueLocations = this.deduplicateLocations(locations);
    const sortedLocations = uniqueLocations.sort((a, b) => b.confidence - a.confidence);

    // 收集相关文件
    for (const location of sortedLocations) {
      if (!relatedFiles.includes(location.filePath)) {
        relatedFiles.push(location.filePath);
      }
    }

    const endTime = Date.now();
    
    return {
      locations: sortedLocations.slice(0, options.maxResults || 20),
      relatedFiles,
      searchTime: endTime - startTime,
      indexUsed: this.projectIndex !== null
    };
  }

  private async findLocationForStackTrace(
    trace: StackTraceEntry,
    projectRoot: string,
    options: CodeSearchOptions
  ): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = [];

    // 1. 精确文件名匹配
    if (trace.fileName) {
      const exactMatches = await this.findByExactFileName(trace.fileName, projectRoot, trace.lineNumber);
      locations.push(...exactMatches);
    }

    // 2. 类名匹配
    if (trace.className) {
      const classMatches = await this.findByClassName(trace.className, projectRoot);
      locations.push(...classMatches);
    }

    // 3. 方法名匹配
    if (trace.methodName) {
      const methodMatches = await this.findByMethodName(trace.methodName, trace.className, projectRoot);
      locations.push(...methodMatches);
    }

    // 4. 模糊匹配
    if (options.fuzzyMatch) {
      const fuzzyMatches = await this.findByFuzzyMatch(trace, projectRoot);
      locations.push(...fuzzyMatches);
    }

    return locations;
  }

  private async findByExactFileName(
    fileName: string,
    projectRoot: string,
    lineNumber?: number
  ): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = [];
    const baseName = path.basename(fileName);

    if (this.projectIndex) {
      // 使用索引搜索
      for (const file of this.projectIndex.files) {
        if (path.basename(file.path) === baseName) {
          locations.push({
            filePath: file.path,
            lineNumber,
            confidence: 0.9,
            matchReason: `精确文件名匹配: ${baseName}`
          });
        }
      }
    } else {
      // 直接文件系统搜索
      const { glob } = await import('glob');
      const pattern = `**/${baseName}`;
      
      try {
        const files = await glob(pattern, {
          cwd: projectRoot,
          absolute: true,
          ignore: ['**/node_modules/**', '**/target/**', '**/build/**']
        });

        for (const file of files) {
          locations.push({
            filePath: file,
            lineNumber,
            confidence: 0.9,
            matchReason: `精确文件名匹配: ${baseName}`
          });
        }
      } catch (error) {
        console.warn(`文件搜索失败: ${error}`);
      }
    }

    return locations;
  }

  private async findByClassName(className: string, projectRoot: string): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = [];
    const simpleClassName = this.extractSimpleClassName(className);

    if (this.projectIndex) {
      // 使用索引搜索
      for (const file of this.projectIndex.files) {
        const content = await this.safeReadFile(file.path);
        if (content) {
          const classLocations = this.findClassInContent(content, simpleClassName, file.path, file.language);
          locations.push(...classLocations);
        }
      }
    } else {
      // 直接搜索
      const { glob } = await import('glob');
      const patterns = ['**/*.java', '**/*.cs', '**/*.cpp', '**/*.py', '**/*.js', '**/*.ts'];

      for (const pattern of patterns) {
        try {
          const files = await glob(pattern, {
            cwd: projectRoot,
            absolute: true,
            ignore: ['**/node_modules/**', '**/target/**', '**/build/**']
          });

          for (const file of files) {
            const content = await this.safeReadFile(file);
            if (content) {
              const language = this.getLanguageFromExtension(path.extname(file));
              const classLocations = this.findClassInContent(content, simpleClassName, file, language);
              locations.push(...classLocations);
            }
          }
        } catch (error) {
          console.warn(`类搜索失败: ${error}`);
        }
      }
    }

    return locations;
  }

  private async findByMethodName(
    methodName: string,
    className: string | undefined,
    projectRoot: string
  ): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = [];
    const files = this.projectIndex ? this.projectIndex.files : await this.getAllSourceFiles(projectRoot);

    for (const file of files) {
      let filePath: string;
      let language: ProgrammingLanguage;
      
      if (this.projectIndex) {
        const projectFile = file as ProjectFile;
        filePath = projectFile.path;
        language = projectFile.language;
      } else {
        filePath = file as string;
        language = this.getLanguageFromExtension(path.extname(filePath));
      }
      
      const content = await this.safeReadFile(filePath);
      
      if (content) {
        const methodLocations = this.findMethodInContent(content, methodName, className, filePath, language);
        locations.push(...methodLocations);
      }
    }

    return locations;
  }

  private async findByFuzzyMatch(trace: StackTraceEntry, projectRoot: string): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = [];
    
    // 简单的模糊匹配实现
    if (trace.fileName) {
      const nameWithoutExt = path.basename(trace.fileName, path.extname(trace.fileName));
      const { glob } = await import('glob');
      
      try {
        const files = await glob(`**/*${nameWithoutExt}*`, {
          cwd: projectRoot,
          absolute: true,
          ignore: ['**/node_modules/**', '**/target/**', '**/build/**']
        });

        for (const file of files) {
          locations.push({
            filePath: file,
            lineNumber: trace.lineNumber,
            confidence: 0.3,
            matchReason: `模糊文件名匹配: ${nameWithoutExt}`
          });
        }
      } catch (error) {
        console.warn(`模糊搜索失败: ${error}`);
      }
    }

    return locations;
  }

  private findClassInContent(
    content: string,
    className: string,
    filePath: string,
    language: ProgrammingLanguage
  ): CodeLocation[] {
    const locations: CodeLocation[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let classPattern: RegExp;

      switch (language) {
        case ProgrammingLanguage.JAVA:
        case ProgrammingLanguage.KOTLIN:
        case ProgrammingLanguage.SCALA:
          classPattern = new RegExp(`\\bclass\\s+${className}\\b`);
          break;
        case ProgrammingLanguage.CSHARP:
          classPattern = new RegExp(`\\bclass\\s+${className}\\b`);
          break;
        case ProgrammingLanguage.PYTHON:
          classPattern = new RegExp(`^class\\s+${className}\\s*[\\(:]`);
          break;
        case ProgrammingLanguage.JAVASCRIPT:
        case ProgrammingLanguage.TYPESCRIPT:
          classPattern = new RegExp(`\\bclass\\s+${className}\\b`);
          break;
        default:
          classPattern = new RegExp(`\\b${className}\\b`);
      }

      if (classPattern.test(line)) {
        locations.push({
          filePath,
          lineNumber: i + 1,
          className,
          confidence: 0.8,
          matchReason: `类定义匹配: ${className}`
        });
      }
    }

    return locations;
  }

  private findMethodInContent(
    content: string,
    methodName: string,
    className: string | undefined,
    filePath: string,
    language: ProgrammingLanguage
  ): CodeLocation[] {
    const locations: CodeLocation[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let methodPattern: RegExp;

      switch (language) {
        case ProgrammingLanguage.JAVA:
        case ProgrammingLanguage.KOTLIN:
        case ProgrammingLanguage.SCALA:
          methodPattern = new RegExp(`\\b(public|private|protected)?.*\\s+${methodName}\\s*\\(`);
          break;
        case ProgrammingLanguage.CSHARP:
          methodPattern = new RegExp(`\\b(public|private|protected|internal)?.*\\s+${methodName}\\s*\\(`);
          break;
        case ProgrammingLanguage.PYTHON:
          methodPattern = new RegExp(`^\\s*def\\s+${methodName}\\s*\\(`);
          break;
        case ProgrammingLanguage.JAVASCRIPT:
        case ProgrammingLanguage.TYPESCRIPT:
          methodPattern = new RegExp(`\\b(function\\s+)?${methodName}\\s*[=:]?\\s*\\(`);
          break;
        case ProgrammingLanguage.GO:
          methodPattern = new RegExp(`^func\\s+(\\w+\\s+)?${methodName}\\s*\\(`);
          break;
        default:
          methodPattern = new RegExp(`\\b${methodName}\\s*\\(`);
      }

      if (methodPattern.test(line)) {
        const confidence = className && line.includes(className) ? 0.9 : 0.7;
        locations.push({
          filePath,
          lineNumber: i + 1,
          className,
          methodName,
          confidence,
          matchReason: `方法定义匹配: ${methodName}`
        });
      }
    }

    return locations;
  }

  private extractSimpleClassName(fullClassName: string): string {
    return fullClassName.split('.').pop() || fullClassName;
  }

  private getLanguageFromExtension(extension: string): ProgrammingLanguage {
    const extensionMap: Record<string, ProgrammingLanguage> = {
      '.java': ProgrammingLanguage.JAVA,
      '.js': ProgrammingLanguage.JAVASCRIPT,
      '.ts': ProgrammingLanguage.TYPESCRIPT,
      '.py': ProgrammingLanguage.PYTHON,
      '.cs': ProgrammingLanguage.CSHARP,
      '.cpp': ProgrammingLanguage.CPP,
      '.go': ProgrammingLanguage.GO,
      '.rs': ProgrammingLanguage.RUST,
      '.kt': ProgrammingLanguage.KOTLIN
    };

    return extensionMap[extension.toLowerCase()] || ProgrammingLanguage.UNKNOWN;
  }

  private async safeReadFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  private async getAllSourceFiles(projectRoot: string): Promise<string[]> {
    const { glob } = await import('glob');
    const patterns = ['**/*.java', '**/*.cs', '**/*.cpp', '**/*.py', '**/*.js', '**/*.ts', '**/*.go', '**/*.rs', '**/*.kt'];
    const allFiles: string[] = [];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: projectRoot,
          absolute: true,
          ignore: ['**/node_modules/**', '**/target/**', '**/build/**']
        });
        allFiles.push(...files);
      } catch (error) {
        console.warn(`文件搜索失败 (${pattern}): ${error}`);
      }
    }

    return [...new Set(allFiles)]; // 去重
  }

  private deduplicateLocations(locations: CodeLocation[]): CodeLocation[] {
    const seen = new Set<string>();
    const unique: CodeLocation[] = [];

    for (const location of locations) {
      const key = `${location.filePath}:${location.lineNumber || 0}:${location.methodName || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(location);
      }
    }

    return unique;
  }
}