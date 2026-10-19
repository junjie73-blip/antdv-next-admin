# Editor and File Upload

This page documents two demo routes: `/components/editor` (menu "编辑器" / Editor, `apps/backend-mock/server/api/menus.get.ts:287-292`) and `/components/upload` (menu "文件上传" / File Upload, `menus.get.ts:293-298`).

## Editor: `/components/editor`

### Markdown and rich text are now one menu

The old `editor/markdown` and `editor/rich-text` demo pages were deleted; there is a single `/components/editor` with two tabs (`apps/web/src/views/components/editor/index.vue:44`). **The two tabs are not two modes of one wrapper** — the file's own header comment says so (`editor/index.vue:26-30`):

| Tab | Engine | Output |
| --- | --- | --- |
| Markdown 编辑 (Markdown editing) | A hand-rolled `textarea` + `marked` / `markdown-it` + `highlight.js` inside the demo page (`editor/index.vue:60-82`); it is **not a component** and exposes no API | Markdown source string |
| 富文本编辑 (Rich-text editing) | The component-library `MarkdownEditor` (tiptap, `packages/core/ui-kit/common-ui/src/components/markdown-editor/MarkdownEditor.vue`) | Decided by `contentType`: HTML by default, Markdown source when `'markdown'` |

::: warning There is no wangEditor on the rich-text side `MarkdownEditor` is the tiptap replacement written for the former `@wangeditor/editor`, with toolbar key names and todo/video nodes aligned to wangEditor's legacy format (`editor/index.vue:35-40`; extension assembly at `markdown-editor/extensions/index.ts:31-58`). Its dependencies live in `packages/core/ui-kit/common-ui/package.json:29-37` (9 `@tiptap/*` entries plus `marked`); `apps/web/package.json` no longer declares `@tiptap/*`, and **`@wangeditor/*` was never installed**. So "rich text" today means the tiptap-based `MarkdownEditor`; whatever wangEditor-only capabilities old docs describe are simply gone, and wangEditor configuration does not transfer to this component. :::

### What the Markdown tab actually provides

- The renderer toggles between `marked` and `markdown-it` (`editor/index.vue:84`), fully client-side, no requests (the UI says so at `editor/index.vue:757-759`); the preview is injected through `v-safe-html` (`editor/index.vue:834`).
- The toolbar is hand-written in the demo page and **inserts Markdown syntax into the textarea** rather than applying rich-text formatting (`editor/index.vue:204-405`): bold/italic/strikethrough/inline code, H1–H3, quote/lists/task lists, code block/table, link/image/divider.
- The shared 只读 / 禁用 / 字数统计 (readonly / disabled / word count) switches act on both tabs (`editor/index.vue:50-52,201-202`); "取值" (get value) reads a local ref or `getHtml()`, "赋值" (set value) writes the ref or calls `setHtml()` — everything stays in page state (`editor/index.vue:477-511`).

### Rich-text tab: the real API of `MarkdownEditor`

**What problem it solves**: a WYSIWYG editor that keeps reading and writing wangEditor-era HTML, with edit/split/preview modes and image/video insertion.

**Props** (types at `markdown-editor/types.ts:113-137`, defaults at `MarkdownEditor.vue:36-52`):

| Field | Default | Notes |
| --- | --- | --- |
| `value` | `''` | The content, used with `v-model:value`; its meaning is decided by `contentType` |
| `contentType` | `'html'` | `'html'` \| `'markdown'` (`types.ts:136`). Both directions go through a conversion: the incoming model is parsed by `toEditorContent()` and the outgoing value is serialized by `modelFromEditor()` (`MarkdownEditor.vue:96-105`) |
| `mode` | `'edit'` | `edit` / `split` / `preview` (`types.ts:3`); `preview` counts as locked and hides the toolbar (`MarkdownEditor.vue:429-431,626`) |
| `minHeight` / `maxHeight` / `height` | `160` / `500` / unset | Numbers become px (defaults at `MarkdownEditor.vue:38-40`) |
| `readonly` / `disabled` | `false` | Combined with `mode==='preview'` into `isLocked` (`MarkdownEditor.vue:429-431`) |
| `showToolbar` / `toolbarConfig` | `true` / unset | Setting `toolbarKeys` makes `excludeKeys` ignored (`MarkdownEditor.vue:416-423`, same semantics as wangEditor) |
| `imageUpload` / `videoUpload` | see below | `types.ts:71-108`; defaults: images ≤ 5 MB, videos ≤ 100 MB (`types.ts:78-79,99-100`, editor-side config at `MarkdownEditor.vue:259,265`) |
| `maxLength` / `showCount` / `autoFocus` / `compact` / `placeholder` | — | `maxLength` blocks typing/paste/drop (`MarkdownEditor.vue:434-441`) and emits the `maxLength` event |
| `theme` | `'light'` | ⚠️ **silent no-op**, see the defect list below |

