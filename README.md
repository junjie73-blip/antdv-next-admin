# Antdv Next Vue Admin

[English](./README.en.md) | **简体中文**

现代化企业级后台管理系统模板：Vue 3 + TypeScript + antdv-next + Tailwind CSS v4，pnpm Monorepo，开发期零后端可跑（进程内 Nitro Mock），三引擎端到端测试。

完整文档（中英双语）在本仓库的 [`docs/`](./docs)，构建后是 GitHub Pages 站点，见下文"文档站"。

---

## 技术栈

| 类别   | 技术               | 版本         |
| ------ | ------------------ | ------------ |
| 框架   | Vue 3 + TypeScript | 3.5.43 / 6.0 |
| UI     | antdv-next         | ^1.6.0       |
| 样式   | Tailwind CSS v4    | ^4.3.3       |
| 状态   | Pinia 3            | ^3.0.4       |
| 路由   | Vue Router         | ^5.3.1       |
| HTTP   | 自研 fetch 请求层  | —            |
| i18n   | vue-i18n           | ^11.4.13     |
| 图表   | ECharts            | ^6.1.0       |
| 构建   | Vite               | ^8.3.3       |
| Mock   | Nitro（进程内）    | ^2.13.4      |
| 包管理 | pnpm               | 10.12.4      |

版本一律来自根 `pnpm-workspace.yaml` 的 catalog，子包写 `"xxx": "catalog:"`，所以这张表就是真实版本。

---

## 快速开始

```bash
pnpm install          # preinstall 强制 pnpm，npm/yarn 会被拦下
pnpm dev              # 管理后台 http://localhost:6080
pnpm docs:dev         # 文档站  http://localhost:5200
```

登录账号（mock）：`admin` / `admin123`。

Mock 服务由 dev 进程**在进程内**拉起（Nitro，端口 5320），`/api` 由 dev server 代理过去，所以不需要先起后端。要求 Node `>=22`，本地用 `.node-version` 里的 24.0.0。

---

## 仓库结构

```
apps/
├── web/                  # 管理后台（@antdv/web）
│   ├── src/
│   │   ├── api/          # 接口封装（request.ts 提供 get/post/put/del）
│   │   ├── composables/  # 应用内组合式函数，含 web/request 请求层
│   │   ├── config/       # constants（缓存键名、登录路径等）
│   │   ├── layouts/      # 应用侧布局装配（外壳来自 @antdv/layouts）
│   │   ├── locales/      # zh-CN / en-US
│   │   ├── router/       # 文件约定路由 + 守卫注册（守卫来自 @antdv/router）
│   │   ├── stores/       # user / app / route / dict / tabs
│   │   ├── utils/        # ws.ts 单例、cache、crypto、安全初始化
│   │   └── views/        # 页面：login system dashboard screen components ...
│   └── e2e/              # Playwright 端到端（三引擎）
├── backend-mock/         # Nitro mock 接口与运行时控制
docs/                     # VitePress 文档站，与 apps/ 齐平的独立包；zh/en 双语，单独发布到 GitHub Pages
packages/                 # 9 个运行时子包（shared / ui / layouts / router / directives / ...）
internal/                 # 构建与规范工具（vite-config / lint-configs / tsconfig / node-utils）
scripts/                  # vsh 等仓库任务
.changeset/               # 版本与变更说明
.github/workflows/        # ci.yml（门禁）+ docs.yml（文档发布）
```

> **关键约束**：`packages/*` 之间**不许** import `pinia` / `vue-router` / store，需要的能力靠依赖注入拿，这样它们才能在别的项目里单点复用。`docs/` 不参与应用构建，`@antdv/web` 也不依赖它。

---

## 核心约定

### 改了共享包却没生效

子包被消费的是 **`dist` 产物**，不是 `src`。改完 `packages/*/src` 必须：

```bash
pnpm --filter @antdv/shared build   # 换成你改的包
# 然后重启 dev server（vite 的依赖缓存也指向 dist）
```

