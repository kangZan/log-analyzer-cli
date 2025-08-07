import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { LanguageDetector } from './LanguageDetector';
import { ProjectFile, ProjectIndex, ProgrammingLanguage } from '../types/codeLocation';

export class ProjectScanner {
  private static readonly DEFAULT_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/target/**',
    '**/build/**',
    '**/dist/**',
    '**/out/**',
    '**/bin/**',
    '**/obj/**',
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    '**/vendor/**',
    '**/__pycache__/**',
    '**/*.pyc',
    '**/.idea/**',
    '**/.vscode/**',
    '**/*.class',
    '**/*.jar',
    '**/*.war',
    '**/*.dll',
    '**/*.exe',
    '**/*.so',
    '**/*.dylib'
  ];

  private static readonly DEFAULT_INCLUDE_PATTERNS = [
    '**/*.java',
    '**/*.js',
    '**/*.jsx',
    '**/*.ts',
    '**/*.tsx',
    '**/*.py',
    '**/*.cs',
    '**/*.cpp',
    '**/*.cxx',
    '**/*.cc',
    '**/*.c',
    '**/*.hpp',
    '**/*.hxx',
    '**/*.h',
    '**/*.go',
    '**/*.rs',
    '**/*.php',
    '**/*.rb',
    '**/*.kt',
    '**/*.kts',
    '**/*.scala',
    '**/*.sc'
  ];

  async scanProject(
    rootPath: string,
    options: {
      includePatterns?: string[];
      excludePatterns?: string[];
      maxFileSize?: number; // MB
      followSymlinks?: boolean;
    } = {}
  ): Promise<ProjectIndex> {
    const startTime = Date.now();
    
    if (!await fs.pathExists(rootPath)) {
      throw new Error(`项目路径不存在: ${rootPath}`);
    }

    const resolvedRootPath = path.resolve(rootPath);
    
    const includePatterns = options.includePatterns || ProjectScanner.DEFAULT_INCLUDE_PATTERNS;
    const excludePatterns = [...ProjectScanner.DEFAULT_EXCLUDE_PATTERNS, ...(options.excludePatterns || [])];
    const maxFileSizeBytes = (options.maxFileSize || 5) * 1024 * 1024; // 默认5MB

    console.log(`🔍 扫描项目: ${resolvedRootPath}`);
    
    // 使用glob查找文件
    const allFiles: string[] = [];
    
    for (const pattern of includePatterns) {
      const files = await glob(pattern, {
        cwd: resolvedRootPath,
        absolute: true,
        ignore: excludePatterns,
        follow: options.followSymlinks || false,
        nodir: true
      });
      allFiles.push(...files);
    }

    // 去重
    const uniqueFiles = [...new Set(allFiles)];
    console.log(`📁 找到 ${uniqueFiles.length} 个源码文件`);

    const projectFiles: ProjectFile[] = [];
    const classIndex = new Map<string, any[]>();
    const methodIndex = new Map<string, any[]>();
    const packageIndex = new Map<string, string[]>();
    const languageStats = new Map<ProgrammingLanguage, number>();

    let processedCount = 0;

    for (const filePath of uniqueFiles) {
      try {
        const stats = await fs.stat(filePath);
        
        // 跳过过大的文件
        if (stats.size > maxFileSizeBytes) {
          console.log(`⚠️  跳过大文件: ${path.relative(resolvedRootPath, filePath)} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
          continue;
        }

        const relativePath = path.relative(resolvedRootPath, filePath);
        const extension = path.extname(filePath).toLowerCase();
        
        // 检测语言
        const language = LanguageDetector.detectByExtension(filePath);
        
        if (language === ProgrammingLanguage.UNKNOWN) {
          continue;
        }

        const projectFile: ProjectFile = {
          path: filePath,
          relativePath,
          extension,
          size: stats.size,
          language,
          classes: [],
          methods: [],
          imports: []
        };

        projectFiles.push(projectFile);

        // 统计语言使用情况
        languageStats.set(language, (languageStats.get(language) || 0) + 1);

        processedCount++;
        if (processedCount % 100 === 0) {
          console.log(`📊 已处理 ${processedCount} 个文件...`);
        }

      } catch (error: any) {
        console.warn(`⚠️  处理文件失败: ${filePath} - ${error.message}`);
      }
    }

    const endTime = Date.now();
    const scanTime = endTime - startTime;

    console.log(`✅ 项目扫描完成，耗时 ${scanTime}ms`);
    console.log(`📈 语言统计:`);
    
    for (const [language, count] of languageStats.entries()) {
      console.log(`  ${LanguageDetector.getLanguageDisplayName(language)}: ${count} 文件`);
    }

    return {
      rootPath: resolvedRootPath,
      files: projectFiles,
      classIndex,
      methodIndex,
      packageIndex,
      createdAt: new Date(),
      totalFiles: projectFiles.length,
      supportedLanguages: Array.from(languageStats.keys())
    };
  }

  async scanWithCodeAnalysis(
    rootPath: string,
    options: {
      includePatterns?: string[];
      excludePatterns?: string[];
      maxFileSize?: number;
      followSymlinks?: boolean;
      analyzeContent?: boolean;
    } = {}
  ): Promise<ProjectIndex> {
    const index = await this.scanProject(rootPath, options);
    
    if (options.analyzeContent === false) {
      return index;
    }

    console.log('🔬 开始代码内容分析...');
    
    // 这里可以扩展为分析每个文件的类和方法
    // 由于实现复杂，暂时返回基础索引
    console.log('⚠️  详细代码分析功能开发中...');
    
    return index;
  }

  async findProjectRoot(startPath: string): Promise<string | null> {
    const indicators = [
      'package.json',      // Node.js
      'pom.xml',          // Maven Java
      'build.gradle',     // Gradle
      'Cargo.toml',       // Rust
      'go.mod',           // Go
      'requirements.txt', // Python
      'Pipfile',          // Python Pipenv
      'pyproject.toml',   // Python Poetry
      '.csproj',          // C# (partial match)
      'solution.sln',     // C# Solution
      'composer.json',    // PHP
      'Gemfile'           // Ruby
    ];

    let currentPath = path.resolve(startPath);
    const root = path.parse(currentPath).root;

    while (currentPath !== root) {
      for (const indicator of indicators) {
        const indicatorPath = path.join(currentPath, indicator);
        
        if (await fs.pathExists(indicatorPath)) {
          return currentPath;
        }

        // 处理.csproj文件的特殊情况
        if (indicator === '.csproj') {
          const files = await fs.readdir(currentPath);
          if (files.some(file => file.endsWith('.csproj'))) {
            return currentPath;
          }
        }
      }

      // 检查是否包含src目录
      const srcPath = path.join(currentPath, 'src');
      if (await fs.pathExists(srcPath)) {
        const srcStat = await fs.stat(srcPath);
        if (srcStat.isDirectory()) {
          return currentPath;
        }
      }

      currentPath = path.dirname(currentPath);
    }

    return null;
  }

  async getDirectoryStats(dirPath: string): Promise<{
    totalFiles: number;
    sourceFiles: number;
    languages: Record<string, number>;
    largestFile: { path: string; size: number } | null;
  }> {
    const stats = {
      totalFiles: 0,
      sourceFiles: 0,
      languages: {} as Record<string, number>,
      largestFile: null as { path: string; size: number } | null
    };

    try {
      const files = await glob('**/*', {
        cwd: dirPath,
        absolute: true,
        ignore: ProjectScanner.DEFAULT_EXCLUDE_PATTERNS,
        nodir: true
      });

      stats.totalFiles = files.length;

      for (const file of files) {
        const fileStat = await fs.stat(file);
        
        if (LanguageDetector.isSourceFile(file)) {
          stats.sourceFiles++;
          
          const language = LanguageDetector.detectByExtension(file);
          const langName = LanguageDetector.getLanguageDisplayName(language);
          stats.languages[langName] = (stats.languages[langName] || 0) + 1;
        }

        if (!stats.largestFile || fileStat.size > stats.largestFile.size) {
          stats.largestFile = {
            path: path.relative(dirPath, file),
            size: fileStat.size
          };
        }
      }

    } catch (error: any) {
      console.warn(`获取目录统计失败: ${error.message}`);
    }

    return stats;
  }
}