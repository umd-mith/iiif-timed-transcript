# Contributing

## Setup

```bash
git clone git@github.com:umd-mith/svelte-iiif-transcript-player.git
cd svelte-iiif-transcript-player
pnpm install
pnpm exec playwright install chromium
```

## Commands

| Command           | Description         |
| ----------------- | ------------------- |
| `pnpm test`       | Run tests (browser) |
| `pnpm test:watch` | Watch mode          |
| `pnpm typecheck`  | Type-check          |
| `pnpm lint`       | Lint + format check |
| `pnpm format`     | Auto-format         |
| `pnpm build`      | Build `dist/`       |

## Commits

Follows [Conventional Commits](https://www.conventionalcommits.org/). Enforced by commitlint.

## Releasing

Releases are cut from a clean `main` and published to npm automatically via
[OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers) — no tokens
are stored in the repo.

1. Ensure changes are on `main` and CI is green.
2. Move the new changes under `## [Unreleased]` in `CHANGELOG.md`.
3. Run `pnpm run release --no-publish X.Y.Z` (add `--dry-run` first to preview).
   This tests, type-checks, builds, bumps the version, dates the changelog,
   commits, tags `vX.Y.Z`, and pushes the branch and tag.
4. The pushed tag triggers `.github/workflows/publish.yml`, which publishes
   `@umd-mith/svelte-iiif-transcript-player` to npm with provenance.
