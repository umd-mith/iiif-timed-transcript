#!/usr/bin/env bash
# The .docx at docs/a11y/vpat-2.5-int.docx is the canonical Accessibility
# Conformance Report. Colleagues review and edit it in Word; the Markdown
# beside it is a generated reading copy, kept in sync so the repository still
# renders the report on GitHub and so diffs are legible in review.
#
#   ./scripts/acr-docx.sh sync    docx -> md   (after Word edits: run this)
#   ./scripts/acr-docx.sh build   md   -> docx (only to re-style the document)
#
# `build` OVERWRITES the canonical file. Use it only when nobody has unmerged
# Word edits, and never to discard tracked changes.
set -euo pipefail
cd "$(dirname "$0")/.."

DOCX="docs/a11y/vpat-2.5-int.docx"
MD="docs/a11y/vpat-2.5-int.md"
TITLE="Accessibility Conformance Report — iiif-transcript-player"
AUTHOR="Trevor Muñoz, MITH, University of Maryland"

case "${1:-}" in
  sync)
    pandoc "$DOCX" -f docx -t gfm --wrap=none -o "$MD"
    npx prettier --write "$MD" >/dev/null
    echo "synced $DOCX -> $MD (review the diff; pandoc round-trips lose link syntax)"
    ;;
  build)
    tmp="$(mktemp -d)"
    pandoc "$MD" -f gfm -t docx -V lang=en-US \
      --metadata title="$TITLE" --metadata author="$AUTHOR" \
      --metadata date="$(date '+%-d %B %Y')" \
      -o "$tmp/raw.docx"
    python3 scripts/acr-docx-style.py "$tmp/raw.docx" "$DOCX"
    rm -rf "$tmp"
    echo "built $MD -> $DOCX"
    ;;
  *)
    echo "usage: $0 {sync|build}" >&2; exit 2 ;;
esac
