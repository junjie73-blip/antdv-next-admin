# Testing strategy

The quality bar is three things holding at the same time: **unit tests green, end-to-end (e2e) green on all
three engines, clean before you commit** (no debug code left behind, no `.only`, no throwaway specs). If any
one of them has not been run, do not say "it's fixed".

## Unit tests

```bash
pnpm test:unit                 # turbo across the whole repo (21 tasks, ^build first per the dependency graph)
pnpm --filter @antdv/shared test:unit
cd apps/web && pnpm exec vitest run src/views/__tests__/page-root-padding.spec.ts
cd apps/web && pnpm exec vitest run -t "keyword"
```

The layered approach:

| Location | What it tests |
| --- | --- |
| `packages/*/__tests__` | Pure logic: XSS escaping, caching, encryption, preferences written to the DOM, region blueprints, guard flow. Sub-packages do not import pinia, so no store mocks are needed |
| `apps/web/src/**/__tests__` | The composition layer inside the app: stores, layout assembly, **source contracts** |
| `apps/web/test/` | Repo-level reconciliation checks, for example whether icon names are real |

::: tip "Source contracts" are this project's signature layer
Some rules only pin down when you scan the source: route page root containers must not declare padding
(`page-root-padding.spec.ts`), the login page accent color must not be hardcoded (`login-styles.spec.ts`),
the tab style class set (`tab-style.spec.ts`), APIs must not be silently misused (`gallery-api-usage.spec.ts`).
:::

::: danger Static guards need positive and negative samples
Asserting "0 matches in the code that exists today" is not enough — when the regex is wrong (a missed escape,
the wrong directory scanned) the result is 0 matches as well, and the guard silently turns into a check that is
always green. So every rule ships two sample sets: the wrong form that **must be caught** and the correct form
that **must not be flagged**, plus a sanity assertion that the scanned set is not empty (such as
`expect(FILES.length).toBeGreaterThan(30)`).
:::

## End-to-end

```bash
cd apps/web
VITE_WRITE_DTS=false pnpm exec playwright test gallery-examples --project=chromium --workers=1 --reporter=line
pnpm exec playwright test --project=chromium --project=firefox --project=webkit   # full run, all three engines
pnpm test:e2e:install            # the first run needs the three browser engines installed
E2E_HEADED=1 pnpm exec playwright test    # run headed for local debugging
```

A few decisions in the config that are **not defaults** (`apps/web/playwright.config.ts`):

- **The port comes from the vite config** (`VITE_PORT=6080`), and dev / preview are not kept apart: the preview
  port differs from dev, the mock is only mounted on dev, and CI uses dev as well — that removes half of the
  environment differences; an already running server is reused directly (`reuseExistingServer: true`), so a dev
  server you keep open locally does not have to be shut down.
- **`workers` is clamped to 3 locally**: the default value (cores/2) × 3 engines saturates the machine — what
  gets saturated is not only the browsers, but also the single dev server process carrying Vite's on-demand
  compilation and the in-process Nitro mock at the same time, which produces a pile of false reds that are
  "pure timeouts". CI runs serially (`workers: 1`, `retries: 2`).
- **WebKit gets its own relaxed timings** (`actionTimeout: 45s`, whole-case `timeout: 240s`): on this machine it
  is 3-5 times slower than the other two engines. Only the **wall clock** is relaxed; the per-step
  `actionTimeout` and the `expect` timeouts were not touched at all — if something is genuinely broken it still
  goes red immediately.
- **`baseURL` is the only source of an external address**; specs always write relative paths (`/#/login`), and
  changing the address means overriding `E2E_BASE_URL`, not editing code.
- Reporters: `list` + `html` (does not open a browser automatically). The failure scene is in
  `apps/web/test-results/<spec directory>/error-context.md`: error details + the page aria snapshot + a code
  snippet — read it before guessing.

The e2e fixtures live in `apps/web/e2e/utils/app.ts`: `signIn` / `go` / `navigate` / `expectActivePath` /
`watchErrors` / `HOME_PATH`. Two rules to remember:

- `go()` asserts that the tab becomes active, so it **cannot be used on routes that only redirect**; for pure
  navigation use `navigate()` (it changes the hash directly), and judge where you landed by the URL
  (`toHaveURL(/#\/error\/404/)`) rather than by tab activation state.
- `watchErrors(page)` sorts problems into buckets — "this site's console errors / API 4xx-5xx / third-party
  noise" — with one new probe per page and `stop()` once you are done with it, otherwise the bucket from the
  previous slice keeps collecting the errors that come after it.

## Two kinds of false signals in sweep specs

`site-sweep.spec.ts` walks every leaf page in the menu, and it taught two lessons:

1. **False positive**: the sweep catches dead links by looking for `页面不存在` in the content area's text, and
   an example page happens to display the 404 `a-result` as demo material inside an `a-card` — a good page got
   judged as a fallback page. The fix is to make the check **skip text inside cards** (the real fallback page is
   a bare h1/p), plus a positive-and-negative case proving "dead links are still recognized, the example page's
   404 card is not misjudged".
2. **False red**: during a full WebKit run `/system/user` was judged red, while the failure snapshot sat on the
   **previous** page (the real-time monitoring big screen, whose own timers were still running) and the tab
   never appeared — navigation was still in flight, the page was not broken. The sweep is an existence check
   that "every page opens", not a performance gate, so this engine alone gets a relaxed wait; the other two
   engines stay tight, and a real regression goes red immediately.

::: tip Telling a timing problem from something that is really broken
Rerun that one engine and that one case only: `--project=webkit e2e/xxx.spec.ts -g "name"`.
Green when run alone + red in a full run ⇒ environment/concurrency; red when run alone ⇒ a real problem, go read
`error-context.md`.
:::

## Assertions must land on outcomes the user can see

The DOM in antdv-next 1.6 differs quite a bit from the old API; these are the facts to write assertions against:

- The linear progress bar is three layers, `rail / track / indicator`; the old `.ant-progress-bg` is gone and
  the percentage is on the root node's `aria-valuenow`;
- `editable-card` renders **two** `.ant-tabs-nav-add` nodes (the permanent one plus the overflow dropdown area),
  so take `.first()`;
- After a switch the old panel only gets `ant-tabs-content-hidden` and stays in the DOM; to read content use
  `[role=tabpanel][aria-hidden=false]`;
- Timeline is implemented with the Steps DOM (every `.ant-timeline-item` also carries `ant-steps-item`), so a
  page-level selector over-counts — scope it inside the card;
- Both the message wrapper and the notice layer carry `ant-message-<type>`; the accessible name of a
  two-character button is written as `成 功` (a space inserted between the characters), so
  `getByRole({ name: '成功', exact: true })` does not match it.

Behavior is a more reliable standard than selectors: the message really appears and really disappears after the
click, the progress value really climbs, the list really gets shorter after filtering, and the button really
flips itself once the permission checkbox changes.

## Wrap-up checklist

Pre-commit self-check (the fixed routine in this project):

- [ ] `pnpm test:unit` is fully green
- [ ] The related specs are green on all three engines (if you touched layout / styles / interaction you must run the non-Chromium engines)
- [ ] `pnpm exec eslint <changed file>` is clean
- [ ] No `test.only` / `console.log` / temporary probe specs
- [ ] If you changed `packages/*`, rebuild and **restart dev** before verifying (the browser reads `dist`)
- [ ] Changes worth versioning got a changeset
