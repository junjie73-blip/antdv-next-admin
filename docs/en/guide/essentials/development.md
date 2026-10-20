# Development conventions and environment variables

## Environment variables

Three files, merged per Vite mode (`.env` as the base, `.env.development` / `.env.production` override it):

| Variable | Location | Purpose |
| --- | --- | --- |
| `VITE_NAMESPACE` | `.env` | namespace prefix for cache keys / localStorage |
| `VITE_APP_TITLE` | `.env` | the title and the app-loading text |
| `VITE_MOCK` | all three files | on in dev, off in production; when off, `/api` is no longer proxied to Nitro |
| `VITE_MICRO_APP` | `.env` | micro-frontend switch, **off by default** (see below) |
| `VITE_WS_URL` | `.env` | WebSocket address of the header's live notifications, empty = don't connect |
| `VITE_PORT` | mode files | dev 6080 / prod 9080 |
| `VITE_APP_BASE_API` | `.env.development` | endpoint prefix (`/api`); don't hardcode a full domain in code |
| `VITE_MOCK_SERVER` | `.env.development` | Nitro mock address (`http://localhost:5320`) |
| `VITE_INJECT_APP_LOADING` | mode files | first-paint app-loading injection |
| `VITE_DEVTOOLS` | `.env.development` | vue devtools |
| `VITE_PWA` | `.env.production` | generate the manifest + service worker |
| `VITE_COMPRESS` / `VITE_ARCHIVER` | `.env.production` | gzip the build output / pack a zip |
| `VITE_VISUALIZER` | `.env.production` | build output size analysis |
| `VITE_CACHE_ENCRYPT_KEY` | `.env.production` | local cache encryption key (SM4, must be 32 characters) |

::: warning

Use `isEnvEnabled` for boolean switches, don't write `=== true` `VITE_*` values come out of the environment as strings. Writing `VITE_MICRO_APP === true` is always false, and the symptom is "I clearly turned the switch on, yet the micro-frontend page keeps reporting that it can't connect".
:::

::: warning

The two switches that default to off are off for a reason

- `VITE_MICRO_APP=false`: the child app has to actually run on the port configured in the registry (`src/config/micro-app.ts`), otherwise the "Micro frontend" menu page tries to connect to an address that isn't reachable.
- `VITE_WS_URL=` (empty): the Nitro mock has no `/ws` handler, and reconnection is **unlimited** — starting a connection with no backend only floods the console and the end-to-end cases. When you hook up a real backend, fill in the full address (for example `ws://localhost:8080/ws`); the frontend attaches the token automatically.

