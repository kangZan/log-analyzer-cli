#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createConfigCommand } from './commands/configCommand';
import { createAnalyzeCommand } from './commands/analyzeCommand';

const program = new Command();

program
  .name('log-analyzer')
  .description('CLI工具用于分析日志文件并通过AI定位错误和分析原因')
  .version('1.0.0');

program.addCommand(createConfigCommand());
program.addCommand(createAnalyzeCommand());

if (process.argv.length === 2) {
  program.outputHelp();
}

program.parse();