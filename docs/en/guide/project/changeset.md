# Changesets

In one sentence: **releases run on changesets (`pnpm changeset → version → release`); every `@antdv/*` package sits in a `fixed` group and versions in lockstep; private packages still get version bumps and tags. The root `CHANGELOG.md` is a standard-version relic nobody maintains.**

## Reading `.changeset/config.json`

| Key | Value | What it means here |
| --- | --- | --- |
| `changelog` | `["@changesets/changelog-github", { repo: "junjie73-blip/antdv-next-admin" }]` | generated CHANGELOGs link commits on GitHub |
| `fixed` | `[["@antdv/*", "@antdv/*"]]` | **lockstep versioning**: one minor bump and the whole `@antdv/*` family (including `@antdv/web` and `@antdv/backend-mock`) rises to the same number. This is the right call for this monorepo — internal deps are `workspace:*` and cross-package types (`@antdv/types`) desynchronize the moment versions diverge |
| `privatePackages` | `{ version: true, tag: true }` | `private: true` packages still bump and get tagged; they just aren't published to npm |
| `baseBranch` | `main` | changesets diff against main to decide what changed |
| `updateInternalDependencies` | `patch` | internal dependency ranges follow patch-level updates |
| `snapshot.prereleaseTemplate` | `{tag}-{datetime}` | snapshot prereleases carry a timestamp |
| `commit` / `access` / `linked` / `ignore` | `false` / `public` / `[]` / `[]` | no changeset commit helper, no linked groups, no ignored packages |

## The three wired commands (root `package.json`)

```bash
pnpm changeset   # pnpm exec changeset — pick packages + bump level, write .changeset/*.md
pnpm version     # pnpm exec changeset version && pnpm install --no-frozen-lockfile
pnpm release     # pnpm run build && pnpm exec changeset publish
```

The order is the contract: **every change ships with its changeset file** (`.changeset/` currently holds 15 pending entries; `monorepo-shared-packages.md` lists all 13 packages as minor). `version` folds the summaries into per-package CHANGELOGs, rewrites versions, deletes the changeset files, and needs the lockfile re-resolved — the script already chains `pnpm install --no-frozen-lockfile`; don't drop it when running steps manually. `release` builds everything before publishing. `pnpm publint` (`vsh publint`) checks export surfaces before any publish — a package that can't be resolved is the classic publish accident.

## Catalog + workspace versioning

- External deps: versions exist only in `pnpm-workspace.yaml`'s `catalog:` (e.g. `@changesets/cli: ^3.0.3`, `antdv-next: ^1.6.0`); package.json files write `catalog:`. `pnpm catalog` (`codemod pnpm/catalog`) batch-syncs them.
- Internal deps: always `workspace:*`; changesets rewrites them to real numbers on release, consistent across the fixed group.

## Historical baggage: CHANGELOG.md and two stale tags

Places that will mislead you, stated up front:

- The root `CHANGELOG.md` header is standard-version output — `0.0.1 (2026-06-05)` — unrelated to the current pipeline; the `monorepo-shared-packages.md` summary explicitly records "release flow moved to changesets (standard-version removed)".
- The only git tags are `v0.0.3` and `vnull` (a malformed tag from the migration). The root version is already `0.4.0`, so neither tag matches reality — after the first `changeset publish`, trust per-package CHANGELOGs and package-level tags instead.

## Writing good changesets

- Existing entries are Chinese prose organized as added/fixed/migrated bullets, and they describe **user-visible behavior** (e.g. `theme-primary-follow-through.md`, `login-page-theme-aware.md`) — not a file diff list.
- `.changeset/*.md` is inside the spellcheck glob (`pnpm check` → `check:cspell`), so coined terms get flagged; reuse wording from existing entries.
- Changing `packages/*` behavior without adding a changeset silently loses that CHANGELOG line forever — the reason [Testing](/en/guide/project/testing) ends its checklist with "changes worth a version got a changeset".
