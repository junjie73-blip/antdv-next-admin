# Antdv Next Vue Admin

**English** | [简体中文](./README.md)

A modern enterprise admin template: Vue 3 + TypeScript + antdv-next + Tailwind CSS v4, pnpm monorepo, runs with zero backend during development (in-process Nitro mock), three-engine end-to-end tests.

The full documentation (Chinese and English) lives in [`docs/`](./docs) in this repo and builds to a GitHub Pages site — see the "Docs site" section below.

---

## Tech stack

| Category        | Technology         | Version      |
| --------------- | ------------------ | ------------ |
| Framework       | Vue 3 + TypeScript | 3.5.43 / 6.0 |
| UI              | antdv-next         | ^1.6.0       |
| Styling         | Tailwind CSS v4    | ^4.3.3       |
| State           | Pinia 3            | ^3.0.4       |
| Routing         | Vue Router         | ^5.3.1       |
| HTTP            | custom fetch layer | —            |
| i18n            | vue-i18n           | ^11.4.13     |
| Charts          | ECharts            | ^6.1.0       |
| Build           | Vite               | ^8.3.3       |
| Mock            | Nitro (in-process) | ^2.13.4      |
| Package manager | pnpm               | 10.12.4      |

Versions always come from the catalog in the root `pnpm-workspace.yaml`; sub-packages write `"xxx": "catalog:"`, so this table is the real version set.

---

## Quick start

```bash
pnpm install          # preinstall enforces pnpm; npm/yarn are blocked
pnpm dev              # admin app  http://localhost:6080
pnpm docs:dev         # docs site  http://localhost:5200
```

Login account (mock): `admin` / `admin123`.

The mock server is started **in-process** by the dev process (Nitro, port 5320), and `/api` is proxied to it by the dev server, so you do not need a backend first. Requires Node `>=22`; locally use 24.0.0 from `.node-version`.

---

## Repository structure

```
apps/
├── web/                  # admin app (@antdv/web)
│   ├── src/
│   │   ├── api/          # API wrappers (request.ts provides get/post/put/del)
│   │   ├── composables/  # app-level composables (re-export @antdv/request)
│   │   ├── config/       # constants (cache key names, login path, etc.)
│   │   ├── layouts/      # app-side layout assembly (shells come from @antdv/layouts)
│   │   ├── locales/      # zh-CN / en-US
│   │   ├── plugins/      # runtime injection (request credentials, vue-query, table, UI shells)
│   │   ├── router/       # file-convention routing + guard registration (guards from @antdv/router)
│   │   ├── stores/       # user / app / route / dict / tabs
│   │   ├── utils/        # ws.ts singleton, cache, crypto, security init
│   │   └── views/        # pages: login system dashboard screen components ...
│   └── e2e/              # Playwright end-to-end tests (three engines)
├── backend-mock/         # Nitro mock APIs and runtime controls
docs/                     # VitePress docs site, a package beside apps/; zh/en bilingual, published to GitHub Pages
packages/                 # runtime sub-packages (core/{base,ui-kit,composables,preferences} / request / layouts / router / enums / utils / directives ...)
internal/                 # build and lint tooling (vite-config / lint-configs / tsconfig / node-utils)
scripts/                  # repo tasks such as vsh
.changeset/               # versions and change notes
.github/workflows/        # ci.yml (CI gate) + docs.yml (docs publishing)
```

> **Key constraint**: `packages/*` must **never** import `pinia` / `vue-router` / stores; capabilities they need are obtained via dependency injection, so each package can be reused standalone in other projects. `docs/` takes no part in the app build, and `@antdv/web` does not depend on it.

---

## Core conventions

### Changed a shared package but nothing took effect

What consumers get from a sub-package is its **`dist` output**, not `src`. After changing `packages/*/src` you must:

```bash
pnpm --filter @antdv/shared build   # swap in the package you changed
# then restart the dev server (vite's dependency cache also points at dist)
```

Otherwise your code never enters the build graph, and the symptom is "changes do nothing".

### Login and session

```ts
await userStore.login(username, password); // POST /auth/login
```

There is no `tenantCode` and no "forgot password" dialog (both items from early READMEs no longer apply). The mock backend only accepts `admin` / `admin123`. The session is stored under these keys (`apps/web/src/config/constants.ts`):

| Key             | Contents     |
| --------------- | ------------ |
| `auth_token`    | accessToken  |
| `refresh_token` | refreshToken |
| `user_info`     | user info    |

Only `pick` the fields you need; do not stuff the entire login response in. The `UserInfo` shape lives in `packages/types/src/user.ts` (`id: number`, `username`, `nickname`, `avatar`, `email`, `phone`, `roles: string[]`, `permissions?: string[]`).

### Request layer

```ts
import { get, post, put, del } from '~/api/request';

export function getUserList(params: Record<string, unknown>) {
  return get<{ list: unknown[]; total: number }>('/user/list', params);
}
```

