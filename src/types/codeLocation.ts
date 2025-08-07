export interface CodeLocation {
  filePath: string;
  lineNumber?: number;
  className?: string;
  methodName?: string;
  confidence: number; // 匹配置信度 0-1
  matchReason: string;
}

export interface ProjectFile {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
  language: ProgrammingLanguage;
  classes?: ClassInfo[];
  methods?: MethodInfo[];
  imports?: string[];
}

export interface ClassInfo {
  name: string;
  fullName: string;
  lineNumber: number;
  methods: MethodInfo[];
  package?: string;
  namespace?: string;
}

export interface MethodInfo {
  name: string;
  className?: string;
  lineNumber: number;
  parameters?: string[];
  returnType?: string;
  isStatic?: boolean;
  visibility?: 'public' | 'private' | 'protected' | 'internal';
}

export enum ProgrammingLanguage {
  JAVA = 'java',
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  CSHARP = 'csharp',
  CPP = 'cpp',
  GO = 'go',
  RUST = 'rust',
  PHP = 'php',
  RUBY = 'ruby',
  KOTLIN = 'kotlin',
  SCALA = 'scala',
  UNKNOWN = 'unknown'
}

export interface ProjectIndex {
  rootPath: string;
  files: ProjectFile[];
  classIndex: Map<string, ClassInfo[]>;
  methodIndex: Map<string, MethodInfo[]>;
  packageIndex: Map<string, string[]>;
  createdAt: Date;
  totalFiles: number;
  supportedLanguages: ProgrammingLanguage[];
}

export interface CodeSearchOptions {
  maxResults?: number;
  includeLibraries?: boolean;
  excludePatterns?: string[];
  includePatterns?: string[];
  caseSensitive?: boolean;
  fuzzyMatch?: boolean;
}

export interface CodeLocationResult {
  locations: CodeLocation[];
  relatedFiles: string[];
  searchTime: number;
  indexUsed: boolean;
}