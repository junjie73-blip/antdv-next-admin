# 编辑器与文件上传

本页覆盖两个示例路由：`/components/editor`（菜单「编辑器」，`apps/backend-mock/server/api/menus.get.ts:294-299`）与 `/components/upload`（菜单「文件上传」，`menus.get.ts:300-305`）。

## 编辑器：`/components/editor`

### Markdown 与富文本已合并成一个菜单

旧的 `editor/markdown`、`editor/rich-text` 两个示例页已经删除，现在只有一个 `/components/editor`，由两个 Tab 组成（`apps/web/src/views/components/editor/index.vue:34`）。**两个 Tab 不是同一个包装器的两种模式**（`editor/index.vue:36`，本页头部注释自己就把这点写明了）：

| Tab | 内核 | 产出 |
| --- | --- | --- |
| Markdown 编辑 | 示例页手写的 `textarea` + `marked` / `markdown-it` + `highlight.js`（`editor/index.vue:65-92`），**不是组件**，没有对外 API | Markdown 源码字符串 |
| 富文本编辑 | 组件库里的 `MarkdownEditor`（tiptap，`packages/core/ui-kit/common-ui/src/components/markdown-editor/MarkdownEditor.vue`） | 由 `contentType` 决定：默认 HTML，`'markdown'` 时是 Markdown 源码 |

::: warning

富文本这一侧没有 wangEditor `MarkdownEditor` 是当年 `@wangeditor/editor` 的 tiptap 替代实现，工具栏按键名、待办/视频节点按 wangEditor 存量格式对齐（`editor/index.vue:45-50`；扩展组装见 `markdown-editor/extensions/index.ts:31-58`）。依赖清单在 `packages/core/ui-kit/common-ui/package.json:31-39`（9 个 `@tiptap/*`，`marked` 在 `:44`），应用侧 `apps/web/package.json` 已经不再声明 `@tiptap/*`，**也从来没有装过 `@wangeditor/*`**。所以「富文本」现在指 tiptap 版 `MarkdownEditor`，wangEditor 那套能力（如它自己的菜单体系）不存在，也不要把旧文档里的 wangEditor 配置往这上面套。
:::

### Markdown Tab 实际提供了什么

- 渲染引擎可切换 `marked` / `markdown-it`（`editor/index.vue:94`），纯前端渲染、不发请求（界面原话见 `editor/index.vue:801`）；预览区经 `v-safe-html` 注入（`editor/index.vue:879`）。
- 工具栏是本页手写的按钮组，往 textarea 里**插 Markdown 语法**而非富文本操作（`editor/index.vue:214-415`）：粗体/斜体/删除线/行内代码、H1~H3、引用/列表/任务列表、代码块/表格、链接/图片/分割线。
- 顶部「只读 / 禁用 / 字数统计」开关同时作用于两个 Tab（`editor/index.vue:56-62,728-749`）；「取值」读本地 ref 或 `getHtml()`、「赋值」写 ref 或调 `setHtml()`，全部只动页面状态（`editor/index.vue:486-512`）。

### 富文本 Tab：`MarkdownEditor` 真实 API

**它解决什么问题**：给后台一个能直接吃 wangEditor 存量 HTML 的所见即所得编辑器，产出 HTML 字符串，支持编辑/分屏/预览三种模式与图片、视频插入。