**The second argument is itself the query string** — do not wrap it in another `{ params }`. Doing so sends `?params=[object Object]` and every filter and pagination condition is lost. A 401 automatically renews the session with the refresh token (concurrent requests share a single refresh); it only redirects to login when the refresh itself fails.

### WebSocket singleton

The whole app keeps exactly one connection; the module-level singleton lives in `apps/web/src/utils/ws.ts` and is accessed through `useWebSocket()`:

```ts
const { onNotice, onForceLogout } = useWebSocket();
const off = onNotice((notice) => {
  /* ... */
});
onUnmounted(() => off());
```

Message types are `notice` and `force-logout` (**hyphenated** — writing `forceLogout` receives nothing). When `VITE_WS_URL` is not set, no connection is attempted at all — this is not a bug; it avoids endless reconnect log spam in development.

### State management

| Store           | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `useUserStore`  | user state + login/logout (**main entry**)               |
| `useAppStore`   | theme, layout, language, preferences                     |
| `useRouteStore` | dynamic routes (from backend menus) + registry alignment |
| `useTabsStore`  | tab pages: ordering, pinning, maximize, caching          |
| `useDictStore`  | data dictionaries                                        |

> ⚠️ `useAuthStore` (`stores/modules/auth.ts`) is a legacy empty shell — **do not use it anymore**; go through `useUserStore` consistently.

### Caching

`cache` from `@antdv/shared` provides SM4-encrypted caching:

```ts
import { cache } from '@antdv/shared';

cache.setItem('key', value, 3600); // the third argument is seconds
cache.getItem('key');
```

In production you must set `VITE_CACHE_ENCRYPT_KEY` (32 characters).

### Permission directives

```vue
<a-button v-permission="'user:add'">Add</a-button>
<div v-permission.all="['user:edit', 'user:delete']">Actions</div>
<span v-permission:role="'admin'">Admin only</span>
<a-button
  v-permission.disabled="'user:add'"
>Greyed out without permission</a-button>
```

`role` / `admin` are **directive arguments** — writing `.role` is not recognized by the check; only `.all` / `.disabled` are modifiers. The directive itself lives in `packages/directives/src/permission`, and the checking function is injected by the application side.

### Layout, theme, and interaction

- **Page root containers carry no padding**; inner spacing of the content area is owned by the layout;
- **Only genuinely clickable elements get `cursor: pointer`**; boxes that merely react on hover do not get the hand cursor;
- The primary color is written into CSS variables, and both names `--ant-color-primary` and `--ant-primary-color` must be set; on the Tailwind side use `bg-ant-primary` (from `@antdv-next/tailwind/compat.css`);
- Using antdv's `message` / `notification` / `modal` requires `App.useApp()` first — the static methods do not work under cssinjs.

### Security

`v-safe-html` (whitelist rendering), `v-escape` (context-aware escaping), `v-lazy`, `v-loading`. CSRF is currently a **front-end-generated token**, which strictly speaking does not constitute protection; when real security semantics are needed, the token must be issued by the backend.

---

## Quality and verification

```bash
pnpm lint             # eslint (vsh lint)
pnpm check:circular   # dependency direction: sub-packages must not import back into the app
pnpm test:unit        # vitest, builds dependencies first per the turbo task graph
pnpm test:e2e         # Playwright, chromium / firefox / webkit
pnpm check:type       # vue-tsc (has pre-existing errors, see docs)
```

CI (`.github/workflows/ci.yml`): `quality` (lint + circular dependencies + unit tests, blocking), `e2e` (three-engine matrix, blocking), `type-check` (pre-existing debt, reports but does not block).

---

## Deployment

- **Admin app**: Vercel, Root Directory = `apps/web`, commands in `apps/web/vercel.json`. The `--filter @antdv/web...` in the build command (three dots) builds the 9 workspace sub-packages along with it; drop it and CI fails with "cannot find `@antdv/shared/cn`".
- **Docs site**: GitHub Actions → GitHub Pages, see `.github/workflows/docs.yml`. It only builds and publishes — no lint / type-check / e2e. Repo Settings → Pages → Source must first be set to **GitHub Actions**, otherwise the deploy job will not start.

---

## Docs site

`docs/` is a VitePress site with `/zh/` and `/en/` content; **Chinese is the default** — the root `docs/index.md` is a single `redirect: /zh/`, so opening the site lands on the Chinese home page and English is reached through the language menu that ships with the default theme (the top-bar copy needs a viewport of at least 1280px; narrower windows get it inside the hamburger menu). It jumps to the same article in the other language based on the current page path, so file names must match on both sides. The `locales` keys must be bare language codes (`zh` / `en`) — writing them as paths like `'/zh/'` silently blanks the sidebar, the top bar and the language switcher; see [`docs/en/guide/essentials/deploy.md`](./docs/en/guide/essentials/deploy.md).

The body follows the information architecture of [vben's docs](https://doc.vben.pro/): `guide/introduction`, `guide/essentials`, `guide/in-depth`, `components` (this repo's own component gallery), `guide/project`, `guide/other`. Deliberately no architecture chapter — what survives is directory and package layout, in `guide/project/dir.md`. Land a new page in `zh` first, then add the same path under `en` — a page that exists in only one language makes the switcher jump to a 404.

