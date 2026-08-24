# Keyboard-only walkthrough

**Scope:** the `<iiif-transcript-player>` custom element, evaluated in
isolation on a minimal host page (per the evaluation framing in
[`vpat-2.5-int.md`](vpat-2.5-int.md)). Settles WCAG 2.1.2 No Keyboard Trap
and 2.4.3 Focus Order, and confirms the 2.4.7 Focus Visible fix.

**Tools:** keyboard only. No mouse, no trackpad. Tab, Shift+Tab, arrow keys,
Home, End, Enter, Space, Escape.

## Pages used

- **`examples/element/plain.html`** — a bare host page for the single-canvas
  pass. Open it after `pnpm run build`, since it loads the built IIFE bundle
  from `dist/element/`. Note that its style block is deliberately hostile: it
  remaps `--iiif-player-accent` and other tokens to prove they do not leak.
  That makes it the right page for keyboard order and trap checks, and the
  wrong page for judging the shipped default appearance — use the
  multi-canvas fixture page below for anything about default colors.
- **The multi-canvas fixture page**, `/canvas-nav-demo` on the docs site
  (`cd docs && pnpm install && pnpm run dev`, which opens at
  `http://localhost:4321/svelte-iiif-transcript-player`). Its manifest,
  `docs/public/fixtures/canvas-nav-a11y.json`, has two canvases that draw
  their transcripts from different sources — canvas 1 from an external
  WebVTT track, canvas 2 from embedded `TextualBody` annotations that name
  themselves ("Canvas 2, segment 1…"). If a canvas switch leaves a stale
  reference behind, the panel shows visibly wrong text rather than a subtle
  off-by-one. The page applies no `::part()` overrides and no token
  remapping, so what is audited is the element's shipped default
  appearance.
  **Not used:** the chapters demo (`/chapters-demo`). The element's fixed
  composition contains no chapters component, and that page is built on the
  Svelte compound API rather than on `<iiif-transcript-player>`, so it is a
  different product surface from the one this script scopes itself to.

## Browser requirement

**Run this on a real browser build, not headless Chromium.** Headless
Chromium ships without the H.264 decoder, and both fixture manifests use
H.264 media. When the media fails to load, Play, Skip back, Skip forward,
and Speed all render `disabled` and drop out of the tab sequence entirely,
which silently invalidates the control-bar order checks (step 2) and makes
the seek checks (steps 7 and 8) unrunnable. The automated rows in Results
below are marked with the environment they were taken in for exactly this
reason.

## Walkthrough

Run this sequence on `examples/element/plain.html` first (single-canvas),
then repeat on the multi-canvas fixture page, whose canvas navigation adds
stops the bare page does not have.

1. Load the page. Click once anywhere _outside_ the player to establish a
   known focus origin, then press **Tab**.
   - **Check:** focus lands on the first control inside the player's shadow
     tree — the Play button in the fixed composition — and is neither
     silently skipped nor trapped before it.
2. Continue pressing **Tab** through every control in the control bar in
   source order: Play → Progress → Skip back → Skip forward → Speed → the
   Captions toggle, if this canvas has caption tracks → canvas-nav buttons,
   if the manifest has more than one canvas → the auto-scroll pause toggle
   → the search input → the transcript segments. Time is not focusable; it
   is a `role="timer"`. There are no chapter buttons: the element's fixed
   composition does not include a chapters component.
   - **Check:** every enabled control receives visible focus, in the order
     it appears on screen. No control is skipped. No control is visited
     twice.
   - **Check:** the focus indicator is visible against the background at
     every stop, **including the active canvas-nav button**. This is the
     white-on-white ring the focus-token fix targets: confirm the ring is a
     real, non-white color and that it sits clear of the button's own
     accent-colored background.
3. Continue **Tab** into the transcript panel. Focus should land on exactly
   one segment — the roving-tabindex entry point, normally the first
   segment, or the active segment if media has been playing.
   - **Check:** only one segment is in the tab sequence. Pressing Tab again
     moves focus _out_ of the transcript panel entirely, not to the next
     segment.
4. With focus on a segment, press **ArrowDown**.
   - **Check:** focus moves to the next segment. The previously focused
     segment leaves the tab sequence (`tabindex="-1"`); the newly focused
     one enters it (`tabindex="0"`).
5. Press **ArrowUp** from the first segment.
   - **Check:** focus wraps to the _last_ segment.
6. Press **End**, then **Home**.
   - **Check:** End moves focus to the last segment; Home moves focus to
     the first.
7. With focus on a segment, press **Enter**.
   - **Check:** the media seeks to that segment's start time. Focus stays
     on the segment and does not jump to the media element.
8. With focus on a different segment, press **Space**.
   - **Check:** same seek behavior as Enter. The page does _not_ scroll —
     Space is not falling through to the browser's scroll-the-page default.
9. Tab to the search input.
   - **Check:** it is reachable, has a visible focus ring, and typing a
     query does not move focus away from the input.
10. Continue Tab through any remaining controls to the end of the player,
    then press **Tab** once more.
    - **Check:** focus leaves the player entirely and lands on the next
      focusable element on the host page. This is the keyboard-trap check
      (2.1.2): the shadow boundary must not swallow focus.
11. Press **Shift+Tab** repeatedly from outside the player, back in and all
    the way through in reverse.
    - **Check:** the reverse order exactly mirrors the forward order from
      steps 1–10. No control is unreachable in reverse.

## Multi-canvas and canvas-switch pass

Run this section against the multi-canvas fixture page, `/canvas-nav-demo`.

