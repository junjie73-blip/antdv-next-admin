# Permissions, directives and cursors

## Three permission layers

| Layer | Who owns it | How failure shows up |
| --- | --- | --- |
| Routing | The navigation guards in `@antdv/router`: login check + filtering menus/routes by permission | Redirect to the login page, or land on `/error/403` / `/error/404` |
| Menu | The backend menu endpoint returns only the items you have rights to, the frontend stops guessing | It never shows up in the menu at all |
| Element | `v-permission` (`@antdv/directives`) | `display: none` by default, or the `.disabled` fallback |

::: tip Fallback pages don't belong in tab pages `/error/403` and `/error/404` are marked `hidden` in the menu and take no part in tab page registration — opening an error page once should not leave a "404" behind in the tab bar. The site-wide sweep decides "landed on a fallback page" from the address (`toHaveURL(/#\/error\/404/)`) — not from which tab is active. :::

## 403 or 404 — the fork isn't hardcoded

After the registry is pruned by the menu, **a page you have no rights to simply isn't registered**, so navigation can only fall through to the wildcard (`apps/web/src/router/routes.ts:60-82`). But "no permission" is not the same as "no such page": reporting 404 for both tells the user "this feature doesn't exist", and they go looking in the wrong place instead of asking an admin for access. The fork is therefore computed inside `catchAllRoute.redirect`:

```ts
redirect: (to) =>
  useRouteStore().isUngrantedExistingPage(to.path) ? '/error/403' : '/error/404',
```

`isUngrantedExistingPage` (`packages/stores/src/route.ts:379-383`) compares the current address against the **leaf landing points** of the full menu snapshot (`collectExistingPagePaths` at `:397`, framework pages already removed): the page exists but is ungranted → 403, the very same target as the guard's `forbiddenPath`, so both interception styles look identical; the address really doesn't exist → 404. The criterion is "leaf", not "does it have a `component` field" — a convention-route page isn't guaranteed to carry that field in the snapshot, and filtering on it would classify perfectly good pages as "nonexistent", sending unauthorized access back to 404.

`apps/web/e2e/permission-accounts.spec.ts` pins this chain with the `admin` / `custom` accounts: every whitelisted page opens, every page outside the list lands on `/#/error/403`, plus a reverse control — a mistyped address (`/components/this-page-does-not-exist`) must still be 404, otherwise "no permission" and "typo" collapse into one target and nobody notices. The button-level asymmetry lives in `apps/web/e2e/table-crud.spec.ts`: on the same table admin sees Delete / Batch delete, while `custom` only gets `add` / `edit` and no delete entry is findable anywhere on the page.

## How to write `v-permission` (don't mix up arg and modifier)

The decision priority comes from `packages/directives/src/permission/utils.ts`: `arg === 'admin'` → super admin; a `'*'` permission code → everything passes; `arg === 'role'` → interpret as roles; otherwise interpret as permission codes. Example pages and real business code use the repo's own `Button` (`@antdv/shadcn-ui` or `@antdv/common-ui`), not antdv-next's `a-button` — `apps/web/src/views/__tests__/gallery-api-usage.spec.ts:137` scans the source and forbids `from 'antdv-next'` under the example and layout directories, so the snippets below follow the same rule.

```vue
<script setup lang="ts">
import { Button } from '@antdv/shadcn-ui';
</script>

<template>
  <!-- By permission code (the default interpretation), an "or" relationship -->
  <Button v-permission="'system:user:add'">Add</Button>
  <Button v-permission="['system:user:edit', 'system:user:add']">Edit</Button>

  <!-- Require both at the same time → .all -->
  <Button v-permission="['a', 'b'].all">Both required</Button>

  <!-- By role: role is the **arg** -->
  <Button v-permission:role="'auditor'">Visible to auditors</Button>

  <!-- Super admin: also an arg, with an empty value -->
  <Button v-permission:admin>Visible to admins</Button>

  <!-- Don't hide it, fall back to disabled instead -->
  <Button v-permission.disabled="'system:user:delete'">Delete</Button>
</template>
```

