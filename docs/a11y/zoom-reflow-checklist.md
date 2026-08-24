# Zoom and reflow checklist

**Scope:** the `<iiif-transcript-player>` custom element. Settles WCAG 1.4.4
Resize Text, 1.4.10 Reflow, and 1.4.12 Text Spacing.

**Pages used:** `examples/element/plain.html`, and the multi-canvas fixture
page `/canvas-nav-demo` on the docs site for the canvas-nav wrap check. See
[`keyboard-walkthrough.md`](keyboard-walkthrough.md) for how to run both.

**A note on what "320px" means for a component.** The reflow criterion is
written for pages. The element is not a page: it gets whatever width its
host gives it, which on a 320px-wide page is typically less than 320px once
the page's own padding is subtracted. Run the page-level checks at a 320px
viewport, and the component-level checks by narrowing the element's own
container — a component that only survives because the page happened to be
generous has not passed.

## 200% text-only zoom

Use the browser's text-only zoom (Firefox: View > Zoom > Zoom Text Only).
Where a browser has no text-only mode, substitute page zoom and record
which mode was actually used.

1. Load the player.
   - **Check:** no text is clipped or truncated where it shouldn't be.
     Control labels stay fully visible.
2. Look at the transcript panel, which has a `max-height` of 24rem.
   - **Check:** the panel's internal scrollbar still works at 200%, and
     text inside a segment wraps rather than being clipped by that fixed
     height.
3. Check the control bar (Play, Progress, Skip, Speed, Time, and the
   Captions toggle when present).
   - **Check:** controls stay operable — none overlap, none become
     unreachable because their container failed to grow with the zoomed
     text.
4. Check the search input and its match counter.
   - **Check:** the input stays usable and the counter text is not clipped.
5. Check the canvas-nav and chapter buttons.
   - **Check:** buttons wrap onto additional rows rather than overflowing
     or overlapping.

## 320px viewport

Resize the viewport to 320px wide at 100% zoom.

1. Load the player at 320px.
   - **Check:** no horizontal scrollbar on the page as a whole. The
     player's content reflows to fit rather than forcing page-level
     horizontal scroll.
2. Check the control bar.
   - **Check:** controls wrap onto additional rows; none are cut off at the
     320px edge.
3. Check the transcript panel and its `max-height` at this width.
   - **Check:** segment text wraps within the narrow column, and the
     timestamp-plus-text layout inside a segment does not force horizontal
     scrolling within the panel.
4. Check canvas nav at 320px.
   - **Check:** buttons stack into multiple rows.
5. Check the search input.
   - **Check:** it stays within the column rather than overflowing on its
     own padding and border.

## Results

Four of the five 320px rows are locked by
`src/element/element-reflow.test.ts`, which asserts the same conditions in
real Chromium on every run: row 2 (the control bar wraps), row 3 (a segment
stays inside its column), row 4 (canvas navigation wraps) and row 5 (the
search input stays in its column). Row 1 — no page-level horizontal scroll —
has no standing assertion, because it is a property of a whole page and this
component is not one; it stays a one-time observation.
The 200% section needs a human: text-only zoom is a browser chrome setting
with no automation surface, and "is anything clipped" is a judgment a DOM
measurement cannot make.

The commit SHAs below are element builds on branch `docs/a11y-acr`, which
had not merged when these rows were recorded. They are not reachable from
`feat/element-hardening-completion` or from `main`. Check out `docs/a11y-acr`
to reach them, and re-pin every row to the merge SHA once the branch lands.

| Commit SHA | Date       | Tester                                      | Mode           | Check                                  | Pass/Fail | Notes                                                                                                                                                                                                                                                                                               |
| ---------- | ---------- | ------------------------------------------- | -------------- | -------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|            |            |                                             | 200% zoom      | 1. No clipped/truncated text           |           |                                                                                                                                                                                                                                                                                                     |
|            |            |                                             | 200% zoom      | 2. Transcript panel max-height scroll  |           |                                                                                                                                                                                                                                                                                                     |
|            |            |                                             | 200% zoom      | 3. Control bar operable                |           |                                                                                                                                                                                                                                                                                                     |
|            |            |                                             | 200% zoom      | 4. Search input + counter              |           |                                                                                                                                                                                                                                                                                                     |
|            |            |                                             | 200% zoom      | 5. Canvas-nav/chapter wrap             |           |                                                                                                                                                                                                                                                                                                     |
| `e74e616`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | 320px viewport | 1. No page-level horizontal scroll     | ✅        | Document `scrollWidth` equals `clientWidth` (305px). Failed before `e74e616` — 526px of content in a 305px document.                                                                                                                                                                                |
| `e74e616`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | 320px viewport | 2. Control bar wraps/fits              | ✅        | `flex-wrap: wrap`, `scrollWidth` equals `clientWidth`. Failed before `e74e616`: the bar was `flex-wrap: nowrap` and held 483px of content in a 318px box, overflowing at every width below roughly 484px.                                                                                           |
| `e74e616`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | 320px viewport | 3. Transcript panel wraps, no h-scroll | ✅        | Panel and segments container both report `scrollWidth` equal to `clientWidth`; `max-height` resolves to 384px (24rem) with `overflow-y: auto`. Failed before `e74e616`: each segment measured 322px in a 303px column, because `box-sizing` was `content-box` under padding plus the 4px indicator. |
| `e74e616`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | 320px viewport | 4. Canvas-nav wraps                    | ✅        | `nav.canvas-nav` computes `flex-wrap: wrap` and does not overflow; the two buttons stack.                                                                                                                                                                                                           |
| `e74e616`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | 320px viewport | 5. Search input stays in column        | ✅        | `box-sizing: border-box`, no overflow against its container.                                                                                                                                                                                                                                        |
