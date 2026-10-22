# 第三方组件库与依赖规则

## 1. 准入判定（先过这一关）

新增任何外部包前依次回答：

1. **它是不是"又一套 Vue UI 库"？** 是 → 拒绝。本仓库的交互组件只有一个底座：`reka-ui`（无样式 Headless 原语），外观由 `@antdv/design` 的 token + Tailwind 工具类给出。
2. **能不能用已有的包组合出来？**（`@antdv/shadcn-ui` 原语 + `common-ui` 外壳 + `@vueuse/core` + `es-toolkit` + `dayjs`）能 → 不新增。
3. **能力是否必须落在某个层？** 只有 `apps/web` 可以直接吃重型业务库（编辑器、流程图、表格导入导出、播放器）；`packages/**` 引库要同时说明"为什么不能放宿主"，因为包一旦引库，全部下游产物都背上了。
4. **许可证是否可商用？** 见 §6。
5. **它会不会带构建期二进制/联网下载？**（imagemin 系、puppeteer 系）会 → 必须走 `allowBuilds` / `ignoredBuiltDependencies` 显式登记。

## 2. 允许引入的范围

| 类别 | 允许的包 | 落点约束 |
| --- | --- | --- |
| Headless 交互原语 | `reka-ui`（**精确钉 2.11.0**） | 只允许经 `@antdv/shadcn-ui` 包一层再被上层用；业务代码不直接摸 reka 的 DOM 结构 |
| shadcn-vue 生态 | `@antdv/shadcn-ui`（`pnpm shadcn add` 产物）、`class-variance-authority`、`clsx`、`tailwind-merge`、`tw-animate-css` | 生成的源文件不手改覆写（见 forbidden §1） |
| Tailwind v4 | `tailwindcss`、`@tailwindcss/vite`、`@tailwindcss/nesting`（**insiders 版**）、`@tailwindcss/typography` | 只装在设计/构建配置层 |
| 图标 | `@iconify/vue` + `@iconify-json/{ant-design,carbon,fa6-regular,lucide,mdi}`、`@lucide/vue`、`@tomjs/vite-plugin-iconify`（离线编译） | **不连 Iconify CDN**：名字必须能在已装的 `@iconify-json/*` 集合里取到；新增集合 = 新增 catalog 条目 |
| 提示/浮层的底座 | `vue-sonner`（精确 2.0.9） | 只允许 `@antdv/popup-ui` 引（`boundary.test.ts:157`），业务侧一律走 `popup-ui` 的 toast/message |
| 表单与校验 | `vee-validate` + `@vee-validate/zod` + `zod`（版本互相锁死：4.15.1 / 4.15.1 / 3.25.76） | 校验口径统一，不再引入第二套表单库 |
| 日期/数据 | `dayjs`、`@internationalized/date`、`es-toolkit`、`@tanstack/{vue-query,vue-table,vue-form,vue-store}` | 日期只用 dayjs（`internal/vite-config/src/plugins/dayjs.ts` 统一 locale 分包）；`@internationalized/date` 只服务日历字段 |
| 图表/富文本/流程/文档 | `echarts`、`@tiptap/*`、`codemirror` + `@codemirror/*`、`bpmn-js*` + `camunda-bpmn-moddle`、`@vue-flow/*`、`video.js` + `@videojs-*`、`@vue-office/*`、`pdfjs-dist`、`vue-pdf-embed` | 只在 `apps/web` 侧使用，不进可复用子包 |
| 工具类 | `@vueuse/core`（**14.4.0 精确**）、`@vueuse/motion`、`mitt`、`nanoid`、`qs`、`dompurify`、`sortablejs`、`vue-draggable-plus`、`nprogress`、`qrcode`、`watermark-plus`、`spark-md5`、`xlsx` | 注意 `@vueuse/core` 与本项目 `use*` 的同名冲突（见 standards §2） |
| 测试/构建工具链 | `vitest`、`@vue/test-utils`、`jsdom`、`happy-dom`、`@playwright/test` + `playwright`、`vite`、`turbo`、`tsdown`、`oxfmt`/`oxlint`/`eslint`/`stylelint`、`cspell`、`knip`、`publint` | `devDependencies`，`publicHoistPattern` 已把 lint 系提到根，别在子包重复装一份 |

**明确不在允许范围内**：`antdv-next` / `@antdv-next/*`（历史依赖，已随兼容层移除，静态检查会在包源码里拦它）、任何成套 Vue 组件库（Element Plus / Naive UI / Vuetify / PrimeVue / Ant Design Vue）、以及第二套 CSS-in-JS 或第二套 tailwind 变体方案。要加就先把"为什么 reka + token 组合不出来"写进 changeset 与提交信息。

## 3. 版本约束

