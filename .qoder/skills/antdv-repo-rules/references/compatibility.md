# 跨平台兼容要求

三个轴都要顾：**操作系统**（开发机与 CI）、**浏览器引擎**（用户端）、**视口尺寸**（桌面/平板/窄屏）。

## 1. 操作系统层（Windows / macOS / Linux）

| 事项 | 适配要求 |
| --- | --- |
| 换行符 | `.gitattributes` 定死 `* text=auto eol=lf`。Windows 侧不要 `core.autocrlf=true`；工具（oxfmt）重写行尾时会伪装成"内容改动"，diff 变大就是这个原因 |
| 路径 | **源码与测试里禁止写死盘符、绝对路径、`file://`**（`boundary.test.ts` 的判据常量 `ABSOLUTE_SPECIFIER`）。跨平台拼路径只用 `node:path` 的 `join/resolve` 与 `fileURLToPath(new URL(...))`；基准点用 `import.meta.url` 或"从当前目录向上找工作区标记"，不要假定技能/脚本装在第几层 |
| 大小写 | 文件系统大小写敏感性不一致（Win/macOS 默认不敏感，Linux 敏感）。重命名一个组件文件必须同时改所有 import 的大小写，否则 Linux 上构建才炸 |
| 包管理器布局 | pnpm 用软链/junction。**禁止 `robocopy /MOVE`、跨盘 `move`、`\\?\` 长路径工具搬目录** —— 它们会顺着 junction 删掉真实包内容；目录改名前先杀掉 dev server（句柄占用会让改名失败并留下半个目录） |
| 文件监听 | 仓库放在映射盘/网络盘时 inotify 事件不送达：改完 `packages/**` 或 `internal/**` 后**必须重建受影响包 + 清 `apps/web/node_modules/.vite` + 重启 dev**再验证。`VITE_DEV_POLLING=true` 实测救不回来（模块图不失效），别浪费时间打开 |
| 端口与回环 | mock 只绑 `::1`（IPv6 回环）。用 `127.0.0.1:5320` 直连会失败，一律用 `localhost`；`get-port` 在端口被占时静默换端口（日志里 `Using alternative port 3000`），所以"起了 dev 就以为 mock 在 5320"是不成立的判断，要看 `netstat` 的实际归属 |
| 命令差异 | 不要在脚本里假定 shell 类型。Windows + Git Bash 下 `taskkill //PID <pid> //T //F`（双斜杠防路径转换）、`find`/`stat` 可用但 `xargs -0` 要小心；macOS/Linux 与 CI 侧不要写 `powershell`/`cmd` 专属命令，Windows 侧也不要假定 `sh` 语法可用。跨平台脚本一律用 Node（`scripts/*.mjs`），别写 `.bat`/`.sh` 补丁 |
| Node/pnpm | `.node-version` = 24.0.0、`engines.node >= 22`、`packageManager pnpm@10.12.4`、`preinstall: only-allow pnpm`。macOS/Linux 用户也走同一套（`fnm/nvm use`），不要混用 npm/yarn/bun |
| 内存与并发 | `build` 需要 `--max-old-space-size=8192`；`turbo run test:unit --concurrency=1`；单测与 e2e 不要与其他重工具（`type-check`、`build`）同时跑，机器差异会表现成随机红 |
| 中文与本地化 | 文案里含中文时，脚本判据不要用 `localeCompare` 的默认序（跨平台不一致）；日期/月份名走 `Intl.DateTimeFormat(locale,…)` 与 dayjs locale（`vite-dayjs-plugin` 把 `dayjs` 重写成 `dayjs/esm` 并处理 locale 分包），不要写死中文月名 |

## 2. 浏览器引擎层（Chromium / Firefox / WebKit）

| 差异点 | 处理规则 |
| --- | --- |
| 测试计时 | WebKit 在本机比另两引擎慢 3–5 倍：`playwright.config.ts` 里**只给它**放宽 `actionTimeout 45_000` / `timeout 240_000`；Chromium/Firefox 保持 15s，好让真实性能退化仍然红。整条用例墙钟放宽 ≠ 单步断言放宽（`expect` 仍是 10s） |
| 控制台错误口径 | 图标 CDN/头像外链失败：Firefox 报成 console **error**，Chromium 只报 `Failed to load resource`。分桶逻辑在 `e2e/utils/app.ts` 的 `externalResourceFailure()` —— 只允许加更窄判据，禁止"全忽略" |
| 滚动条 | 两套并存：标准属性 `scrollbar-width: thin`（Firefox）与 `::-webkit-scrollbar*`（Chromium/WebKit），都在 `design/src/css/scrollbar.css`；组件内部滚动区另有自绘 `Scrollbar.vue`（样式随组件走）。只写一套 = 某个引擎里滚动条粗细/颜色不一致 |
| 浮层定位 | reka-ui 把定位挂在 **popper 包裹层**上，`PopoverContent` 自己的 `position` 不是判据；量位置要量内容盒与触发器盒的几何关系（见 `e2e/popup-anchor.spec.ts`），也不要断言"内容元素 style 里有 position" |
| 可用高度 | 面板自适应要用 reka 暴露的 `--reka-popover-content-available-height`（同类 `--reka-*-available-width`），不能靠固定高度 + 内部滚动；矮视口下"能滚"不等于"不溢出"，工具栏与分页条要 `shrink-0`、中间列表 `min-h-0 shrink` |
| 过渡与动画 | `tw-animate-css` + `@custom-variant dark` 走 `.dark` 类；视图过渡与动画在测试里要用"等动画结束"再量（`getAnimations().finished`），不要用固定 sleep；WebKit 对 `transition` 的完成事件更慢，判据必须容忍 |
| 光标 | 浏览器不会自己给 `<button>` 指针光标：全局规则在 `design/css/base.css`（能点 → `pointer`，禁用 → `not-allowed`），不要往模板里逐个塞 `cursor-pointer`；全站扫描由 `e2e/cursor.spec.ts` 兜底 |
| 圆角/尺度 | `rem` 基准 + 根字号百分比（`base.css:35` 附近），三引擎的 16px 基准一致；把 px 写死会在改字号偏好时不跟随 |
| 窄屏判定 | `MOBILE_BREAKPOINT = 768`（`layout-ui/src/layout.ts:189`）与 Tailwind `md` 同源：767 是窄屏最后一档，768 起是桌面档。窄屏用例要跑 `[360, 390, 767]` 三档并在 768 验一次"翻回去" |
| 深浅色 | 偏好落 DOM 只有一条链路（`applyPreferencesToDom` 写 shadcn 裸规范名变量），组件不得读任何库的作用域变量（portal 浮层在库根节点之外，读了就是"亮色对、暗色错"） |
| PWA/Service Worker | 只在 prod 开（`VITE_PWA`）；e2e 跑 dev 不注册 SW，验证产物时若命中旧 SW 缓存要先清 (这是"改了没生效"的常见假象) |

## 3. 兼容性测试标准

1. **判据必须能在三引擎上都成立**，不靠引擎专属豁免。确实需要差异处理时，差异写进被测实现（CSS/运行时），不写进测试的 `project` 分支里。
2. **每条静态/几何判据配反向对照**：造一个被剥掉样式/被改坏的样本，证明判据抓得住（`popup-anchor.spec.ts` 的第二条用例就是这个作用）。
3. **视口矩阵**：桌面（默认 1280×720）+ 平板/窄屏三档（360/390/767）+ 768 回归档；涉及浮层的用例再加"矮视口"（≤ 720 高）场景。
4. **深浅色双跑**：任何颜色/边框/阴影相关判据要在 `.dark` 与亮色各取一次证；预设切换要能看出"真的变了"（预设取值互不相同由 `design.test.ts:250` 钉住）。
5. **不动全局超时来掩盖失败**：假红的处理顺序是 隔离复跑（`--project=<引擎> --workers=1`）→ 定位是哪一步在等 → 修实现或修等待点；只有计时类失败且隔离即绿，才允许记录为环境抖动。

## 4. 验证流程（按顺序，产出都要留档）

```bash
# 0) 静态体检（秒级，先挡硬约束）；<skill-dir> = 本技能目录，项目级安装时是 .qoder/skills/antdv-repo-rules
node <skill-dir>/scripts/check-repo.mjs

# 1) 改到 packages/** 的构建口径
npx turbo run build --concurrency=1          # 或只 build 受影响包
rm -rf apps/web/node_modules/.vite           # 映射盘必须清；cmd/PowerShell 下换成等价的 Node 递归删除
# 重启 dev（先确认 6080/5320 上进程归属），再进下一步

# 2) 单测 + 类型
npx turbo run test:unit --concurrency=1      # 红的用例单文件复跑再判
npx turbo run type-check                      # 存量例外要在汇报里点名

# 3) 三引擎 e2e（本地 workers=3，收尾每个引擎各一遍）
cd apps/web
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit --workers=1

# 4) 产物 + 浏览器内 mock 核验（这一步只看"有没有请求逃逸到网络"）
cd ../.. && pnpm build:web
node apps/web/scripts/verify-prod-mock.mjs
```

结果判读规矩：后台包装器的 exit code 无意义，日志里必须自己打印真实退出码（POSIX shell 用 `; echo "EXIT=$?"`，PowerShell 用 `$LASTEXITCODE`）；Playwright 每次跑都会清 `apps/web/test-results`，**失败上下文要立刻落盘**（否则后一个引擎跑完就看不到前一个引擎的现场）；不要把 Playwright 输出管道给 `tail`（会吞退出码与截断关键行）。
