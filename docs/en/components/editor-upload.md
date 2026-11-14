# Editor & File Upload

This page covers two example routes: `/components/editor` (Editor) and `/components/upload` (File Upload).

::: tip Three things to remember

1. **The editor's two tabs are two separate implementations**, not two modes of one component: the Markdown tab is a hand-written `textarea` + renderer, while the Rich Text tab is the library's `MarkdownEditor` (tiptap).
2. **Every "upload succeeded" is a mock fake success.** The returned inline SVG data URL is a placeholder image, not your file. Nothing is written to disk.
3. **The large-file card sends no requests at all** — progress is computed from local chunking. Real chunked / instant upload needs a real backend.

:::

---

## Editor: `/components/editor`

### How the two tabs divide the work

The old `editor/markdown` and `editor/rich-text` pages were merged into one page with two tabs.

| Tab | Engine | Output |
| --- | --- | --- |
| Markdown | Hand-written `textarea` + `marked` / `markdown-it` + `highlight.js` — **not a component**, no public API | Markdown source string |
| Rich Text | Library `MarkdownEditor` (tiptap) | Decided by `contentType`: HTML by default, Markdown source when `'markdown'` |

::: warning There is no wangEditor on the rich-text side

`MarkdownEditor` is a tiptap replacement for the former `@wangeditor/editor`: toolbar key names and todo / video nodes are aligned with the legacy wangEditor format, but wangEditor's own menu system and capabilities do not exist. The app no longer declares `@tiptap/*` and never installed `@wangeditor/*`. **Do not apply old wangEditor configuration to this component.**

:::

### What the Markdown tab offers

- Switchable renderers `marked` / `markdown-it`, purely client-side, **no requests**; the preview is injected via `v-safe-html`.
- The toolbar is hand-written buttons that **insert Markdown syntax** into the textarea (bold / italic, headings, quotes, lists, code blocks, tables, links / images) — not rich-text operations.
- The top "Readonly / Disabled / Word count" switches affect both tabs; "Get / Set value" only touches local page state.

### Rich Text tab: `MarkdownEditor` API

**Purpose**: a WYSIWYG editor that accepts legacy wangEditor HTML, outputs an HTML string, and supports edit / split / preview modes plus image and video insertion.

| Field | Default | Notes |
| --- | --- | --- |
| `value` | `''` | Content, used with `v-model:value`; semantics follow `contentType` |
| `contentType` | `'html'` | `'html'` \| `'markdown'`; writes go through `toEditorContent()`, reads through `modelFromEditor()` |
| `mode` | `'edit'` | `edit` / `split` / `preview`; `preview` is locked and hides the toolbar |
| `minHeight` / `maxHeight` / `height` | `160` / `500` / unset | Numbers are px |
| `readonly` / `disabled` | `false` | Combined with `mode === 'preview'` into `isLocked` |
| `showToolbar` / `toolbarConfig` | `true` / unset | Configuring `toolbarKeys` disables `excludeKeys` |
| `imageUpload` / `videoUpload` | see below | Images ≤5MB, videos ≤100MB by default |
| `maxLength` / `showCount` / `autoFocus` / `compact` / `placeholder` | — | `maxLength` intercepts input / paste / drop and emits `maxLength` |
| `theme` | `'light'` | ⚠️ **Silent no-op**, see the defect list below |

**Events**: `update:value`, `change(html, text)`, `focus` / `blur`, `uploadSuccess` / `uploadError`, `maxLength`, `created`, `destroyed`.

**Instance methods**: `getEditor`, `getHtml` / `getHTML`, `getMarkdown`, `getText`, `setHtml` / `setHTML`, `setMarkdown`, `clear`, `focus` / `blur`, `undo` / `redo`, `insertText` / `insertHtml` / `insertMarkdown`, `insertImage` / `insertVideo`, `selectAll`, `getStats`. The example page exposes most of them as buttons.

::: info Markdown ↔ document round-trip

`docToMarkdown(JSONContent)` serializes a ProseMirror document to Markdown; `markdownToDoc(markdown)` parses it back with the `marked` lexer. The `case 'html'` branch keeps HTML input working. `@tiptap/markdown` is not used because this editor has a custom `todo` node and block-level `text-align`, which the official serializer cannot cover.

:::

**Colors come entirely from design tokens**: `border-border` for borders, `bg-card` for panels, `bg-popover` for dropdowns, `bg-muted` for code and table headers, `text-card-foreground` for body text, `text-primary` for selection. There is no hard-coded gray and no `.dark` branch, so all 14 preset themes pick up their own border / surface colors on theme switch.

