# 编辑器与文件上传

本页讲两个示例路由：`/components/editor`（编辑器）与 `/components/upload`（文件上传）。

::: tip 先记住三件事

1. **编辑器页的两个 Tab 是两套实现**，不是同一个组件的两种模式：Markdown Tab 是示例页手写的 `textarea` + 渲染器，富文本 Tab 才是组件库的 `MarkdownEditor`（tiptap）。
2. **所有"上传成功"都是 mock 假成功**。返回的内联 SVG data URL 是占位图，不是你选的文件；不落盘、不存字节。
3. **大文件卡片不发任何请求**，进度是本地切片算出来的。真实分片 / 秒传需要真后端。

:::

---

## 编辑器：`/components/editor`

### 两个 Tab 的分工

旧的两个示例页（`editor/markdown`、`editor/rich-text`）已合并为单页双 Tab。

| Tab | 内核 | 产出 |
| --- | --- | --- |
| Markdown 编辑 | 示例页手写的 `textarea` + `marked` / `markdown-it` + `highlight.js`，**不是组件**，没有对外 API | Markdown 源码字符串 |
| 富文本编辑 | 组件库 `MarkdownEditor`（tiptap） | 由 `contentType` 决定：默认 HTML，`'markdown'` 时是 Markdown 源码 |

::: warning 富文本侧没有 wangEditor

`MarkdownEditor` 是当年 `@wangeditor/editor` 的 tiptap 替代实现：工具栏按键名、待办 / 视频节点按 wangEditor 存量格式对齐，但 wangEditor 自身的菜单体系等能力不存在。应用侧已不声明 `@tiptap/*`，也从未安装过 `@wangeditor/*`。**不要把旧文档里的 wangEditor 配置往这上面套。**

:::

### Markdown Tab 提供了什么

- 渲染引擎可切换 `marked` / `markdown-it`，纯前端渲染、**不发请求**；预览区经 `v-safe-html` 注入。
- 工具栏是本页手写的按钮组，往 textarea 里**插入 Markdown 语法**（粗斜体、标题、引用、列表、代码块、表格、链接 / 图片等），不是富文本操作。
- 顶部「只读 / 禁用 / 字数统计」开关同时作用于两个 Tab；「取值 / 赋值」只改页面状态。

### 富文本 Tab：`MarkdownEditor` API

**定位**：能直接吃 wangEditor 存量 HTML 的所见即所得编辑器，产出 HTML 字符串，支持编辑 / 分屏 / 预览三种模式与图片、视频插入。

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `value` | `''` | 内容，配合 `v-model:value`；语义由 `contentType` 决定 |
| `contentType` | `'html'` | `'html'` \| `'markdown'`；写入经 `toEditorContent()` 解析，抛出经 `modelFromEditor()` 序列化 |
| `mode` | `'edit'` | `edit` / `split` / `preview`；`preview` 视为锁定并隐藏工具栏 |
| `minHeight` / `maxHeight` / `height` | `160` / `500` / 未设 | 数字按 px |
| `readonly` / `disabled` | `false` | 与 `mode === 'preview'` 合成 `isLocked` |
| `showToolbar` / `toolbarConfig` | `true` / 未设 | 配置 `toolbarKeys` 后 `excludeKeys` 失效 |
| `imageUpload` / `videoUpload` | 见下 | 图片默认 ≤5MB、视频默认 ≤100MB |
| `maxLength` / `showCount` / `autoFocus` / `compact` / `placeholder` | — | `maxLength` 在输入 / 粘贴 / 拖入时拦截并抛 `maxLength` 事件 |
| `theme` | `'light'` | ⚠️ **静默空操作**，见下方缺陷清单 |

**事件**：`update:value`、`change(html, text)`、`focus` / `blur`、`uploadSuccess` / `uploadError`、`maxLength`、`created`、`destroyed`。

**实例方法**：`getEditor`、`getHtml` / `getHTML`、`getMarkdown`、`getText`、`setHtml` / `setHTML`、`setMarkdown`、`clear`、`focus` / `blur`、`undo` / `redo`、`insertText` / `insertHtml` / `insertMarkdown`、`insertImage` / `insertVideo`、`selectAll`、`getStats`。示例页把大部分做成了按钮。

::: info Markdown ↔ 文档的往返

`docToMarkdown(JSONContent)` 把 ProseMirror 文档序列化成 Markdown，`markdownToDoc(markdown)` 用 `marked` 的 lexer 反解回文档；`case 'html'` 分支保证喂 HTML 也解得开。没用 `@tiptap/markdown` 是因为本编辑器有自定义 `todo` 节点和块级 `text-align`，官方序列化器覆盖不了。

:::

**配色全走 design token**：外框 / 工具栏分隔线 / 表格线用 `border-border`，面板 `bg-card`、弹层 `bg-popover`、代码与表头 `bg-muted`、正文 `text-card-foreground`、选中态 `text-primary`。组件里没有硬编码灰阶，也没有 `.dark` 分支，切主题时由 design token 接管，14 套预设主题的边框 / 底色都会跟着变。

