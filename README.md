# Antdv Next Vue Admin

现代化企业级后台管理系统前端，基于 Vue 3 + TypeScript + Antdv Next + Tailwind CSS 构建。

配套 VitePress 文档站已独立为 [antdv-docs](https://github.com/junjie73-blip/antdv-docs) 仓库，与代码仓库并列存放，不在本仓库内；克隆文档仓库后运行 `pnpm dev` 即可查阅。

***

## 技术栈

| 类别     | 技术            | 版本    |
| -------- | --------------- | ------- |
| 框架     | Vue 3           | ^3.5.42 |
| 语言     | TypeScript      | ~6.0.0  |
| UI       | Antdv Next      | ^1.5.4  |
| 样式     | Tailwind CSS v4 | ^4.3.3  |
| 状态     | Pinia 3         | ^3.0.4  |
| 路由     | Vue Router 4    | ^4.6.4  |
| 请求     | Alova 3         | ^3.5.4  |
| 国际化   | vue-i18n        | ^11.4.8 |
| 富文本   | Tiptap 3        | ^3.31.3 |
| 图表     | ECharts         | ^6.1.0  |
| 表格导出 | xlsx            | ^0.18.5 |
| 构建     | Vite 8          | ^8.2.2  |
| 单元测试 | Vitest          | ^4.1.11 |
| E2E      | Playwright      | ^1.62.1 |
| 包管理   | pnpm            | 10.12.4 |

***

## 环境要求

- Node.js **>= 22.0.0**
- pnpm **10.x**（`packageManager: pnpm@10.12.4`）

***

## 快速开始

```bash
pnpm install
pnpm dev
# 开发端口由 .env.development 的 VITE_PORT 决定，默认 http://localhost:5680
```

后端联调默认代理到 `http://localhost:3000`（`VITE_PROXY` 中配置 `/api/v1`、`/uploads`、`/ws`、`/minio-api`）。

```bash
pnpm build        # 生产构建，产物输出到 dist/
pnpm preview      # 预览构建产物
pnpm type-check   # vue-tsc 类型检查
```

***

## 项目结构

```
admin/
├── .agents/                  # Agent 相关配置
├── .kiro/skills/             # 本地技能包（vue / vite / vitepress / pnpm ...）
├── .trae/skills/             # 同上，Trae 侧技能包
├── .vscode/                  # 编辑器配置
├── public/                   # 运行时静态资源
│   ├── favicon.ico
│   └── pwa-icons/            #   PWA 图标与 logo.png
├── src/
│   ├── api/                  # 接口定义（auth / user / role / menu / dept / dict / notice / todo / file ...）
│   ├── assets/
│   │   ├── images/           #   图片与文件类型图标
│   │   └── styles/           #   global.css / var.css
│   ├── components/
│   │   ├── business/         #   ★ 业务组件
│   │   │   ├── Table/        #     表格（useTable / BasicTable）
│   │   │   ├── Form/         #     表单（useForm / BasicForm）
│   │   │   ├── Modal/        #     弹窗（useModal）
│   │   │   ├── Drawer/       #     抽屉（useDrawer）
│   │   │   ├── Description/  #     描述列表
│   │   │   ├── CountTo/      #     数字动画
│   │   │   ├── TreeTable/    #     树形表格
│   │   │   ├── MarkdownEditor/  #  ★ Tiptap 富文本编辑器
│   │   │   ├── MicroAppContainer.vue
│   │   │   ├── ImportExport.vue
│   │   │   └── TenantSelect.vue
│   │   ├── common/           #   Icon / Loading / Scrollbar / Skeleton / Upload / CronEditor ...
│   │   ├── layout/           #   PageTransition / ReloadPrompt（PWA 更新提示）
│   │   └── index.ts
│   ├── composables/          # useCRUD / useRequest / useChunkUpload / usePasswordPolicy / useRouteLoading
│   │   └── web/              #   permission / websocket / sse / useLocale / useThemeTransition / useWatermark
│   ├── config/               # color.ts / constants.ts / micro-app.ts / project.ts
│   ├── directives/           # permission（v-permission）/ lazy
│   ├── enums/                # app / cache / dict / status
│   ├── layouts/
│   │   ├── components/       #   LayoutHeader / LayoutSidebar / LayoutTabs / LayoutFooter / AccountDrawer
│   │   │   └── SettingDrawer/#     主题设置抽屉
│   │   ├── widgets/          #   WidgetTheme / WidgetNotice / WidgetSearch / WidgetFullscreen ...
│   │   └── DefaultLayout.vue
│   ├── locales/              # i18n（lang/zh-CN.ts、lang/en-US.ts）
│   ├── monitor/              # behavior / error / performance / reporter（埋点与 Sentry）
│   ├── router/               # index.ts / guards.ts / routes.ts
│   ├── settings/             # index.ts / theme.ts（主题 token）
│   ├── stores/modules/       # app.ts / user.ts / route.ts / dict.ts / auth.ts（历史空壳）
│   ├── utils/
│   │   ├── cache/            #   SM4 加密缓存
│   │   ├── crypto/           #   aes / hash / jwt
│   │   ├── event/            #   mitt 事件总线
│   │   ├── helpers/menu/     #   菜单树处理
│   │   ├── request/          #   Alova 客户端（alova.ts / constant.ts / interface.ts）
│   │   ├── token/            #   Token 管理
│   │   ├── excel.ts          #   Excel 导出
│   │   ├── print.ts          #   打印
│   │   └── ws.ts             #   ★ WebSocket 单例
│   ├── views/
│   │   ├── workspace/        #   工作台
│   │   ├── analysis/         #   分析页（charts / hooks）
│   │   ├── account/          #   个人中心
│   │   ├── login/            #   登录（含 ForgotPasswordModal.vue）
│   │   ├── register/         #   注册
│   │   ├── error/            #   403 / 404 / 503
│   │   ├── system/           #   user / role / menu / permission / dept / tenant / ip-rule / settings / micro-app
│   │   ├── monitor/          #   online / login-log / log / job / cache / server
│   │   ├── message/          #   my / notice / todo
│   │   ├── tool/             #   dict / code（代码生成）/ file（文件管理）
│   │   ├── micro-app/        #   子应用视图 SubAppView.vue
│   │   └── components/       #   组件示例页
│   ├── App.vue
│   └── main.ts
├── types/                    # 全局类型声明与自动生成声明（auto-imports.d.ts / components.d.ts ...）
├── index.html
├── vite.config.ts            # 别名：~ → src，# → types
├── vitest.config.ts
├── playwright.config.ts
└── nginx.conf                # 生产部署参考配置
```

***

## 核心约定

### 登录

**必须携带** **`tenantCode`**（后端多租户要求），且登录接口还支持图形验证码参数：

```ts
// src/stores/modules/user.ts
await userStore.login(username, password, tenantCode, captcha);
// → POST /auth/login { username, password, tenantCode, ...captcha }
```

登录页会记住上次的 `tenantCode`（`last_tenant_code`）。登录成功后先同步写入缓存，再请求 `getProfile()` 与权限列表刷新，避免首屏用户信息闪空。

### 会话存储

| Key             | 内容         |
| --------------- | ------------ |
| `auth_token`    | accessToken  |
| `refresh_token` | refreshToken |
| `user_info`     | 用户信息     |

Key 常量定义在 `src/config/constants.ts`。**不要**把整个登录响应塞进去，只存需要的字段。

### UserInfo

```ts
// types/user.d.ts
export interface UserInfo {
  userId: string;
  username: string;
  realname: string;
  avatar: string;
  email: string;
  phone: string;
  roles: string[];
  permissions?: string[];
}
```

### 忘记密码

登录页 →「忘记密码」→ 弹窗（`ForgotPasswordModal.vue`），未登录即可调用：

```ts
POST /auth/forgot-password
{ tenantCode, username, oldPassword, newPassword }
```

### WebSocket 单例

整应用只连一条 WS，通过 `useWebSocket()` 获取：

```ts
import { useWebSocket } from "~/utils/ws";

const { onNotice, onForceLogout, notice } = useWebSocket();

const off = onNotice((item) => { /* ... */ });
onUnmounted(() => off());
```

**服务端下行消息类型**：

- `notice:push` — 站内通知推送
- `notice:revoke` — 通知撤回
- `force-logout` — 强制下线（**注意短横线**）

WS 地址形如 `/ws?token=xxx&type=notice`，token 变化自动重连，登出自动断开。

### 请求（Alova）

**推荐用法**（在 `src/api/*.ts` 中封装，组件只 import 函数）：

```ts
import { get, post, put, del } from "~/api/request";

export function getUserList(params: Record<string, unknown>) {
  return get<{ list: UserInfo[]; total: number }>("/user/list", params);
}

export function updateUser(id: string, data: Record<string, unknown>) {
  return post(`/user/update/${id}`, data); // 后端用 POST
}
```

**自动处理**（`src/utils/request/alova.ts`）：

- 401 → 用 refresh token 刷新，刷新失败跳登录
- 4xx → 展示后端 message；5xx → 统一提示
- 失败重试（退避 + 抖动），仅 5xx / 网络错误

### 状态管理

| Store           | 用途                             |
| --------------- | -------------------------------- |
| `useUserStore`  | 用户态 + 登录/登出（**主入口**） |
| `useAppStore`   | 主题、布局、语言、设置           |
| `useRouteStore` | 动态路由（来自后端菜单）         |
| `useDictStore`  | 数据字典                         |

> ⚠️ `stores/modules/auth.ts` 是历史遗留空壳，**不要再使用**，统一走 `useUserStore`。

### 缓存

`src/utils/cache` 提供 SM4 加密缓存：

```ts
import { cache } from "~/utils/cache";

cache.setItem("key", value, 3600); // 秒
cache.getItem("key");
cache.removeItem("key");
```

密钥来自 `VITE_CACHE_ENCRYPT_KEY`（32 字符），生产环境必须配置。

### 权限与国际化

```vue
<a-button v-permission="'user:create'">新增</a-button>
<div v-permission:any="['user:edit', 'user:delete']">操作</div>
```

```ts
const userStore = useUserStore();
userStore.hasPermission("user:create");
```

用户可见文本走 `$t("key")`，语言包在 `src/locales/lang/`，切换通过 `useLocale()`。

### 安全

- `v-safe-html` / `v-escape`：渲染富文本前过滤 XSS（`src/utils/xss.ts`、`security.ts`）
- 敏感字段脱敏：`src/utils/masking.ts`
- Token 用 `cache` 存储，不拼 URL、不 `console` 打印

***

## 环境变量

| 变量                      | 文件                     | 说明                                                       |
| ------------------------- | ------------------------ | ---------------------------------------------------------- |
| `VITE_NAMESPACE`          | `.env`                   | 应用命名空间，缓存前缀                                     |
| `VITE_APP_TITLE`          | `.env`                   | 项目标题                                                   |
| `VITE_MOCK`               | `.env`                   | Mock 开关（当前为 `false`）                                |
| `VITE_ENABLE_LOGGING`     | `.env`                   | 是否记录前端本地日志                                       |
| `VITE_LOG_ROUTE_CHANGE`   | `.env`                   | 日志是否记录路由跳转                                       |
| `VITE_LOG_MAX_ENTRIES`    | `.env`                   | 本地日志最大条数                                           |
| `VITE_PORT`               | development / production | 开发端口 `5680`，生产端口 `9080`                           |
| `VITE_INJECT_APP_LOADING` | development / production | 是否注入首屏 Loading                                       |
| `VITE_DEVTOOLS`           | `.env.development`       | 是否启用 Vue DevTools                                      |
| `VITE_APP_BASE_API`       | development / production | API 基础路径（`/api/v1`）                                  |
| `VITE_APP_BASE_URL`       | `.env.development`       | 后端服务地址                                               |
| `VITE_PROXY`              | `.env.development`       | 开发代理规则（`/api/v1`、`/uploads`、`/ws`、`/minio-api`） |
| `VITE_PWA`                | development / production | 是否启用 PWA                                               |
| `VITE_VISUALIZER`         | `.env.production`        | 是否生成构建分析报告                                       |
| `VITE_COMPRESS`           | `.env.production`        | 压缩格式（`gzip` / `brotli`）                              |
| `VITE_ARCHIVER`           | `.env.production`        | 构建完成后是否打包为 zip                                   |
| `VITE_CACHE_ENCRYPT_KEY`  | `.env.production`        | 缓存加密密钥（SM4，**32 字符**）                           |
| `VITE_SENTRY_DSN`         | `.env.production`        | Sentry 上报地址                                            |

> 只有 `VITE_` 前缀变量会暴露给客户端。

***

## npm 脚本

| 脚本              | 说明                                              |
| ----------------- | ------------------------------------------------- |
| `pnpm dev`        | 启动开发服务器                                    |
| `pnpm build`      | `rimraf dist` 后生产构建                          |
| `pnpm preview`    | 预览构建产物                                      |
| `pnpm type-check` | `vue-tsc --build` 类型检查                        |
| `pnpm lint`       | oxlint + eslint 修复                              |
| `pnpm format`     | oxfmt 格式化 `src/`                               |
| `pnpm test:unit`  | Vitest 单元测试                                   |
| `pnpm test:e2e`   | Playwright E2E                                    |
| `pnpm release`    | standard-version 版本发布（含 minor/major/patch） |

***

## 关键文件说明

| 文件                                      | 作用                                        |
| ----------------------------------------- | ------------------------------------------- |
| `src/stores/modules/user.ts`              | 登录、登出、token 管理、用户信息、权限判断  |
| `src/utils/ws.ts`                         | WebSocket 单例 + 事件总线（`useWebSocket`） |
| `src/utils/request/alova.ts`              | HTTP 客户端、401 刷新、错误处理             |
| `src/api/request.ts`                      | `get / post / put / del` 接口封装           |
| `src/router/guards.ts`                    | 路由守卫（登录校验、动态路由注入）          |
| `src/settings/theme.ts`                   | 主题 token 生成（`getThemeConfig`）         |
| `src/config/constants.ts`                 | Token / 缓存 Key 等全局常量                 |
| `src/components/business/Table/`          | 表格组件与 `useTable`                       |
| `src/components/business/MarkdownEditor/` | 基于 Tiptap 的富文本编辑器                  |

***

## 常见坑

| 现象                     | 原因                                              | 修复                                                  |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------- |
| 登录 400「缺少租户标识」 | 未传 `tenantCode`                                 | 表单加字段                                            |
| `userId` 显示 NaN        | `Number(uuid)`                                    | UUID 保持字符串                                       |
| 收到强制下线不跳登录     | 判断了错误的消息类型                              | 服务端下行是 `force-logout`，通知推送是 `notice:push` |
| 每个组件都连一条 WS      | 直接 `new WebSocket`                              | 用 `src/utils/ws.ts` 的单例                           |
| 登出后主题丢了           | `logout` 里 `cache.clear()` + `location.reload()` | 只清 auth 相关 key                                    |
| 开发端口不对             | 以为固定 9080                                     | 读 `VITE_PORT`（开发为 5680）                         |
| 无权限指令不生效         | 权限字符串与后端不一致                            | 以 `/auth/permissions` 返回为准                       |
| 富文本列表项间距异常     | Tiptap 列表项内会多包一层 `<p>`                   | 组件内已用 CSS 压平，勿在业务侧再改                   |

***

## 相关文档

- 文档站：[antdv-docs](https://github.com/junjie73-blip/antdv-docs) 独立仓库（本地运行 `pnpm dev`）
- 代码规范：[CODE_STANDARD.md](./CODE_STANDARD.md)
- 仓库级协作规则：[../AGENTS.md](../AGENTS.md)
- 更新日志：[CHANGELOG.md](./CHANGELOG.md)
