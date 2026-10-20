# CI and deployment

Two unrelated release pipelines: the admin app goes through Vercel's Git integration, while the docs site goes through GitHub Actions to deploy to GitHub Pages; CI only runs the CI gate, and the two sides never overlap:

```
GitHub repo ──► Vercel project: admin app        Root Directory = apps/web
            ├─► GitHub Actions (.github/workflows/ci.yml): lint / unit tests / three-engine e2e
            └─► GitHub Actions (.github/workflows/docs.yml): docs build → GitHub Pages
```

## Why the docs site isn't crammed into the same deployment as the admin app

- **Decoupled releases**: publishing a new version of the admin app should not republish the docs along with it, and vice versa.
- **Build cost**: the docs only need `pnpm install --filter @antdv/docs...`, without installing heavy dependencies such as echarts, tiptap, and video.js all over again.
- **The gate is decoupled too**: `docs.yml` only guards the docs' own dead-link check and does not run lint / type-check / e2e; one mistaken docs edit should not drag the app's CI gate red, and conversely the app's pre-existing type errors should not block the docs from going live.
- **Access boundary**: the docs site is pure static and publicly readable; the admin app may need protection, plus the domains and forwarding rules for a real backend.

::: tip

The docs can also live on Vercel: making them a second Vercel project (Root Directory = `docs`) works too, and this project used to be configured that way. There is only one reason for switching to GitHub Pages: **docs changes are frequent, small commits, and Pages' deployment logs and site settings sit right in the repo's Insights, so you don't have to go looking back and forth between two platforms**. Both paths depend only on the build output, and switching does not require changing the docs content itself.
:::

## The admin app (Vercel)

In the Vercel console: New Project → import the repo → **set Root Directory to `apps/web`**, everything else per the table below (there is **no** `apps/web/vercel.json` in the repository and no Vercel configuration file of any kind, so every item has to be set by hand in the console):

| Item | Value |
| --- | --- |
| Framework Preset | Vite |
| Build and Development Settings → Root Directory | `apps/web` |
| Install Command | `pnpm install --frozen-lockfile --filter @antdv/web...` |
| Build Command | `pnpm --filter @antdv/web... build` |
| Output Directory | `dist` |
| Node Version | 24 (follows `.node-version` at the repo root) |

::: warning

The three dots at the end of `--filter @antdv/web...` are not a typo `apps/web` depends on 23 workspace packages: 21 runtime sub-packages in `dependencies` (`apps/web/package.json:20-40`) plus `@antdv/tsconfig` and `@antdv/vite-config` in `devDependencies` (`:113-114`). Of those, `@antdv/{shared,hooks,directives,preferences,router,types}` — six — ship **`tsdown` build output** (`main` points at `./dist/index.js`), and so do `@antdv/{vite-config,node-utils}`; the repo does not commit `dist`. pnpm's `<pkg>...` brings that package **and its dependencies** into scope, so `... build` builds `@antdv/shared`, `@antdv/layouts`, `@antdv/vite-config` … first and only then web. With only `pnpm --filter @antdv/web build`, Vercel gives you a pile of build failures about "cannot find `@antdv/shared/utils/cn`" — it does not reproduce locally, because the `dist` on your machine is what the previous build left behind. The remaining 15 (`enums` / `layouts` / `request` / `stores` / `utils` / `icons` / `design` and the eight ui-kit packages) are source-published — `main` points straight at `./src/index.ts` (`design`: `./src/index.css`) and they have no build script at all; the web app's Vite compiles them, so it makes no difference whether they are inside `... build`.

`pnpm turbo build --filter=@antdv/web` works too (turbo computes `^build` itself); the cost is that Vercel has to set up turbo's cache directory as well, and the only payoff is remote cache — switch to it when CI really needs speeding up.
:::

The build output needs no extra configuration:

- `base: './'` (`apps/web/vite.config.ts`) → relative asset paths, so it opens directly under any sub-path;
- Routing is in **hash mode**, deep links look like `/#/system/user`, and the server only ever needs `/index.html`;
- `vercel.json` still keeps `rewrites: /(.*) → /index.html`, which covers switching to history routing later and old addresses people type by hand;
- `/assets/*` gets one year of `immutable`: file names carry a hash, so changing content changes the name and nothing caches an old bundle.

