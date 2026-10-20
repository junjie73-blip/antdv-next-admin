# Antdv Next Vue Admin

**English** | [简体中文](./README.md)

A modern enterprise admin template: Vue 3 + TypeScript + reka-ui / shadcn-vue + Tailwind CSS v4, pnpm monorepo. It runs with zero backend during development (in-process Nitro mock) and ships chromium / firefox / webkit end-to-end tests.

---

## Tech stack

| Category        | Technology         | Version      |
| --------------- | ------------------ | ------------ |
| Framework       | Vue 3 + TypeScript | 3.5.43 / 6.0 |
| UI              | reka-ui + shadcn   | 2.11.0       |
| Styling         | Tailwind CSS v4    | ^4.3.3       |
| State           | Pinia 3            | ^3.0.4       |
| Routing         | Vue Router         | ^5.3.1       |
| HTTP            | custom fetch layer | —            |
| i18n            | vue-i18n           | ^11.4.13     |
| Charts          | ECharts            | ^6.1.0       |
| Build           | Vite               | ^8.3.3       |
| Mock            | Nitro (in-process) | ^2.13.4      |
| Package manager | pnpm               | 10.12.4      |

Versions always come from the catalog in the root `pnpm-workspace.yaml`; sub-packages write `"xxx": "catalog:"`, so this table is the real version set.

---

## Quick start

```bash
pnpm install          # preinstall enforces pnpm; npm/yarn are blocked
pnpm dev              # admin app  http://localhost:6080
```

Login account (mock): `admin` / `admin123`.

The mock server is started **in-process** by the dev process (Nitro, port 5320), and `/api` is proxied to it by the dev server, so you do not need a backend first. Requires Node `>=22`.

---

## Repository structure

```
apps/
├── web/                  # admin app (@antdv/web)
│   ├── src/
│   │   ├── api/          # API wrappers (request.ts provides get/post/put/del)
│   │   ├── composables/  # app-level composables (re-export @antdv/request)
│   │   ├── config/       # constants (cache key names, login path, etc.)
│   │   ├── layouts/      # app-side layout assembly (shells come from @antdv/layouts)
│   │   ├── locales/      # zh-CN / en-US
│   │   ├── plugins/      # runtime injection (request credentials, vue-query, table, UI shells)
│   │   ├── router/       # file-convention routing + guard registration (guards from @antdv/router)
│   │   ├── stores/       # user / app / route / dict / tabs
│   │   ├── utils/        # ws.ts singleton, cache, crypto, security init
│   │   └── views/        # pages: login system dashboard screen components ...
│   └── e2e/              # Playwright end-to-end tests (three engines)
├── backend-mock/         # Nitro mock APIs and runtime controls
docs/                     # VitePress docs site, a package beside apps/; not part of the app build
packages/                 # runtime sub-packages (core/{base,ui-kit,composables,preferences} / request / layouts / router / enums / utils / directives ...)
internal/                 # build and lint tooling (vite-config / lint-configs / tsconfig / node-utils)
scripts/                  # repo tasks such as vsh
.changeset/               # versions and change notes
.github/workflows/        # ci.yml (CI gate) + docs.yml
```

> **Key constraint**: `packages/*` must **never** import `pinia` / `vue-router` / stores; capabilities they need are obtained via dependency injection, so each package can be reused standalone in other projects. What consumers get from a sub-package is its **`dist` output**, so after changing `packages/*/src` run `pnpm --filter <pkg> build` and restart dev.

---

## Development scripts

```bash
pnpm build            # full build (turbo)
pnpm lint             # eslint (vsh lint)
pnpm check            # circular deps + dependency direction + type-check + spelling
pnpm test:unit        # vitest, builds dependencies first per the turbo task graph
pnpm test:e2e         # Playwright, chromium / firefox / webkit
pnpm check:type       # vue-tsc (pre-existing type debt; reports but does not block)
pnpm changeset        # record a change note
```

CI (`.github/workflows/ci.yml`) has three jobs: `quality` (lint + circular dependencies + unit tests, blocking), `e2e` (three-engine matrix, blocking) and `type-check` (pre-existing debt, reports but does not block).

---

## Contributing

- Commit messages follow the Angular commit convention (Conventional Commits); `pnpm commit` generates them interactively;
- Make sure `pnpm lint` and `pnpm test:unit` pass before committing;
- Add a changeset (`pnpm changeset`) for changes that affect released artifacts.

---

## License

MIT, see `LICENSE`.
