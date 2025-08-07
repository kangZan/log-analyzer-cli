export interface LogEntry {
  timestamp?: string;
  level?: LogLevel;
  message: string;
  lineNumber: number;
  rawLine: string;
  metadata?: Record<string, any>;
}

export interface ErrorLogEntry extends LogEntry {
  level: LogLevel.ERROR | LogLevel.FATAL;
  stackTrace?: StackTraceEntry[];
  errorType?: string;
  contextLines?: LogEntry[];
}

export interface StackTraceEntry {
  className?: string;
  methodName?: string;
  fileName?: string;
  lineNumber?: number;
  fullPath?: string;
  rawLine: string;
}

export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export enum LogFormat {
  JSON = 'json',
  TEXT = 'text',
  COMMON = 'common',
  COMBINED = 'combined',
  SPRING = 'spring',
  LOG4J = 'log4j'
}

export interface ParsedLogResult {
  entries: LogEntry[];
  errorEntries: ErrorLogEntry[];
  format: LogFormat;
  totalLines: number;
  parseErrors: string[];
}

export interface LogParseOptions {
  contextLines?: number; // 错误日志前后获取多少行上下文
  maxFileSize?: number;  // 最大文件大小限制（MB）
  encoding?: string;     // 文件编码
}