# 开发 / 代码 / 命名 / 提交 / 测试 / 部署规范

细则的单一来源是 `CODE_STANDARD.md`（21 节）与 `docs/zh/guide/**`；这里只收"必须照做且容易漏"的部分，并给出每个环节的质量标准。冲突时以 `CODE_STANDARD.md` + 守门测试为准。

## 1. 开发流程规范

1. 动手前：读改动模块的守门测试与注释（本仓库的坑**写在出事的那一行上面**，不在 wiki 里）。
2. 一次改动只做一件事：迁移、修缺陷、加判据分开，混在一起 e2e 红了无法归因。
3. 跨包搬迁按"新增→改引用→删旧→跑守门"顺序，不要反过来（半途就是双份实现 + 环依赖）。
4. 改到 `packages/**` 或 `internal/**`：受影响包要 `turbo build`，重启 dev 前清 `apps/web/node_modules/.vite`（映射盘 inotify 不送达，热更新救不回来）。
5. 收尾：`references/acceptance.md` 逐项取证，绿了再汇报。

**质量标准**：改动可归因（一个变更一个目的）；无残留引用（`Grep` 旧路径为 0）；守门测试与文档同批改。

## 2. 代码编写规范

| 主题 | 硬性口径 |
| --- | --- |
| SFC | 必须 `<script setup lang="ts">`（或 `tsx`）；`defineOptions({ name })` 显式命名；props/emits 用泛型写法（`defineProps<Props>()` / `defineEmits<{ e: [T] }>()`），不用 runtime props；v-model 用 `defineModel` |
| import 顺序 | 类型 → 三方 → 项目内部（包名）→ 相对路径 |
| 组合式函数 | `useXxx` 命名；**必须显式 import**（`unplugin-auto-import` 没配 `dirs`，本仓库 `use*` 一个都不自动导入，而 `usePermission`/`useWebSocket` 与 `@vueuse/core` 同名，漏 import 不报错只拿错函数）；生命周期钩子写在函数体顶层，不许藏进回调；模块级单例要在注释里写明谁负责清理 |
| TS | 禁 `any`（用 `unknown` + 类型守卫）；类型用 `import type`；泛型加约束；`satisfies` 优先于断言 |
| 样式 | 优先级：Tailwind 原子类 → `cn()`（clsx + tailwind-merge）→ `:deep()` 改第三方 → `<style scoped>` 兜底；复杂类名抽到 `constants.ts` 导出 `xxxClassName` |
| 状态 | Pinia；持久化只点名需要的 key，禁止全量落盘；跨页共享进 `@antdv/stores`，宿主专属进 `apps/web/src/stores` |
| 请求 | 接口在 `apps/web/src/api/*.ts` 集中导出函数，组件里只 import 函数；401/4xx/5xx 已由请求层统一处理，业务侧不再 try/catch 弹提示 |
| WS | 只用 `apps/web/src/utils/ws.ts` 的单例 `useWebSocket()`，订阅返回解订函数并在 `onUnmounted` 调用；消息类型是 `notice` / `force-logout` / `connected` |
| 表格/CRUD | `const [register, tableRef] = useTable()`（第二个返回值是 `Ref<TableActionType | null>`，调方法要 `tableRef.value?.reload()`）；`actions.ts`无状态、副作用经`ctx`注入；单条删除靠`popConfirm`，批量删除只留 `useCRUD`内置那一次`Modal.confirm` |
| 表单 schema | 依赖响应式数据时**必须用 `computed` 工厂**，`ifShow`/`componentProps` 用函数不用布尔值 |
| i18n | 用户可见文本走 `$t('key')`，key 形如 `system.user.create`；`zh-CN` / `en-US` 两份同步 |
| 安全 | HTML 用 `v-safe-html`、URL 用 `sanitizeUrl`；token 走 `cache`（SM4）加密，不拼进 URL、不打进 console、不进 `localStorage`；`password`/`token` 不进日志与提交信息 |
| 性能 | 大列表虚拟滚动；图表用 `shallowRef`/`markRaw`；高频回调用 `useDebounceFn`/`useThrottleFn`；路由懒加载；`setup` 里不重算 |

格式化交给工具：`pnpm format`（oxfmt）、`pnpm lint`（oxlint + eslint + stylelint）。`.gitattributes` 统一 `eol=lf`，别在提交里带 CRLF 差异。

## 3. 命名规范

| 类型 | 规范 | 例 |
| --- | --- | --- |
| 组件文件 | 大驼峰 | `UserTable.vue`、`FDatePicker.vue`、`IconPicker.vue` |
| 页面目录 | 全小写，模块/页面两级 | `views/system/user/` |
| 变量/函数 | 小驼峰，动词开头 | `handleAdd`、`fetchUserList` |
| 常量 | 大写下划线 | `USER_STATUS_MAP`、`PAGE_SIZE` |
| 类型/接口 | 大驼峰，`Props`/`Emits`/`Record` 后缀 | `UserRecord`、`UserActionContext` |
| CSS 类 | 优先 Tailwind；自绘组件带语义类（`.scrollbar__*` 归组件自己） | — |
| 包名/目录 | `@antdv/<name>`；目录 kebab；唯一例外 `@antdv/types` → `packages/core/base/typings` | — |
| 单测文件 | 与被测同目录的 `__tests__/<name>.test.ts`（包内约定 `.test.ts`，hooks 侧 `.spec.ts`，跟随所在包已有命名） | — |
| e2e 文件 | `apps/web/e2e/<主题>.spec.ts`，中文用例名描述"可观察结果"而不是"操作步骤" | `浮层定位与工具类生成` |
| 分支/提交 | 见 §4；仓库主分支 `main` |

