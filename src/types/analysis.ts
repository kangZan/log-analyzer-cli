import { ErrorLogEntry } from './log';
import { CodeLocation } from './codeLocation';

export interface AIAnalysisRequest {
  errorEntries: ErrorLogEntry[];
  codeLocations: CodeLocation[];
  codeContext: string[];
  projectContext: ProjectContext;
}

export interface ProjectContext {
  projectType: string;
  primaryLanguage: string;
  frameworks: string[];
  dependencies: string[];
  projectStructure: string;
}

export interface AIAnalysisResult {
  summary: string;
  rootCause: string;
  errorAnalysis: ErrorAnalysis[];
  recommendations: Recommendation[];
  codeImprovements: CodeImprovement[];
  confidence: number;
  analysisTime: number;
}

export interface ErrorAnalysis {
  errorId: string;
  errorType: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelyCause: string;
  affectedComponents: string[];
  relatedErrors: string[];
}

export interface Recommendation {
  id: string;
  type: 'immediate' | 'short-term' | 'long-term';
  priority: number;
  title: string;
  description: string;
  actionItems: string[];
  estimatedEffort: string;
  benefits: string[];
}

export interface CodeImprovement {
  filePath: string;
  lineNumber?: number;
  type: 'bug-fix' | 'enhancement' | 'refactor' | 'security';
  description: string;
  suggestedCode?: string;
  explanation: string;
}

export interface PromptTemplate {
  name: string;
  template: string;
  variables: string[];
  maxTokens: number;
  temperature: number;
}

export interface AIProvider {
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiUrl: string;
  apiKey?: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  supportedFeatures: AIFeature[];
}

export enum AIFeature {
  TEXT_COMPLETION = 'text_completion',
  CHAT_COMPLETION = 'chat_completion',
  CODE_ANALYSIS = 'code_analysis',
  STREAMING = 'streaming',
  FUNCTION_CALLING = 'function_calling'
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}