- **唯一来源是 `pnpm-workspace.yaml` 的 `catalog`**：子包写 `"vue": "catalog:"`，禁止在包 `package.json` 里写区间。加新库：先登记 catalog，再在包内引用（`pnpm catalog` 提供 codemod 辅助迁移）。
- **内部包只用 `workspace:*`**，跨包依赖必须写在 `dependencies` / `peerDependencies`（`vsh check-dep` 与 `boundary.test.ts` 都查）。
- **单实例靠 `overrides` 保命**：`vue`、`pinia`、`clsx`、`@ctrl/tinycolor`、`@ast-grep/napi`。放开任意一条就会出现多份 Vue 副本（provide/inject 失效、devtools 报错、reka 上下文断裂）。
- **精确钉版本的包**（升级要显式决策）：`reka-ui` 2.11.0、`vue` 3.5.43、`@vueuse/core` 14.4.0、`vee-validate` 4.15.1、`@vee-validate/zod` 4.15.1、`zod` 3.25.76、`vue-sonner` 2.0.9、`pdfjs-dist` 6.3.289、`embla-carousel-vue` 8.6.0、`vue-input-otp` 0.4.0、`@lucide/vue` 1.55.0、`@tailwindcss/nesting` insiders。
- **peer 策略**：`strictPeerDependencies: false` + `autoInstallPeers: true` + `dedupePeerDependents: true` —— 装得上不代表对，冲突要人工判断。
- **供应链冷却期是关的**：`minimumReleaseAge: 0`、`verifyDepsBeforeRun: false`。也就是"新发布当天就能装上"，加包/升包必须人工核对来源与版本，不能靠工具兜。
- 构建期脚本白名单：`allowBuilds`（`@parcel/watcher`、`core-js`、`esbuild`、`lefthook`、`vue-demi`）+ `ignoredBuiltDependencies`（imagemin 全家、`cwebp-bin`、`gifsicle` 等）+ `onlyBuiltDependencies`（`@vue-office/*`）。动这三处属 🔴。

## 4. 引入方式

```bash
# 1) 先在 pnpm-workspace.yaml 的 catalog 里登记版本
# 2) 只给需要的包安装
pnpm --filter @antdv/web add <pkg>@catalog
# 3) shadcn-vue 组件走 CLI，产物落 @antdv/shadcn-ui
pnpm shadcn add <component>
# 4) 装完立刻验证：依赖图、循环引用、构建口径
pnpm check:dep && pnpm check:circular && pnpm check:builds
```

带 `.vue` 模板的新包（或新库的样式类名）要同步：`@source` 登记、`design.test.ts` 反查、必要时补 `@plugin`。类型入口靠 `vite-plugin-dts`/`unplugin-dts` 与包内 `antdv:validate-dist` 保证，不在应用侧手写 `.d.ts`。

## 5. 二次开发限制

- `@antdv/shadcn-ui` = CLI 产物区：**只允许新增文件与在上层包组合**，不在这里写覆写；上游样式不满意就在 `common-ui` 建外壳组件，或用主题变量 / 自定义类名 / CSS 覆盖层解决（方案必须与 shadcn 实现解耦，下次 `add` 不会冲掉）。
- 直接魔改 reka-ui 内部行为前，先确认它没有对应 prop / slot；确实要改结构，把改动写在**我们自己的包**里（wrapper 组件），不 patch 上游、不加 `pnpm patch` 例外（要用先取得确认并登记原因）。
- 上游模板/库的源码 vendored 进来时，文件头保留原始出处与许可证说明，并在 `docs/` 里点名；不要伪装成自研。
- 三方库的 DOM 结构、类名不是 API：e2e 与 `:deep()` 只依赖我们自己打的 `data-*` 锚点（如 `[data-field-control]`、`[data-slot="select-content"]`、`[data-sonner-toast]` 要按 `data-x-position`/`data-y-position` 收窄）。

## 6. 合规与安全要求

- **许可证**：进产物的包按 MIT / Apache-2.0 / BSD / ISC / 0BSD / CC0 放行；GPL/AGPL/LGPL 与"仅非商用"一律拒绝（会污染整包分发）。已核对：`reka-ui` MIT、`vue-sonner` MIT、`codemirror` MIT、`sortablejs` MIT、`vue-cropper` ISC、`watermark-plus` ISC、`standard-version` ISC、`pdfjs-dist`/`video.js`/`xlsx` Apache-2.0、`@sentry/vue` MIT、`mockjs` MIT。
  **需要人工读一遍 LICENSE 文本**：`bpmn-js*`（package.json 写 `SEE LICENSE IN LICENSE`，抬头是 Camunda Services GmbH 版权）、`@tiptap/*`、`dompurify`、`qrcode`、`@vue-office/*`、`xlsx`（该包已不在公共 registry 常态发布，来源要固定并留档）。
- **联网与遥测**：图标默认离线编译（不连 Iconify）；`@sentry/vue` 只在 `PROD` 初始化、DSN 取 `VITE_SENTRY_DSN`，含 Session Replay（录制用户画面 → 属于个人信息处理，上线前要有告知与开关）；`apps/web/src/main.ts:91` 的 `tracePropagationTargets` 里写死了一个外部地址，替换成部署方域名后再上线。mock 头像用的是 `api.dicebear.com` 外链，内网部署要么换成本地资源、要么在 e2e 的"外站资源失败"分桶里继续豁免（`e2e/utils/app.ts`）。
- **凭据卫生**：依赖安装脚本、示例代码、e2e 断言里不得出现真实 token/cookie/密码；`.env.production` 的 `VITE_CACHE_ENCRYPT_KEY` 示例值上线前必须换。仓库里有一处历史遗留的调试语句含 token 字样（文件已在 `references/forbidden.md` ⚪ 节点名），处理动作是删除该语句，**不要把内容贴进日志、提交信息或聊天记录**。
- **已知的"无效防护"必须讲清楚**：`CODE_STANDARD.md` §11.2 记录 CSRF token 目前是前端生成的，不构成真实防护；对外部署要改后端 `Set-Cookie` 下发，别在文档里写成已具备。
