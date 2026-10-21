# 常见问题

按**症状**索引，不按模块索引——撞上来时你手里只有现象。每条都给了出处，改之前先确认自己看到的确实是同一个原因。

## 开发环境

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 改了子包源码，页面没反应 | 应用消费的是子包 `dist`，不是源码 | `pnpm --filter <pkg> build`，然后**重启** dev（只重启不构建 = 还是旧的） |
| `pnpm install` 被拦 | 根 `preinstall` 挂了 `only-allow pnpm` | `corepack prepare pnpm@10.12.4 --activate`；npm/yarn 装出来的 workspace 是假的 |
| dev 改一个二级页面，顶栏侧栏全没了 | 自动路由 HMR 重铺**裸路由**，布局父记录丢了 | 已修（`apps/web/src/router/index.ts:46-73` 接管 `handleHotUpdate`）；若复现，先确认没绕过 `buildAppRoutes` |
| 三个端口撞车 | 文档站 5200 / 应用 6080 / mock 5320 | mock 端口写死且两边各持一份，改它要同时改 `VITE_MOCK_SERVER` 与插件探测，见[Mock 服务（Nitro）](/guide/essentials/mock) |
| `pnpm check:cspell` 报错找不到命令 | 本工作区没装 cspell | 已知缺口，CI 也不跑它；不要为它加依赖 |

## 路由与菜单

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 页面能直达，但侧栏看不到 | 侧栏读 `GET /menus`，**不是**从路由表递归的 | 后端加菜单项；本地可先在菜单管理页建 |
| 菜单点了不跳转 | `attachMenuPaths` 在路由表里反查不到该 path | 菜单的 path 必须命中已生成的约定路由，见[路由与菜单](/guide/essentials/route) |
| 进页面被踢到 403 | 菜单里没有它 → 路由被 `removeRoute` 裁掉 | 这是"菜单即权限"的正常结果，不是 bug |
| 公开页被重定向到登录 | 缺省即 `requiresAuth` | 显式写 `meta.requiresAuth: false` 并加进 `WHITE_LIST`（`apps/web/src/config/constants.ts:6-12`） |
| 标签页"刷新当前"白屏 | `/redirect/:path(.*)` 被删了 | 它必须显式注册，约定路由只给精确的 `/redirect`（`apps/web/src/router/routes.ts:48-57`） |
| 切二级页面后布局外壳消失（dev） | 同第一条 HMR 问题 | 同上；生产不受影响，`import.meta.hot` 那段不进包 |

## 请求与接口

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 搜索框输什么都一样、翻页还是第一页数据 | `get(url, { params })` 多包了一层，发出去是 `?params=[object Object]` | `get`/`del` 的**第二个实参就是查询串**（`apps/web/src/api/request.ts:22-26`） |
| HTTP 200 但业务失败没提示 | 信封 `code !== 200` 时 `afterFetch` 抛 `RequestError` 并标 `handled` | 别在调用处 catch 掉就完事，`fetcher.ts:287-298` |
| 收到强制下线但不跳登录 | WebSocket 消息类型写成 `forceLogout` | 用 `force-logout`（连字符） |
| WS 一直重连刷日志 | 没配 `VITE_WS_URL` | 单例在 URL 为空时**直接不连**（`apps/web/src/utils/ws.ts:107-112,312-319`） |
| 上传接口报 `Content-Type` 不对 | 手写 JSON 头覆盖了 FormData | 走共享 client：`FormData` 时它会**故意置空** `Content-Type`（`fetcher.ts:245-259`） |
| 登录接口带了 Bearer 头被后端拒 | token 注入跳过了 auth 端点判定 | 新增登录类端点要进 `AUTH_ENDPOINTS` 名单（`fetcher.ts:18-27`） |

## 主题与样式

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 换主色，菜单选中项不变 | 只改了 antd token，或只写了一个变量名 | 主色只有一条链：档位写在 `<html data-theme>`，自定义色再内联 `--primary`（`packages/core/preferences/src/update-css-variables.ts:85-116`）。给 antd 的 `--ant-*` 桥已经整体删掉，不要再往那个方向补变量 |
| 深色下主色和自己设的不一样 | 预设档位**故意不写**内联 `--primary`：暗色色板在 `@antdv/design` 的 `token/dark.css` 里已经按该主题提亮过一遍，内联会把亮色值又压回去 | 只有取色器选的自定义色才需要内联（此时 `data-theme='custom'`）；新页面统一走 `@antdv/design` 的 `*-primary` 令牌；测试断言别钉色值，要么在浅色下断，要么断"同源关系"（见[主题与偏好设置](/guide/in-depth/theme)） |
| 工具类盖不住 `components` 层规则 | Tailwind 层顺序被改动 | `@layer theme, base, components, utilities` 必须显式声明且 `utilities` 在最后（`packages/core/base/design/src/index.css:27`） |
| 页面之间间距不一致 | 路由页面外层自己写了 padding | 内边距归布局管，见[开发规范与环境变量](/guide/essentials/development) |
| 生产包里图标是空白方块 | 用了离线列表外的 Iconify 前缀 | 新集合要同时加 catalog 依赖与 `internal/vite-config/src/plugins/auto-import.ts:30-32` 的 `iconifyOffline({ local: [...] })` 列表 |