::: tip 初值请用 `value` prop

内容变化时抛 `update:value`；外部回传等价内容会被 200ms「回声屏蔽期」跳过以免光标跳文首，但真正的外部改写按文本比对后仍会落地。**挂载后再调 `setHtml()` 可能落在屏蔽期里被吞掉。**

:::

::: warning 读源码读出来的两个坑

1. **`theme` prop 不生效** —— 组件内部没有任何地方读它；深浅色实际由 `--*` token 自动切换，传 `theme="dark"` 什么都不会发生。
2. **`imageUpload.onProgress` / `videoUpload.onProgress` 从不触发** —— 上传调用只透传 `file/server/fieldName/meta`，`uploadFile` 没消费 `onProgress`，内置上传没有进度上报。

> 原先的第三条「`getMarkdown()` / `setMarkdown()` 其实是 HTML」已修复：现在走 `docToMarkdown` / `markdownToDoc` 的真往返。

:::

### 表单字段 `FMarkdown`

`@antdv/form-ui` 的 componentMap 里 `MarkdownEditor: FMarkdown`。`FMarkdown.vue` 是薄壳，固定 `content-type="markdown"`，所以**字段值就是 Markdown 源码**；`rows` 只换算编辑区最小高度。渲染结果里没有 `textarea`，可编辑区是 `.tiptap`（`contenteditable`）。

### 编辑器内置上传打到哪

工具栏「上传图片 / 上传视频」走 `uploadFile`，默认地址 `/upload/file`，经请求层拼上 `VITE_APP_BASE_API=/api`，实际请求 **`POST /api/upload/file`**。mock 端由 catch-all 变体 handler 接住，返回内联 SVG data URL；组件侧只校验响应里有没有 `url`。

---

## 文件上传：`/components/upload`

### 九张卡片

| 卡片 | 实现 | 后端 |
| --- | --- | --- |
| 基础上传 | `uploadRequest('')` + `:drag="true"` | mock 假成功 |
| 图片墙 | `uploadRequest('image')`，jpg/png/gif、`maxCount: 8`、单张 <2MB | mock 假成功 |
| 头像上传（通用 Upload） | `uploadRequest('avatar')`，图片、<5MB | mock 假成功 |
| 自定义上传按钮 | `uploadRequest('custom')` + `:drag="true"` | mock 假成功 |
| 上传状态展示 | 三条**写死的**文件记录演示 uploading/error/done | 无 |
| 上传前校验 | 白名单 + 10MB，`uploadRequest('validate')` | mock 假成功 |
| 手动上传 | `:auto-upload="false"` + 实例 `upload()`，`uploadRequest('manual')` | mock 假成功 |
| 头像上传（自研） | `AvatarUploader` 组件，见下文 | multipart `POST /upload/avatar` |
| 大文件上传 | `useChunkUpload` 本地队列，见下文 | **不发任何请求** |

::: warning 进度与失败从哪来

前七张卡片原先直连 `action="/api/upload"`（antd `a-upload` 自带的 XHR），进度来自浏览器 progress 事件，且**绕开项目 request 封装**（不带 token / 租户头）。现在统一换成 `customRequest` → `http`（ofetch → fetch），原因有两个：

- `/api` 只是 dev 前缀，生产构建里为空串，请求会打到不存在的 `/api/upload`；
- 包内浏览器 mock 劫持的是 `globalThis.fetch`，XHR 会绕过它，静态部署下点一次上传就是一次 404。

**代价**：`uploadRequest` 只在应答回来时补一次 `onProgress({ percent: 100 })`，进度是 0 → 100 一跳；「失败」变成请求被拦截器拒绝，而非非 2xx 状态码。

:::

「成功」仍全部来自 mock：dev 由 Nitro handler 应答，生产由 `apps/web/src/mock/dynamic.ts` 现造同构信封（`/upload` 与 `/upload/:variant` 故意不在 fixtures 里——multipart 抓不了，且返回值要求每次唯一）。两边 `data.url` 都是内联 SVG data URL。

::: tip 图片墙预览与拖拽排序

预览地址按 `thumbUrl → url → response.data.url → response.url` 顺序解析；点缩略图必须 `preventDefault` 吃掉 antd 渲染的 `<a target="_blank">`。

**文件上传菜单里已不再有拖拽排序演示**（本次改造删除）。表格里的 `:drag="true"` 指「拖拽文件到区域」，与列表项重排无关。

:::

### 大文件上传：本地切片调度

最后一张卡片用 `@antdv/hooks` 的 `useChunkUpload`。它的职责边界是**切片 + 并发 + 进度 + 暂停 / 恢复 / 取消，不关心后端接口**。示例没传 `createWorker` / `workerUrl`，走主线程模式：每个分片读进内存就算完成，**不算哈希、不发请求**。进度 = 完成分片数 ÷ 总分片数，「已完成」是纯本地结论。表内预览基于本地 `URL.createObjectURL` / `FileReader`，与上传无关。