::: tip Pass the initial value via `value`

Content changes emit `update:value`. Equivalent content echoed back externally is skipped during a 200ms "echo guard" to protect the caret, but genuine external writes still land after a text comparison. **Calling `setHtml()` right after mount may be swallowed by that guard.**

:::

::: warning Two issues found by reading the source

1. **The `theme` prop does nothing** — no code reads it; light / dark is driven by `--*` tokens. Passing `theme="dark"` has no effect.
2. **`imageUpload.onProgress` / `videoUpload.onProgress` never fire** — the upload call only forwards `file/server/fieldName/meta`, and `uploadFile` never consumes `onProgress`. Built-in upload has no progress reporting.

> The former third item ("`getMarkdown()` / `setMarkdown()` are actually HTML") is fixed: both now use the real `docToMarkdown` / `markdownToDoc` round-trip.

:::

### Form field `FMarkdown`

The `@antdv/form-ui` componentMap maps `MarkdownEditor: FMarkdown`. `FMarkdown.vue` is a thin wrapper with `content-type="markdown"`, so **the field value is Markdown source**; `rows` only maps to the editor's minimum height. There is no `textarea` — the editable region is `.tiptap` (`contenteditable`).

### Where the editor's built-in upload goes

Toolbar "Upload image / Upload video" uses `uploadFile` with default endpoint `/upload/file`, prefixed by `VITE_APP_BASE_API=/api` in the request layer — the actual request is **`POST /api/upload/file`**. The mock catch-all variant handler returns an inline SVG data URL, and the component only checks that a `url` exists in the response.

---

## File Upload: `/components/upload`

### The nine cards

| Card | Implementation | Backend |
| --- | --- | --- |
| Basic upload | `uploadRequest('')` + `:drag="true"` | mock fake success |
| Image wall | `uploadRequest('image')`, jpg/png/gif, `maxCount: 8`, <2MB each | mock fake success |
| Avatar (generic Upload) | `uploadRequest('avatar')`, images <5MB | mock fake success |
| Custom upload button | `uploadRequest('custom')` + `:drag="true"` | mock fake success |
| Upload statuses | Three **hard-coded** records showing uploading/error/done | none |
| Pre-upload validation | Allow-list + 10MB, `uploadRequest('validate')` | mock fake success |
| Manual upload | `:auto-upload="false"` + exposed `upload()`, `uploadRequest('manual')` | mock fake success |
| Avatar (in-house) | `AvatarUploader` component — see below | multipart `POST /upload/avatar` |
| Large files | `useChunkUpload` local queue — see below | **no requests at all** |

::: warning Where progress and failure come from