## 组件与交互

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| `notification` 弹不出来 | 用了静态方法 | `App.useApp()` 拿实例；标题字段是 `title` |
| 表格固定列里的弹层被裁 | 固定列自己造了层叠上下文 | 把弹层 `z-index` 抬到固定列之上 |
| 按钮级权限不生效 | 以为 `meta.permissions` 有用 | 没有任何守卫读它；用 `hasPermission` / 指令，见[权限、指令与光标](/guide/in-depth/access) |

## 文档站

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 侧栏、顶栏菜单、语言切换全是空的，正文正常 | `locales` 的键写成路径 `'/'`，内部拼成 `///` 永不匹配 | 键用裸语言码 `zh` / `en`，见[CI 与部署](/guide/essentials/deploy) |
| 顶栏看不到语言切换 | 上游把它藏在小屏（<1280px） | 窄窗口在汉堡菜单里，不是坏链 |
| 切语言后 `<html lang>` 没变 | VitePress 同页换 locale 不重载文档 | 验收断言按 URL 与标题，别按 `lang` |
| HTML 在、样式全 404 | `VITEPRESS_BASE` 与实际挂载路径不符 | GitHub Pages 项目站是 `/<仓库名>/`；Git Bash 里还要 `MSYS_NO_PATHCONV=1` |
| 语言切换跳到 404 | zh 与 en 的文件名/路径不一致 | 两边**目录与文件名逐一对应**，加页面先补另一边 |
| 链接写错没报错但锚点失效 | VitePress 只校验页面存在性，不校验锚点 | 双语锚点 slug 完全不同，改标题后手动核对产物 |

## 已知的死代码与未接线

这些不是坑，是**当前状态**。动它们之前知道一下，不要按"存在即生效"来推断：

| 位置 | 状态 |
| --- | --- |
| `stores/modules/auth.ts` | 与 `@antdv/stores` 的 `user.ts` 重复，**全仓零消费者**（挂住它的只有 `apps/web/src/stores/index.ts:1` 那句 `export *`） |
| 偏好里的 `routeMode` | 声明在 `packages/core/preferences/src/config.ts:79`，应用代码无读取点 |
| `VITE_NAMESPACE` | 无任何代码路径读它，前缀实际来自 `VITE_APP_TITLE` |
| vue-i18n | **已接线，不是死代码**：全仓 `useI18n()` 的真实调用只有一处 —— `packages/core/hooks/src/use-locale.ts:65`（`layout-ui/src/layout.ts` 里那句只是注释）。菜单标题由 `localizeMenus` 翻译（`packages/layouts/src/hooks/use-menu-tree.ts:25`），译文查找函数 `translateMenu` 由宿主注入（`apps/web/src/plugins/ui-runtime.ts:20-21`），包内不 import vue-i18n。顶栏语言切换在 `packages/layouts/src/widgets/language-toggle/index.vue`，写入走 `appStore.updateSetting({ locale })`（`:38`），应用侧同一个入口是 `useLocale.ts:70` 的 `setLocale`。仍然没接上的是业务页面：`src/views/**` 一个 `useI18n` 都没有，文案硬编码中文，`.vue` 里也没有 `$t()` |
| `apps/web/src/assets/icons/` | 4 枚宿主自带 SVG（github / wechat / qq / google），`vite-plugin-svg-icons` 打成 `#icon-<文件名>` 雪碧图，注册在 `apps/web/src/main.ts:38`，消费点 `apps/web/src/config/auth-social.ts:17-25`。**不是空目录** |
| `views/tool/mock/**` | 只剩私有模块，没有 `index.vue`，mock-center 面板只能走 HTTP 接口 |
| stylelint | 规则包 `@antdv/stylelint-config` 与 `apps/web` 的 stylelint 依赖都在，但**仓库里没有任何 `.stylelintrc*` / `stylelint.config.*`，也没有 stylelint 脚本**；`lefthook.yml` 整个文件从第 1 行起就被注释掉，所以 pre-commit 一个任务都不跑 |
| `docs/` 与 `apps/web/public/pwa-icons/` 的 logo | **拷贝**关系，不是引用；换 logo 要两边一起改 |

::: tip

想清理按"死代码"的代价排序最划算的是：i18n 的外壳与菜单标题已经接上，剩下来的是业务页面文案（要么补 `useI18n`，要么承认中文就是这个界面的语言）；`auth` store 直接删（上表已给出唯一挂点）；`routeMode` / `VITE_NAMESPACE` 二选一——要么实现要么从 `.env` 与 `types/env.d.ts` 移除。清理完记得同步这份 FAQ；删的顺序与牵动面见[移除代码](/guide/other/remove-code)。:::