::: danger `role` / `admin` are args, not modifiers Write `v-permission.role="'auditor'"` or `v-permission.admin` and the check **never reads them at all**, so the element is visible forever — no error, no warning: the hardest class of permission bug to notice. (The only real modifiers are `.all` and `.disabled`.) `apps/web/src/views/__tests__/gallery-api-usage.spec.ts` has a static guard that catches exactly this pattern, with two sample sets — "must match" and "must not over-match" — so the rule itself can't be silently empty. :::

The object form can carry its own criteria, and then `arg` no longer takes part in interpretation:

```vue
<Button
  v-permission="{ mode: 'all', permissions: ['a', 'b'], roles: ['ops'] }"
>
  Mixed check
</Button>
```

## The directive package doesn't touch the store

Inside `@antdv/directives` there is no import of pinia / api / vueuse; the checkers, the subscription and the dev-time logging all come by injection:

```ts
// apps/web/src/directives/index.ts
export const vPermission = createPermissionDirective({
  // Read the store lazily: when this module is imported in main.ts pinia isn't attached yet,
  // and calling usePermission() directly throws no active pinia
  checkers: () => usePermission(),
  onCheck: (context) => {
    if (import.meta.env.DEV) console.log('[v-permission]', context);
  },
  // The permission list is filled in asynchronously after login; subscribing to it is what lets an element correct itself once the data arrives
  subscribe: (notify) =>
    watch(() => useUserStore().permissions, notify, { deep: true }),
});
```

`subscribe` is the one that matters: without it, a button that **renders before the permissions arrive** stays "invisible" forever. The directive calls the returned stop function on `unmounted`, so no dangling `watch` is left behind.

## Fallback styling belongs to the style layer

The directive only "raises a flag" (under the `.disabled` modifier it adds `permission-disabled`, by default it just sets `display:none`); the visual result is decided by `@antdv/design/css/permission.css`:

```css
.permission-disabled {
  @apply cursor-not-allowed opacity-50 saturate-50 select-none;
  pointer-events: none; /* non-form elements don't honor the disabled attribute, so block interaction here uniformly */
}
```

It is written inside `@layer components`, so utility classes in templates still override it — if you want "no permission but still fully opaque", add `opacity-100`; if you want "looks downgraded but still interactive", add `permission-disabled--passthrough`. No change to the directive needed.

## Cursor rule: pointer only when it's clickable

The shared rule is that **only elements that really trigger interaction get `cursor-pointer`**: clickable cards, buttons, links, tab pages, tree nodes and switches all do; disabled state gets `cursor-not-allowed`; display-only containers and text keep the default cursor. Making "every box with hover should have a cursor" into a blanket `:hover { cursor: pointer }` would trick non-clickable areas into looking clickable — that is a usability regression, so classify by "can it be clicked", not by "does it have hover styles".

## Four other security/experience directives

```ts
// apps/web/src/main.ts
app.directive('safe-html', safeHtmlDirective); // whitelist-based rich text rendering
app.directive('escape', escapeDirective); // escape by context
app.directive('lazy', vLazy); // load only when it enters the viewport
app.directive('loading', vLoading); // element mask + full-screen instance
```

`v-safe-html` / `v-escape` come from `@antdv/shared/utils/xss`. Two pitfalls we already hit:

1. **In the html context, `v-escape` must not escape a second time.** `textContent` never parses the content as HTML to begin with, so running `escapeHtml` again only makes users see literals like `&lt;script&gt;`. The html context now writes the raw text as is, while the other contexts (`url` / `js` / `css` / `attr`) transform according to their own semantics: `v-escape:url` replaces pseudo-protocols such as `javascript:` with `#unsafe-url`.
2. **`<script setup>` unwraps refs inside template expressions automatically.** `@click="flashLoading(boxLoading)"` passes `false` into the function rather than a `Ref`, so `target.value = true` throws `Cannot create property 'value' on boolean 'false'` and the mask never appears. Pass "a key name + one `reactive` record" instead, don't hand a ref over as an argument.