| Section | Page | Contents |
| --- | --- | --- |
| Introduction | [Getting started](./docs/en/guide/introduction/quick-start.md) | Environment, ports, the "changed a shared package but nothing took effect" pitfall |
| Essentials | [Core concepts](./docs/en/guide/essentials/concepts.md) | What the shell contains, the layering the code actually follows |
| Essentials | [Local development](./docs/en/guide/essentials/development.md) | Environment variable table, commit messages, changesets |
| Essentials | [Configuration](./docs/en/guide/essentials/config.md), [Icons](./docs/en/guide/essentials/icons.md), [Styles](./docs/en/guide/essentials/styles.md) | Preferences and env precedence, five offline Iconify sets, Tailwind v4 layer order and the `cn()` convention |
| Essentials | [Routes and menu](./docs/en/guide/essentials/route.md) | The route registry, meta fields, the five guards, the menu comes from `/menus`, the dev HMR trap |
| Essentials | [Server interaction](./docs/en/guide/essentials/request.md), [Data mocking](./docs/en/guide/essentials/mock.md) | The fetch wrapper, CSRF/retry/401 refresh, the envelope shape; in-process Nitro in dev and the in-browser mock in production |
| Essentials | [State management](./docs/en/guide/essentials/stores.md) | The setup stores, hand-rolled persistence, the app store as a preferences facade |
| Essentials | [Build and deployment](./docs/en/guide/essentials/deploy.md) | Build output, the Pages `base`, what to verify manually after a rollback |
| In depth | [Login](./docs/en/guide/in-depth/login.md), [Theming](./docs/en/guide/in-depth/theme.md), [Access control](./docs/en/guide/in-depth/access.md) | The token chain, how the primary color truly propagates, three permission layers |
| In depth | [Internationalization](./docs/en/guide/in-depth/internationalization.md) | The single locale source, what a switch actually moves, and what is still Chinese-only |
| In depth | [Layout and tabs](./docs/en/guide/in-depth/layout.md), [Global loading](./docs/en/guide/in-depth/loading.md), [Checking for updates](./docs/en/guide/in-depth/check-update.md) | 7 layout forms and tab styles; the four loading layers; the PWA update prompt and why it never shows today |
| Examples | [Component examples](./docs/en/components/index.md) | The gallery's own chapter: table (with row drag-and-drop), form (with the step form), modal and drawer, display, editor and upload, chart and cron, directives and drag layout |
| Engineering | [Directory structure](./docs/en/guide/project/dir.md), [Conventions](./docs/en/guide/project/protocol.md), [CLI](./docs/en/guide/project/cli.md) | Sub-package boundaries, catalog, tsdown, turbo; the real lint pipeline; every script explained |
| Engineering | [Tailwind CSS](./docs/en/guide/project/tailwindcss.md), [Changeset](./docs/en/guide/project/changeset.md), [Vite config](./docs/en/guide/project/vite.md), [Testing](./docs/en/guide/project/testing.md) | v4 CSS-first setup, lockstep versioning, the plugin matrix and the `isEnvEnabled` trap; unit-test layers, e2e scope, two kinds of false signals |
| Other | [Changelog](./docs/en/guide/other/changelog.md), [FAQ](./docs/en/guide/other/faq.md) | How releases are cut and what is pending; symptoms someone already hit |

---

## Common pitfalls

| Symptom | Cause | Fix |
| --- | --- | --- |
| Changed sub-package source, no effect | `dist` output is what gets consumed | `pnpm --filter <pkg> build` + restart dev |
| Search/pagination conditions all lost | `get(url, { params })` wrapped one layer too many | the second argument is directly the query string |
| Force logout received but no redirect to login | message type written as `forceLogout` | use `force-logout` |
| Changed the primary color but the selected menu item stays the same | only one CSS variable name written | set both `--ant-color-primary` and `--ant-primary-color` |
| Docs site has an empty sidebar, top bar and language switcher | `locales` keys written as paths (`'/zh/'`) | use bare language codes (`zh` / `en`) |
| `notification` does not show | used the static method | get the instance via `App.useApp()`; the title field is `title` |
| Popups inside fixed table columns get clipped | the fixed column creates its own stacking context | raise `z-index` above the fixed columns |
| Editing a page in dev makes the layout disappear | automatic-routing HMR re-lays bare routes | fixed; see the docs section "Second-level routes: HMR in development" |
| WS keeps reconnecting and spamming logs | `VITE_WS_URL` not set | the singleton simply does not connect; configure it when needed |

These nine are what people hit most. The full symptom-indexed tables (plus the known dead-code and unwired list) live in [`docs/en/guide/other/faq.md`](./docs/en/guide/other/faq.md). When you find a new pitfall, add it there rather than only editing this table.

---

## License

MIT, see `LICENSE`.