否则你改的代码根本没进构建图，表现是"改了没反应"。

### 登录与会话

```ts
await userStore.login(username, password); // POST /auth/login
```

没有 `tenantCode`，也没有"忘记密码"弹窗（早期 README 里的这两条已经不适用）。mock 后端只认 `admin` / `admin123`。会话存这几个键（`apps/web/src/config/constants.ts`）：

| Key             | 内容         |
| --------------- | ------------ |
| `auth_token`    | accessToken  |
| `refresh_token` | refreshToken |
| `user_info`     | 用户信息     |

只 `pick` 需要的字段，不要把整个登录响应塞进去。`UserInfo` 结构在 `packages/types/src/user.ts`（`id: number`、`username`、`nickname`、`avatar`、`email`、`phone`、 `roles: string[]`、`permissions?: string[]`）。

### 请求层

```ts
import { get, post, put, del } from '~/api/request';

export function getUserList(params: Record<string, unknown>) {
  return get<{ list: unknown[]; total: number }>('/user/list', params);
}
```

**第二个实参本身就是查询串**，不要再包一层 `{ params }` —— 包了之后发出去的是 `?params=[object Object]`，筛选和分页条件整批丢失。401 会自动用 refresh token 续期（并发请求共享一次刷新），刷新失败才跳登录。

### WebSocket 单例

整个应用只连一条，模块级单例在 `apps/web/src/utils/ws.ts`，通过 `useWebSocket()` 拿：

```ts
const { onNotice, onForceLogout } = useWebSocket();
const off = onNotice((notice) => {
  /* ... */
});
onUnmounted(() => off());
```

消息类型是 `notice` 与 `force-logout`（**短横线**，写成 `forceLogout` 收不到）。 `VITE_WS_URL` 没配就不发起连接 —— 这不是 bug，是为了避免 dev 下无限重连刷日志。

### 状态管理

| Store           | 用途                                 |
| --------------- | ------------------------------------ |
| `useUserStore`  | 用户态 + 登录/登出（**主入口**）     |
| `useAppStore`   | 主题、布局、语言、偏好设置           |
| `useRouteStore` | 动态路由（来自后端菜单）+ 注册表对齐 |
| `useTabsStore`  | 标签页：排序、固定、最大化、缓存     |
| `useDictStore`  | 数据字典                             |

> ⚠️ `useAuthStore`（`stores/modules/auth.ts`）是历史遗留空壳，**不要再使用**，统一走 `useUserStore`。

### 缓存

`@antdv/shared` 的 `cache` 提供 SM4 加密缓存：

```ts
import { cache } from '@antdv/shared';

cache.setItem('key', value, 3600); // 第三参是秒
cache.getItem('key');
```

生产必须配 `VITE_CACHE_ENCRYPT_KEY`（32 字符）。

### 权限指令

```vue
<a-button v-permission="'user:add'">新增</a-button>
<div v-permission.all="['user:edit', 'user:delete']">操作</div>
<span v-permission:role="'admin'">仅管理员</span>
<a-button v-permission.disabled="'user:add'">无权限时置灰</a-button>
```

`role` / `admin` 是**参数 arg**，写成 `.role` 判定不认；`.all` / `.disabled` 才是修饰符。指令本体在 `packages/directives/src/permission`，判定函数由应用侧注入。

### 布局、主题与交互

- **页面根容器不写 padding**，内容区内边距归布局管；
- **只有真的能点的元素才有 `cursor: pointer`**，hover 有反馈的盒子不给手型；
- 主题色写进 CSS 变量，`--ant-color-primary` 与 `--ant-primary-color` 两个名字都要给，Tailwind 侧用 `bg-ant-primary`（来自 `@antdv-next/tailwind/compat.css`）；
- 用 antdv 的 `message` / `notification` / `modal` 必须先 `App.useApp()`，静态方法在 cssinjs 下不生效。