::: warning

Environment variables are configured on Vercel, not committed `VITE_APP_BASE_API` points at the real backend, `VITE_MOCK=false`, `VITE_WS_URL` gets the production WebSocket address, and `VITE_CACHE_ENCRYPT_KEY` becomes your own 32-character random key (SM4). Configure them under Project Settings → Environment Variables; the values never enter the repo. The `nginx.conf` at the repo root is the old self-hosted deployment path (`try_files` + a `/api/v1` reverse proxy); it is not used on Vercel. Pick one of the two paths — do not keep both sets of prefixes at the same time.
:::

## The docs site: GitHub Actions + Pages

In the repo: Settings → Pages → Build and deployment → **set Source to GitHub Actions** (if you skip this step, the `deploy` job fails at "no Pages configuration with Actions for the provided repository"). Nothing else needs to be configured in the console; `.github/workflows/docs.yml` is everything:

| Step | Value |
| --- | --- |
| Trigger | push to `main` with changes hitting `docs/**` / this workflow / `pnpm-lock.yaml`, or a manual dispatch |
| Install | `pnpm install --frozen-lockfile --filter @antdv/docs...` |
| Build | `pnpm --filter @antdv/docs build` (includes the dead-link check, the only quality gate) |
| Output | `docs/.vitepress/dist` → `actions/upload-pages-artifact` |
| Deploy | `actions/deploy-pages`, `environment: github-pages` |

The site is bilingual, `/` and `/en/`; the root path `docs/index.md` is a language selection page. Language switching uses the menus that ship with the default theme (`VPNavBarTranslations` in the top bar, `VPNavScreenTranslations` inside the hamburger menu, labelled via `langMenuLabel`), which jump to the same article in the other language based on the current page path — so the file names on both sides **must stay the same**: `zh/layout.md` corresponds to `en/layout.md`.

::: warning

Gotcha: `locales` keys must be bare language codes Use `zh` / `en`, **not** path-style `'/'`. VitePress builds a regex out of `/${key}/` and matches it against the current route (`getLocaleForPath`); a path-style key becomes `///` and never matches. The symptom is that the body renders fine while the sidebar, top-bar menu, language switcher and local-search strings are **all silently empty** — and you cannot tell from the built HTML, because the navbar is SSR-rendered while locale-level `themeConfig` is only merged on the client. URLs stay `/` either way, since `link` is derived from the bare code.

One more note for acceptance testing: the top-bar switcher follows upstream responsive rules and only appears at viewports ≥1280px — narrower windows have to use the copy inside the hamburger menu. Also, switching language via client-side routing does not immediately update `<html lang>` (a full reload does), so assert on the URL and the heading, not on that attribute.
:::

::: warning

`base` is only set in CI Pages' project site is served under `https://<user>.github.io/<repo>/`, so asset paths must carry this prefix; otherwise the symptom is "the HTML is there, all styles and scripts 404, and the page renders unstyled". This step is handled by the workflow setting `VITEPRESS_BASE: /<repo>/` (the value comes from GitHub's repository-name context), with the default in the config being `/` (local dev/preview uses the root path, so the URL needs no prefix). When you bind a custom domain or a user site, change `VITEPRESS_BASE` to `/` — **just change this one environment variable in CI; do not hardcode it in `config.mts`** — hardcoding turns local preview into `/antdv-next-admin/`, which actually makes misjudgment more likely.
:::

Preview the build output locally (equivalent to those two commands in CI):

```bash
pnpm docs:dev        # http://localhost:5200
pnpm docs:build      # build, checks for dead links
pnpm docs:preview    # preview dist
```

::: tip

Dead links fail the build VitePress checks link validity by default, so a wrong page name goes straight to **build failed**, and the build job in `docs.yml` goes red with it. That is the behavior we want — the most typical symptom of docs rotting away is links pointing at pages that no longer exist. But **anchors are not within the check**: a link to a nonexistent `#某标题` (`#some-heading`) just silently lands at the top of the page. Anchors are especially prone to drifting on a bilingual site (the slug of an English heading is completely different from the Chinese one), so cross-page anchors must be verified against the generated output by hand.
:::