**Props**（类型 `markdown-editor/types.ts:113-137`，默认值 `MarkdownEditor.vue:36-52`）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `value` | `''` | 内容，配合 `v-model:value`；语义由 `contentType` 决定 |
| `contentType` | `'html'` | `'html'` \| `'markdown'`（`types.ts:136`）。取/放都要过一遍转换：喂进去的模型经 `toEditorContent()` 解析，抛出来的值经 `modelFromEditor()` 序列化（`MarkdownEditor.vue:96-105`） |
| `mode` | `'edit'` | `edit` / `split` / `preview`（`types.ts:3`）；`preview` 视为锁定且隐藏工具栏（`MarkdownEditor.vue:429-431,626`） |
| `minHeight` / `maxHeight` / `height` | `160` / `500` / 未设 | 数字按 px（默认值见 `MarkdownEditor.vue:38-40`） |
| `readonly` / `disabled` | `false` | 与 `mode==='preview'` 合成 `isLocked`（`MarkdownEditor.vue:429-431`） |
| `showToolbar` / `toolbarConfig` | `true` / 未设 | `toolbarKeys` 一旦配置则 `excludeKeys` 失效（`MarkdownEditor.vue:416-423`，同 wangEditor 语义） |
| `imageUpload` / `videoUpload` | 见下 | `types.ts:71-108`；图片默认 ≤5MB、视频默认 ≤100MB（`types.ts:78-79,99-100`，编辑器侧配置在 `MarkdownEditor.vue:259,265`） |
| `maxLength` / `showCount` / `autoFocus` / `compact` / `placeholder` | — | `maxLength` 在输入/粘贴/拖入时拦截（`MarkdownEditor.vue:434-441`）并抛 `maxLength` 事件 |
| `theme` | `'light'` | ⚠️ **静默空操作**，见下方缺陷清单 |

**事件**（`types.ts:147-157`）：`update:value`、`change(html, text)`、`focus` / `blur`、`uploadSuccess` / `uploadError`、`maxLength`、`created`、`destroyed`。

**实例方法**（`MarkdownEditor.vue:552-600`，`defineExpose` 在 600）：`getEditor` / `getHtml` / `getHTML` / `getMarkdown` / `getText` / `setHtml` / `setHTML` / `setMarkdown` / `clear` / `focus` / `blur` / `undo` / `redo` / `insertText` / `insertHtml` / `insertMarkdown` / `insertImage` / `insertVideo` / `selectAll` / `getStats`。示例页把大部分做成了按钮（`editor/index.vue:929-963`）。

**Markdown ↔ 文档的往返在 `markdown.ts`**：`docToMarkdown(JSONContent)`（`markdown.ts:588`）把 ProseMirror 文档序列化成 Markdown 源码，`markdownToDoc(markdown)`（`markdown.ts:593`）用 `marked` 的 lexer 反解回文档，其中 `case 'html'` 分支保证喂 HTML 也解得开（`contentType="html"` 的老调用因此不受影响）。没有改用 `@tiptap/markdown` 的理由写在 `markdown.ts` 头注释里：本编辑器有自定义 `todo` 节点和块级 `text-align`，官方 markdown 序列化器覆盖不了这两样。

**配色全走 design token**：外框/工具栏分隔线/表格线用 `border-border`（即 `--app-border`，亮色 `#f0f0f0`），面板底色 `bg-card`、下拉弹层 `bg-popover`、代码与表头底 `bg-muted`、正文 `text-card-foreground`、选中态 `text-primary`（`MarkdownEditor.vue:606-621`、内容样式 `:697-855`）。组件里**没有**任何 `gray-*` 之类的硬编码色，也没有 `.dark` 分支——切主题时由 `packages/core/base/design/src/token/{default,dark}.css` 的变量接管，因此 14 套预设主题（`packages/core/base/shared/src/constants/theme-presets.ts:26-41`）各自的边框/底色都会跟着变。实测：亮色外框 `rgb(240,240,240)`、深色 `rgba(255,255,255,.12)`，弹层亮 `#fff` / 深 `#1f1f1f`。

**v-model 行为**：内容变化时抛 `update:value`（`MarkdownEditor.vue:167`）；外部回传等价内容会被 200ms「回声屏蔽期」跳过以免光标跳文首，但真·外部改写按文本比对后仍会落地（`MarkdownEditor.vue:141-150,487-521`）。**初值请走 `value` prop 而不是挂载后 `setHtml()`**——后者可能落在屏蔽期里被吞，示例页注释记录了这条踩坑史（`editor/index.vue:427-433`）。