### 安全

`v-safe-html`（白名单渲染）、`v-escape`（按语境转义）、`v-lazy`、`v-loading`。CSRF 目前是**前端生成 token**，严格说不构成防护，需要真安全语义时改由后端下发。

---

## 质量与验证

```bash
pnpm lint             # eslint（vsh lint）
pnpm check:circular   # 依赖方向：子包不许反向引用应用
pnpm test:unit        # vitest，按 turbo 任务图先构建依赖
pnpm test:e2e         # Playwright，chromium / firefox / webkit
pnpm check:type       # vue-tsc（有存量错误，见 docs）
```

CI（`.github/workflows/ci.yml`）：`quality`（lint + 循环依赖 + 单测，拦截）、 `e2e`（三引擎矩阵，拦截）、`type-check`（存量债务，报告但不拦截）。

---

## 部署

- **管理后台**：Vercel，Root Directory = `apps/web`，命令见 `apps/web/vercel.json`。构建命令里的 `--filter @antdv/web...`（三个点）会把 9 个 workspace 子包一起构建，漏掉就是 CI 上"找不到 `@antdv/shared/cn`"。
- **文档站**：GitHub Actions → GitHub Pages，见 `.github/workflows/docs.yml`。只做"构建 + 发布"，不跑 lint / type-check / e2e。仓库 Settings → Pages → Source 必须先选 **GitHub Actions**，否则 deploy job 起不来。

---

## 文档站

`docs/` 是 VitePress 站点，`/zh/` 与 `/en/` 双语，**默认中文** —— 根 `docs/index.md` 只有一条 `redirect: /zh/`，打开站点直接落到中文首页，英文靠默认主题自带的语言菜单跳过去（顶栏那份要视口≥1280px，更窄的窗口在汉堡菜单里），它按当前页面路径跳到另一语言的同一篇，所以两边文件名必须一致。 `locales` 的键必须是裸语言码 `zh` / `en` —— 写成 `'/zh/'` 会让侧栏、顶栏、语言切换全部静默失效，细节见 [`docs/zh/guide/essentials/deploy.md`](./docs/zh/guide/essentials/deploy.md)。

