#!/usr/bin/env bash
set -euo pipefail

# Release script for @umd-mith/iiif-timed-transcript
# Usage: ./scripts/release.sh [--dry-run] [version]
# Example: ./scripts/release.sh 0.16.0
#          ./scripts/release.sh --dry-run 0.16.0
#
# Publishing is done in CI: pushing the v* tag triggers publish.yml, which runs
# `npm publish --provenance` via OIDC trusted publishing. This script never
# publishes locally (provenance requires a supported CI/OIDC environment).

cd "$(dirname "$0")/.."

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

DRY_RUN=false

info() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
error() { echo -e "${RED}==>${NC} $1" >&2; exit 1; }
dry() { echo -e "${BLUE}[dry-run]${NC} $1"; }

run() {
    if [[ "$DRY_RUN" == true ]]; then dry "$*"; else "$@"; fi
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true; shift ;;
        -*) error "Unknown option: $1" ;;
        *) break ;;
    esac
done

if [[ "$DRY_RUN" == true ]]; then echo -e "${BLUE}=== DRY RUN MODE ===${NC}"; echo ""; fi

CURRENT_VERSION=$(node -p "require('./package.json').version")

if [[ -n "${1:-}" ]]; then
    NEW_VERSION="$1"
else
    echo "Current version: $CURRENT_VERSION"
    read -rp "New version: " NEW_VERSION
fi

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    error "Invalid version format: $NEW_VERSION (expected semver like 1.0.0 or 1.0.0-beta.1)"
fi

echo ""
info "Release checklist:"
echo "  - Version: $CURRENT_VERSION → $NEW_VERSION"
echo "  - Update package.json"
echo "  - Update CHANGELOG.md"
echo "  - Commit and tag v$NEW_VERSION"
echo "  - Push to origin (tag push triggers CI publish via OIDC)"
echo ""
read -rp "Proceed? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then echo "Aborted."; exit 0; fi

info "Running preflight checks..."
if [[ -n "$(git status --porcelain)" ]]; then
    if [[ "$DRY_RUN" == true ]]; then warn "Working directory not clean (ignored in dry-run)";
    else error "Working directory not clean. Commit or stash changes first."; fi
fi

BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
    warn "Not on main branch (currently on $BRANCH)"
    read -rp "Continue anyway? [y/N] " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then exit 0; fi
fi

info "Running tests..."
pnpm test

info "Running type check..."
pnpm typecheck

info "Building..."
pnpm build

info "Updating package.json..."
run npm version "$NEW_VERSION" --no-git-tag-version

info "Updating CHANGELOG.md..."
TODAY=$(date +%Y-%m-%d)
if [[ "$DRY_RUN" == true ]]; then
    dry "CHANGELOG: insert [$NEW_VERSION] - $TODAY heading below [Unreleased]"
else
    # Portable in-place edit (avoids BSD/GNU sed -i and \n differences).
    NEW_VERSION="$NEW_VERSION" TODAY="$TODAY" node -e '
        const fs = require("fs");
        const file = "CHANGELOG.md";
        const marker = "## [Unreleased]";
        const text = fs.readFileSync(file, "utf8");
        if (!text.includes(marker)) {
            console.error(`release: "${marker}" heading not found in ${file}`);
            process.exit(1);
        }
        const heading = `${marker}\n\n## [${process.env.NEW_VERSION}] - ${process.env.TODAY}`;
        fs.writeFileSync(file, text.replace(marker, heading));
    '
fi

info "Committing changes..."
run git add package.json CHANGELOG.md
run git commit -m "chore(release): release v$NEW_VERSION

Assisted-by: Claude <noreply@anthropic.com>"

info "Creating tag v$NEW_VERSION..."
run git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

info "Pushing to origin..."
run git push origin "$BRANCH"
run git push origin "v$NEW_VERSION"

info "Creating GitHub release..."
# Notes come from this version's CHANGELOG section (already written above), so
# the GitHub Releases page stays in sync with the tags and npm instead of
# falling behind. Non-fatal: the tag is already pushed and CI publishes from it,
# so a gh hiccup here should not abort the release.
NOTES_FILE="$(mktemp)"
NEW_VERSION="$NEW_VERSION" node -e '
    const fs = require("fs");
    const v = process.env.NEW_VERSION;
    const text = fs.readFileSync("CHANGELOG.md", "utf8");
    const re = new RegExp("## \\[" + v.replace(/\./g, "\\.") + "\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)");
    const m = text.match(re);
    fs.writeFileSync(process.argv[1], (m ? m[1].trim() : "Release v" + v) + "\n");
' "$NOTES_FILE"
run gh release create "v$NEW_VERSION" --title "v$NEW_VERSION" --notes-file "$NOTES_FILE" --verify-tag --latest \
    || warn "GitHub release creation failed — create it manually: gh release create v$NEW_VERSION --notes-file <changelog section> --verify-tag --latest"
rm -f "$NOTES_FILE"

echo ""
if [[ "$DRY_RUN" == true ]]; then
    info "Dry run complete for v$NEW_VERSION"
    echo "  Run without --dry-run to execute"
else
    info "Tagged and pushed v$NEW_VERSION (CI publishes to npm via OIDC on the tag)"
    echo "  - Actions: https://github.com/umd-mith/iiif-timed-transcript/actions/workflows/publish.yml"
    echo "  - npm: https://www.npmjs.com/package/@umd-mith/iiif-timed-transcript"
    echo "  - GitHub: https://github.com/umd-mith/iiif-timed-transcript/releases/tag/v$NEW_VERSION"
fi