::: warning 读源码读出来的两个坑

1. **`theme` prop 不生效**：声明在 `types.ts:119`、默认值在 `MarkdownEditor.vue:42`，但组件内部没有任何地方读它；深浅色实际由上面的 `--app-*` token 自动切换。传 `theme="dark"` 什么都不会发生。
2. **`imageUpload.onProgress` / `videoUpload.onProgress` 从不触发**：回调声明在 `types.ts:65`、`utils.ts:71`，但上传调用只透传 `file/server/fieldName/meta`（`MarkdownEditor.vue:305-310,328-333`），`uploadFile` 的实现根本没有消费 `onProgress`（`utils.ts:77-103`）。内置上传没有进度上报。

原先这里的第三条「`getMarkdown()` / `setMarkdown()` 其实是 HTML」已经修掉了：现在这两个方法走 `docToMarkdown` / `markdownToDoc` 的真往返（`MarkdownEditor.vue:557-562,580`），示例页「导出 Markdown」打到控制台的是 Markdown 源码。
:::

**工具栏默认按键**：`constants.ts:8-39` 的 `DEFAULT_TOOLBAR_KEYS`（headerSelect、粗斜体下划线删除线、颜色、字号字体行高、列表/待办、对齐、链接、uploadImage、uploadVideo、表格、代码块、undo/redo、fullScreen）。按键名的字典是 `types.ts:12-37`。

### 表单字段 `FMarkdown`：同一个编辑器的字段壳

`@antdv/form-ui` 的 componentMap 里 `MarkdownEditor: FMarkdown`（`packages/core/ui-kit/form-ui/src/config.ts`），`FMarkdown.vue` 是 `@antdv/common-ui` 那个编辑器的薄壳：`content-type="markdown"`，所以**字段值就是 Markdown 源码**，不再是 HTML；`rows` 只用来换算编辑区最小高度（`rows * 24`，下限 60）。渲染结果里没有 `textarea`，可编辑区是 `.tiptap`（`contenteditable`），预览态靠 `disabled`。字段级断言见 `form-ui/__tests__/fields.test.ts` 的 `describe('FMarkdown')`。

### 编辑器内置上传打到哪、mock 给什么

工具栏「上传图片 / 上传视频」走 `uploadFile`，默认地址 `/upload/file`（`packages/core/ui-kit/common-ui/src/components/markdown-editor/utils.ts:80`），经请求层拼上 `VITE_APP_BASE_API=/api`（`apps/web/.env.development:19`；前缀拼接在 `packages/request/src/fetcher.ts:162`，baseUrl 由 `apps/web/src/plugins/request-runtime.ts` 注入），即 **`POST /api/upload/file`**。mock 端由 catch-all 变体 handler 接住（`apps/backend-mock/server/api/upload/[variant].post.ts:13-23`），返回一张**内联 SVG data URL**（`server/utils/upload.ts:64-106`），不落盘、不存字节（设计说明见其头注释 `upload.ts:9-12`）。所以「上传成功」是示例自己装的假成功；组件侧只校验响应里有没有 `url`（`utils.ts:98-100`）。示例页自己在界面提示里也写明了这一点（`editor/index.vue:964-970`）。

## 文件上传：`/components/upload`

### 页面全景

九张卡片（`apps/web/src/views/components/upload/index.vue:697-1172`）：