### 完整的分片 / 秒传链路（仓库里有，页面没演示）

`common-ui/src/components/chunk-upload/` 才是完整实现：`ChunkUpload.vue` + `useChunkUploader.ts` + `api.ts`。流程是 计算哈希 → `POST /upload/check` 秒传检查 → `GET /upload/check` 查已传分片 → 并发 `POST /upload/chunk`（带重试）→ `POST /upload/merge` → `GET /upload/merge/status` 轮询。

::: danger 别指望它在 mock 上跑通

1. `ChunkUpload` / `Upload` 包装器**没有任何示例页引用**，九张卡片一个都没用；想用得自己引。
2. mock 只有两个 POST handler，`GET /upload/check`、`GET /upload/merge/status` **没有 handler**。
3. 变体 handler 返回的 `data` 里没有秒传所需的 `hit`、合并所需的 `taskId` / `status`——即便挂起来，秒传永不命中、断点续传直接失败、合并轮询拿不到状态。

真实分片 / 秒传需要真后端，示例环境给不了这条链路跑通的证据。

:::

### 自研 `AvatarUploader`

props：`modelValue` / `maxSizeMb(5)` / `outputSize(256)` / `round(true)` / `size(80)`；事件：`update:modelValue` / `uploaded`。

流程：`useFileDialog` 选文件 → 格式与体积校验 → `useFileReader` 读成 DataURL → `BasicModal` 里 vue-cropper 1:1 裁剪 → 出 PNG → `http.Post('/upload/avatar', formData)` → 拿到 url 回抛。

::: info 三处要按代码说

- **故意不走 `~/api/system` 的 `uploadFile`**：那个接口是文件管理页的元数据登记，返回的 `FileRecord` 里没有 `url` 字段，拿它传头像永远回填不了地址。请求层只对普通对象 `JSON.stringify`，FormData 原样透传，所以二进制能正常发出。
- **`/upload/avatar` 由变体路由接住**：返回信封里 `data.url` 是内联 SVG data URL；组件要求 `res.data.url`，缺了就抛「上传接口未返回 url」。
- **`outputSize` 只影响文案**：裁剪器固定 `:output-size="1"`，props 的 256 只出现在提示文字里；「输出 256×256」是展示口径，实际输出是选区的 1 倍。

:::

---

## 在线示例

| 地址 | 值得试什么 |
| --- | --- |
| `http://localhost:6080/#/components/editor` | Markdown Tab 插语法、切 `marked` / `markdown-it` 引擎、复制 HTML；富文本 Tab 换「编辑 / 分屏 / 预览」、插入文本 / HTML / 图片、撤销重做、导出 Markdown（结果在控制台） |
| `http://localhost:6080/#/components/upload` | 图片墙选 jpg 看大图预览；校验卡片试超限与非白名单；手动上传先选文件再点「开始上传」；大文件卡片**断网也能传完**；自研头像卡片从选图、裁剪到回填整条链路可跑通 |

## 相关页面

- [组件示例总览](/components/)
- [表格](/components/table) · [表单](/components/form)
- [请求](/guide/essentials/request) —— `/api` 前缀、超时与拦截器
- [Mock](/guide/essentials/mock) —— 假成功信封与变体 handler 的由来

---

<details>
<summary>源码索引（按文件 / 行号查实现细节）</summary>

| 主题 | 位置 |
| --- | --- |
| 编辑器示例页 | `apps/web/src/views/components/editor/index.vue`（Tab 定义 `:34`, 工具栏 `:214-415`, 实例方法按钮 `:929-963`） |
| `MarkdownEditor` | `packages/core/ui-kit/common-ui/src/components/markdown-editor/`（`MarkdownEditor.vue`, `types.ts`, `markdown.ts`, `utils.ts`, `constants.ts`, `extensions/`） |
| 上传示例页 | `apps/web/src/views/components/upload/index.vue`（`uploadRequest` `:45-72`, 九张卡片 `:697-1172`, 预览解析 `:113-132`） |
| 通用 `Upload` / `UploadDragger` | `packages/core/ui-kit/common-ui/src/components/upload/` |
| `AvatarUploader` | `packages/core/ui-kit/common-ui/src/components/avatar-uploader/AvatarUploader.vue` |
| `ChunkUpload` | `packages/core/ui-kit/common-ui/src/components/chunk-upload/` |
| `useChunkUpload` | `packages/core/hooks/src/use-chunk-upload.ts` |
| mock handler | `apps/backend-mock/server/api/upload.post.ts`、`upload/[variant].post.ts`、`server/utils/upload.ts` |
| 生产 mock 信封 | `apps/web/src/mock/dynamic.ts` |
| 菜单节点 | `apps/backend-mock/server/api/menus.get.ts` |

</details>
