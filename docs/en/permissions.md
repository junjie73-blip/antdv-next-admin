# Permissions, directives and cursors

## Three permission layers

| Layer | Who owns it | How failure shows up |
| --- | --- | --- |
| Routing | The navigation guards in `@antdv/router`: login check + filtering menus/routes by permission | Redirect to the login page, or land on `/error/403` / `/error/404` |
| Menu | The backend menu endpoint returns only the items you have rights to, the frontend stops guessing | It never shows up in the menu at all |
| Element | `v-permission` (`@antdv/directives`) | `display: none` by default, or the `.disabled` fallback |

::: tip Fallback pages don't belong in tab pages
`/error/403` and `/error/404` are marked `hidden` in the menu and take no part in tab page registration — opening an
error page once should not leave a "404" behind in the tab bar. The site-wide sweep decides "landed on a fallback page"
from the address (`toHaveURL(/#\/error\/404/)`) — not from which tab is active.
:::

## How to write `v-permission` (don't mix up arg and modifier)

The decision priority comes from `packages/directives/src/permission/utils.ts`:
`arg === 'admin'` → super admin; a `'*'` permission code → everything passes; `arg === 'role'` → interpret as roles; otherwise interpret as permission codes.

```vue
<!-- By permission code (the default interpretation), an "or" relationship -->
<a-button v-permission="'system:user:add'">Add</a-button>
<a-button v-permission="['system:user:edit', 'system:user:add']">Edit</a-button>

<!-- Require both at the same time → .all -->
<a-button v-permission="['a', 'b'].all">Both required</a-button>

<!-- By role: role is the **arg** -->
<a-button v-permission:role="'auditor'">Visible to auditors</a-button>

<!-- Super admin: also an arg, with an empty value -->
<a-button v-permission:admin>Visible to admins</a-button>

<!-- Don't hide it, fall back to disabled instead -->
<a-button v-permission.disabled="'system:user:delete'">Delete</a-button>
```

::: danger `role` / `admin` are args, not modifiers
Write `v-permission.role="'auditor'"` or `v-permission.admin` and the check **never reads them at all**,
so the element is visible forever — no error, no warning: the hardest class of permission bug to notice.
(The only real modifiers are `.all` and `.disabled`.)
`apps/web/src/views/__tests__/gallery-api-usage.spec.ts` has a static guard that catches exactly this pattern,
with two sample sets — "must match" and "must not over-match" — so the rule itself can't be silently empty.
:::

The object form can carry its own criteria, and then `arg` no longer takes part in interpretation:

```vue
<a-button v-permission="{ mode: 'all', permissions: ['a', 'b'], roles: ['ops'] }">
  Mixed check
</a-button>
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
  subscribe: (notify) => watch(() => useUserStore().permissions, notify, { deep: true }),
});
```

`subscribe` is the one that matters: without it, a button that **renders before the permissions arrive** stays "invisible" forever.
The directive calls the returned stop function on `unmounted`, so no dangling `watch` is left behind.

## Fallback styling belongs to the style layer

The directive only "raises a flag" (under the `.disabled` modifier it adds `permission-disabled`, by default it just sets `display:none`);
the visual result is decided by `@antdv/styles/permission.css`:

```css
.permission-disabled {
  @apply cursor-not-allowed opacity-50 saturate-50 select-none;
  pointer-events: none; /* non-form elements don't honor the disabled attribute, so block interaction here uniformly */
}
```

It is written inside `@layer components`, so utility classes in templates still override it — if you want "no permission but still fully opaque",
add `opacity-100`; if you want "looks downgraded but still interactive", add `permission-disabled--passthrough`. No change to the directive needed.

## Cursor rule: pointer only when it's clickable

The shared rule is that **only elements that really trigger interaction get `cursor-pointer`**: clickable cards, buttons, links,
tab pages, tree nodes and switches all do; disabled state gets `cursor-not-allowed`; display-only containers and text keep the default cursor.
Making "every box with hover should have a cursor" into a blanket `:hover { cursor: pointer }` would trick non-clickable areas
into looking clickable — that is a usability regression, so classify by "can it be clicked", not by "does it have hover styles".

## Four other security/experience directives

```ts
// apps/web/src/main.ts
app.directive('safe-html', safeHtmlDirective);   // whitelist-based rich text rendering
app.directive('escape', escapeDirective);        // escape by context
app.directive('lazy', vLazy);                    // load only when it enters the viewport
app.directive('loading', vLoading);              // element mask + full-screen instance
```

`v-safe-html` / `v-escape` come from `@antdv/shared/xss`. Two pitfalls we already hit:

1. **In the html context, `v-escape` must not escape a second time.** `textContent` never parses the content as HTML to begin with,
   so running `escapeHtml` again only makes users see literals like `&lt;script&gt;`. The html context now writes
   the raw text as is, while the other contexts (`url` / `js` / `css` / `attr`) transform according to their own semantics:
   `v-escape:url` replaces pseudo-protocols such as `javascript:` with `#unsafe-url`.
2. **`<script setup>` unwraps refs inside template expressions automatically.** `@click="flashLoading(boxLoading)"`
   passes `false` into the function rather than a `Ref`, so `target.value = true` throws
   `Cannot create property 'value' on boolean 'false'` and the mask never appears.
   Pass "a key name + one `reactive` record" instead, don't hand a ref over as an argument.
