# Changesets

In one sentence: **releases run on changesets (`pnpm changeset` → `pnpm version` → `pnpm exec changeset tag` → `pnpm release`); every `@antdv/*` package sits in a `fixed` group and versions in lockstep; private packages still get version bumps and tags. The chain first completed on 2026-10-23, putting all 34 packages on `0.1.0`. The root `CHANGELOG.md` is a standard-version relic nobody maintains.**

## Reading `.changeset/config.json`

| Key | Value | What it means here |
| --- | --- | --- |
| `changelog` | `@changesets/changelog-git` | CHANGELOG entries carry the short commit SHA and need no credentials (`changelog-github` looks each commit up on the GitHub API, and without `GITHUB_TOKEN` it aborts the whole `version` run) |
| `fixed` | `[["@antdv/*", "@antdv/*"]]` | **lockstep versioning**: one minor bump and the whole `@antdv/*` family (including `@antdv/web` and `@antdv/backend-mock`) rises to the same number — the landing point being the **highest version currently in the group** plus the largest bump level of the round. This is the right call for this monorepo — internal deps are `workspace:*` and cross-package types (`@antdv/types`) desynchronize the moment versions diverge |
| `privatePackages` | `{ version: true, tag: true }` | `private: true` packages still bump and get tagged; they just aren't published to npm |
| `baseBranch` | `main` | changesets diff against main to decide what changed |
| `updateInternalDependencies` | `patch` | internal dependency ranges follow patch-level updates |
| `snapshot.prereleaseTemplate` | `{tag}-{datetime}` | snapshot prereleases carry a timestamp |
| `commit` / `access` / `linked` / `ignore` | `false` / `public` / `[]` / `[]` | no changeset commit helper, no linked groups, no ignored packages |

## The wired commands (root `package.json`)

```bash
pnpm changeset   # pnpm exec changeset — pick packages + bump level, write .changeset/*.md
pnpm version     # pnpm exec changeset version && pnpm install --no-frozen-lockfile
pnpm release     # pnpm run build && pnpm exec changeset publish
```

The order is the contract: **every change ships with its changeset file** (`.changeset/` now holds only `config.json` — 0.1.0 consumed all 38 registered entries; historically `monorepo-shared-packages.md` listed 13 packages as minor). `version` folds the summaries into per-package CHANGELOGs, rewrites versions, deletes the changeset files, and needs the lockfile re-resolved — the script already chains `pnpm install --no-frozen-lockfile`; don't drop it when running steps manually. `changeset tag` then tags every package as `<pkg>@<version>` (a plain `git push` does not carry tags; use `--follow-tags`). `release` builds everything before publishing. `pnpm publint` (`vsh publint`) checks export surfaces before any publish — a package that can't be resolved is the classic publish accident.

::: warning A renamed package breaks the whole chain

`changeset version` validates that every package named in a changeset is still in the workspace, and `.changeset/monorepo-shared-packages.md:4-5` used to name `@antdv/composables` (now `@antdv/hooks`) and `@antdv/ui` (its common components are now `@antdv/common-ui` in ui-kit). Both are gone, so `pnpm changeset status` / `version` / `release` all fail hard — the whole plan is aborted, not just that one changeset skipped. That is what blocked the first 0.1.0 run; both lines now carry the current names. The rule: **when a package is renamed or split, the names registered in `.changeset/*.md` are part of the rename**. No CI job runs changesets, so this only surfaces when someone actually tries to release — `pnpm changeset status` is read-only and would make a cheap gate. Full write-up in the [changelog](/en/guide/other/changelog).

:::

## Catalog + workspace versioning

- External deps: versions exist only in `pnpm-workspace.yaml`'s `catalog:` (e.g. `@changesets/cli: ^3.0.3`, `antdv-next: ^1.6.0`); package.json files write `catalog:`. `pnpm catalog` (`codemod pnpm/catalog`) batch-syncs them.
- Internal deps: always `workspace:*`. `changeset version` does **not** rewrite them into concrete numbers (after 0.1.0 every package still says `workspace:*`); resolving the protocol is `pnpm publish`'s job, and since all packages are private that step never runs today.

## Historical baggage: CHANGELOG.md and two stale tags

Places that will mislead you, stated up front:

- The root `CHANGELOG.md` header is standard-version output — `0.0.1 (2026-06-05)` — unrelated to the current pipeline; the `monorepo-shared-packages.md` summary explicitly records "release flow moved to changesets (standard-version removed)".
- Before 0.1.0 the only git tags were `v0.0.3` and `vnull` (a malformed tag from the migration, pointing at a 2026-09-25 commit named "📦 准备提交"), while the packages sat on five different numbers — the numbers moved, the tags did not, so that stretch of the rework has no release record to look up. From 0.1.0 on, trust each package's `CHANGELOG.md` and its `<pkg>@<version>` tag; `v0.0.3` and `vnull` are archaeology.

## Writing good changesets

- Existing entries are Chinese prose organized as added/fixed/migrated bullets, and they describe **user-visible behavior** (e.g. `theme-primary-follow-through.md`, `login-page-theme-aware.md`) — not a file diff list.
- `.changeset/*.md` is inside the spellcheck glob (`pnpm check` → `check:cspell`), so coined terms get flagged; reuse wording from existing entries.
- Changing `packages/*` behavior without adding a changeset silently loses that CHANGELOG line forever — the reason [Testing](/en/guide/project/testing) ends its checklist with "changes worth a version got a changeset".
