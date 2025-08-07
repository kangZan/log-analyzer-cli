import * as path from 'path';
import { ProgrammingLanguage } from '../types/codeLocation';

export class LanguageDetector {
  private static readonly EXTENSION_MAP: Record<string, ProgrammingLanguage> = {
    '.java': ProgrammingLanguage.JAVA,
    '.js': ProgrammingLanguage.JAVASCRIPT,
    '.jsx': ProgrammingLanguage.JAVASCRIPT,
    '.ts': ProgrammingLanguage.TYPESCRIPT,
    '.tsx': ProgrammingLanguage.TYPESCRIPT,
    '.py': ProgrammingLanguage.PYTHON,
    '.pyw': ProgrammingLanguage.PYTHON,
    '.cs': ProgrammingLanguage.CSHARP,
    '.cpp': ProgrammingLanguage.CPP,
    '.cxx': ProgrammingLanguage.CPP,
    '.cc': ProgrammingLanguage.CPP,
    '.c': ProgrammingLanguage.CPP,
    '.hpp': ProgrammingLanguage.CPP,
    '.hxx': ProgrammingLanguage.CPP,
    '.h': ProgrammingLanguage.CPP,
    '.go': ProgrammingLanguage.GO,
    '.rs': ProgrammingLanguage.RUST,
    '.php': ProgrammingLanguage.PHP,
    '.rb': ProgrammingLanguage.RUBY,
    '.kt': ProgrammingLanguage.KOTLIN,
    '.kts': ProgrammingLanguage.KOTLIN,
    '.scala': ProgrammingLanguage.SCALA,
    '.sc': ProgrammingLanguage.SCALA
  };

  private static readonly LANGUAGE_PATTERNS: Record<ProgrammingLanguage, RegExp[]> = {
    [ProgrammingLanguage.JAVA]: [
      /^package\s+[\w.]+;/m,
      /^import\s+[\w.]+;/m,
      /public\s+class\s+\w+/,
      /public\s+static\s+void\s+main/
    ],
    [ProgrammingLanguage.JAVASCRIPT]: [
      /require\s*\(\s*['"][^'"]+['"]\s*\)/,
      /import\s+.+\s+from\s+['"][^'"]+['"]/,
      /export\s+(default\s+)?/,
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/
    ],
    [ProgrammingLanguage.TYPESCRIPT]: [
      /interface\s+\w+\s*{/,
      /type\s+\w+\s*=/,
      /import\s+.+\s+from\s+['"][^'"]+['"]/,
      /export\s+(default\s+)?/,
      /:\s*(string|number|boolean|any)/
    ],
    [ProgrammingLanguage.PYTHON]: [
      /^import\s+\w+/m,
      /^from\s+[\w.]+\s+import/m,
      /def\s+\w+\s*\(/,
      /class\s+\w+\s*(\([^)]*\))?:/,
      /if\s+__name__\s*==\s*['"]__main__['"]/
    ],
    [ProgrammingLanguage.CSHARP]: [
      /^using\s+[\w.]+;/m,
      /namespace\s+[\w.]+/,
      /public\s+class\s+\w+/,
      /public\s+static\s+void\s+Main/,
      /\[.*Attribute.*\]/
    ],
    [ProgrammingLanguage.CPP]: [
      /#include\s*[<"][^>"]+[>"]/,
      /using\s+namespace\s+\w+;/,
      /class\s+\w+\s*{/,
      /int\s+main\s*\(/,
      /std::/
    ],
    [ProgrammingLanguage.GO]: [
      /^package\s+\w+/m,
      /^import\s*\(/m,
      /func\s+\w+\s*\(/,
      /func\s+main\s*\(\)/,
      /fmt\./
    ],
    [ProgrammingLanguage.RUST]: [
      /use\s+[\w:]+;/,
      /fn\s+\w+\s*\(/,
      /fn\s+main\s*\(\)/,
      /struct\s+\w+\s*{/,
      /impl\s+\w+/
    ],
    [ProgrammingLanguage.PHP]: [
      /^<\?php/m,
      /\$\w+\s*=/,
      /function\s+\w+\s*\(/,
      /class\s+\w+\s*{/,
      /echo\s+/
    ],
    [ProgrammingLanguage.RUBY]: [
      /require\s+['"][^'"]+['"]/,
      /def\s+\w+/,
      /class\s+\w+/,
      /module\s+\w+/,
      /puts\s+/
    ],
    [ProgrammingLanguage.KOTLIN]: [
      /^package\s+[\w.]+/m,
      /^import\s+[\w.]+/m,
      /fun\s+\w+\s*\(/,
      /class\s+\w+/,
      /val\s+\w+\s*=/
    ],
    [ProgrammingLanguage.SCALA]: [
      /^package\s+[\w.]+/m,
      /^import\s+[\w.]+/m,
      /def\s+\w+\s*\(/,
      /class\s+\w+/,
      /object\s+\w+/
    ],
    [ProgrammingLanguage.UNKNOWN]: []
  };

  static detectByExtension(filePath: string): ProgrammingLanguage {
    const extension = path.extname(filePath).toLowerCase();
    return this.EXTENSION_MAP[extension] || ProgrammingLanguage.UNKNOWN;
  }

  static detectByContent(content: string, extensionHint?: ProgrammingLanguage): ProgrammingLanguage {
    const scores: Record<ProgrammingLanguage, number> = {} as any;
    
    // 初始化分数
    for (const lang of Object.values(ProgrammingLanguage)) {
      scores[lang] = 0;
    }

    // 如果有扩展名提示，给予额外分数
    if (extensionHint && extensionHint !== ProgrammingLanguage.UNKNOWN) {
      scores[extensionHint] += 2;
    }

    // 根据模式匹配计分
    for (const [language, patterns] of Object.entries(this.LANGUAGE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          scores[language as ProgrammingLanguage]++;
        }
      }
    }

    // 找到得分最高的语言
    let bestLanguage = ProgrammingLanguage.UNKNOWN;
    let maxScore = 0;

    for (const [language, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestLanguage = language as ProgrammingLanguage;
      }
    }

    return maxScore > 0 ? bestLanguage : ProgrammingLanguage.UNKNOWN;
  }

  static getSupportedExtensions(): string[] {
    return Object.keys(this.EXTENSION_MAP);
  }

  static isSourceFile(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return extension in this.EXTENSION_MAP;
  }

  static getLanguageDisplayName(language: ProgrammingLanguage): string {
    const displayNames: Record<ProgrammingLanguage, string> = {
      [ProgrammingLanguage.JAVA]: 'Java',
      [ProgrammingLanguage.JAVASCRIPT]: 'JavaScript',
      [ProgrammingLanguage.TYPESCRIPT]: 'TypeScript',
      [ProgrammingLanguage.PYTHON]: 'Python',
      [ProgrammingLanguage.CSHARP]: 'C#',
      [ProgrammingLanguage.CPP]: 'C/C++',
      [ProgrammingLanguage.GO]: 'Go',
      [ProgrammingLanguage.RUST]: 'Rust',
      [ProgrammingLanguage.PHP]: 'PHP',
      [ProgrammingLanguage.RUBY]: 'Ruby',
      [ProgrammingLanguage.KOTLIN]: 'Kotlin',
      [ProgrammingLanguage.SCALA]: 'Scala',
      [ProgrammingLanguage.UNKNOWN]: 'Unknown'
    };

    return displayNames[language];
  }
}