1. Tab to the canvas-nav control bar.
   - **Check:** every canvas button is reachable via Tab and Shift+Tab, and
     has a visible focus ring on both the _active_ and the _inactive_
     button. The active button carries an accent-colored background, so
     this is where a ring that borrowed `currentColor` would disappear.
2. With focus on a non-active canvas button, press **Enter**.
   - **Check:** the canvas switches. Focus is not lost — record where it
     ends up.
3. After the switch, Tab into the transcript panel again.
   - **Check:** the roving-tabindex entry point is a real segment in the
     _new_ canvas's transcript, not a stale reference into the old
     canvas's DOM. On this fixture the segment text names its own canvas,
     so a stale reference is visible immediately.
4. Repeat steps 4–8 of the main walkthrough (arrow navigation, Home/End,
   Enter/Space seek) against the new canvas's segments.
   - **Check:** navigation and seeking work identically after the switch.
5. Switch canvases a second time while focus is inside the transcript panel
   — click a canvas-nav button with the mouse while a segment holds
   keyboard focus. This isolates the canvas-switch focus question from the
   click-activation question.
   - **Check:** focus does not end up in a dead spot, and the console
     reports no error.

## Results

One row per numbered check across both passes. Use ✅/❌; a ❌ row needs a
linked issue. Blank rows have not been run — they need a real browser and,
for the seek checks, working media playback.

The commit SHAs below are element builds on branch `docs/a11y-acr`, which
had not merged when these rows were recorded. They are not reachable from
`feat/element-hardening-completion` or from `main`. Check out `docs/a11y-acr`
to reach them, and re-pin every row to the merge SHA once the branch lands.

| Commit SHA | Date       | Tester                                      | Check                                                           | Pass/Fail | Notes                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ---------- | ------------------------------------------- | --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 1 (initial Tab entry)                          | ✅        | Tab from the link preceding the player enters the shadow tree. First stop was Progress rather than Play, because headless Chromium disabled the H.264-dependent controls — the entry itself is confirmed, the identity of the first stop is not.                                                                                            |
|            |            |                                             | Walkthrough step 2 (control-bar order)                          |           | Not evaluable headlessly: Play, Skip back, Skip forward and Speed were `disabled` and absent from the tab sequence. Needs a real browser.                                                                                                                                                                                                   |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 2 (focus ring, incl. active canvas-nav button) | ✅        | Measured computed styles under focus. Both the active and the inactive canvas-nav button render `2px solid rgb(29, 78, 216)` at `outline-offset: 2px`, so the ring sits outside the accent background against the white panel. No white-on-white and no accent-on-accent ring.                                                              |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 3 (single roving-tabindex entry point)         | ✅        | Exactly one of 107 segments carried `tabindex="0"`; Tab from the search input landed on it.                                                                                                                                                                                                                                                 |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 4 (ArrowDown)                                  | ✅        | Focus moved to the next segment; `tabindex="0"` moved with it, count stayed at one.                                                                                                                                                                                                                                                         |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 5 (ArrowUp wrap)                               | ✅        | ArrowUp from the first segment wrapped to the last (9:12 of a 9:32 canvas); ArrowDown from the last wrapped back to the first.                                                                                                                                                                                                              |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 6 (Home/End)                                   | ✅        | End moved focus to the last segment, Home back to the first.                                                                                                                                                                                                                                                                                |
|            |            |                                             | Walkthrough step 7 (Enter seeks, focus stays)                   |           | Not evaluable headlessly: no decodable media, so there is nothing to seek.                                                                                                                                                                                                                                                                  |
|            |            |                                             | Walkthrough step 8 (Space seeks, no page scroll)                |           | Not evaluable headlessly, as above.                                                                                                                                                                                                                                                                                                         |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 9 (search input reachable)                     | ✅        | Reached by Tab and focusable. Note the observed order: the search input comes **before** the segments, not after — the search UI sits above the segment list in the panel.                                                                                                                                                                  |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 10 (Tab exits player — no trap)                | ✅        | Tab from a focused segment left the shadow tree and landed on the link following the player.                                                                                                                                                                                                                                                |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Walkthrough step 11 (Shift+Tab mirrors forward order)           | ✅        | Shift+Tab from the following link re-entered the panel at the same segment, then moved to the search input — the exact reverse of the forward order across the shadow boundary. Only the panel boundary was sampled; the full reverse sweep of the control bar needs a real browser.                                                        |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Multi-canvas step 1 (canvas-nav focus rings)                    | ✅        | See step 2's note; both states measured.                                                                                                                                                                                                                                                                                                    |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Multi-canvas step 2 (Enter switches canvas, focus not lost)     | ✅        | Enter on a focused canvas-nav button switched the canvas and left focus on that same button.                                                                                                                                                                                                                                                |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Multi-canvas step 3 (fresh roving-tabindex entry post-switch)   | ✅        | After switching, the panel held the new canvas's segments and `tabindex="0"` was back on its first segment. Confirmed in both directions (4 embedded segments ↔ 107 WebVTT cues).                                                                                                                                                           |
|            |            |                                             | Multi-canvas step 4 (nav/seek works post-switch)                |           | Arrow navigation post-switch was not re-run; the seek half is blocked on media, as in steps 7 and 8.                                                                                                                                                                                                                                        |
| `70acb01`  | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | Multi-canvas step 5 (no dead focus spot on second switch)       | ✅        | Activating a canvas-nav button while a segment held focus left focus on the activated button. Console carried no error — only the expected development warning that canvas 2 has no caption tracks. A synthetic `.click()` that skips the focus step drops focus to `<body>`, but no real pointer or keyboard input produces that sequence. |
