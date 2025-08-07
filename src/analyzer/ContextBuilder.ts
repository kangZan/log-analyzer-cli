import * as fs from 'fs-extra';
import * as path from 'path';
import { 
  ErrorLogEntry, 
  CodeLocation, 
  ProjectContext, 
  AIAnalysisRequest 
} from '../types';

export class ContextBuilder {
  private static readonly MAX_CODE_CONTEXT_LINES = 50;
  private static readonly MAX_ERROR_CONTEXT_LINES = 20;

  static async buildAnalysisRequest(
    errorEntries: ErrorLogEntry[],
    codeLocations: CodeLocation[],
    projectRoot?: string
  ): Promise<AIAnalysisRequest> {
    const projectContext = projectRoot ? 
      await this.buildProjectContext(projectRoot) : 
      this.getDefaultProjectContext();

    const codeContext = await this.buildCodeContext(codeLocations);

    return {
      errorEntries,
      codeLocations,
      codeContext,
      projectContext
    };
  }

  private static async buildProjectContext(projectRoot: string): Promise<ProjectContext> {
    const context: ProjectContext = {
      projectType: 'Unknown',
      primaryLanguage: 'Unknown',
      frameworks: [],
      dependencies: [],
      projectStructure: ''
    };

    try {
      // 检测项目类型和框架
      await this.detectProjectType(projectRoot, context);
      await this.detectLanguageAndFrameworks(projectRoot, context);
      await this.buildProjectStructure(projectRoot, context);
    } catch (error) {
      console.warn(`构建项目上下文失败: ${error}`);
    }

    return context;
  }

  private static async detectProjectType(projectRoot: string, context: ProjectContext): Promise<void> {
    const indicators = [
      { file: 'package.json', type: 'Node.js项目' },
      { file: 'pom.xml', type: 'Maven Java项目' },
      { file: 'build.gradle', type: 'Gradle Java项目' },
      { file: 'Cargo.toml', type: 'Rust项目' },
      { file: 'go.mod', type: 'Go项目' },
      { file: 'requirements.txt', type: 'Python项目' },
      { file: 'composer.json', type: 'PHP项目' },
      { file: 'Gemfile', type: 'Ruby项目' }
    ];

    for (const indicator of indicators) {
      const filePath = path.join(projectRoot, indicator.file);
      if (await fs.pathExists(filePath)) {
        context.projectType = indicator.type;
        
        // 读取项目文件以获取更多信息
        await this.parseProjectFile(filePath, context);
        break;
      }
    }

    // 检查.csproj文件
    const files = await fs.readdir(projectRoot);
    const csprojFiles = files.filter(file => file.endsWith('.csproj'));
    if (csprojFiles.length > 0) {
      context.projectType = 'C#项目';
      await this.parseProjectFile(path.join(projectRoot, csprojFiles[0]), context);
    }
  }

  private static async parseProjectFile(filePath: string, context: ProjectContext): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(filePath);

