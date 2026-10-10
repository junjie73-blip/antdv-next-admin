import type { Ora } from 'ora';

// Buffer 显式从 node:buffer 引入：ESM 下没有可靠的全局 Buffer 注入，
// 且 eslint 的 n/prefer-global/buffer 也禁止使用全局版本
import { Buffer } from 'node:buffer';
import { readSync } from 'node:fs';

import ora from 'ora';

interface SpinnerOptions {
  failedText?: string;
  successText?: string;
  title: string;
}

export async function spinner<T>(
  { failedText, successText, title }: SpinnerOptions,
  callback: () => Promise<T>,
): Promise<T> {
  const loading: Ora = ora(title).start();

  try {
    const result = await callback();
    loading.succeed(successText || 'Success!');
    return result;
  } catch (error) {
    loading.fail(failedText || 'Failed!');
    throw error;
  } finally {
    loading.stop();
  }
}

/**
 * 逐字节同步读一行。
 * 脚本（changesets / 发布检查）跑在同步流程里，readline 的异步 callback
 * 会让后续代码在答案到达前就执行完；Node 也没有 window.prompt 可用。
 */
function readLineSync(): string {
  const chunk = Buffer.alloc(1);
  const lines: Buffer[] = [];
  for (;;) {
    let read: number;
    try {
      read = readSync(process.stdin.fd, chunk, 0, 1, null);
    } catch {
      // stdin 关闭 / 重定向到 /dev/null：视为没有输入
      break;
    }
    if (read === 0) break;
    if (chunk[0] === 0x0a) break;
    if (chunk[0] === 0x0d) continue;
    lines.push(Buffer.from(chunk));
  }
  return Buffer.concat(lines).toString('utf8').trim();
}

/**
 * 终端确认。非 TTY（CI、被管道调用）时直接返回默认值，
 * 否则构建机会因为等不到输入而挂到超时。
 */
export function confirmInTerminal(
  question: string,
  defaultValue = false,
): boolean {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return defaultValue;
  process.stdout.write(`${question} `);
  const answer = readLineSync();
  if (answer === '') return defaultValue;
  return /^(y|yes)$/i.test(answer);
}
