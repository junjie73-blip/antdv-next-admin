# Update check

In one sentence: **this repository's "check for updates" is the PWA route (vite-plugin-pwa's Service Worker update flow), not a version-endpoint poller; and the prompt UI — `ReloadPrompt.vue` — is not mounted in any layout today, so the prompt never appears.**

## What actually exists

| Piece | Where | Fact |
| --- | --- | --- |
| Plugin wiring | `internal/vite-config/src/plugins/pwa.ts`, registered when `VITE_PWA=true` (already on in `.env.production`) | `VitePWA({ registerType: 'prompt', strategies: 'generateSW', injectRegister: 'script-defer' })`, `devOptions.enabled: true` |
| Precache list | same file | `workbox.globPatterns` covers js/css/html/ico/png/svg/woff2, 20MB per-file cap; images additionally get a runtime `CacheFirst` route (50 entries / 30 days) |
| Prompt component | `apps/web/src/components/layout/ReloadPrompt.vue` | Fully implemented: `useRegisterSW` `needRefresh` / `offlineReady`, polling, countdown, update button |
| Mounting | — | **No template renders `<ReloadPrompt />` anywhere.** Its only mention is a `types/components.d.ts` entry — the artifact of `unplugin-vue-components` scanning the `src/components` directory, which lists every local component; that is not usage |

So the live behavior is: the SW registers via the injected script, and after a new build Workbox detects a waiting SW; but `registerType: 'prompt'` means **something must call `updateServiceWorker()`**, and that something is not on screen — users never see the "new version" card and keep the old bundle until they refresh on their own.

## What the component would do once mounted (read from source)

Four check paths, all against the SW registration:

- **Interval polling**: `registration.update()` every 5 minutes (`POLL_INTERVAL`), production only (`onRegisteredSW` returns early when `!import.meta.env.PROD`);
- **Tab back to visible**: `useDocumentVisibility` schedules a check 1s after becoming visible and resumes polling; invisible pauses it;
- **Route changes**: `router.afterEach`, throttled to 30s (`ROUTE_CHECK_THROTTLE`);
- **Manual**: `window.__pwaCheckUpdate()` (registered in `onMounted`, for debugging).

Prompt semantics: `needRefresh` shows "发现新版本" and starts a **10-second auto-update countdown** (`AUTO_COUNTDOWN`); "later" cancels the auto-update but keeps the manual button; `offlineReady` shows a one-off "offline ready" toast. The countdown is driven by `useTimestamp` rather than a decrementing `setInterval`, so background-tab throttling cannot drift it.

::: warning

What is NOT here — do not look for vue-vben-admin's mechanisms

- No endpoint polling of a published version / no `buildTime` diff service;
- `__APP_INFO__` (build time + dependency manifest, injected by `defineApplicationConfig`) exists, but nothing consumes it for update detection — it is build metadata only;
- No version-info page. To get the full "new version detected" experience, step one is mounting `<ReloadPrompt />` in a layout (e.g. next to the root of `apps/web/src/layouts/index.vue`); everything else is already written.
:::

## Verifying locally

```bash
pnpm --filter @antdv/web build     # dist contains sw.js and workbox-*.js (VITE_PWA=true)
pnpm --filter @antdv/web preview
```

Change some page copy, rebuild, and diff the precache manifest inside `dist/sw.js`; with the component mounted, the preview page should show the update card at the bottom right. Dev also has `devOptions.enabled`, but its SW lands in `dev-dist/` and behaves slightly differently — validate against `preview`.

## Related pages

- All Vite plugin switches: [Vite config](/en/guide/project/vite)
- Build output and deployment: [Deployment](/en/guide/essentials/deploy)
