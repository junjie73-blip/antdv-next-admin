---
'@antdv/web': minor
---

feat: 生产产物自带浏览器内 mock，静态部署不需要任何后端

诉求：**"web 子包生产环境需要开启 VITE_MOCK"** —— 目标口径是产物单独部署出去就能把 21 个菜单点得动，不依赖 Node mock 服务，也不接真实后端。

## 拦截器装在 fetch 出口，不在 axios/ofetch 里

`apps/web/src/mock/` 九个文件：`activate.ts` 判定开关（`!!env.PROD && isEnvEnabled(env.VITE_MOCK)`），命中才 `import('./browser')`。用动态 import 是为了那 427 KB 的 `fixtures.json` —— 开关关着时它是另一个 chunk，浏览器根本不会去取，主包不受影响。`browser.ts` 换掉 `globalThis.fetch`，补 20–60ms 的人造延迟，应答用 `Response.json()`；没命中或跨域一律透传。`matcher.ts` 负责去前缀、同域与 method 判定，多条候选时取 `:param` 最少的那条。`overlay.ts` 是会话 + 写覆盖层。

选 fetch 而不是在请求层加开关，是因为请求层之外还有别的出口（图标集合、PWA 更新检查、示例页里直接 `fetch` 的地方），一处劫持全都覆盖；反过来在 `fetcher.ts` 里加分支只能覆盖 `http.*`。

## 数据从一次"正在跑的 Nitro"抓下来

`scripts/generate-mock-fixtures.mjs`（`pnpm mock:fixtures`）遍历运行中的 mock 服务，把 67 条接口的响应信封 + 各账号（凭据、权限码、可见菜单白名单）快照成 `src/mock/fixtures.json`。

**写接口不抓**：抓一次 POST/PUT/DELETE 就真改掉开发中 mock 的数据（DELETE 尤其致命），所以它们的应答由覆盖层按同一信封现造。`/upload*` 与 `/mock-center*` 也在排除名单里 —— 前者是 multipart 且要求每次唯一，后者本来就不该进产物。

## 两处只有生产才会暴露的缺陷

1. **列表筛选整个被丢掉**。覆盖层以前只读 `page/pageSize`，`keyword`、`status` 一律忽略：搜索框输什么都返回第一页，表现和"后端没响应"几乎一样，dev 下由 Nitro 真算所以看不见。现在按 Nitro 各 handler 的口径补上 `filterItems`：文本走不区分大小写的 `includes`，`status`/`priority`/`parentId` 这类走全等，`page/pageNum/pageSize` 三个分页键**不参与筛选**（否则 `page=1` 会被当成一个要求 `item.page === 1` 的条件），`total` 取筛选后的条数。
2. **上传在产物里没人接**。fixtures 排除了 `/upload*`，而示例页七张卡片还写着 `action="/api/upload..."`：那是 antd 自带的 **XHR** 上传器，从 fetch 劫持旁边绕过去，而且 `/api` 只是 dev 前缀（`VITE_APP_BASE_API` 只写在 `.env.development`，生产包里它是空串）。两头都错，点一次就是 404。现在七张卡片统一 `:custom-request="uploadRequest('…')"` → 项目的 `http`（ofetch → fetch）， `/upload`、`/upload/:variant` 由新增的 `dynamic.ts` 现造应答，契约逐字段对着 `apps/backend-mock/server/utils/upload.ts` 抄（`fileId` / `storedPath` / `uploadedAt` / `url` / `variant`）。代价是进度条不再真实：只在应答回来时补一次 `onProgress(100)`。

`AvatarUploader` 此前已经走 `http.Post('/upload/avatar')`，正好跟着这套一起通。

## 会话、权限与刷新

覆盖层是**内存态**的：新增的行可检索、`total` 跟着副本走，但刷新页面就回到快照。生产预览里没有真实后端可对账，把会话落盘反而会让人换台机器读到一份对不上号的数据。`/auth/user-info` 与 `/menus` 按会话账号出：菜单按白名单裁剪（叶子看名单、父壳只要有孩子活着就留），而前端正是拿这棵树摊成 allowedNames/allowedPaths 的 —— 不裁就等于生产预览里换个账号还是全通。

## 验证

- 单测：`src/mock/__tests__` 六个文件覆盖开关、匹配、覆盖层读写、筛选口径与上传现造；web 包 `vitest run` 376 条全绿。`vue-tsc` 仍是 **205** 条历史存量（本批文件零错误）。
- 生产口径：`apps/web/scripts/verify-prod-mock.mjs`（`pnpm --filter @antdv/web verify:prod-mock`）。自带一个**不带代理**的静态 dist 服务器（端口给 0 让系统挑），且**故意不做 SPA history 兜底** ——那会把没被接住的接口伪装成 `200 + index.html`。跑登录、侧栏、useCRUD 增改删（含关键词检索）、语言切换后的标签页标题、custom 账号菜单裁剪与越权 403、上传落 done 态，并把「逃逸到网络的接口请求」当硬失败统计。两轮 9/9，逃逸与 console 错误均为空。
- **不能用 `vite preview` 验生产**：`internal/vite-config` 没有 `preview` 段，Vite 的 preview server 会继承 `server.proxy`，`/api` 又被 dev 的 Nitro 接住 —— 上一轮就是这么"绿"的，属于假阳性。
- dev 回归：`ops-sweep` 的「上传示例页」用例照旧绿（它监听 `/api/upload` 响应，dev 下前缀由请求层补上，换传输方式不改口径）。

## 没做的

- 图标集合仍走 HTTP：离线化把 @iconify 的本地集合发布成同源 `/npm/…json`，那是静态资源而不是接口，核验脚本按"非资源请求"口径把它们排除在逃逸统计之外。
- `fixtures.json` 进仓库（427 KB）：重新生成需要一个正在跑的 mock 服务，不进门禁就没法复现产物。mock 接口有增删或结构变化时**必须**重跑 `pnpm mock:fixtures`，否则产物里是上一次的快照。
