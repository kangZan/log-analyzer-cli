import { LogEntry, ErrorLogEntry, LogLevel, StackTraceEntry } from '../types/log';

export class ErrorExtractor {
  private static readonly ERROR_INDICATORS = [
    /\b(exception|error|err|fail|failed|failure)\b/i,
    /\b(null\s*pointer|segmentation\s*fault|access\s*violation)\b/i,
    /\b(timeout|connection\s*refused|connection\s*reset)\b/i,
    /\b(out\s*of\s*memory|memory\s*leak|stack\s*overflow)\b/i,
    /\b(file\s*not\s*found|permission\s*denied|access\s*denied)\b/i,
    /\b(syntax\s*error|parse\s*error|compilation\s*error)\b/i,
    /\b(database\s*error|sql\s*error|query\s*failed)\b/i,
    /\b(network\s*error|socket\s*error|http\s*error)\b/i,
    /\b(assertion\s*failed|assertion\s*error)\b/i,
    /\bcritical\b/i,
    /\bfatal\b/i
  ];

  private static readonly JAVA_STACK_PATTERN = /^\s*at\s+([a-zA-Z_$][a-zA-Z\d_$]*\.)*[a-zA-Z_$][a-zA-Z\d_$]*\.[a-zA-Z_$][a-zA-Z\d_$]*\([^)]*\)/;
  private static readonly PYTHON_STACK_PATTERN = /^\s*File\s+"([^"]+)",\s*line\s+(\d+),\s*in\s+(.+)/;
  private static readonly CSHARP_STACK_PATTERN = /^\s*at\s+[^(]+\([^)]*\)\s+in\s+(.+):line\s+(\d+)/;
  private static readonly JS_STACK_PATTERN = /^\s*at\s+([^(]+)\s*\(([^:]+):(\d+):(\d+)\)/;

  static isErrorLine(entry: LogEntry): boolean {
    // 首先检查日志级别
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      return true;
    }

    // 然后检查消息内容中的错误指示器
    const message = entry.message.toLowerCase();
    return this.ERROR_INDICATORS.some(pattern => pattern.test(message));
  }

  static extractErrorEntries(entries: LogEntry[]): ErrorLogEntry[] {
    const errorEntries: ErrorLogEntry[] = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      if (this.isErrorLine(entry)) {
        const errorEntry = this.createErrorEntry(entry, entries, i);
        errorEntries.push(errorEntry);
      }
    }

    return errorEntries;
  }

  static createErrorEntry(entry: LogEntry, allEntries: LogEntry[], currentIndex: number): ErrorLogEntry {
    const errorEntry: ErrorLogEntry = {
      ...entry,
      level: entry.level as LogLevel.ERROR | LogLevel.FATAL || LogLevel.ERROR,
      stackTrace: [],
      contextLines: []
    };

    // 提取错误类型
    errorEntry.errorType = this.extractErrorType(entry.message);

    // 查找堆栈跟踪
    const stackTrace = this.extractStackTrace(allEntries, currentIndex);
    if (stackTrace.length > 0) {
      errorEntry.stackTrace = stackTrace;
    }

    // 提取上下文行
    errorEntry.contextLines = this.extractContextLines(allEntries, currentIndex, 3);

    return errorEntry;
  }

  private static extractErrorType(message: string): string | undefined {
    // 尝试提取Java异常类型
    const javaExceptionMatch = message.match(/\b([A-Z][a-zA-Z]*Exception|[A-Z][a-zA-Z]*Error)\b/);
    if (javaExceptionMatch) {
      return javaExceptionMatch[1];
    }

    // 尝试提取Python异常类型
    const pythonExceptionMatch = message.match(/\b([A-Z][a-zA-Z]*Error|[A-Z][a-zA-Z]*Exception)\b/);
    if (pythonExceptionMatch) {
      return pythonExceptionMatch[1];
    }

    // 尝试提取C#异常类型
    const csharpExceptionMatch = message.match(/\b([A-Z][a-zA-Z]*Exception)\b/);
    if (csharpExceptionMatch) {
      return csharpExceptionMatch[1];
    }

    // 尝试提取JavaScript错误类型
    const jsErrorMatch = message.match(/\b(Error|TypeError|ReferenceError|SyntaxError|RangeError)\b/);
    if (jsErrorMatch) {
      return jsErrorMatch[1];
    }

    return undefined;
  }

  private static extractStackTrace(entries: LogEntry[], startIndex: number): StackTraceEntry[] {
    const stackTrace: StackTraceEntry[] = [];
    const maxLookAhead = 50; // 最多向后查看50行

    for (let i = startIndex + 1; i < Math.min(entries.length, startIndex + maxLookAhead); i++) {
      const entry = entries[i];
      const line = entry.rawLine.trim();

      if (!line) continue;

      // 如果遇到新的日志条目（有时间戳或日志级别），停止查找堆栈
      if (this.isNewLogEntry(line)) {
        break;
      }

      const stackEntry = this.parseStackTraceLine(line);
      if (stackEntry) {
        stackTrace.push(stackEntry);
      } else if (stackTrace.length > 0) {
        // 如果已经开始收集堆栈但当前行不是堆栈行，可能堆栈结束了
        break;
      }
    }

    return stackTrace;
  }

  private static isNewLogEntry(line: string): boolean {
    // 检查是否包含时间戳模式
    const timestampPatterns = [
      /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/,
      /^\d{2}:\d{2}:\d{2}/,
      /^\[\d{4}-\d{2}-\d{2}/,
      /^INFO|^DEBUG|^ERROR|^WARN|^FATAL|^TRACE/i
    ];

    return timestampPatterns.some(pattern => pattern.test(line));
  }

  private static parseStackTraceLine(line: string): StackTraceEntry | null {
    // Java堆栈格式
    const javaMatch = line.match(this.JAVA_STACK_PATTERN);
    if (javaMatch) {
      const fullMatch = javaMatch[0];
      const methodMatch = fullMatch.match(/at\s+([^(]+)\(([^)]*)\)/);
      if (methodMatch) {
        const fullMethodName = methodMatch[1];
        const methodInfo = methodMatch[2];
        
        const lastDotIndex = fullMethodName.lastIndexOf('.');
        const className = lastDotIndex > 0 ? fullMethodName.substring(0, lastDotIndex) : '';
        const methodName = lastDotIndex > 0 ? fullMethodName.substring(lastDotIndex + 1) : fullMethodName;

        return {
          className,
          methodName,
          fileName: this.extractFileName(methodInfo),
          lineNumber: this.extractLineNumber(methodInfo),
          rawLine: line
        };
      }
    }

    // Python堆栈格式
    const pythonMatch = line.match(this.PYTHON_STACK_PATTERN);
    if (pythonMatch) {
      return {
        fileName: pythonMatch[1],
        lineNumber: parseInt(pythonMatch[2]),
        methodName: pythonMatch[3],
        rawLine: line
      };
    }

    // C#堆栈格式
    const csharpMatch = line.match(this.CSHARP_STACK_PATTERN);
    if (csharpMatch) {
      const methodPart = line.match(/at\s+([^(]+)/);
      const methodName = methodPart ? methodPart[1] : '';
      
      return {
        methodName,
        fileName: csharpMatch[1],
        lineNumber: parseInt(csharpMatch[2]),
        rawLine: line
      };
    }

    // JavaScript堆栈格式
    const jsMatch = line.match(this.JS_STACK_PATTERN);
    if (jsMatch) {
      return {
        methodName: jsMatch[1],
        fileName: jsMatch[2],
        lineNumber: parseInt(jsMatch[3]),
        rawLine: line
      };
    }

    return null;
  }

  private static extractFileName(methodInfo: string): string | undefined {
    const match = methodInfo.match(/([^:]+):\d+/);
    return match ? match[1] : undefined;
  }

  private static extractLineNumber(methodInfo: string): number | undefined {
    const match = methodInfo.match(/:(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }

  private static extractContextLines(entries: LogEntry[], currentIndex: number, contextSize: number): LogEntry[] {
    const start = Math.max(0, currentIndex - contextSize);
    const end = Math.min(entries.length, currentIndex + contextSize + 1);
    
    return entries.slice(start, end);
  }
}