The first seven cards used to point at `action="/api/upload"` (antd `a-upload`'s own XHR): progress came from browser progress events and it **bypassed the project request wrapper** (no token / tenant headers). They now all use `customRequest` → `http` (ofetch → fetch), for two reasons:

- `/api` is a dev-only prefix and is empty in production builds, so the request would hit a non-existent `/api/upload`;
- the in-package browser mock hijacks `globalThis.fetch`; XHR walks past it, so every upload on a static deployment was a real 404.

**Trade-off**: `uploadRequest` fires `onProgress({ percent: 100 })` only once when the reply arrives, so the bar jumps 0 → 100; "failure" now means the interceptor rejected the request rather than a non-2xx status.

:::

"Success" is still entirely mock-supplied: in dev Nitro handlers answer it, in production `apps/web/src/mock/dynamic.ts` builds an isomorphic envelope on the spot (`/upload` and `/upload/:variant` are deliberately absent from fixtures — multipart cannot be captured and replies must be unique per call). Both sides return `data.url` as an inline SVG data URL.

::: tip Image-wall preview and drag-sorting

Preview URLs resolve in the order `thumbUrl → url → response.data.url → response.url`; clicking a thumbnail must `preventDefault` the `<a target="_blank">` antd renders.

**The file-upload menu no longer includes a drag-sorting demo** (removed in this round). `:drag="true"` in the table means "drop files onto the area", unrelated to reordering a list.

:::

### Large files: local chunk scheduling

The last card uses `useChunkUpload` from `@antdv/hooks`. Its boundary is **slicing + concurrency + progress + pause/resume/cancel, with no knowledge of any backend API**. The demo passes no `createWorker` / `workerUrl`, so it runs in main-thread mode: each chunk is read into memory and counted as done — **no hashing, no network**. Progress = chunks done ÷ chunks total, and "completed" is a purely local conclusion. In-table previews use local `URL.createObjectURL` / `FileReader` and have nothing to do with uploading.

### The full chunked / instant-upload chain (in the repo, not demoed)

`common-ui/src/components/chunk-upload/` is the complete implementation: `ChunkUpload.vue` + `useChunkUploader.ts` + `api.ts`. Flow: compute hash → `POST /upload/check` for instant upload → `GET /upload/check` for existing chunks → concurrent `POST /upload/chunk` (with retry) → `POST /upload/merge` → poll `GET /upload/merge/status`.

::: danger Do not expect it to work against the mock

1. `ChunkUpload` / `Upload` are **not referenced by any example page** — none of the nine cards use them; import them yourself.
2. The mock has only two POST handlers; `GET /upload/check` and `GET /upload/merge/status` **have no handler**.
3. The variant handler's `data` lacks `hit` (instant upload) and `taskId` / `status` (merge) — even if you mount it, instant upload never hits, resumable checks fail, and merge polling gets no state.

Real chunked / instant upload needs a real backend; the example environment cannot prove this chain works.

:::

### In-house `AvatarUploader`

Props: `modelValue` / `maxSizeMb(5)` / `outputSize(256)` / `round(true)` / `size(80)`. Events: `update:modelValue` / `uploaded`.

Flow: `useFileDialog` → format & size validation → `useFileReader` to DataURL → 1:1 vue-cropper inside `BasicModal` → PNG out → `http.Post('/upload/avatar', formData)` → emit the returned url.

::: info Three details that matter in code

- **It deliberately does not use `~/api/system`'s `uploadFile`**: that endpoint registers file-manager metadata and its `FileRecord` has no `url`, so an avatar could never be filled back. The request layer only `JSON.stringify`s plain objects and passes FormData through unchanged, so binary data is sent correctly.
- **`/upload/avatar` is caught by the variant route**: the response's `data.url` is an inline SVG data URL; the component requires `res.data.url` and throws "upload endpoint returned no url" when missing.
- **`outputSize` only affects wording**: the cropper is fixed at `:output-size="1"` and the prop's 256 appears only in hint text. "Output 256×256" is a display statement; the real output is 1× the selection.

:::

---

## Live examples

| URL | What to try |
| --- | --- |
| `http://localhost:6080/#/components/editor` | Markdown tab: insert syntax, switch `marked` / `markdown-it`, copy HTML. Rich Text tab: switch Edit / Split / Preview, insert text / HTML / image, undo / redo, export Markdown (logged to console) |
| `http://localhost:6080/#/components/upload` | Image wall: pick a jpg and open the large preview. Validation card: try oversized or non-allow-listed files. Manual card: select then click "Start upload". Large-file card **finishes even offline**. In-house avatar card: select → crop → fill url all works against the mock |

## Related pages

- [Examples overview](/en/components/)
- [Table](/en/components/table) · [Form](/en/components/form)
- [Requests](/en/guide/essentials/request) — `/api` prefix, timeouts, interceptors
- [Mock](/en/guide/essentials/mock) — fake-success envelopes and variant handlers

---

<details>
<summary>Source index (file / line references)</summary>

| Topic | Location |
| --- | --- |
| Editor example page | `apps/web/src/views/components/editor/index.vue` (tabs `:34`, toolbar `:214-415`, instance-method buttons `:929-963`) |
| `MarkdownEditor` | `packages/core/ui-kit/common-ui/src/components/markdown-editor/` (`MarkdownEditor.vue`, `types.ts`, `markdown.ts`, `utils.ts`, `constants.ts`, `extensions/`) |
| Upload example page | `apps/web/src/views/components/upload/index.vue` (`uploadRequest` `:45-72`, nine cards `:697-1172`, preview resolution `:113-132`) |
| Generic `Upload` / `UploadDragger` | `packages/core/ui-kit/common-ui/src/components/upload/` |
| `AvatarUploader` | `packages/core/ui-kit/common-ui/src/components/avatar-uploader/AvatarUploader.vue` |
| `ChunkUpload` | `packages/core/ui-kit/common-ui/src/components/chunk-upload/` |
| `useChunkUpload` | `packages/core/hooks/src/use-chunk-upload.ts` |
| Mock handlers | `apps/backend-mock/server/api/upload.post.ts`, `upload/[variant].post.ts`, `server/utils/upload.ts` |
| Production mock envelope | `apps/web/src/mock/dynamic.ts` |
| Menu nodes | `apps/backend-mock/server/api/menus.get.ts` |

</details>
