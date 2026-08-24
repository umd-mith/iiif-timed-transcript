# Segment semantics rationale

Prepared for the README accessibility section (C1, consumed by phase G6).
Source: `src/lib/player/TranscriptSegments.svelte` (comment above the
`role="group"` container, A8).

## For the README

> Transcript segments are `role="button"` elements rather than native
> `<button>`s: a native button's content commonly resists text selection,
> which conflicts with a transcript's core reading-and-copying use case.
> Each segment is fully keyboard-operable (Enter or Space activates it,
> matching native button semantics) via an explicit keydown handler, and the
> segment list itself is a labelled `role="group"` rather than a
> `role="toolbar"`, since a transcript is primarily readable text, not a row
> of action controls.

## Verification performed (A8, 2026-08-24)

Checked against `src/lib/transcript/Segment.svelte`:

- `role="button"` on the segment root (line 62).
- Keyboard activation via `onkeydown` handling Enter/Space (lines 68–73),
  matching native `<button>` activation semantics.
- `all: unset` in the component's style block (lines 87–92) resets
  `user-select` to its initial value, keeping segment text selectable —
  the property most likely to regress if this were a native `<button>`,
  where UA stylesheets / form-control rendering commonly suppress content
  selection.

No native-button conversion is warranted; this rationale holds.
