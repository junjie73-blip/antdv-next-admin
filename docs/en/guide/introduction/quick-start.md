# Getting started

## 1. Environment

| Item | Requirement | Source of truth |
| --- | --- | --- |
| Node | `>=22`; locally 24.0.0 per `.node-version` | `engines.node` in `package.json` |
| pnpm | `10.12.4` | `packageManager` in `package.json` |
| Package manager | pnpm only (`preinstall` runs `only-allow pnpm`) | root `package.json` |

```bash
corepack enable
corepack prepare pnpm@10.12.4 --activate
```

::: warning

Don't use npm / yarn The root `preinstall` script blocks non-pnpm installs outright. Beyond that, workspace dependencies, catalog versions, and the symlinks under `internal/*` all rely on pnpm's semantics — mix package managers and you end up with a bogus `node_modules`. :::

## 2. Install and start

```bash
pnpm install          # install dependencies + trigger the stub
pnpm dev:web          # start only the admin app (apps/web)
```

Open `http://localhost:6080` and log in with the mock account:

| Username | Password   |
| -------- | ---------- |
| `admin`  | `admin123` |

That one `pnpm dev:web` command is enough, because it brings up two things at the same time:

```
apps/web dev server ──── 6080 ─  frontend (Vite 8 + Vue 3 + antdv-next 1.6)
        │
        └─ in-process Nitro Mock ── 5320 ─  /api/**, data for login, upload and all 50 menu paths
```

The mock isn't "another process": `VITE_MOCK=true` in `apps/web/.env.development:18` makes the Vite assembly register `viteNitroMockPlugin` (`internal/vite-config/src/plugins/index.ts:149-154`), which calls `createDevServer().listen(5320)` inside the same Node process. The ports aren't hardcoded either: the same file sets `VITE_PORT=6080` (`:1`) and `VITE_MOCK_SERVER=http://localhost:5320` (`:20`), and the dev server proxies `/api` through. So **you don't need a backend prepared separately**.

Other scripts you'll use:

```bash
pnpm dev              # turbo-run dev: pick one package interactively, run its dev script (NOT "web + mock together")
pnpm build            # turbo build, builds all packages along the dependency graph
pnpm preview          # preview the build output
pnpm test:unit        # repo-wide unit tests (turbo; 24 sub-packages declare test:unit)
pnpm test:e2e         # Playwright (starts the dev server itself)
pnpm lint             # vsh lint: oxlint / oxfmt / eslint / stylelint
pnpm check:type       # vue-tsc type-check, package by package
```

## 3. You changed a shared package but nothing took effect

The sub-packages come in two publishing styles — read each `package.json`'s `exports["."]`:

- **`dist` published** (6 packages): `@antdv/shared`, `@antdv/types`, `@antdv/hooks`, `@antdv/preferences`, `@antdv/router`, `@antdv/directives`. `apps/web` reads their `dist/`, so editing `src` requires a rebuild:

```bash
pnpm --filter @antdv/shared build   # or just pnpm build
```

- **Source published** (15 packages): the eight `ui-kit` packages plus `design`, `icons`, `layouts`, `request`, `stores`, `utils`, `enums`. Their `exports` point straight at `./src/index.ts`, they have no `build` script, and a save hot-reloads immediately.

After rebuilding a `dist` package, restart the dev server. This constraint is the easiest thing to trip over in the project: without a restart the page still gets the old modules, which shows up as "I clearly changed it, but the page didn't change".

::: details

Why the dist packages don't just alias to src

- The sub-packages have to be installable and usable on their own by other projects, so their build output must be their own `dist`;
- Vite's `optimizeDeps` and type resolution often disagree with the build result when aliased to source;
- `turbo dev` already uses `dependsOn: ["^build"]` to guarantee dependency packages are up to date before it starts; the only cost is a slower first build.

`apps/web/.env.development` keeps a `VITE_DEV_POLLING` switch. Tested on a mapped drive (this repo sits on `J:` locally) it **does not bring HMR back**, so it stays commented out — don't count on it. :::

## 4. Directory at a glance

```
apps/
  web/              # the admin app (@antdv/web)
  backend-mock/     # Nitro Mock (@antdv/backend-mock)
packages/           # 21 runtime sub-packages in three tiers:
  core/base/        #   design / icons / shared / types
  core/             #   hooks / preferences
  core/ui-kit/      #   common-ui / form-ui / layout-ui / menu-ui /
                    #   popup-ui / shadcn-ui / table-ui / tabs-ui
  (packages root)   #   directives / enums / layouts / request / router / stores / utils
internal/           # 8 build-time packages: vite-config / node-utils / tsconfig /
                    # lint-configs/{eslint,oxlint,oxfmt,stylelint,commitlint}-config
scripts/            # the two in-house CLIs: turbo-run / vsh
docs/               # this site (@antdv/docs, deployed separately)
.changeset/         # where versions and the CHANGELOG come from
```

Details in [Directory structure](/en/guide/project/dir).

## 5. Before your first commit

```bash
pnpm lint && pnpm test:unit
```

Then run the end-to-end (e2e) suite once through, per [Testing strategy](/en/guide/project/testing). If the change is worth a version entry, add one with `pnpm changeset`; see [Development conventions and environment variables](/en/guide/essentials/development).
