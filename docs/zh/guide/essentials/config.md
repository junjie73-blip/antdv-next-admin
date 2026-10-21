# 配置

这个仓库有**三套互不相干的配置面**，搞混是问题最多的地方：

| 配置面 | 位置 | 生效时机 | 改完要不要重启 |
| --- | --- | --- | --- |
| 构建期环境变量（`VITE_*`） | `apps/web/.env*` | Node 里读（插件与 dev server）+ 浏览器里读（`import.meta.env`） | 要，dev server 重启 |
| 用户偏好 | `packages/preferences` + `apps/web/src/settings/index.ts` | 运行时，落在 localStorage | 不要，刷新即可 |
| 应用常量 | `apps/web/src/config/*.ts` | 编译期常量 | 不要（HMR） |

第一套决定"这个包怎么被打出来、连哪个后端"，第二套决定"界面长什么样"，第三套是写死的业务约定（缓存键名、首页路径、表格分页字段）。**偏好不是配置文件的运行时副本**：它有默认值、有净化、有迁移，见下文。

## 环境变量：两份读取路径，两种类型

Vite 的合并顺序是 `.env` → `.env.[mode]` → `.env.local` → `.env.[mode].local`（后者覆盖前者， `.local` 不进版本库）。仓库里目前只有前三类中的两个基础文件加模式文件：

- `apps/web/.env`：`VITE_NAMESPACE`、`VITE_APP_TITLE`、`VITE_MOCK=false`、`VITE_MICRO_APP=false`、`VITE_WS_URL=`
- `apps/web/.env.development`：`VITE_PORT=6080`、`VITE_INJECT_APP_LOADING`、`VITE_DEVTOOLS`、 `VITE_MOCK=true`、`VITE_APP_BASE_API=/api`、`VITE_MOCK_SERVER=http://localhost:5320`
- `apps/web/.env.production`：`VITE_ARCHIVER`、`VITE_COMPRESS=gzip`、`VITE_PWA`、`VITE_VISUALIZER`、 `VITE_PORT= 9080`、`VITE_CACHE_ENCRYPT_KEY`

类型这件事**两边正好相反**，这是本仓库踩过的坑：

- Node 侧：`internal/vite-config/src/utils/env.ts` 的 `loadEnv()` 把结果交给 `vite-plugin-env-parse` 的 `parseLoadedEnv`，于是 `.env` 里的 `true` 变成布尔 `true`、`6080` 变成数字。写 `envConfig.VITE_X === 'true'` 恒为 false。
- 浏览器侧：`import.meta.env.VITE_X` **永远是字符串**（`'true'` / `'false'` / `''`）。写 `=== true` 恒为 false。

所以有两份 `isEnvEnabled`：Node 版在 `internal/vite-config/src/utils/env.ts`（额外认数字 `1`），浏览器版在 `packages/shared/src/utils/env.ts`（`@antdv/shared/utils/env`）。两边都只认 `true / 1 / on / yes`（忽略大小写与前后空格），其余含 `''`、`'0'` 一律 false。 `types/env.d.ts` 由 `envParse` 自动生成，里面的 `boolean` 只是"字面量看上去是布尔"，不代表运行时类型——这个提醒就写在文件头注释里。

## 变量清单

浏览器侧真正被读的：

| 变量 | 读取处 | 作用 |
| --- | --- | --- |
| `VITE_APP_TITLE` | `index.html` 模板、`internal/vite-config/src/plugins/pwa.ts` 的 manifest、标题守卫、`bootstrap/env.ts` 的 `cachePrefix`、`settings/index.ts` 的 `APP_DEFAULTS` | 标题与缓存键前缀（改它会让全部旧缓存失效） |
| `VITE_APP_BASE_API` | `apps/web/src/plugins/request-runtime.ts`（注入给 `@antdv/request`） | 接口前缀，别在业务代码里写完整域名 |
| `VITE_WS_URL` | `apps/web/src/utils/ws.ts` | 空 = 不连接（重连是无限的，没后端时只会刷屏） |
| `VITE_MICRO_APP` | `apps/web/src/config/micro-app.ts` | 微前端总开关，用 `isEnvEnabled` 判定 |
| `VITE_CACHE_ENCRYPT_KEY` | `apps/web/src/bootstrap/env.ts` → `configureSharedEnv` | 缓存加密密钥，长度要求见[缓存](/zh/guide/essentials/cache) |
| `VITE_MOCK` | 只在 Node 侧读（代理与插件），浏览器代码不判它 | dev 打开时 `/api` 转发到 Nitro；生产侧语义正在调整，见[数据 Mock](/zh/guide/essentials/mock) |

构建侧（只在 `internal/vite-config` 里读，浏览器拿不到）：

