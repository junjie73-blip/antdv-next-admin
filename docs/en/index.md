---
layout: home

hero:
  image:
    src: /logo-512.png
    alt: Antdv Admin
  name: Antdv Admin
  text: Enterprise admin dashboard template
  tagline: Vue 3 · antdv-next · Tailwind CSS v4 · pnpm Monorepo · in-process Nitro Mock · end-to-end tests on three engines
  actions:
    - theme: brand
      text: Quick start
      link: /en/guide/introduction/quick-start
    - theme: alt
      text: Examples
      link: /en/components/
    - theme: alt
      text: FAQ
      link: /en/guide/other/faq
    - theme: alt
      text: View on GitHub
      link: https://github.com/junjie73-blip/antdv-next-admin

features:
  - icon: 🧩
    title: Cleanly split sub-packages
    details: 9 runtime sub-packages plus 4 internal tooling packages. Shared packages never import pinia / vue-router / store; the capabilities they need come in through dependency injection, so each one can be reused on its own in another project.
    link: /en/guide/project/dir
    linkText: Package layout
  - icon: 🧭
    title: Routes and menu
    details: File-convention routing plus the layouts plugin and five guards; the sidebar does not come from the route table but from the /menus response, which then prunes the registry.
    link: /en/guide/essentials/route
    linkText: Read this
  - icon: 🔌
    title: Home-grown request layer
    details: 'Built on createFetch rather than axios: Bearer injection, CSRF double submit, exponential-backoff retries, refresh-and-replay-once on 401, and cancellation on unmount.'
    link: /en/guide/essentials/request
    linkText: API contract
  - icon: 🗃
    title: State management
    details: 'Six setup stores with hand-rolled persistence: the cache key prefix comes from VITE_APP_TITLE, production values are SM4-encrypted, and logout has exactly one aggregate exit.'
    link: /en/guide/essentials/stores
    linkText: State and caching
  - icon: 🎨
    title: The theme really does follow along
    details: Primary color, corner radius, font size, and sidebar width are written into CSS variables; selected menu items, link buttons, and progress bars recolor together, and dark mode plus gray/color-weak mode go through the same chain.
    link: /en/guide/in-depth/theme
    linkText: Theme and preferences
  - icon: 🧱
    title: 7 layout variants
    details: The combinations of top bar, sidebar, icon bar, and breadcrumb are described by a "region blueprint", so adding a variant doesn't require touching the layout components; tab pages and keep-alive share one source.
    link: /en/guide/in-depth/layout
    linkText: Layout and tabs
  - icon: 🛡
    title: Three permission layers
    details: 'The menu is the permission: it decides which routes you can enter. Button level goes through hasPermission and directives; anything out of bounds lands on /error/403. No guard reads meta.roles.'
    link: /en/guide/in-depth/access
    linkText: Permissions and directives
  - icon: 🚀
    title: Runs with zero backend
    details: The dev process spins up Nitro Mock in-process (5320), so the 30+ example pages, login, upload, and scheduled jobs all have data — and you can tune latency and failure rate live.
    link: /en/guide/essentials/mock
    linkText: Mock server
  - icon: ✅
    title: End-to-end on three engines
    details: Playwright runs against a real dev server on Chromium / Firefox / WebKit, plus 250+ unit tests and a few "source contract" guards. Merge only when it's all green.
    link: /en/guide/project/testing
    linkText: Testing strategy
  - icon: 🖼
    title: Design tokens and global styles
    details: Tailwind v4 with an explicit layer order, so overriding the component library needs no !important; the shadcn semantic palette ships as --app-* variables pinned to the root element, so overlays and pages resolve identically.
    link: /en/guide/essentials/design
    linkText: Design tokens
  - icon: 📦
    title: Versions managed by changesets
    details: Changes ship with a changeset, `pnpm version` generates the CHANGELOG, and `pnpm release` publishes. Version numbers are never written by hand.
    link: /en/guide/other/changelog
    linkText: Releases and changelog
  - icon: 🌐
    title: Bilingual documentation site
    details: The VitePress site ships to GitHub Pages through its own GitHub Actions workflow that only builds docs — no lint, type-check, or e2e — so the two release cadences never block each other.
    link: /en/guide/essentials/deploy
    linkText: CI and deployment
---

## What this documentation answers

| Your situation | Go straight to |
| --- | --- |
| Just cloned it, want it running | [Getting started](/en/guide/introduction/quick-start) |
| Want to know which components exist and how to use them | [Component examples](/en/components/), [Shared components](/en/components/common-ui) |
| Want to know why the code is arranged this way | [Core concepts](/en/guide/essentials/concepts), [Directory structure](/en/guide/project/dir) |
| Adding a page / a menu entry | [Routes and menu](/en/guide/essentials/route), [Layout, menu, and tab pages](/en/guide/in-depth/layout) |
| Calling an API or adding a field | [Request layer and API contract](/en/guide/essentials/request), [Data mocking](/en/guide/essentials/mock) |
| Keeping state that outlives one page | [State management](/en/guide/essentials/stores) |
| Writing styles or hunting an icon | [Design tokens and global styles](/en/guide/essentials/design) |
| Changing the primary color or adding a preference switch | [Theme and preferences](/en/guide/in-depth/theme) |
| Controlling button / route permissions | [Permissions, directives and cursors](/en/guide/in-depth/access) |
| What checks to pass before committing | [Development conventions and environment variables](/en/guide/essentials/development), [Testing strategy](/en/guide/project/testing) |
| Shipping it live | [Build and deployment](/en/guide/essentials/deploy) |
| Want to know what changed in this round | [Changelog](/en/guide/other/changelog) |
| Hitting a pitfall someone already hit | [FAQ](/en/guide/other/faq) |

::: info

Conventions Every command in the docs runs from the repo root. The package manager is pinned to `pnpm@10.12.4` (locked by the `packageManager` field), Node is required to be `>=22`, and locally we use 24.0.0 from `.node-version`.
:::