## 4. 提交规范

`pnpm commit`（czg 交互式）或手写，格式：`type(scope): subject`

- **type**：`feat fix docs style refactor perf test build ci revert chore wip workflow types`
- **scope**：只能是包名（`@antdv/form-ui`）或 `project style lint ci dev deploy other`；省略也可以（`scope-enum` 已关闭，自定义校验在 `internal/lint-configs/commitlint-config/index.mjs`）。
- **header ≤ 108 字符**；`subject` 不能空、`type` 不能空；body 前必须空一行（`body-leading-blank` 是 error 级）。
- 中文描述写"做了什么 + 为什么"，不写文件清单；`git status` 里挑文件属于 PR 描述。
- 每个用户可见变更配一条 `.changeset/*.md`（版本号与变更记录靠它，漏写就等于没发布内容）。
- **`lefthook.yml` 的 pre-commit 全部是注释状态**（避免 `check:type` 期间的 CPU/内存峰值），没有任何钩子会替你把关：commitlint、lint、type-check 都要手跑。
- CI 只有 `.github/workflows/docs.yml`（文档站），**没有跑测试与构建的流水线**——"CI 绿"不构成证据。

**质量标准**：提交前 `pnpm check`（= `check:circular` + `check:dep` + `check:type` + `check:builds` + `check:cspell`）至少跑与改动相关的项；已知存量例外要在提交信息里点名（当前：`turbo run type-check` 47/48 通过，`@antdv/web` 有约 90 条历史错误）。

## 5. 测试规范

| 层 | 怎么跑 | 口径 |
| --- | --- | --- |
| 静态体检 | `node <skill-dir>/scripts/check-repo.mjs`（`<skill-dir>` 是本技能目录，项目级安装时为 `.qoder/skills/antdv-repo-rules`） | 只读、秒级，先挡住依赖边界/token/`@source`/写死版本 |
| 单元测试 | `npx turbo run test:unit --concurrency=1`；**慢/红用例必须单文件复跑再判** | `pnpm exec vitest run` 在仓库根直接崩，别用。环境按包：`design`=node、`hooks`=happy-dom、`form-ui` 等 DOM 包=jsdom、`apps/web`=复用应用 vite 配置（`mode:'test'` 下 `VITE_MOCK=false`，不拉 Nitro） |
| 类型检查 | 包内 `vue-tsc --noEmit`；`apps/web` 必须分别跑 `tsconfig.app.json` 与 `tsconfig.vitest.json` | 后者是给测试文件单独定的 `types`（覆盖不是追加，漏 `vite/client` 会让 `import.meta.env.VITE_*` 全报 TS2339） |
| 端到端 | `npx playwright test [<spec>] --project=<chromium\|firefox\|webkit>`，本地默认 `E2E_WORKERS=3` | **三引擎都绿才算绿**；`--project=chromium` 单跑不构成证据；假红先隔离复跑（`--workers=1`）再判，不许先改断言 |
| 产物核验 | `pnpm build:web` + `node apps/web/scripts/verify-prod-mock.mjs` | 产物里没有 Node mock，接口由包内 fixtures 在 fetch 出口应答；"逃逸到网络的非资源请求"按硬失败统计 |

写用例的三条仓库约定：

1. **判据要能反证**：静态扫描/几何断言类用例必须配反向对照（造一个坏样本证明判据抓得住），否则等于没写。
2. **不为个别假红放宽全局**：只允许给特定引擎放宽墙钟（WebKit 已是 `actionTimeout 45s`/`timeout 240s`），单步 `expect(10s)` 不动；`e2e/utils/app.ts` 的 `externalResourceFailure()` 只准加更窄判据。
3. **快照式白名单要同步**：像 `cursor.spec.ts` 的 `DECORATIVE_HOVER_ALLOWLIST` 用「标签 + class 前四枚」做键，改模板里的工具类顺序会把它顶掉——同批改，别把匹配放宽成子串。

## 6. 部署规范

- 构建：`pnpm build`（`NODE_OPTIONS=--max-old-space-size=8192`）或 `pnpm build:web`；每包都有 `build`，由 `pnpm check:builds` 与包内 `antdv:validate-dist` 把关；按源码发布的包不挂自己的 `dev`/`watch`。
- 产物配置：`VITE_COMPRESS`（gzip）、`VITE_ARCHIVER`（zip）、`VITE_PWA`、`VITE_VISUALIZER` 只在 `.env.production` 打开；`VITE_APP_BASE_API` 决定接口前缀，接真实后端要同步改 `VITE_MOCK=false`（否则首屏菜单/用户信息由 fixtures 应答，看不出后端故障）。
- 容器：`pnpm build:docker`（`scripts/deploy/build-local-docker-image.sh` + `scripts/deploy/Dockerfile` + `nginx.conf`）。
- 发布：`pnpm version`（changesets 生成版本 + 更新 lockfile）→ `pnpm release`（先 `build` 再 `changeset publish`）。本仓库 `private: true`，包不对外发布，版本号只服务于变更记录。
- 密钥：`VITE_CACHE_ENCRYPT_KEY` 是前端缓存加密密钥，部署方必须换成自己的随机值；任何密钥不入库、不进日志。

**质量标准**：部署前完成 `references/acceptance.md` 的清单；换环境后至少手工走一遍登录 + 一个列表页 + 一个浮层交互，确认 token 链路与 `@source` 产物一致。