| 变量 | 默认 | 打开后的效果 | 定义处 |
| --- | --- | --- | --- |
| `VITE_PORT` | `5173`（`DEFAULT_PORT`） | dev server 端口；`Number()` 失败才回落到 `options.port` | `config/application.ts:105` |
| `VITE_DEVTOOLS` | 关 | `vite-plugin-vue-devtools` | `plugins/index.ts:123-126` |
| `VITE_VISUALIZER` | 关 | 产出 `stats.html`（`vite-bundle-analyzer`） | `:110-111` |
| `VITE_TURBO_CONSOLE` | 关 | `unplugin-console-highlight` 终端高亮 | `:112-113` |
| `VITE_ARCHIVER` | 关 | 构建产物打成 zip | `:119` |
| `VITE_PWA` | 关 | manifest + service worker（`registerType: 'prompt'`） | `:120` |
| `VITE_COMPRESS` | 关 | gzip + brotli，阈值 10 KB | `:121-122`、`plugins/compress.ts` |
| `VITE_EXTRA_APP` | 关 | 把 env 抽成 `_app-config-<version>-<hash>.js` 并在 HTML 里引 | `:123-127` |
| `VITE_PRINT` | 关 | 自定义 dev 启动横幅 | `:136` |
| `VITE_INJECT_APP_LOADING` | 关（两个模式文件都写了 `true`） | 首屏遮罩注入（插件本体**永远注册**，见下） | `:145` |
| `VITE_APP_LOADING_DEV` / `_BUILD` / `_DURATION` / `_PATH` | 前两个在未关注入时默认开 | 分别控制 dev/build 注入、淡出时长、自定义遮罩 HTML | `:175-189` |
| `VITE_WRITE_DTS` | 开 | 关掉可跳过自动导入声明文件回写（映射盘上的稳定性开关） | `:62-67` |
| `VITE_DEV_POLLING` | 关 | `server.watch.usePolling`；映射盘上的结论写在[本地开发](/zh/guide/essentials/development) | `config/application.ts:119-123` |
| `VITE_MOCK_SERVER` / `VITE_MOCK_PORT` | `http://localhost:5320` / `5320` | dev 代理目标与内嵌 Nitro 端口，必须同源推导 | `utils/proxy.ts:40-90` |
| `VITE_PROXY` | 无 | 额外代理表 `[prefix, target][]`，Mock 代理优先级更高 | `config/application.ts:106` |
| `VITE_APP_BASE_URL` | 无 | 注入 `index.html` 的 `canonical` / `og:url` | `plugins/index.ts:90-97` |

::: warning 三个"看着有、其实没人读"的变量

- `VITE_NAMESPACE`：只在 `.env` 与 `types/env.d.ts` 里出现，全仓无引用。缓存前缀实际来自 `VITE_APP_TITLE`，别再按名字猜它有隔离作用。
- `VITE_APP_VERSION`：`plugins/metadata.ts:104` 用 `define` 造出来的，应用代码里没有读它。
- `VITE_MINIO_PUBLIC_URL`、`VITE_SENTRY_DSN`：代码里读（`bootstrap/env.ts`、`main.ts`），但三份 `.env` 都没写，运行时是 `undefined`。Sentry 只在 `import.meta.env.PROD` 分支初始化，DSN 为空即不实际上报；MinIO 直链没配时下载走代理前缀（`packages/shared/src/utils/download.ts`）。:::

`vite-plugin-iconify-offline`、`@vitejs/plugin-legacy`、`vite-plugin-cdn-import` 在 `apps/web/package.json` 的 devDependencies 里，但**没有任何 import**；图标离线由 `@tomjs/vite-plugin-iconify` 负责（见[图标](/zh/guide/essentials/icons)）。加依赖前先搜一遍有没有人用。

## vite.config.ts 与合并顺序

`apps/web/vite.config.ts` 只有一行有效代码：

```ts
// apps/web/vite.config.ts:14-16
export default defineApplicationConfig({
  base: './',
});
```

`defineApplicationConfig(options)`（`internal/vite-config/src/config/application.ts:78-132`）的入参：

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `base` | `'./'` | 配合 hash 路由，产物可从任意静态目录直出 |
| `root` | `process.cwd()` | 决定 `envDir`、别名与 `__APP_INFO__` 读哪个 package.json |
| `port` | — | 兜底端口，优先级低于 `VITE_PORT` |
| `appInfo` | `true` | 是否注入 `__APP_INFO__` |
| `define` | — | 追加 `define` 常量 |
| `plugins` | — | 追加插件，数组拼接，不会顶掉共享插件 |
| `overrides` | — | **最后一层深合并**，项目专属配置从这里进来 |