## The GitHub Actions CI gate

`.github/workflows/ci.yml`, trigger conditions: push to `main`, pull request, and manual. Three jobs:

| Job | Content | Blocks the merge? |
| --- | --- | --- |
| `quality` | `pnpm lint`, `pnpm check:circular`, `pnpm test:unit` | ✅ |
| `e2e` | Matrix over `chromium / firefox / webkit`, `fail-fast: false` | ✅ |
| `type-check` | `pnpm check:type` | ⚠️ Not blocking for now |

The docs build is **not here**; it has its own `docs.yml` (see the previous section). The reasoning: `ci.yml` guards the application code, so one typo in the docs should not make all three engines' e2e run again; `docs.yml` only does build + publish and does not re-run lint / type-check / e2e.

The reasoning behind a few decisions:

- **`node-version-file: .node-version`**: the Node version has exactly one source of truth, so nobody maintains a second copy.
- **All three e2e engines run**: problems like scrollbars, menu overflow, and responsive breakpoints only surface on non-Chromium; running chromium alone is equivalent to giving up the "compatible with all mainstream browsers" requirement.
- **`pnpm turbo build --filter=@antdv/web^...` builds the dependencies first**: same reasoning as pnpm's three dots above, except the `<` direction (`^...`) builds only the dependencies and not web itself — web is left to Playwright's `webServer`, which starts dev.
- **`VITE_WRITE_DTS=false`**: the type declaration build output is useless in CI, saving a few dozen seconds.
- **Uploading `test-results` and `playwright-report` on failure**: `error-context.md` holds the error details plus the page aria snapshot, which is the fastest way to pin down a false red.

### Why type-check is non-blocking at first

`pnpm check:type` currently has **253 pre-existing errors**, concentrated in `apps/web/src/components/business/**`, `src/api/mock.ts`, `views/security/dashboard/**`, `views/form/validation` and the like; files added in this batch have zero errors. Turning known pre-existing debt straight into a must-pass CI gate just makes every PR red — which is the same as having no gate at all. So:

1. Now: `continue-on-error: true`, so type errors stay visible in the CI log (reported, not blocking);
2. Converge: clear them directory by directory in batches (start with the files this batch touched and with new code; new code may not add errors);
3. Later: remove `continue-on-error` and merge `type-check` into `quality` as a must-pass step.

::: info

The local hooks are still empty Every hook in `lefthook.yml` is commented out, so nothing lints automatically when you commit. CI is currently the only enforcement layer, so run the local self-check with the wrap-up checklist in [Testing strategy](/en/guide/project/testing).
:::

## Rollback and verification

Vercel keeps a Deployments list for every deployment, so when something goes wrong you Promote the previous Production deployment right there in that project — no rebuild needed. Rolling back the docs site goes through the GitHub side: Actions → `Docs` → pick a past run → **Deploy workflow**, and Pages switches back to that run's output. After going live, confirm at least these by hand:

Admin app:

1. `/` (no hash) opens, assets return 200, and there are no console errors;
2. The login call goes to the real backend that `VITE_APP_BASE_API` points at, not to `/api` (that is the mock's prefix);
3. Reloading a deep link (`/#/system/user`) does not 404, and unmatched paths fall through to `index.html`.

Docs site:

1. `/antdv-next-admin/` opens on the language selection page, and the **styles and scripts under both `/` and `/en/` return 200** (an asset 404 means `VITEPRESS_BASE` doesn't match the actual mount path);
2. The language switcher jumps the current page to the same article in the other language, and the two titles line up. The top-bar copy only appears at viewports ≥1280px; narrower windows use the one inside the hamburger menu, so test each at its own width;
3. Site search covers **the current language only**. With bare `locales` keys the build emits one index per language (`assets/chunks/@localSearchIndex{zh,en,root}.*.js`), so a Chinese query from an `/en/` page finds nothing. This changed when the keys became bare codes — previously every page fell into the single `root` index, which is why the two languages used to come back mixed together. Accept the site as "per-language search".