      switch (extension) {
        case '.json':
          await this.parsePackageJson(content, context);
          break;
        case '.xml':
          await this.parsePomXml(content, context);
          break;
        case '.toml':
          // 简单解析Cargo.toml或其他toml文件
          break;
        case '.gradle':
          await this.parseGradleFile(content, context);
          break;
      }
    } catch (error) {
      console.warn(`解析项目文件失败 ${filePath}: ${error}`);
    }
  }

  private static async parsePackageJson(content: string, context: ProjectContext): Promise<void> {
    try {
      const packageJson = JSON.parse(content);
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      for (const dep of Object.keys(allDeps || {})) {
        if (dep.includes('react')) {
          context.frameworks.push('React');
        } else if (dep.includes('vue')) {
          context.frameworks.push('Vue.js');
        } else if (dep.includes('angular')) {
          context.frameworks.push('Angular');
        } else if (dep.includes('express')) {
          context.frameworks.push('Express.js');
        } else if (dep.includes('next')) {
          context.frameworks.push('Next.js');
        }
      }

      context.dependencies = Object.keys(allDeps || {}).slice(0, 10); // 前10个依赖
    } catch (error) {
      console.warn('解析package.json失败:', error);
    }
  }

  private static async parsePomXml(content: string, context: ProjectContext): Promise<void> {
    // 简单的XML解析，查找Spring Boot等框架
    if (content.includes('spring-boot-starter')) {
      context.frameworks.push('Spring Boot');
    }
    if (content.includes('springframework')) {
      context.frameworks.push('Spring Framework');
    }
    if (content.includes('hibernate')) {
      context.frameworks.push('Hibernate');
    }
    if (content.includes('mybatis')) {
      context.frameworks.push('MyBatis');
    }
  }

  private static async parseGradleFile(content: string, context: ProjectContext): Promise<void> {
    if (content.includes('spring-boot')) {
      context.frameworks.push('Spring Boot');
    }
    if (content.includes('org.springframework')) {
      context.frameworks.push('Spring Framework');
    }
  }

  private static async detectLanguageAndFrameworks(projectRoot: string, context: ProjectContext): Promise<void> {
    const extensions = new Map<string, number>();
    
    try {
      const { glob } = await import('glob');
      const files = await glob('**/*.{java,js,ts,py,cs,go,rs,php,rb}', {
        cwd: projectRoot,
        ignore: ['**/node_modules/**', '**/target/**', '**/build/**'],
        absolute: false
      });

      for (const file of files.slice(0, 100)) { // 限制检查文件数量
        const ext = path.extname(file).toLowerCase();
        extensions.set(ext, (extensions.get(ext) || 0) + 1);
      }

      // 确定主要语言
      const sorted = Array.from(extensions.entries()).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const primaryExt = sorted[0][0];
        context.primaryLanguage = this.getLanguageFromExtension(primaryExt);
      }

    } catch (error) {
      console.warn('检测语言失败:', error);
    }
  }

  private static getLanguageFromExtension(ext: string): string {
    const map: Record<string, string> = {
      '.java': 'Java',
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.py': 'Python',
      '.cs': 'C#',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.rb': 'Ruby'
    };
    return map[ext] || 'Unknown';
  }

  private static async buildProjectStructure(projectRoot: string, context: ProjectContext): Promise<void> {
    try {
      const structure: string[] = [];
      const items = await fs.readdir(projectRoot);
      
      for (const item of items.slice(0, 20)) { // 限制显示的项目数
        const itemPath = path.join(projectRoot, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && 
            !['node_modules', 'target', 'build', 'dist'].includes(item)) {
          structure.push(`${item}/`);
        }
      }
      
      context.projectStructure = structure.join(', ');
    } catch (error) {
      console.warn('构建项目结构失败:', error);
      context.projectStructure = '无法读取项目结构';
    }
  }

  private static getDefaultProjectContext(): ProjectContext {
    return {
      projectType: 'Unknown',
      primaryLanguage: 'Unknown',
      frameworks: [],
      dependencies: [],
      projectStructure: 'Unknown'
    };
  }

  private static async buildCodeContext(locations: CodeLocation[]): Promise<string[]> {
    const codeContext: string[] = [];

    for (const location of locations.slice(0, 5)) { // 限制处理的位置数量
      try {
        const context = await this.extractCodeContext(location);
        if (context) {
          codeContext.push(context);
        }
      } catch (error) {
        console.warn(`提取代码上下文失败 ${location.filePath}: ${error}`);
      }
    }

    return codeContext;
  }

  private static async extractCodeContext(location: CodeLocation): Promise<string | null> {
    try {
      const content = await fs.readFile(location.filePath, 'utf-8');
      const lines = content.split('\n');
      
      if (!location.lineNumber) {
        // 如果没有行号，返回文件开头的一部分
        return this.formatCodeSnippet(
          location.filePath,
          lines.slice(0, Math.min(this.MAX_CODE_CONTEXT_LINES, lines.length)),
          1
        );
      }

      // 提取指定行周围的代码
      const startLine = Math.max(0, location.lineNumber - 10);
      const endLine = Math.min(lines.length, location.lineNumber + 10);
      const contextLines = lines.slice(startLine, endLine);

      return this.formatCodeSnippet(
        location.filePath,
        contextLines,
        startLine + 1,
        location.lineNumber
      );

    } catch (error) {
      return null;
    }
  }

  private static formatCodeSnippet(
    filePath: string,
    lines: string[],
    startLineNumber: number,
    highlightLine?: number
  ): string {
    const relativePath = path.basename(filePath);
    let result = `## 文件: ${relativePath}\n`;
    
    if (highlightLine) {
      result += `### 关键行: ${highlightLine}\n`;
    }
    
    result += '```\n';
    
    lines.forEach((line, index) => {
      const lineNum = startLineNumber + index;
      const marker = lineNum === highlightLine ? ' >>> ' : '     ';
      result += `${lineNum.toString().padStart(4)}${marker}${line}\n`;
    });
    
    result += '```\n';
    
    return result;
  }

  static formatErrorLogs(errorEntries: ErrorLogEntry[]): string {
    return errorEntries.slice(0, this.MAX_ERROR_CONTEXT_LINES).map((error, index) => {
      let formatted = `## 错误 ${index + 1} (行 ${error.lineNumber})\n`;
      formatted += `**级别**: ${error.level}\n`;
      
      if (error.errorType) {
        formatted += `**类型**: ${error.errorType}\n`;
      }
      
      formatted += `**消息**: ${error.message}\n`;
      
      if (error.stackTrace && error.stackTrace.length > 0) {
        formatted += `**堆栈跟踪**:\n`;
        error.stackTrace.slice(0, 10).forEach(trace => {
          formatted += `  - ${trace.rawLine}\n`;
        });
      }
      
      formatted += '\n';
      return formatted;
    }).join('');
  }

  static formatCodeLocations(locations: CodeLocation[]): string {
    return locations.slice(0, 10).map((location, index) => {
      const relativePath = path.basename(location.filePath);
      let formatted = `## 位置 ${index + 1}\n`;
      formatted += `**文件**: ${relativePath}\n`;
      
      if (location.lineNumber) {
        formatted += `**行号**: ${location.lineNumber}\n`;
      }
      
      if (location.className) {
        formatted += `**类**: ${location.className}\n`;
      }
      
      if (location.methodName) {
        formatted += `**方法**: ${location.methodName}\n`;
      }
      
      formatted += `**置信度**: ${(location.confidence * 100).toFixed(0)}%\n`;
      formatted += `**匹配原因**: ${location.matchReason}\n\n`;
      
      return formatted;
    }).join('');
  }
}