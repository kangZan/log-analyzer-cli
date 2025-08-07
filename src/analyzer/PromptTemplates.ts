import { PromptTemplate } from '../types/analysis';

export class PromptTemplates {
  private static readonly templates: Record<string, PromptTemplate> = {
    LOG_ANALYSIS: {
      name: 'log_analysis',
      template: `你是一个专业的系统运维和软件开发专家，擅长分析日志错误和诊断系统问题。

## 分析任务
请分析以下错误日志，并提供详细的技术分析和解决建议。

## 项目信息
- **项目类型**: {{projectType}}
- **主要语言**: {{primaryLanguage}}
- **使用框架**: {{frameworks}}
- **项目结构**: {{projectStructure}}

## 错误日志
{{errorLogs}}

## 相关源码位置
{{codeLocations}}

## 源码上下文
{{codeContext}}

## 分析要求
请按照以下结构提供分析：

### 1. 问题摘要
简要描述发现的主要问题

### 2. 根本原因分析
- 错误的技术原因
- 可能的触发条件
- 影响范围评估

### 3. 详细错误分析
对每个错误提供：
- 错误类型和严重程度
- 具体原因解释
- 相关联的其他错误

### 4. 解决建议
提供具体的解决方案：
- 立即修复措施
- 短期改进建议
- 长期优化方案

### 5. 代码改进建议
针对定位到的源码位置，提供：
- 具体的代码修改建议
- 防御性编程建议
- 最佳实践推荐

### 6. 预防措施
- 如何避免类似问题
- 监控和告警建议
- 测试策略改进

请用中文回答，保持专业性和实用性。`,
      variables: ['projectType', 'primaryLanguage', 'frameworks', 'projectStructure', 'errorLogs', 'codeLocations', 'codeContext'],
      maxTokens: 4000,
      temperature: 0.3
    },

    QUICK_DIAGNOSIS: {
      name: 'quick_diagnosis',
      template: `你是一个经验丰富的软件工程师，请快速诊断以下错误：

## 错误信息
{{errorLogs}}

## 技术栈
- 语言: {{primaryLanguage}}
- 框架: {{frameworks}}

请提供：
1. **问题类型**: 简要分类
2. **可能原因**: 最可能的3个原因
3. **快速修复**: 立即可尝试的解决方法
4. **检查点**: 需要验证的关键点

用中文回答，保持简洁明了。`,
      variables: ['errorLogs', 'primaryLanguage', 'frameworks'],
      maxTokens: 1500,
      temperature: 0.2
    },

    CODE_REVIEW: {
      name: 'code_review',
      template: `作为代码审查专家，请分析以下出现错误的代码段：

## 错误信息
{{errorMessage}}

## 相关代码
{{codeSnippet}}

## 代码位置
文件: {{filePath}}
行号: {{lineNumber}}

## 项目信息
语言: {{primaryLanguage}}
框架: {{frameworks}}

请提供：
1. **代码问题**: 指出具体的问题点
2. **修复建议**: 提供改进的代码
3. **最佳实践**: 相关的编程最佳实践
4. **测试建议**: 如何测试修复的有效性

用中文回答，关注代码质量和可维护性。`,
      variables: ['errorMessage', 'codeSnippet', 'filePath', 'lineNumber', 'primaryLanguage', 'frameworks'],
      maxTokens: 2000,
      temperature: 0.1
    },

    SYSTEM_HEALTH: {
      name: 'system_health',
      template: `作为系统架构师，请基于错误日志评估系统健康状况：

## 错误统计
- 总错误数: {{totalErrors}}
- 错误类型分布: {{errorDistribution}}
- 时间范围: {{timeRange}}

## 主要错误
{{majorErrors}}

## 系统信息
- 技术栈: {{techStack}}
- 部署环境: {{environment}}

请评估：
1. **系统健康度**: 整体健康评分（1-10）
2. **风险评估**: 识别的风险点
3. **性能影响**: 对系统性能的影响
4. **稳定性分析**: 系统稳定性评估
5. **优先级建议**: 问题修复的优先级排序
6. **监控建议**: 需要加强的监控点

用中文回答，关注系统的整体质量。`,
      variables: ['totalErrors', 'errorDistribution', 'timeRange', 'majorErrors', 'techStack', 'environment'],
      maxTokens: 3000,
      temperature: 0.4
    }
  };

  static getTemplate(name: string): PromptTemplate | undefined {
    return this.templates[name];
  }

  static getAllTemplates(): PromptTemplate[] {
    return Object.values(this.templates);
  }

  static renderTemplate(templateName: string, variables: Record<string, string>): string {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`未找到模板: ${templateName}`);
    }

    let rendered = template.template;

    // 替换变量
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value || '');
    }

    // 检查是否还有未替换的变量
    const unresolved = rendered.match(/\{\{(\w+)\}\}/g);
    if (unresolved) {
      console.warn(`模板 ${templateName} 中有未解析的变量: ${unresolved.join(', ')}`);
    }

    return rendered;
  }

  static validateTemplate(template: PromptTemplate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name || template.name.trim() === '') {
      errors.push('模板名称不能为空');
    }

    if (!template.template || template.template.trim() === '') {
      errors.push('模板内容不能为空');
    }

    if (template.maxTokens <= 0) {
      errors.push('maxTokens必须大于0');
    }

    if (template.temperature < 0 || template.temperature > 2) {
      errors.push('temperature必须在0-2之间');
    }

    // 检查模板中的变量是否在variables数组中声明
    const templateVars = template.template.match(/\{\{(\w+)\}\}/g) || [];
    const declaredVars = new Set(template.variables);

    for (const varMatch of templateVars) {
      const varName = varMatch.replace(/\{\{|\}\}/g, '');
      if (!declaredVars.has(varName)) {
        errors.push(`变量 ${varName} 在模板中使用但未在variables中声明`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static createCustomTemplate(
    name: string,
    template: string,
    variables: string[],
    options: { maxTokens?: number; temperature?: number } = {}
  ): PromptTemplate {
    const customTemplate: PromptTemplate = {
      name,
      template,
      variables,
      maxTokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.3
    };

    const validation = this.validateTemplate(customTemplate);
    if (!validation.isValid) {
      throw new Error(`自定义模板验证失败: ${validation.errors.join(', ')}`);
    }

    return customTemplate;
  }

  static getTemplatePreview(templateName: string, sampleVariables?: Record<string, string>): string {
    const template = this.getTemplate(templateName);
    if (!template) {
      return `模板 ${templateName} 不存在`;
    }

    const samples = sampleVariables || {
      projectType: 'Spring Boot Web应用',
      primaryLanguage: 'Java',
      frameworks: 'Spring Boot, Hibernate, Redis',
      errorLogs: '示例错误日志...',
      codeLocations: '示例代码位置...',
      codeContext: '示例代码上下文...'
    };

    try {
      return this.renderTemplate(templateName, samples);
    } catch (error) {
      return `模板渲染失败: ${error}`;
    }
  }
}