| 卡片 | 实现 | 后端 |
| --- | --- | --- |
| 基础上传 | `:custom-request="uploadRequest('')"`，`:drag="true"` 拖拽**选文件**（`upload/index.vue:697-715`，拖拽开关在 `:705`） | mock 假成功 |
| 图片墙 | `uploadRequest('image')`（`:724`），jpg/png/gif、`maxCount: 8`（`imageUploadProps`，`:88-92`）、单张 <2MB（`handleImageBeforeUpload`，`:94-102`），卡片 `:717-746` | mock 假成功 |
| 头像上传（通用 Upload） | `uploadRequest('avatar')`（`:755`），图片、<5MB（`handleAvatarBeforeUpload` `:175-189`，`handleAvatarChange` `:191-203`），卡片 `:748-794` | mock 假成功 |
| 自定义上传按钮 | `uploadRequest('custom')` + `:drag="true"`（`:796-813`，请求在 `:800`、拖拽在 `:801`） | mock 假成功 |
| 上传状态展示 | 三条**写死的**文件记录演示 uploading/error/done（`statusFileList`，`:214-234`），`handleStatusChange` 是空函数（`:249`），卡片 `:815-845` | 无 |
| 上传前校验 | `handleValidateBeforeUpload` 白名单 + 10MB（`:253-278`），`uploadRequest('validate')`（卡片 `:847-865`，请求在 `:853`） | mock 假成功 |
| 手动上传 | `:auto-upload="false"`（`:874`）+ 实例 `upload()`（`handleManualUpload` 调 `manualUploadRef.value?.upload()`，`:293-310`，调用点 `:302`；方法来自 `packages/core/ui-kit/common-ui/src/components/upload/Upload.vue:279` 的 `defineExpose`），`uploadRequest('manual')`（`:873`），卡片 `:867-903` | mock 假成功 |
| 头像上传（自研） | `AvatarUploader` 组件，见下文（卡片 `upload/index.vue:905-942`，组件挂 `:914-920`） | multipart 打 `POST /upload/avatar`，见下文 |
| 大文件上传 | `useChunkUpload` 本地队列，见下文（卡片 `upload/index.vue:944-1172`） | **不发任何请求** |

::: warning

上传进度与失败从哪来前七张卡片原先直连 `action="/api/upload"` —— 那是 antd `a-upload` 自带的 XHR，进度来自浏览器 progress 事件，「失败」= HTTP 非 2xx，而且**绕开项目的 request 封装**（不带 token/租户头）。现在统一换成 `customRequest`（`uploadRequest`，`upload/index.vue:45-72`），把请求交回 `http`（ofetch → fetch）。换掉有两个理由：`/api` 只是 dev 前缀（`VITE_APP_BASE_API` 仅写在 `.env.development:19`，生产构建里它是空串，请求会打到并不存在的 `/api/upload`）；而包内的浏览器 mock 劫持的是 `globalThis.fetch`，XHR 从它旁边绕过去，静态部署下点一次上传就是一次 404。

代价是进度不再真实：`uploadRequest` 只在应答回来时补一次 `onProgress({ percent: 100 })`（`upload/index.vue:63-64`），所以是 0 → 100 一跳；「失败」也变成请求被拒绝（拦截器抛错，`:69-71`），而不是非 2xx 状态码。

「成功」仍然全部来自 mock：dev 由 Nitro 的 `server/api/upload.post.ts`、`upload/[variant].post.ts` 应答，生产由 `apps/web/src/mock/dynamic.ts` 现造同构信封（`/upload` 与 `/upload/:variant` 在 fixtures 里是缺席的 —— multipart 抓不了，而且返回值要求每次唯一）。两边的 `data.url` 都是内联 SVG data URL（`server/utils/upload.ts:64-106`）——图片墙、头像能显示大图，但那是占位图，不是你的文件。
:::

图片墙的预览地址按 `thumbUrl → url → response.data.url → response.url` 顺序解析（`upload/index.vue:113-120`，注释 106-112 解释了为什么只读 `response.url` 会「点了没反应」）；点击缩略图必须 `preventDefault` 吃掉 antd 渲染的 `<a target="_blank">`（`upload/index.vue:126-132`）。

::: tip