**Events** (`types.ts:147-157`): `update:value`, `change(html, text)`, `focus` / `blur`, `uploadSuccess` / `uploadError`, `maxLength`, `created`, `destroyed`.

**Instance methods** (`MarkdownEditor.vue:552-600`, exposed at `:600`): `getEditor` / `getHtml` / `getHTML` / `getMarkdown` / `getText` / `setHtml` / `setHTML` / `setMarkdown` / `clear` / `focus` / `blur` / `undo` / `redo` / `insertText` / `insertHtml` / `insertMarkdown` / `insertImage` / `insertVideo` / `selectAll` / `getStats`. The demo page wires most of them into buttons (`editor/index.vue:882-923`).

**The Markdown ↔ document round-trip lives in `markdown.ts`**: `docToMarkdown(JSONContent)` (`markdown.ts:588`) serializes a ProseMirror document into Markdown source, `markdownToDoc(markdown)` (`markdown.ts:593`) parses it back with the `marked` lexer — including a `case 'html'` branch, so feeding HTML still works (which is why `contentType="html"` callers are unaffected). The header comment of `markdown.ts` records why `@tiptap/markdown` was not used instead: this editor has a custom `todo` node and block-level `text-align`, neither of which the official markdown serializer covers.

**Colours come entirely from design tokens**: the outer frame, toolbar divider and table rules use `border-border` (i.e. `--app-border`, `#f0f0f0` in light), the shell uses `bg-card`, dropdown panels `bg-popover`, code and table headers `bg-muted`, body text `text-card-foreground`, active toolbar keys `text-primary` (MarkdownEditor.vue:606-621, content styles `:697-855`). There is **no** hard-coded `gray-*` palette and no `.dark` branch left in the component — the variables in `packages/core/base/design/src/token/{default,dark}.css` take over, so all eight theme presets move the editor's borders and surfaces with them. Measured: outer border `rgb(240,240,240)` in light and `rgba(255,255,255,.12)` in dark; panel `#fff` / `#1f1f1f`.

**v-model behaviour**: content changes emit `update:value` (`MarkdownEditor.vue:167`); an equivalent value sent back from the parent is skipped during a 200 ms "echo suppression" window so the caret doesn't jump, while genuine external rewrites still land via a text-equality check (`MarkdownEditor.vue:141-150,487-521`). **Pass the initial value through the `value` prop instead of calling `setHtml()` after mount** — the latter can fall inside the suppression window; the demo comment records exactly this bug history (`editor/index.vue:417-424`).

::: warning Two pitfalls read straight from the source

1. **The `theme` prop does nothing**: declared at `types.ts:119`, defaulted at `MarkdownEditor.vue:42`, but no code inside the component ever reads it — light/dark styling is handled by the `--app-*` tokens above. Passing `theme="dark"` changes nothing.
2. **`imageUpload.onProgress` / `videoUpload.onProgress` never fire**: declared at `types.ts:65` and `utils.ts:71`, but the upload call only forwards `file/server/fieldName/meta` (`MarkdownEditor.vue:305-310,328-333`) and `uploadFile` never consumes `onProgress` (`utils.ts:77-103`). The built-in upload has no progress reporting.

The third item that used to sit here — "`getMarkdown()` / `setMarkdown()` are HTML" — is fixed: those two methods now run the real `docToMarkdown` / `markdownToDoc` round-trip (`MarkdownEditor.vue:557-562,580`), and the demo's "导出 Markdown" button logs Markdown source. :::

