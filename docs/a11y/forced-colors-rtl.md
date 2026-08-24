# Forced-colors and RTL passes

**Scope:** the `<iiif-transcript-player>` custom element. These two passes
don't map onto a single numbered success criterion the way the other three
scripts do. What they verify is that the non-color state indicators behind
the 1.4.1 Use of Color and 1.4.11 Non-text Contrast rows survive two
conditions that strip or mirror the styling those rows depend on.

**Pages used:** `examples/element/plain.html` for both passes, plus the
multi-canvas fixture page `/canvas-nav-demo` where a canvas-nav check is
called for. For the RTL pass, an RTL fixture is useful but not required to
start: the shape is a manifest whose transcript annotations carry Arabic or
Hebrew text, mirroring the local fixture in
`src/element/element-rtl.test.ts`. Setting `dir="rtl"` on the element or an
ancestor exercises the layout half of the pass with any content; the script
half — shaping and bidirectional text flow — needs real RTL text.

## Forced-colors pass

Windows only. Turn on **Settings > Accessibility > Contrast themes** and
pick a high-contrast theme. Load the page in Edge or Chrome, both of which
support `forced-colors: active`.

1. Load the player on a caption-bearing video canvas.
   - **Check:** all text stays legible against the system-supplied
     background. Nothing disappears because a token assumed the light-theme
     default background survived.
2. Look at the active segment and the search-highlight indicators.
   - **Check:** the non-color border indicator is visible. Forced colors
     strips backgrounds, so an indicator carried by background alone would
     vanish entirely — that is the failure mode this pass exists to catch.
3. Tab through every control (Play, Skip, canvas nav, the segment list).
   - **Check:** focus rings stay visible — ideally mapped to the
     `Highlight` system color, at minimum not invisible.
4. Look at the control-bar and transcript-panel borders.
   - **Check:** panel and control boundaries stay visible; the non-text
     borders behind the 1.4.11 row map to a system color or otherwise
     survive.
5. Toggle captions on and off.
   - **Check:** the `aria-pressed` state stays visually distinguishable
     under forced colors.

Repeat all five checks in a **second** contrast theme — switch from
"Desktop" to "High Contrast Black", say. Anything that works against only
one system palette is working by accident.

## RTL pass

Load the player with `dir="rtl"` set on the element or on an ancestor.

1. Load the player.
   - **Check:** `dir="rtl"` inherits into the shadow tree — text alignment,
     layout direction, and transcript reading order all flip. Shadow DOM
     does not always inherit `dir` the way authors expect, so confirm it
     rather than assuming.
2. Look at the non-color indicator on active and highlighted segments.
   - **Check:** the border renders on the correct *logical* start edge —
     the right edge under RTL. This is where a physical `border-left` that
     should have been `border-inline-start` shows itself.
3. Look at the control bar.
   - **Check:** controls flow right-to-left in an order that still makes
     sense. RTL control-bar ordering is a judgment call, not a hard
     pass/fail — record what ships, and flag anything that reads as broken
     rather than merely mirrored.
4. Look at the transcript segment text.
   - **Check:** Arabic or Hebrew text shapes correctly and flows
     right-to-left. Mostly browser-native for real text, but confirm no CSS
     `direction` or `unicode-bidi` override is fighting it.
5. Type in the search input.
   - **Check:** cursor movement and placeholder alignment behave correctly
     for RTL input.

## Results

The forced-colors pass cannot be automated from here at all: it depends on
an operating-system setting, on Windows, and on a human judging legibility.
Every one of its rows is left for a tester with that machine.

The RTL rows below were measured against the multi-canvas fixture page with
`dir="rtl"` set on the element. That fixture carries English text, so it
settles the layout half of the pass — inheritance and which edge the
indicator lands on — and leaves the script-shaping half (row 4) for a run
against real RTL content. `src/element/element-rtl.test.ts` covers the same
inheritance and indicator-edge assertions on every test run.

Rows recorded below were taken on `feat/element-hardening-completion`
before that branch merged. Re-pin them to the merge SHA if the branch
changes before merge.

| Commit SHA | Date | Tester | Pass | Check | Pass/Fail | Notes |
|---|---|---|---|---|---|---|
| | | | Forced-colors | 1. Text legible | | |
| | | | Forced-colors | 2. Non-color indicators visible | | |
| | | | Forced-colors | 3. Focus indicators visible | | |
| | | | Forced-colors | 4. Panel/control borders visible | | |
| | | | Forced-colors | 5. Captions toggle state distinguishable | | |
| | | | Forced-colors (2nd theme) | Repeat checks 1-5 | | |
| `e74e616` | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | RTL | 1. dir inherits into shadow tree | ✅ | With `dir="rtl"` on the element, the shadow wrapper and the segments both compute `direction: rtl`. |
| `e74e616` | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | RTL | 2. Inline-start border on correct edge | ✅ | The segment indicator computes `border-right-width: 4px` and `border-left-width: 0px` under RTL — logical, not physical. |
| | | | RTL | 3. Control bar layout sensible | | Needs a human judgment call, not a measurement. |
| | | | RTL | 4. Segment text shapes/flows correctly | | Needs a fixture carrying real Arabic or Hebrew transcript text. |
| `e74e616` | 2026-08-24 | Claude Code (headless Chromium, CDP-driven) | RTL | 5. Search input RTL behavior | ⚠️ | The input computes `direction: rtl` with `text-align: start`, so alignment follows direction. Cursor behavior while typing was not exercised — re-check by hand. |