没有拖拽排序文件上传菜单里**不再有拖拽排序**演示（本次改造已删除；mock 注释 `upload/[variant].post.ts:7` 残留的 `drag-sort` 变体名只是历史痕迹，页面没有对应入口）。上面的 `:drag="true"` 是「拖拽文件到区域」，与列表项重排无关。
:::

### 大文件上传：本地切片调度，不发请求

最后一张卡片用的是 `@antdv/hooks` 的 `useChunkUpload`（`upload/index.vue:12,435-438`，源码在 `packages/core/hooks/src/use-chunk-upload.ts`，从 `src/index.ts:19` 出口）。这个 composable 的职责边界写在它自己的头注释里：**只做「切片 + 并发 + 进度 + 暂停/恢复/取消」，不关心后端接口**（`use-chunk-upload.ts:52-58`）。示例没给它 `createWorker` / `workerUrl`，于是走「主线程模式」：每个分片读进内存就算完成，**不算哈希、不发任何请求**（`use-chunk-upload.ts:66-69,283-287`）。进度 = 完成分片数 ÷ 总分片数（`use-chunk-upload.ts:335-338`），「已完成」状态是纯本地结论。队列按文件串行推进（`upload/index.vue:485-514`），暂停/恢复/取消透传给各自的 uploader 实例（`use-chunk-upload.ts:187-226`）。文件预览（图片/PDF/docx/excel）全部基于本地 `URL.createObjectURL` / `FileReader`（`upload/index.vue:653-680`），与上传无关。

### 真正的分片/秒传封装在仓库里，但这个页面没有演示它

`apps/web/src/components/common/Upload/` 才是完整链路：`ChunkUpload.vue` + `composables/useChunkUploader.ts` + `api.ts`。流程为 计算哈希 → `POST /upload/check` 秒传检查（命中直接成功，`useChunkUploader.ts:239-256`）→ `GET /upload/check` 查已传分片（断点续传，`:260-280`）→ 并发传 `POST /upload/chunk`（带重试，`useChunkUploader.ts:137-150`；并发调度 `:300-309`）→ `POST /upload/merge` → 未完成则 `GET /upload/merge/status` 轮询（`:329-404`）。endpoint 定义见 `Upload/api.ts:34-154`。

但要知道三件事：

1. **`ChunkUpload` / `Upload` 包装器没有任何示例页引用**——只有 unplugin 自动注册记录（`apps/web/types/components.d.ts` 的 `ChunkUpload` / `Upload` 条目），九张卡片里没有一个用它们。想用它得自己引。
2. **mock 只演了 POST 成功**：`server/api` 下上传相关只有 `upload.post.ts` 与 `upload/[variant].post.ts` 两个 handler（都是 POST）。`POST /upload/check|chunk|merge|delete|file` 会被单段变体路由 `/upload/:variant`（`upload/[variant].post.ts:21`）接住并返回同一个假成功信封；**GET 的 `/upload/check`、`/upload/merge/status` 没有任何 handler**。
3. **对不上契约**：变体 handler 返回的 `data` 里没有秒传所需的 `hit` 字段（对照 `api.ts:25-27` 与 `useChunkUploader.ts:244`），也没有合并所需的 `taskId`/`status`（对照 `api.ts:20-23`）——即便把 `ChunkUpload` 挂起来对着 mock 跑，秒传永远不命中、断点续传的 GET 检查直接失败、合并轮询拿不到状态。真实分片/秒传需要真后端，示例环境给不了这条链路跑通的证据。

### 自研 `AvatarUploader`：链路在 mock 上是通的

组件本体 `apps/web/src/components/common/AvatarUploader.vue`（186 行）：props `modelValue / maxSizeMb(5) / outputSize(256) / round(true) / size(80)`（接口 `:15-21`、默认值 `:23-29`），事件 `update:modelValue` / `uploaded`（`:31-34`）。流程是 `useFileDialog` 选文件（`:72-82`，取代 antd 的 Upload）→ 格式与体积校验（`:52-60`）→ `useFileReader` 读成 DataURL（`:41,63-69`，composable 在 `packages/core/hooks/src/use-file-reader.ts`）→ `BasicModal` 里 vue-cropper 1:1 裁剪（`:150-184`）→ `getCropBlob` 出 PNG（`:88-93`）→ `http.Post('/upload/avatar', formData)` 上传，拿到 url 后回抛（`:101-112`）。