**Default toolbar keys**: `DEFAULT_TOOLBAR_KEYS` at `constants.ts:8-39` (headerSelect, bold/italic/underline/strike, colors, font size/family/line height, lists/todo, alignment, link, uploadImage, uploadVideo, table, codeBlock, undo/redo, fullScreen). The key vocabulary is `types.ts:12-37`.

### The `FMarkdown` form field: the same editor behind a field shell

`@antdv/form-ui`'s componentMap registers `MarkdownEditor: FMarkdown` (`packages/core/ui-kit/form-ui/src/config.ts`), and `FMarkdown.vue` is a thin shell over the `@antdv/common-ui` editor: it sets `content-type="markdown"`, so **the field value is Markdown source** rather than HTML; `rows` only converts into the editing surface's minimum height (`rows * 24`, floor 60). There is no `textarea` in the output — the editable area is `.tiptap` (`contenteditable`), and the readonly preview uses `disabled`. Field-level assertions are in `form-ui/__tests__/fields.test.ts` under `describe('FMarkdown')`.

### Where the editor's built-in upload goes, and what the mock returns

The toolbar's image/video buttons call `uploadFile`, whose default endpoint is `/upload/file` (`packages/core/ui-kit/common-ui/src/components/markdown-editor/utils.ts:80`); the request layer prepends `VITE_APP_BASE_API=/api` (`apps/web/.env.development:19`; concatenation at `packages/request/src/fetcher.ts:162`; `baseUrl` is injected by `apps/web/src/plugins/request-runtime.ts`), i.e. **`POST /api/upload/file`**. On the mock side the catch-all variant handler answers (`apps/backend-mock/server/api/upload/[variant].post.ts:13-23`) with an **inline SVG data URL** (`server/utils/upload.ts:64-106`), storing nothing — the file's header comment says the mock only acts out "what success looks like" (`upload.ts:9-12`). So the "upload success" here is a fake the demo installs itself; the component only checks that the response carries a `url` (`utils.ts:98-100`). The demo page states the same in its UI hint (`editor/index.vue:917-922`).

## File upload: `/components/upload`

### Page inventory

Nine cards (`apps/web/src/views/components/upload/index.vue:650-1111`):

| Card | Implementation | Backend |
| --- | --- | --- |
| 基础上传 (basic) | `:custom-request="uploadRequest('')"`; `:drag` means drag-**to-select** files (`upload/index.vue:651-675`) | mock fake success |
| 图片墙 (image wall) | `uploadRequest('image')`, jpg/png/gif, `maxCount: 8`, < 2 MB per image (`upload/index.vue:60-83,676-702`) | mock fake success |
| 头像上传 (avatar, antd) | `uploadRequest('avatar')`, images, < 5 MB (`upload/index.vue:121-161,703-746`) | mock fake success |
| 自定义上传按钮 (custom trigger) | `uploadRequest('custom')` (`upload/index.vue:747-762`) | mock fake success |
| 上传状态展示 (statuses) | Three **hard-coded** file records demonstrating uploading/error/done (`upload/index.vue:190-223`); `handleStatusChange` is an empty function (`upload/index.vue:225-228`) | none |
| 上传前校验 (validation) | `beforeUpload` allow-list + 10 MB cap (`upload/index.vue:231-256`), `uploadRequest('validate')` (`upload/index.vue:795-814`) | mock fake success |
| 手动上传 (manual) | `:auto-upload="false"` plus instance `submit()` (`upload/index.vue:264-292,815-849`), `uploadRequest('manual')` | mock fake success |
| 头像上传（自研） (in-house avatar) | The `AvatarUploader` component — see below (`upload/index.vue:850-888`) | claims `/system/file/upload`; see defects |
| 大文件上传 (large files) | `useChunkUpload`, local queue — see below (`upload/index.vue:889-1111`) | **sends no requests at all** |

::: warning Where progress and failure come from The first seven cards used to point straight at `action="/api/upload"` — that is antd `a-upload`'s own XHR: progress came from browser progress events, "failure" meant a non-2xx status, and it **bypassed the project's request wrapper** (no token or tenant headers). They now all go through `customRequest` (`upload/index.vue:14-51`), which hands the file back to `http` (ofetch → fetch). Two reasons: `/api` is a dev-only prefix (`VITE_APP_BASE_API` exists solely in `.env.development:19`, so a production build would request `/api/upload`, which is nothing); and the in-package browser mock hijacks `globalThis.fetch` — XHR walks right past it, so on a static deployment every upload was a real 404.

