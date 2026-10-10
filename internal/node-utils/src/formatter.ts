import fs from 'node:fs/promises';

import { execa } from 'execa';

/**
 * 跑 oxfmt 格式化并回读内容，供脚本「生成文件 -> 立刻格式化」链路使用。
 * stdio 继承让格式化的告警直接出现在终端，而不是被吞进 Promise。
 */
async function formatFile(filepath: string) {
  await execa('oxfmt', [filepath], {
    stdio: 'inherit',
  });

  return await fs.readFile(filepath, 'utf8');
}

/**
 * 1024 进位的体积。固定 2 位小数：日志里对齐比省两个字符更重要。
 * 负数与 NaN 一律归零，避免出现 `-1.0 KB` 这种没人能解释的输出。
 */
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let value = bytes;
  let index = 0;
  // 用除法而不是 log：log 的浮点误差会让 1024**3 落到 MB 档
  while (value >= 1024 && index < BYTE_UNITS.length - 1) {
    value /= 1024;
    index += 1;
  }
  const unit = BYTE_UNITS[index] ?? 'B';
  return index === 0
    ? `${Math.round(value)} ${unit}`
    : `${value.toFixed(2)} ${unit}`;
}

/** 耗时三档：毫秒级看个位数、秒级留一位小数、分钟级拆成 m/s */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US');
}

/** 入参是比值（0.256），不是百分数（25.6）——调用方少写一次乘法 */
function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${(ratio * 100).toFixed(digits)}%`;
}

function formatCount(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`;
}

/**
 * 拆词：camel / kebab / snake / 空格混着来都能归一。
 * 连续大写按缩写整体处理（HTTPServer -> http-server），否则会切成 h-t-t-p-server。
 */
function splitWords(input: string): string[] {
  return input
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean);
}

function toCamelCase(input: string): string {
  return splitWords(input)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word[0]!.toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
}

function toPascalCase(input: string): string {
  return splitWords(input)
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toKebabCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join('-');
}

function toSnakeCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join('_');
}

/**
 * 中间省略而不是尾部省略：路径场景下尾部是文件名（最有信息量的部分），
 * 头部保留盘符/根目录才能判断文件在哪。
 */
function truncate(input: string, maxLength = 24, marker = '…'): string {
  if (input.length <= maxLength) return input;
  const side = Math.floor((maxLength - marker.length) / 2);
  const head = input.slice(0, side + 1);
  const tail = input.slice(input.length - side);
  return `${head}${marker}${tail}`;
}

function pluralize(count: number, singular: string, suffix = 's'): string {
  return count === 1 ? singular : `${singular}${suffix}`;
}

/** 只补不截：超长时原样返回，避免调用方误以为长度被限制了 */
function padEnd(input: string, length: number, padChar = ' '): string {
  if (input.length >= length) return input;
  return input + padChar.repeat(length - input.length);
}

export {
  formatBytes,
  formatCount,
  formatDuration,
  formatFile,
  formatNumber,
  formatPercent,
  padEnd,
  pluralize,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  truncate,
};