::: info 三处要按代码说

- **它不走 `~/api/system` 的 `uploadFile`，而且是故意的**：源码注释写了理由——那个接口是文件管理页的**元数据登记**（入参 `Record<string, unknown>` 在 `api/system.ts:146`，mock 只把元数据推进内存表 `server/api/system/file/upload.post.ts:19-38`，返回的 `FileRecord` 里根本没有 `url` 字段，`server/utils/db/file.ts:19-34`），拿它传头像永远回填不了地址（`AvatarUploader.vue:98-100`）。请求层只对普通对象做 `JSON.stringify`，FormData 原样透传（`packages/request/src/executor.ts:147-150,164-168`），所以二进制能正常发出去。
- **`/upload/avatar` 由变体路由接住**：`server/api/upload/[variant].post.ts:13-23`（`path: '/upload/:variant'` 在 `:21`），返回的信封里 `data.url` 是一张内联 SVG data URL（`server/utils/upload.ts:94-106` 的 `buildUploadResult`、`:64-79` 的 `previewDataUrl`，`:9-12` 解释了为什么不落盘）。组件要求 `res.data.url`，缺了就抛「上传接口未返回 url」（`AvatarUploader.vue:108-109`），失败时手动复位确认按钮的 loading（`:119-120`）。
- **`outputSize` 只影响文案**：裁剪器固定 `:output-size="1"`（`AvatarUploader.vue:175`），props 的 256 只出现在提示文字里（`:180`）；示例页另存了一个同值常量 `inhouseAvatarOutputSize = 256`（`upload/index.vue:327-328`）。「输出 256×256」是展示口径，实际输出尺寸是选区的 1 倍。
:::

页面上仍然值得点的部分：圆形头像框、裁剪弹窗、拖拽缩放选区（vue-cropper 本身可用）；头像卡片从选图到回填整条链路在 mock 上跑通，回填与重置逻辑在 `upload/index.vue:342-349`。

## 在线示例

- **`http://localhost:6080/#/components/editor`** — 侧栏「组件示例 → 编辑器」。默认在 Markdown Tab：点工具栏按钮插入语法、右侧实时预览，试一下 `marked` / `markdown-it` 引擎切换与「复制HTML」。切「富文本编辑」Tab：用模式分段器换 `编辑/分屏/预览`，点「插入文本/HTML/图片」「撤销/重做」「导出 Markdown」（结果在控制台，`editor/index.vue:446-480,931-958,964-970`）；工具栏「上传图片/上传视频」才会真发请求并拿到占位 SVG。顶部共用开关作用于两个 Tab。
- **`http://localhost:6080/#/components/upload`** — 侧栏「文件上传」。图片墙选一张 jpg 看上传后点开大图的受控预览；上传前校验卡片试试超限与非白名单格式；手动上传卡片先选文件再点「开始上传」；大文件卡片选一个上百 MB 的文件观察进度与暂停/恢复（**断网也能「传完」**，因为它根本不发请求，这正是理解本页口径的最快方法）；「头像上传（自研）」卡片从选图、裁剪到回填 url 整条链路在 mock 上能跑通（上传打到 `POST /upload/avatar`，拿回来的是一张内联 SVG 占位图）。

## 相关页面

- [组件示例总览](/components/)
- [表格](/components/table)
- [表单](/components/form)
- [请求](/guide/essentials/request) —— 上传链路里的 `/api` 前缀、超时与拦截器
- [Mock](/guide/essentials/mock) —— 假成功信封与变体 handler 的由来
