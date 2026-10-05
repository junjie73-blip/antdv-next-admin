import { loadEnv as viteLoadEnv } from 'vite'
import { parseLoadedEnv } from 'vite-plugin-env-parse'
export function loadEnv(mode: string): Record<string, any> {
  // 第三个参数传 "" 表示加载所有变量（含非 VITE_ 前缀）
  const raw = viteLoadEnv(mode, process.cwd(), '')
  return parseLoadedEnv(raw)
}
