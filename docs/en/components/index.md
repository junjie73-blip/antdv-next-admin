# Component Examples

This chapter documents **this repository's own demo gallery**, not the antdv-next component reference. The business components (table, form, modal, drawer, upload, charts …) are wrapped in `@antdv/*` sub-packages and each one gets a clickable demo page inside `apps/web`. To work out what a wrapper actually does — and where it bites — read the demo page next to the source citations below.

## Where the demos live

| Location | Contents |
| --- | --- |
| `apps/web/src/views/components/**` | Every demo page; the directory mirrors the menu path |
| `apps/web/src/components/business/**` | Only `ImportExport` and `TenantSelect` are left on the app side (neither has a demo page importing it yet); Table, Form, Modal/Drawer, Description and CountTo have moved into `@antdv/{table-ui,form-ui,popup-ui,common-ui}`, `TreeTable` into `@antdv/table-ui`, `MicroAppContainer` into `@antdv/common-ui` |
| `apps/web/src/components/common/**` | `AvatarUploader.vue` and `Upload/**` (the chunked-upload API layer plus its demo shell) are all that remains; `Auth`, `ECharts`, `Loading`, `MarkdownEditor`, `CronEditor`, `EmptyState`, `StatusTag`, `Description`, `CountTo`, `Scrollbar` etc. now live in `@antdv/common-ui`, with the chart on the subpath `@antdv/common-ui/charts` |
| `packages/core/base/icons/src/**` | Icon atoms (`IconPicker` / `IconifyIcon` / `SvgIcon`), package name `@antdv/icons` |
| `packages/core/ui-kit/**` | Stateless UI atoms: `shadcn-ui` plus the common / form / table / popup / tabs / menu / layout wrapper layers (`loading-ui` and `scrollbar-ui` have been folded into `common-ui`) |
| `apps/backend-mock/server/api/menus.get.ts:161-366` | The **only authoritative list** of demo routes — menu entries are also the permission source, so a route that is not in the menu cannot be reached |

`views/components/overview/index.vue` is the gallery's index. It does not keep a second inventory: it flattens `useRouteStore().menus` into a searchable card wall (`overview/index.vue:12-24`), so a new demo page appears there as soon as it is added to the menu.

## How to open them

The demos are admin-app routes, not docs pages. Start the services from the repo root:

```bash
pnpm dev:web       # apps/web, http://localhost:6080 by default
pnpm dev:mock      # apps/backend-mock (Nitro) on 5320 — menus and demo data come from here
```

The admin app uses **hash routing**, so demo URLs look like this (`VITE_MOCK=false` in `apps/web/.env`, which points requests at the local Nitro server):

```text
http://localhost:6080/#/components/table/basic
http://localhost:6080/#/components/form/steps
http://localhost:6080/#/components/chart
```

Log in with the account the mock accepts — the check is hardcoded in `apps/backend-mock/server/api/auth/login.post.ts:9`; the demo credentials are listed in [Quick start](/en/guide/introduction/quick-start). The sidebar group "组件示例" (Component Examples) exposes the same entries; this chapter only adds "what to click" where it is not obvious, and never re-describes the UI.

## The 27 routes covered (the overview page aside)

The sidebar keeps a third level for "Table" and "Form" only; every other demo is a second-level leaf. The comment at `menus.get.ts:165-180` records that flattening plus the pages that were deleted (通用/Basic, 卡片列表/Card List, 详情页/Detail, 数据展示/Data Display, 树形控件/Tree, 视频/Video, VueUse, 二维码/QR Code, 密码强度/Password Strength, 分页表格/Paginated Table). **Those pages have neither a menu entry nor a file, so this chapter does not link to them.** (反馈与交互/Feedback came back in this round as `/components/feedback`, now documented under [Modal and drawer](/en/components/modal-drawer).)

| Docs page | Routes it documents |
| --- | --- |
| [Table](/en/components/table) | `/components/table/basic`, `/components/table/crud`, `/components/table/drag-sort`, `/components/table/tree-table`, `/components/table/animation` |
| [Form](/en/components/form) | `/components/form/basic`, `/components/form/steps`, `/components/form/validation`, `/components/form/custom-component` |
| [Modal and drawer](/en/components/modal-drawer) | `/components/modal-drawer`, `/components/feedback` |
| [Data and display](/en/components/display) | `/components/description`, `/components/count-to`, `/components/relative-time`, `/components/icon-picker`, `/components/loading`, `/components/scroll/basic` |
| [Shared components](/en/components/common-ui) | `/components/border-beam`, `/components/listy` |
| [Editor and upload](/en/components/editor-upload) | `/components/editor`, `/components/upload`, `/components/image-crop` |
| [Chart and cron](/en/components/chart-cron) | `/components/chart`, `/components/cron` |
| [Directives and drag layout](/en/components/directive-drag) | `/components/directive`, `/components/drag-layout` |

## Conventions to know before reading a demo

- **All class names go through `cn()`.** Each page starts with declarations like `const containerClassName = cn('space-y-6')` and then binds `:class="containerClassName"`. That is `@antdv/shared/utils/cn` (clsx + tailwind-merge), not a stylesheet; the class strings quoted here are exactly the ones in the source.
- **Page roots carry no padding.** The layout owns the scroll container, so demo pages only add spacing (`space-y-6`, `flex h-full flex-col`) and every `a-card` is `variant="borderless"`.
- **Demos have no backend.** Apart from a handful of Nitro handlers under `api/**`, "save" buttons write a local `ref` or `localStorage`. Each section that relies on this says so explicitly (the table drag-sort "保存顺序" / Save order button and the step form draft are the two clear cases).
- **Component names must match `defineOptions({ name })`.** Pages are kept alive by keep-alive, which matches the route's `name` against the menu entry's `name` field (e.g. `DemoModalDrawer` in `menus.get.ts`).
- **Only components under `apps/web/src/components/**` need no import.** That directory is `unplugin-vue-components`' default `dirs`, and the generated list is `apps/web/types/components.d.ts` — today only `AvatarUploader` is actually used bare (`ImportExport`, `TenantSelect` and `Upload/**` are leftovers with no importer). Anything that moved into an `@antdv/*` sub-package must be imported explicitly, e.g. `import { ECharts } from '@antdv/common-ui/charts'`.

## How this chapter is structured

For each documented component, in this order: **what problem it solves** → **the real API** (props / events / instance methods read from the component source, with paths) → **live example** (route plus what to click).

::: warning

Defects stay in the text `setModalProps` and `setDrawerProps` are silent no-ops, `useDrawerInner` is only an alias of `useDrawer`, and `changeOkLoading` on a modal is unreachable. Each of these was verified in behaviour, and the file:line is cited in the relevant section. They are not documented as working APIs — the demo pages themselves print these caveats in the UI.
:::
