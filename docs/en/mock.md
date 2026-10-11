# Mock server (Nitro)

No backend is needed in development: `pnpm dev:web` starts a Nitro server inside the Vite process, and it answers every frontend `/api/**` request.

```
apps/web dev server ── 6080
   │  with VITE_MOCK=true the internal plugin `nitroMock()` starts a nitropack dev server
   └── /api ──proxy──► 127.0.0.1:5320  (apps/backend-mock)
```

- Switch: `VITE_MOCK` in `.env`. `.env.development` sets it to `true`, `.env.production` to `false`,
  so the production bundle **never** carries mock code.
- The port is hardcoded (`VITE_MOCK_SERVER=http://localhost:5320`, one copy held by the proxy and one by the plugin):
  the plugin only probes "is this port usable", never "find me a free port" — switching ports makes no sense,
  because the frontend proxy address is configured from it.
- Editing `apps/backend-mock/server/api/**` **reloads automatically**, no need to restart dev.

## Adding a mock endpoint

Create a handler under `apps/backend-mock/server/api/` following Nitro's file conventions:

```ts
// server/api/system/tag/list.get.ts
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  method: 'GET',
  path: '/system/tag/list',
  handler({ query }) {
    return success(
      { items: [{ id: 1, name: String(query.keyword ?? '') }], total: 1 },
      'ok',
    );
  },
});
```

The handler argument of `defineMockRoute` lines up with the legacy mock: `data` (the parsed request body,
`{}` when there is none), `params` (the `:id` captures), `query` (**repeated keys stay arrays** — `login-log`'s
`dateRange` relies on this semantics and is deliberately not flattened), `body`, `path` (without the `/api` prefix and without the query string).

Responses all go through the envelope in `utils/response.ts`: `success(data, message)` / `bizError(code, message)`,
with the same fields as the Mock envelope in `@antdv/types`.

::: tip Route precedence
The legacy fake-server took the first match in registration order, which is why `withRuntime` had to manually put
parameterless paths first; Nitro uses a radix tree, where static segments naturally win over `:param`, so **reordering is no longer needed**.
:::

## Runtime capabilities: the mock-center admin endpoints

`defineMockRoute` registers every endpoint in the store, which is what lets the `/api/mock-center/*` admin endpoints
change runtime behavior **without a restart**:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/mock-center/overview` | GET | Overview: number of registered endpoints, hit count, average duration, how many are disabled/overridden, global config |
| `/mock-center/routes` | GET | Route list (group, method, path, current runtime config) |
| `/mock-center/runtime` | POST | Change the global config: the `enabled` master switch, `defaultDelay`, `failRate` |
| `/mock-center/route-runtime` | POST | Change one endpoint's config: delay, disable, failure injection |
| `/mock-center/logs` | GET | Hit log (`/logs/clear` empties it) |
| `/mock-center/templates` · `/preview` | GET · POST | Template presets and dry runs, used to fabricate data |
| `/mock-center/generated` · `/routes/save` | GET · POST | Generate/save handler files |

```bash
# how many endpoints are registered right now, and how often they were hit
curl -s localhost:6080/api/mock-center/overview

# make every endpoint 800ms slower to check loading / skeleton screens
curl -s -X POST localhost:6080/api/mock-center/runtime \
  -H 'content-type: application/json' \
  -d '{"defaultDelay":800}'
```

::: warning The panel page is not wired into the routes yet
`apps/web/src/views/tool/mock/**` only keeps the private modules (actions / columns / schemas / types / constants),
there is no `index.vue` and nothing else imports them; `apps/web/src/api/mock.ts` is the client for this group of endpoints.
In other words the "data center" can currently only be driven through the HTTP endpoints above — the UI layer is a gap
still to be restored, so this page documents the endpoints first and adds screenshots once the page comes back.
:::

Runtime config is persisted to `.mock-state.json` (already gitignored). Note that **the filename carries no path**: the mock
is started in-process by the `apps/web` dev process, so the persist file lands in the cwd that launched it (`apps/web/.mock-state.json`),
not under `apps/backend-mock/` — check there first when debugging "why didn't my switch get saved".


## Uploads and real files

`server/api/upload.post.ts` (and the `system/file` group) really do receive files: the chunked upload example page has to be
able to actually upload and the image wall has to preview local files, so this endpoint can't just return a fake URL.

## What about production

In the production build `VITE_MOCK=false`, and `/api` reaches the real backend through the hosting platform's forwarding rules or a reverse proxy.
`VITE_APP_BASE_API` is the only source of the prefix (`/api` in dev); don't hardcode a full domain in code.

::: warning Don't let the mock turn into a requirements document
The mock's job is "keep the 21 menu pages clickable when there is no backend", not reproduce real business rules.
For real endpoints the field semantics follow the backend you integrate with; when the mock and the backend disagree,
**change the mock to match the backend**, don't write frontend branches that "are compatible with both".
:::