正文按 [vben 文档](https://doc.vben.pro/) 的信息架构分层：`guide/introduction`（介绍）、 `guide/essentials`（基础）、`guide/in-depth`（深入）、`components`（组件示例，讲这个仓库自己的组件画廊）、 `guide/project`（工程）、`guide/other`（其他）。**不再有架构章节** —— 留下来的是目录与包结构，在 `guide/project/dir.md`。新增页面先在 `zh` 落地，再补同路径的 `en`，只补一边会让语言切换跳到 404。

| 分区 | 页面 | 内容 |
| --- | --- | --- |
| 介绍 | [快速开始](./docs/zh/guide/introduction/quick-start.md) | 环境、端口、"改了共享包没生效"的坑 |
| 基础 | [基础概念](./docs/zh/guide/essentials/concepts.md) | 这套壳里装了什么、代码实际遵循的分层 |
| 基础 | [本地开发](./docs/zh/guide/essentials/development.md) | 环境变量表、提交信息、changeset |
| 基础 | [配置](./docs/zh/guide/essentials/config.md)、[图标](./docs/zh/guide/essentials/icons.md)、[样式](./docs/zh/guide/essentials/styles.md) | 偏好与环境变量的优先级、五套离线 Iconify 集合、Tailwind v4 层顺序与 `cn()` 约定 |
| 基础 | [路由和菜单](./docs/zh/guide/essentials/route.md) | 路由注册表、meta 字段、五段守卫、菜单来自 `/menus`、dev HMR 坑 |
| 基础 | [服务端交互与接口约定](./docs/zh/guide/essentials/request.md)、[数据 Mock](./docs/zh/guide/essentials/mock.md) | fetch 封装、CSRF/重试/401 刷新、信封结构；dev 的进程内 Nitro 与生产包里的浏览器内 mock |
| 基础 | [状态管理](./docs/zh/guide/essentials/stores.md) | 各个 store、手写持久化、app store 是偏好门面 |
| 基础 | [构建与部署](./docs/zh/guide/essentials/deploy.md) | 产物、Pages 的 `base`、回滚后要手工确认什么 |
| 深入 | [登录](./docs/zh/guide/in-depth/login.md)、[主题](./docs/zh/guide/in-depth/theme.md)、[权限](./docs/zh/guide/in-depth/access.md) | token 链路、主色怎么真正贯通、三层权限 |
| 深入 | [国际化](./docs/zh/guide/in-depth/internationalization.md) | locale 的唯一真相、切一次语言到底动了什么、哪些内容目前仍是纯中文 |
| 深入 | [布局与标签页](./docs/zh/guide/in-depth/layout.md)、[全局 loading](./docs/zh/guide/in-depth/loading.md)、[检查更新](./docs/zh/guide/in-depth/check-update.md) | 7 种布局形态与标签页风格、四层 loading、PWA 更新提示以及它今天为什么不弹 |
| 组件示例 | [组件示例](./docs/zh/components/index.md) | 画廊那一章自己的文档：表格（含行拖拽排序）、表单（含分步表单）、弹窗与抽屉、数据与展示、编辑器与上传、图表与 Cron、指令与拖拽布局 |
| 工程 | [目录说明](./docs/zh/guide/project/dir.md)、[规范](./docs/zh/guide/project/protocol.md)、[CLI](./docs/zh/guide/project/cli.md) | 子包边界、catalog、tsdown、turbo；真实的 lint 流水线；每条脚本做什么 |
| 工程 | [Tailwind CSS](./docs/zh/guide/project/tailwindcss.md)、[Changeset](./docs/zh/guide/project/changeset.md)、[Vite Config](./docs/zh/guide/project/vite.md)、[单元测试](./docs/zh/guide/project/testing.md) | v4 CSS-first 配置、锁步升版、插件开关矩阵与 `isEnvEnabled` 陷阱；单测分层、e2e 口径、两类假信号 |
| 其他 | [更新日志](./docs/zh/guide/other/changelog.md)、[常见问题](./docs/zh/guide/other/faq.md) | 版本怎么切、待发的是什么；别人踩过的坑 |

---

## 常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 改了子包源码没反应 | 消费的是 `dist` | `pnpm --filter <pkg> build` + 重启 dev |
| 搜索/分页条件全丢 | `get(url, { params })` 多包了一层 | 第二个实参直接就是查询串 |
| 收到强制下线不跳登录 | 消息类型写成 `forceLogout` | 用 `force-logout` |
| 换主题色，菜单选中项不变 | 只写了一个 CSS 变量名 | `--ant-color-primary` 与 `--ant-primary-color` 都要写 |
| 文档站侧栏、顶栏、语言切换都是空的 | `locales` 的键写成路径 `'/zh/'` | 改用裸语言码 `zh` / `en` |
| `notification` 不显示 | 用了静态方法 | `App.useApp()` 拿实例；标题字段是 `title` |
| 表格固定列里的弹层被裁 | 固定列自己造了层叠上下文 | 把 `z-index` 抬到固定列之上 |
| dev 下改页面把布局改没 | 自动路由 HMR 重铺裸路由 | 已修，见文档"二级路由：开发态热更新" |
| WS 一直重连刷日志 | 没配 `VITE_WS_URL` | 单例直接不连，需要时再配 |

这张表只留最常撞的九条；按症状索引的完整排错表（含已知死代码与未接线清单）在 [`docs/zh/guide/other/faq.md`](./docs/zh/guide/other/faq.md)（英文： [`docs/en/guide/other/faq.md`](./docs/en/guide/other/faq.md)）。撞到新坑就加在那里，不要只改 README。

---

## License

MIT，见 `LICENSE`。
