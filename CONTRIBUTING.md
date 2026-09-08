# Contributing

## Setup

```bash
git clone git@github.com:umd-mith/iiif-timed-transcript.git
cd iiif-timed-transcript
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

## Releases

This project uses [Changesets](https://github.com/changesets/changesets). If your PR changes the public API, run `pnpm changeset` and commit the generated file with your PR.