The price is that progress is no longer real: `uploadRequest` fires `onProgress(100)` once when the reply arrives, so the bar jumps 0 → 100, and "failure" now means the request was rejected (an interceptor throw) rather than a non-2xx code.

"Success" is still entirely mock-supplied: in dev Nitro answers it (`server/api/upload.post.ts`, `upload/[variant].post.ts`), in production `apps/web/src/mock/dynamic.ts` builds an isomorphic envelope on the spot (`/upload` and `/upload/:variant` are deliberately absent from the fixtures — multipart cannot be captured, and the reply has to be unique per call). Both sides return `data.url` as an inline SVG data URL (`server/utils/upload.ts:64-106`) — the image wall and avatar do render a "large preview", but that is a placeholder picture, not your file. :::

The image wall resolves preview URLs in the order `thumbUrl → url → response.data.url → response.url` (`upload/index.vue:85-92`; the comment at 73-84 explains why reading only `response.url` made clicks look dead); clicking a thumbnail must `preventDefault` the `<a target="_blank">` antd renders (`upload/index.vue:94-115`), supported by `pointer-events` fixes on the card layers (`upload/index.vue:1100-1107`).

::: tip Drag-sorting is gone The file-upload menu **no longer includes drag sorting** (removed in this round of work; the `drag-sort` variant still listed in the mock comment `upload/[variant].post.ts:7` is a historical residue with no entry point on the page). The `:drag="true"` above is "drop files onto the area", unrelated to reordering a list. :::

### Large files: local chunk scheduling, no requests

The last card uses `@antdv/composables/useChunkUpload` (`upload/index.vue:7,356-359`; the source moved to `packages/core/hooks/src/use-chunk-upload.ts`). Its own header comment defines the boundary: **slicing + concurrency + progress + pause/resume/cancel only, no knowledge of any backend API** (`useChunkUpload.ts:52-58`). The demo passes no `createWorker` / `workerUrl`, so it runs in "main-thread mode": each chunk is read into memory and immediately counted as done — **no hashing, no network** (`useChunkUpload.ts:66-69,283-287`). Progress = chunks done ÷ chunks total (`useChunkUpload.ts:335-338`); "completed" is a purely local conclusion. The queue advances file by file (`upload/index.vue:406-435`), and pause/resume/cancel forward to each uploader instance (`useChunkUpload.ts:187-226`). The in-table previews (image/PDF/docx/excel) are all built on local `URL.createObjectURL` / `FileReader` (`upload/index.vue:569-596`) and have nothing to do with uploading.

### The real chunked / instant-upload wrapper exists in the repo — but this page does not demo it

`apps/web/src/components/common/Upload/` holds the full pipeline: `ChunkUpload.vue` + `composables/useChunkUploader.ts` + `api.ts`. The flow is: compute hash → `POST /upload/check` instant-upload probe (a hit finishes immediately, `useChunkUploader.ts:239-256`) → `GET /upload/check` for already-uploaded chunks (resume, `:260-280`) → concurrent `POST /upload/chunk` with retries (`useChunkUploader.ts:137-150`; the concurrency scheduling at `:300-309`) → `POST /upload/merge` → if not finished, poll `GET /upload/merge/status` (`:329-404`). Endpoint definitions: `Upload/api.ts:34-155`.

Three things to know before trusting that pipeline in this environment:

1. **No demo page references `ChunkUpload` or the `Upload` wrapper** — they exist only as entries in `apps/web/types/components.d.ts` (the auto-registration list); none of the nine cards uses them. Using them means wiring them into your own page.
2. **The mock only acts out POST success**: under `server/api` the only upload handlers are `upload.post.ts` and `upload/[variant].post.ts`, both POST. `POST /upload/check|chunk|merge|delete|file` all get swallowed by the single-segment route `/upload/:variant` (`upload/[variant].post.ts:21`) and receive the same fake success envelope; **the GETs `/upload/check` and `/upload/merge/status` have no handler at all**.
3. **The contracts do not line up**: the variant response's `data` lacks the `hit` field required for instant upload (compare `api.ts:25-27` with `useChunkUploader.ts:244`) and the `taskId`/`status` required for merging (compare `api.ts:20-23`). Even mounting `ChunkUpload` against the mock means: instant upload never hits, the GET resume check fails outright, and merge polling never learns a status. Real chunking/instant upload needs a real backend; the demo environment cannot show this chain working.

