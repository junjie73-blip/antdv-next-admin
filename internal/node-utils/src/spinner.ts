import { readSync } from 'node:fs'

import chalk from 'chalk'
import { createConsola } from 'consola'
import ora from 'ora'

/**
 * 统一日志出口。
 *
 * turbo / CI 会并发跑多个任务，直接用 console.log 会让不同任务的输出互相插行；
 * consola 的 `logWithLevel` 走的是可被工具链收集的单行输出。
 */
export const logger = createConsola({
  formatOptions: { date: false },
})

/** 终端颜色集中管理：脚本里不直接 import chalk，方便以后换配色方案 */
export const color = {
  cyan: (text: string) => chalk.cyan(text),
  dim: (text: string) => chalk.dim(text),
  green: (text: string) => chalk.green(text),
  magenta: (text: string) => chalk.magenta(text),
  red: (text: string) => chalk.red(text),
  yellow: (text: string) => chalk.yellow(text),
}

export interface SpinnerContext {
  /** 在 spinner 运行期间输出一行信息（会先清掉当前行，避免串行错乱） */
  info: (message: string) => void
}

/**
 * 带进度提示地执行异步任务。
 *
 * 非 TTY（CI、管道重定向）下不启动 ora：spinner 靠 ANSI 控制符刷新单行，
 * 在日志采集器里会留下一堆乱码，所以直接退化成普通日志。
 */
export async function withSpinner<T>(
  title: string,
  task: (context: SpinnerContext) => Promise<T>,
): Promise<T> {
  if (!process.stdout.isTTY) {
    return task({ info: (message) => logger.info(message) })
  }

  const spinner = ora({ hideCursor: true, text: title }).start()
  const context: SpinnerContext = {
    info: (message) => {
      spinner.clear().stop()
      logger.info(message)
      spinner.start()
    },
  }

  try {
    const result = await task(context)
    spinner.succeed(title)
    return result
  } catch (error) {
    spinner.fail(`${title}：${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

export interface Measured<T> {
  durationMs: number
  result: T
}

/** 计时执行，用于「构建耗时」「同步耗时」这类脚本收尾日志 */
export async function measure<T>(
  title: string,
  task: () => Promise<T>,
  onFinish?: (durationMs: number) => void,
): Promise<Measured<T>> {
  const startedAt = performance.now()
  const result = await task()
  const durationMs = performance.now() - startedAt
  onFinish?.(durationMs)
  logger.success(`${title} 完成（${durationMs.toFixed(0)}ms）`)
  return { durationMs, result }
}

/**
 * 逐字节同步读取一行。
 *
 * Node 没有浏览器的 `globalThis.prompt`，而 readline 的异步接口会打断脚本的
 * 同步执行流；交互式构建/发布脚本更希望「问到就阻塞」，所以直接读 fd 0。
 */
function readLineSync(): string {
  const chunk = Buffer.alloc(1)
  const lines: Buffer[] = []

  for (;;) {
    let read = 0
    try {
      read = readSync(process.stdin.fd, chunk, 0, 1, null)
    } catch {
      // stdin 已关闭（重定向 / CI）时按「无输入」处理
      break
    }
    if (read === 0) break
    // Windows 回车是 \r\n，遇到任一换行符即结束
    if (chunk[0] === 0x0a) break
    if (chunk[0] === 0x0d) continue
    lines.push(Buffer.from(chunk))
  }

  return Buffer.concat(lines).toString('utf8').trim()
}

/** 交互式确认：非 TTY 时直接返回默认值，避免 CI 卡住 */
export function confirmInTerminal(
  question: string,
  defaultValue = false,
): boolean {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return defaultValue
  process.stdout.write(`${question} `)
  const answer = readLineSync()
  if (answer === '') return defaultValue
  return /^(y|yes)$/i.test(answer)
}
