# 登录

一句话：**账号密码 → `userStore.login()` → token 加密进缓存 → 跳 `redirect` 或首页常量；登出必须把会话态四件套一次清干净。**

登录页在 `apps/web/src/views/login/index.vue`，登录态在 `packages/stores/src/user.ts`（`logout` 见 :164-170），拦截在路由守卫（见 [权限与菜单](/guide/in-depth/access)），凭证注入在请求层（见 [HTTP 请求](/guide/essentials/request)）。本页只讲这条链路本身。

## 登录的完整链路

```
表单校验（@antdv/form-ui 的 Rule / runRule）
  → userStore.login(username, password)
  → http.Post('/auth/login')            // fetcher 的 beforeFetch 会豁免认证端点，不带 Bearer
  → code === 200
      ├── setToken(token)               // encryptToken AES-256-GCM 后写 cache['auth_token']，24h 过期
      └── setUserInfo(info)             // roles / permissions 落 cache['user_info']
  → router.push(route.query.redirect || HOME_PATH)   // HOME_PATH = '/dashboard/analysis'
```

登录页没有再走 antd Form：`index.vue:7` 从 `@antdv/form-ui` 引 `Rule`、:18 引 `runRule`，字段规则在 :85-116 声明、:127-148 逐条跑；实现细节在 `packages/core/ui-kit/form-ui/src/rule-registry.ts`。轻提示也走 `@antdv/popup-ui` 的 `message`（`index.vue:23`），和 antd 的 `message` 无关。

几个容易踩的点，都是代码里写死了理由的：

- **回跳不能写死 `/dashboard`**。那是菜单目录节点，本身没有页面组件，跳过去是 "外壳都在、内容区空白"。守卫侧还有一道兜底：`resolveDirectory` 会把目录落到它的第一个可见叶子（`router/guards/index.ts`）。
- **演示账号是 `admin / admin123`**，账号表在 `apps/backend-mock/server/utils/accounts.ts`（`authenticate` / `issueToken` 都从这里出），token 形如 `mock_token_<username>_<timestamp>`；页面底部有提示文案。
- **手机号登录 tab 没有接到后端**。`handleLogin` 无论哪种模式都调用 `userStore.login(username, password)`，"发送验证码"只弹一条 message； `remember` 复选框同样没有被消费。接真实后端时这几处都要补。
- 加密失败会**降级明文存储**并 `console.warn`（`setToken` 的 try/catch），不会把用户挡在登录页外。

## 守卫如何拦截与放行

装配处在 `apps/web/src/router/guards/index.ts`，它只做依赖注入，逻辑全在 `@antdv/router` 的 `applyRouterGuards`（顺序即注册顺序）：

| 段 | 配置 | 说明 |
| --- | --- | --- |
| progress | NProgress | 最先注册，后续守卫重定向也能看到"在加载" |
| auth | `whiteList` | `WHITE_LIST = ['/login', '/register', '/error/404', '/error/403', '/error/503']`（`apps/web/src/config/constants.ts:6-12`，白名单是显式路径而不是 `/error/*` 通配）；未登录一律去 `/login?redirect=<当前 hash 路径>` |
| dynamicRoutes | `loadRoutes` | 已登录且未加载时 `routeStore.initRoutes()` 拉 `/menus` 并裁剪路由表，"菜单即权限" |
| title | `VITE_APP_TITLE` | afterEach 写文档标题 |

## 401、刷新令牌与 forceLogout

请求层（`packages/request/src/fetcher.ts` + `executor.ts`）的规则：

1. `beforeFetch` 给非认证端点拼 `Bearer`；无 token 时若有 refresh token 先刷新，否则 `forceLogout()`。
2. 收到 401 时 `doOnceWithAuthReplay` 会**刷新一次并重放一次**；认证端点自身、已在登出流程、或已重放过的直接抛错，避免死循环。
3. `forceLogout`（`packages/request/src/fetcher.ts:73-88`）做两件事：调应用注入的 `onLogout()`（应用侧 `plugins/request-runtime.ts` 把它绑到 `useUserStore().logout()` 这一唯一出口），然后 **改 hash** 回 `#/login?redirect=…`。本应用是 `createWebHashHistory`，写 `location.href = '/login'` 会触发整页重载、打断进行中的导航并把 redirect 弄丢。

::: warning Mock 环境没有 `/auth/refresh` `backend-mock/server/api/auth/` 下只有 `login` / `logout` / `user-info`，登录响应也不发 refresh token。所以演示环境里 401 的直接结果就是 `forceLogout`。刷新链路是按 `REFRESH_TOKEN_KEY`（`config/constants.ts`）设计的，接真实后端才会被激活。:::

::: tip token 解密要显式触发 store 初始化只把缓存里的密文原样读进 `token`；`initToken()` 负责异步解密（解密失败回落原值，兼容旧明文）。它不在应用启动路径上，改这条链路时记得验证 "刷新页面后 Authorization 头里是可用的 token"。:::

## 登出清哪四件套

`userStore.logout()`（`packages/stores/src/user.ts:164-170`）清空的东西一件都不能少，否则"同一个页面会话里换个账号"会带出上一个人的状态：

| 清什么 | 不清的后果 |
| --- | --- |
| `token` + cache `auth_token` | 还是登录态 |
| `userInfo` + cache `user_info` | 头像/昵称/角色是上一个人的 |
| `resetPageCache()` | KeepAlive 里留着上一个账号的表单草稿、分页、图表数据 |
| `routeStore.resetRoutes()` + `tabsStore.reset()` | `isLoaded` 仍为 true，守卫跳过 `loadRoutes()`，菜单授权和标签页都是别人的 —— 权限更小的账号进来直接 403 错乱 |

## 相关页面

- 守卫与菜单裁剪的细节：[权限与菜单](/guide/in-depth/access)
- 路由表怎么生成：[路由](/guide/essentials/route)
- Mock 服务：[Mock 数据](/guide/essentials/mock)
