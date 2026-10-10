import process from 'node:process';

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置。
 *
 * 和上游模板的三处关键差异，都是"这套用例在本项目里真的能跑起来"的必要条件：
 * 1. **端口来自 vite 配置，不是默认的 5173/4173**。`apps/web/.env.development` 里
 *    `VITE_PORT=6080`，而 dev server 还会在进程内拉起 Nitro mock（5320），
 *    所以只起一个 `pnpm dev` 就前后端齐活，不必单独准备后端。
 * 2. **不区分 dev/preview**。preview 端口与 dev 不一致，且 mock 只挂在 dev 上，
 *    CI 也用 dev，省掉一半环境差异；已有服务在跑就直接复用（reuseExistingServer）。
 * 3. **默认 headless**。`E2E_HEADED=1` 才弹窗，方便本地调试而不打断自动化流程。
 *
 * baseURL 是唯一的外部地址来源，用例里一律写相对路径（`/#/login`），
 * 需要换地址用 `E2E_BASE_URL` 覆盖，不改代码。
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:6080';
const PORT = Number(new URL(BASE_URL).port || 80);

/**
 * 并发上限。
 *
 * 默认值（CPU 核数/2）× 3 个引擎会把本机打满：被占满的不只是浏览器，还有那个
 * 同时扛着 Vite 按需编译和进程内 Nitro mock 的单 dev server 进程，
 * 结果是一堆"纯超时"的假红 —— 同一个引擎用 `--workers=1` 单跑就又全绿了。
 * 本地压到 3（约一个引擎一个 worker），要更快/更慢用 `E2E_WORKERS` 覆盖；CI 沿用串行。
 */
const WORKERS = process.env.CI ? 1 : Number(process.env.E2E_WORKERS ?? 3);

export default defineConfig({
  testDir: './e2e',
  /* 首个访问要触发 Vite 按需编译，重型页面（用户管理/大屏）编译可能要十几秒 */
  timeout: 90 * 1000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: WORKERS,
  /* list 便于终端读结果，html 不自动打开浏览器 */
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 15_000,
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    headless: !process.env.E2E_HEADED,
  },
  /* 主流浏览器三件套：WebKit/Firefox 用于抓 Chromium 掩盖不到的布局差异 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      /**
       * WebKit 在本机上比另外两个引擎慢 3-5 倍：单跑一条冒烟 12-27s，
       * 而三引擎并行（workers=3）时会顶到 15s 的 actionTimeout 上，
       * 表现是"点登录按钮超时"这种纯计时失败 —— 单跑立刻绿。
       * 计时放宽只针对这个引擎，别去动全局：Chromium/Firefox 保持 15s，
       * 好让真正的性能退化仍然能红。
       *
       * `timeout` 从 150s 提到 240s 是同一条经验的延伸：整跑三引擎时（前面还有
       * Chromium 5 分钟 + Firefox 9 分钟，dev server 的按需编译缓存也被别的引擎挤掉过）
       * WebKit 的单条交互用例会跑到 1.2 分钟，150s 的墙钟就会咬到"拖拽排序""混合布局切换"
       * 这类正常但慢的用例；把它们单独跑就又绿了。
       * 注意这里只放宽**整条用例的总时长**，各步的 actionTimeout(45s) 与 expect(10s)
       * 一个没动 —— 功能真坏了仍然立刻红，不会靠墙钟兜住。
       */
      use: { ...devices['Desktop Safari'], actionTimeout: 45_000, timeout: 240_000 },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: PORT,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
