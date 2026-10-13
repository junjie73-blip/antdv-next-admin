# Vite Config

In one sentence: **`apps/web/vite.config.ts` is two effective lines — `defineApplicationConfig({ base: './' })`; everything else lives in `internal/vite-config` (`@antdv/vite-config`), merged as common → application → overrides. Env values are type-coerced, so **every switch must go through `isEnvEnabled()` — bare `=== 'true'` comparisons are a proven bug source here.**

## The three layers

| Layer | File | Responsibility |
| --- | --- | --- |
| common | `src/config/common.ts` | aliases `~`→src, `#`→types (mirroring `tsconfig.app.json` paths — mismatch gives "vite runs, vue-tsc errors"); `cacheDir`, `css.devSourcemap`, `envDir`; `resolve.dedupe: ['pinia','vue','vue-router']` — pnpm peer resolution once produced two `@vue/runtime-core` copies (3.5.42/3.5.43), where inject and reactivity couldn't see each other |
| application | `src/config/application.ts` | build, server, define, plugin assembly |
| overrides | the app itself | last deep merge; `plugins` concatenates instead of replacing, so adding a plugin never drops shared ones |

## Plugin inventory (`src/plugins/index.ts`, `kind: 'application'`)

**Always**: `createVuePlugins()` (plugin-vue + jsx, unplugin-vue-router, `@tailwindcss/vite`, vite-plugin-vue-layouts-next, @intlify/unplugin-vue-i18n, vite-plugin-inspect) → `createAutoImportPlugins()` (unplugin-auto-import fed only `vue` / `@vueuse/core` / `pinia` / `vue-router`; unplugin-vue-components scanning just this app's `src/components` — **there is no component resolver any more**; plus the offline iconify sets and vite-plugin-env-parse) → svg-icons, imagemin, dayjs.

**By artifact kind**: only `application` gets HTML injection (vite-plugin-html), the first-screen loading, PWA, archiver, metadata, extra-app-config, print and mock; `library` keeps just the compile chain + vite-plugin-dts (the `kind` comment records the mixing symptom: dts complaining about a library that needs no declarations).

**By env variable (all through `isEnvEnabled`)**:

| Switch | Plugin |
| --- | --- |
| `VITE_WRITE_DTS` (on by default) | `.d.ts` write-back for auto-import/components; on Windows mapped drives that write intermittently fails with `errno -4094` and kills the dev process, hence the off-switch |
| `VITE_DEVTOOLS` / `VITE_VISUALIZER` / `VITE_TURBO_CONSOLE` | vue-devtools / vite-bundle-analyzer / console boost |
| `VITE_ARCHIVER` / `VITE_COMPRESS` / `VITE_PWA` / `VITE_EXTRA_APP` / `VITE_PRINT` | archive, compression, PWA (see [Update check](/en/guide/in-depth/check-update)), runtime config, print |
| `VITE_MOCK` | `vite:mock-server` (`nitro-mock.ts`): boots `@antdv/backend-mock` (Nitro) in-process during dev on `resolveMockPort` (default 5320, skipped if the port is taken) while `utils/proxy.ts` forwards `/api` verbatim — both sides gate on the same `isEnvEnabled(VITE_MOCK)` to avoid the "proxy on, mock off" half-state |
| `VITE_INJECT_APP_LOADING` | only decides whether the overlay is injected; the virtual module stays resolvable regardless |

## The conventional-router exclude has a story

```ts
routesFolder: ['src/views'],
dts: './types/router.d.ts',
exclude: ['**/*/components/*', 'account/**/*', 'login/**/*', 'register/**/*'],
```

The tempting `**/components/**` also swallows the 26 demo pages under `views/components/` (since `**/` matches zero directories) — every example route falls through to the 404 catch-all. Requiring one more directory segment (`**/*/components/*`) keeps page-private components excluded and examples routable; read the comment before touching that line. login/register are excluded because they ship in `constantRoutes` (see [Routing](/en/guide/essentials/route)). Dev-time router HMR fighting the layout and permission pruning is healed by the guard's `syncRoutes()` (see [Access control](/en/guide/in-depth/access)).

## Dev server and proxy

`server`: `host 0.0.0.0`, `cors: true`, port `Number(VITE_PORT) || DEFAULT_PORT(5173)` (`.env.development` sets 6080); `proxy` merges the custom `VITE_PROXY` list with the mock proxy. `VITE_DEV_POLLING=true` enables polling watch — the escape hatch for mapped drives/container volumes where inotify never fires; off by default because polling a large repo is expensive.

## Build

`build.rolldownOptions` (yes, rolldown): entry/chunk names `js/[name]-[hash].js`, `codeSplitting.groups` carve vendors by package (ui/vue/echarts/utils/office/pdfjs/ i18n/editor — see `optimize.ts`), `minSize 20KB`; production minify sets `dropConsole/dropDebugger` (the field is literally `dropDebugger`; typos fail the schema); `sourcemap: false`, `chunkSizeWarningLimit: 1000`. `__APP_INFO__` (build time + dependency manifest) is defined unless `appInfo: false`. `optimizeDeps`: `exclude: ['vue']` (dedupe handles it), include `@vueuse/core / antdv-next / es-toolkit` for first-paint.

## Environment variables: the trap and the only fix

`loadEnv(mode)` runs vite's `loadEnv` (third arg `""`, so all variables) through `vite-plugin-env-parse`'s `parseLoadedEnv`: **`'true'` becomes a boolean, `'6080'` a number**. Therefore `envConfig.VITE_X === 'true'` is forever false — this repo lived with `VITE_DEV_POLLING` as dead config that way, and `Record<string, any>` won't even let TypeScript complain. Truthiness checks are also wrong (`'0'` is not coerced and stays truthy; `'abc'`/`'no'` count as on). The rule: Node-side comparisons go through `isEnvEnabled(value)` (accepts `true/1/'true'/'1'/'on'/'yes'`, case/space insensitive); the browser-side twin in `@antdv/shared/env` reads `import.meta.env`, which is always strings and therefore doesn't accept numbers. Two copies are deliberate: `internal/vite-config` must not import the browser package.

## Related pages

- Actual switch values per mode: `apps/web/.env*`
- The PWA update chain: [Update check](/en/guide/in-depth/check-update)