合并顺序 `common → application → overrides`（`mergeConfig` 两次，见 `:127-130`）。要偏离默认就走 `overrides`，不要在应用里重写整份 config：`createCommonConfig()` 里的别名与 `dedupe` 一旦丢，症状是"能跑，但类型检查炸 / 运行期出现两份 Vue"。

`createPlugins()` 按产物形态分派（`internal/vite-config/src/plugins/index.ts:55-213`）： `application` 才有 HTML 注入、PWA、归档、metadata；`library` 只留编译链与 `.d.ts`。

::: warning

`VITE_INJECT_APP_LOADING=false` 不等于关掉插件入口是常驻的 `import { loadingFadeOut } from 'virtual:app-loading'`。把插件整个跳过会让虚拟模块无法解析，构建期直接 500；所以开关只决定"注不注入"，未注入时那些函数找不到容器、自然空转（`plugins/index.ts:157-164`）。:::

## 用户偏好

`packages/preferences` 是无单例的工厂，项目适配层在 `apps/web/src/settings/index.ts`：

```ts
// apps/web/src/settings/index.ts:60-113
export const APP_DEFAULTS: AppSetting = withDefaultPreferences({
  copyrightCompany: import.meta.env.VITE_APP_TITLE || 'Antdv Admin',
  watermarkContent: import.meta.env.VITE_APP_TITLE || 'Admin',
});

export function getPreferences(): PreferencesInstance {
  instance ??= createPreferences({
    defaults: APP_DEFAULTS,
    migrate: migratePreferences,
  });
  return instance;
}
```

三条设计值得记住：

- **必须懒创建**。顶层直接 `createPreferences()` 会跑在 `bootstrap/env` 注入前缀之前，读写的都是默认 `app_cache_*` 键，症状是"设置保存了但刷新就丢"。
- **默认值里不许有 `import.meta.env`**（`packages/preferences/src/defaults.ts:6-14`）：包体在 dist 里，拿不到静态替换，字段会静默变成空串。项目差异值只能由应用通过 `defaults` 注入。
- **读取链是 缓存 → `migrate` → `pickKnownPreferences` → 与默认值合并** （`packages/preferences/src/store.ts:129-133`）。`pickKnownPreferences` 按类型丢脏值， `migrate` 处理"值合法但枚举已过时"（布局名 `mixed` → 新名字）；迁移只在读时做一次。

全量键与分组（主题 / 布局 / 小部件 / 底栏 / 通用）在 `defaults.ts:16-70`，落盘键是 `appSetting` （`store.ts:21`，带缓存前缀）。怎么用它们驱动 DOM 与 antd 主题见[主题与偏好设置](/zh/guide/in-depth/theme)， `appStore` 如何把它们展平见[状态管理](/zh/guide/essentials/stores)。

## 应用常量

| 文件 | 内容 | 备注 |
| --- | --- | --- |
| `src/config/constants.ts` | `TOKEN_KEY`、`USER_INFO_KEY`、`WHITE_LIST`、`HOME_PATH = '/dashboard/analysis'`、`LOGIN_PATH` | 守卫与登录流程读它，别在页面里写死路径 |
| `src/config/project.ts` | `projectConfig`：`table.fetchSetting/sortSetting`、`pageSizeOptions`、`routeMap`、`scrollbar.native` | 目前只有 `scrollbar.native` 有消费者（`ModalWrapper.vue`、`SettingDrawer/index.vue`）；表格字段名来自 `useDataSource.ts:17` 的 `DEFAULT_FETCH_SETTING`，`routeMap` 无人读 |
| `src/config/micro-app.ts` | 子应用注册表 + `enabled`（`VITE_MICRO_APP`） | 见[外部模块](/zh/guide/essentials/external) |
| `src/config/color.ts` | `COLOR_LIST` 主题预设色 | 与偏好的 `primaryColor` 配合 |
| `src/settings/index.ts` | 偏好适配层 | 上文 |

## 加一个变量的正确顺序

1. 三份 `.env` 里按需写：跨模式共用的进 `.env`，模式差异进 `.env.development` / `.env.production`。
2. 浏览器侧要用的话，让 `envParse` 重新生成 `types/env.d.ts`（dev/build 任意一次即可），然后**只用 `isEnvEnabled` 判布尔**。
3. 只有构建期需要（插件、代理、HTML 注入）就在 `internal/vite-config` 里读 `envConfig`，别把它同时暴露给浏览器。
4. 密钥、私有 token **不进 `VITE_*`**：`VITE_` 前缀的变量会原样打进产物，任何人都能从浏览器读到。需要改生产配置又不想重新构建，用 `VITE_EXTRA_APP` 把 env 抽成独立的 `_app-config*.js`。