`VITE_DEV_POLLING` is also left commented out in `.env.development`: when the repo sits on a mapped drive (`J:` here) inotify events never arrive, so it looks like it should be enabled. Measured in practice **enabling it doesn't save it either** — the config does get `server.watch.usePolling`, and polling the same directory directly with chokidar does deliver change events, but the dev server's module graph never invalidates (stale modules keep being served until a restart). You burn CPU and still get no HMR, so it stays commented; after changing a shared package, rebuild and restart following [Getting started](/en/guide/introduction/quick-start#_3-you-changed-a-shared-package-but-nothing-took-effect).
:::

## Coding conventions

The details live in `CODE_STANDARD.md` at the repo root (20 sections: directory organization, naming, Vue components, Pinia, HTTP, WebSocket, styles, tables, CRUD, permissions, security, environment variables, form schema factory, `actions.ts`, route registration order, common traps, component reuse, internationalization, TypeScript, performance). Only the three rules tightly coupled to directories and layout are repeated here:

1. **Pages are laid out as `views/<module>/<page>/index.vue`**, with page-private logic in `actions.ts` / `columns.ts` / `schemas.ts` next to it; what sits inside the `components/` and `widgets/` subdirectories is a **private component, not a route page** — both file-convention routing and the "no padding on the root container" guard exclude them on that same criterion.
2. **The outer container of a route page declares no padding**; inner spacing is the layout's job (see [Layout, menu, and tab pages](/en/guide/in-depth/layout#content-area-padding-belongs-to-the-layout)).
3. **Accent colors only come from `@antdv/design`'s primary tokens** (`bg-primary` / `text-primary` / `var(--app-primary)`) — never the antd compatibility layer's `*-ant-*` (those utilities are no longer generated) and never a hardcoded `blue-*` or `#1677ff` (see [Theme and preferences](/en/guide/in-depth/theme#writing-the-primary-color-with-tailwind)).

Running the checks:

```bash
pnpm lint            # eslint (assembles the shared config in internal/lint-configs)
pnpm format          # oxfmt
pnpm check           # the five checks: circular + dep + type + builds + cspell
pnpm publint         # are the sub-package build outputs publishable
```

`check:type` currently has **253 pre-existing errors** (`components/business/**`, `api/mock.ts`, `security/dashboard/**`, `form/validation`, etc.). In CI it runs as "continue but don't block"; the reasoning and the convergence plan are in [CI and deployment](/en/guide/essentials/deploy#why-type-check-is-non-blocking-at-first).

## One build standard for every package

All 34 packages in the workspace come in exactly two legal shapes. There is no
"some packages hot-reload, only some get compiled" mix:

| Shape | Who uses it | What `build` does |
| --- | --- | --- |
| Published from source (`exports` point at `./src/**`) | the component and utility packages under `packages/**`, plus `@antdv/design` | `vite build` in library mode: compile SFC / TSX / atomic classes, bundle into `dist`, then validate the output |
| Published from artifacts (`exports` point at `./dist/**`) | `shared`, `preferences`, `router`, `directives`, `hooks`, `types`, and every `internal/*` and `scripts/*` package | `tsdown`, with `clean: true` and `dts: true` in each package's `tsdown.config.ts` |

Four hard rules:

1. **Every package has a `build`.** The only exceptions are packages whose content is
   configuration rather than code (`@antdv/tsconfig`, `@antdv/stylelint-config`,
   `@antdv/commitlint-config` — plain JSON / CSS presets). The list and the reasons live at
   the top of `scripts/check-uniform-build.mjs`.
2. **`stub` cannot be the only build.** tsdown's `stub` drops a trampoline into `dist`; the
   artifacts were never actually compiled, so type errors, missing dependencies and failed SFC
   compactions are postponed until the host app's dev server trips over them.
   `@antdv/node-utils` keeps `stub` because its script toolchain runs sources through the
   trampoline — but it ships a real `build` alongside it.
3. **Source-published packages do not declare their own `dev` / `watch`.** Their hot reload
   comes from the host app (`apps/web`): Vite reads the sources directly, so editing a package
   takes effect immediately. Adding a `vite build --watch` on top only races the host over the
   same directories.
4. **The artifacts must cover every public sub-path in `exports`.** `defineLibraryConfig()`
   derives the entries from the package's own `exports` map (wildcards like `./*` included), and
   `antdv:validate-dist` then checks, entry by entry, that `dist/<name>.js` really landed on disk
   (`.css` for style entries, plus the matching `.d.ts` when declarations are enabled). A single
   missing entry fails the build and names the sub-path.

The standard is a runnable guard. `check:builds` sits inside `pnpm check`, but that chain still
short-circuits at `check:type` today, so run it on its own:

```bash
pnpm check:builds
# 子包统一构建标准检查通过：34 个包都有 build / 无 stub-only / 源码发布包不挂 watch。
# ("Every package has a build / no stub-only / source-published packages install no watchers.")
```

A new package only needs three things: `vite.config.mts` containing
`export default defineLibraryConfig();`; a `package.json` with `build: vite build`,
`clean: rimraf dist .turbo` and `files: ["dist", "src"]`; and `@antdv/vite-config` plus `vite`
in `devDependencies`. The guard catches whatever is missed.

::: warning Three library-mode details we learned the hard way

- **Do not use `build.lib.fileName`.** It is a single-entry prefix option: the string
  `'[name]'` leaves CSS assets out of the substitution (you get `dist/_name_.css`), and the
  function form pushes JS into `dist/es/`. Multi-entry artifact names always go through
  `rolldownOptions.output.entryFileNames` + `assetFileNames`.
- **A CSS-only entry needs `cssCodeSplit: true` explicitly.** Library mode defaults it to
  `false`, and in that mode Vite refuses CSS entries outright
  (`"rolldownOptions.input" should not include CSS files`) — which is how `@antdv/design` started.
- **`dts` follows where `types` points.** Declarations are only emitted when `types` resolves
  into `dist`. For source-published packages (`types: ./src/index.ts`) the generated `.d.ts` has
  no readers — each package's own `type-check` guards the public surface — and emitting them
  anyway doubles the build (`@antdv/menu-ui`: 27 s → 7.5 s).

:::

::: tip What it costs, and when it is paid

A full `pnpm build` is currently 31 tasks and roughly 4 minutes; a single source package takes
7–10 s. In `turbo.json`, `dev`, `type-check` and `test:unit` all `dependsOn ^build`, so the very
first `pnpm dev` after a clean cache pays about a minute building the dependency packages, then
hits the cache. That is not a regression — it is the price of a broken package going red before
the commit instead of in someone's browser.

:::

## Commit messages

```bash
pnpm commit          # czg interactive prompt, validated by internal/lint-configs/commitlint-config
pnpm commit :f       # an alias pre-fills "docs: fix typos"
```

The `type-enum` allow-list has **13 entries**: `feat / fix / perf / style / docs / test / refactor / build / ci / chore / revert / types / release`. The czg **interactive list** offers two more (`wip`, `workflow`) that are not in the allow-list — commitlint rejects them, so don't treat those two as regular types. There are five aliases: `b` = `build: bump dependencies`, `c` = `chore: update config`, `f` = `docs: fix typos`, `r` = `docs: update README`, `s` = `style: update code format`.

The other hard constraints: `header-max-length` 108, `body-leading-blank` (a blank line before the body), `footer-leading-blank` (warning level), and the scope may be empty but must be in the allowed list when present (`function-rules/scope-enum`). **No** rule limits breaking changes to `feat` / `fix` — that wording only appears in the interactive prompt.

::: warning

Local hooks are currently off Every hook in `lefthook.yml` is commented out (`prepare` still runs `lefthook install`, but nothing actually intercepts). So **don't expect lint to run automatically on commit**, and keep in mind that `pnpm exec lefthook run pre-commit` currently does nothing — the real CI gate is on the CI side, see [CI and deployment](/en/guide/essentials/deploy).
:::

## Changeset

Add one when a change affects a published package:

```bash
pnpm changeset
```

The frontmatter of `.changeset/*.md` lists the affected packages and the version level. Because `fixed: [["@antdv/*", "@antdv/*"]]` is configured, bumping any single package moves every `@antdv/*` to the same version number. When writing the content, write "why it changed + how to verify it", not just "which files changed".

## Component example pages are templates, not scratch paper

`views/components/**` gets copied verbatim by other projects. So:

- examples must really be interactive (clicking produces something), never "illustrative" dead code;
- misusing the API is caught by a static guard (`views/__tests__/gallery-api-usage.spec.ts`);
- a component that fails to resolve only produces a **warning** in Vue, the symptom is "that region is blank", and a sweep won't spot it — so assertions have to land on "the content really rendered";
- a new example page that enters the menu automatically shows up in the [overview card wall](/en/guide/in-depth/layout) (the list reads the menu tree directly, it is not a second copy);
- menu depth stops at two levels: `Demo -> page`. The only exceptions are the Form and Table branches — they are numerous, so they use the three-level shape `Demo -> group -> page`. Do not insert another "gallery / category" container in between: once containers nest more than one level, the sidebar takes two clicks before you reach any content, and the breadcrumb grows past the room it has.
