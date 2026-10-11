---
layout: home

hero:
  name: Antdv Admin
  text: Vue 3 + antdv-next admin template
  tagline: pnpm Monorepo, in-process Nitro Mock, end-to-end tests on three engines, hosted on Vercel + GitHub Pages
  actions:
    - theme: brand
      text: Getting started
      link: /en/getting-started
    - theme: alt
      text: Monorepo architecture
      link: /en/architecture
    - theme: alt
      text: CI and deployment
      link: /en/deploy

features:
  - title: Cleanly split sub-packages
    details: 9 runtime sub-packages plus internal tooling packages. Shared packages never import pinia / vue-router / store; the capabilities they need come in through dependency injection, so each one can be reused on its own in another project.
  - title: 7 layout variants
    details: The combinations of top bar, sidebar, icon bar, and breadcrumb are described by a "region blueprint", so adding a variant doesn't require touching the layout components.
  - title: The theme really does follow along
    details: Primary color, corner radius, font size, and sidebar width are written into CSS variables; selected menu items, link buttons, and progress bars recolor together, and dark mode plus gray/color-weak mode go through the same chain.
  - title: Runs with zero backend
    details: The dev process spins up Nitro Mock in-process (5320), and the 21 menu pages, login, upload, and scheduled jobs all have data — no need to start a backend first.
  - title: End-to-end on three engines
    details: Playwright runs against a real dev server on Chromium / Firefox / WebKit, plus 250+ unit tests and a few "source contract" guards. Merge only when it's all green.
  - title: Versions managed by changesets
    details: Changes ship with a changeset, `pnpm version` generates the CHANGELOG, and `pnpm release` publishes. Version numbers are never written by hand.
---

## What this documentation answers

| Your situation | Go straight to |
| --- | --- |
| Just cloned it, want it running | [Getting started](/en/getting-started) |
| Want to know why the code is arranged this way | [Monorepo architecture](/en/architecture) |
| Changing the menu / tab pages / layout | [Layout, menu, and tab pages](/en/layout) |
| Changing the primary color or adding a preference switch | [Theming and preferences](/en/theming) |
| Controlling button / route permissions | [Permissions and directives](/en/permissions) |
| Adding a mock endpoint | [Mock service](/en/mock) |
| What checks to pass before committing | [Development conventions and environment variables](/en/development), [Testing strategy](/en/testing) |
| Shipping it live | [CI and deployment](/en/deploy) |

::: info Conventions
Every command in the docs runs from the repo root. The package manager is pinned to `pnpm@10.12.4` (locked by the `packageManager` field), Node is required to be `>=22`, and locally we use 24.0.0 from `.node-version`.
:::