### In-house `AvatarUploader`: complete by design, two hard breaks in the demo chain

The component itself (`apps/web/src/components/common/AvatarUploader.vue`): props `modelValue / maxSizeMb(5) / outputSize(256) / round(true) / size(80)` (`:11-25`), events `update:modelValue` / `uploaded` (`:27-30`). Flow: `beforeUpload` cancels the automatic upload → `useFileReader` produces a DataURL (`:44-64`; the composable lives at `packages/core/hooks/src/use-file-reader.ts`) → a vue-cropper 1:1 modal → `getCropBlob` yields a PNG → `uploadFile` runs and the URL is emitted back (`:66-93`).

::: warning Defects as they are

- **The import is broken**: line 9 reads `import { uploadFile } from '~/api'`, but the entry of `~/api`, `apps/web/src/api/index.ts` (42 lines in total), only exports `login` / `logout` / `getUserInfo` — **it does not re-export `uploadFile`**, which is defined at `api/system.ts:146-148` (`POST /system/file/upload`). This is a missing named export; the demo comment claiming "`uploadFile` really exists in `~/api`" (`upload/index.vue:252-259`) does not match the source.
- **Even with the import fixed, the mock cannot return a url**: the `/system/file/upload` handler only registers metadata into an in-memory table (`server/api/system/file/upload.post.ts:14-42`), and the returned `FileRecord` type **has no `url` field** (`server/utils/db/file.ts:19-34`). The component needs `res.data.url || res.url` and otherwise reports "上传接口未返回 url" (upload response has no url) (`AvatarUploader.vue:81-82`).
- **`uploadFile`'s signature does not accept a File**: the parameter type is `Record<string, unknown>` (`api/system.ts:146`), and the request layer JSON-stringifies plain objects (`packages/request/src/executor.ts:148,167-168`). Avatar bytes never go out correctly.
- **`outputSize` only affects the label**: the cropper is hard-coded to `:output-size="1"` (`AvatarUploader.vue:148`); the prop's 256 appears only in the hint text (`:153`). "256×256 output" is wording, not the actual crop size. :::

What remains genuinely demoable on the card: the round avatar frame, the crop modal, and drag/zoom selection (vue-cropper itself works). Confirming the crop, though, should end in an error per the defects above.

## Live examples

- **`http://localhost:6080/#/components/editor`** — sidebar "组件示例 → Editor". Starts on the Markdown tab: click toolbar buttons to insert syntax and watch the right pane re-render; try switching `marked` / `markdown-it` and the "复制HTML" button. Switch to the rich-text tab: use the mode segmented control (`编辑/分屏/预览`), press 插入文本/HTML/图片 (insert text/HTML/image), 撤销/重做 (undo/redo), and 导出 Markdown (result lands in the console, `editor/index.vue:466-470,882-923`). Only the toolbar's image/video buttons issue a real request — and return a placeholder SVG. The shared switches on top act on both tabs.
- **`http://localhost:6080/#/components/upload`** — sidebar "File Upload". Pick a jpg in the image wall and open its controlled preview; on the validation card try an oversized or non-allow-listed file; on the manual card select files first, then press "开始上传"; on the large-file card pick something over a hundred MB and watch the progress with pause/resume — **it "completes" with the network unplugged**, which is the fastest way to internalize that this demo sends nothing; the "头像上传（自研）" card works up to the crop modal, then should fail per the defect list above.

## Related

- [Component examples overview](/en/components/)
- [Table](/en/components/table)
- [Form](/en/components/form)
- [Request](/en/guide/essentials/request) — the `/api` prefix, timeouts and interceptors used by the upload chain
- [Mock](/en/guide/essentials/mock) — where the fake success envelope and the variant handler come from
