# Screen reader scripts: NVDA + Firefox and VoiceOver + Safari

**Scope:** the `<iiif-transcript-player>` custom element, evaluated in
isolation on a minimal host page. Settles WCAG 4.1.2 Name, Role, Value —
the shadow-DOM accessibility-tree exposure question — and confirms 4.1.3
Status Messages, including the failed-transcript announcement.

**Why two browser/AT pairs.** Shadow-DOM accessibility-tree exposure is
where NVDA/Firefox and VoiceOver/Safari have historically diverged. Running
both is the only way to settle 4.1.2 rather than assume it. JAWS is
deliberately out of scope unless procurement asks for it later.

## Pages used

- `examples/element/plain.html` for the single-canvas passes. Build first
  (`pnpm run build`); the page loads the IIFE bundle from `dist/element/`.
- The multi-canvas fixture page, `/canvas-nav-demo` on the docs site, for
  the canvas-switch check (check 9). See
  [`keyboard-walkthrough.md`](keyboard-walkthrough.md) for how to run the
  docs site and what the fixture manifest contains.

**Fixture recipes for the two error checks.** Both are host-page edits, not
code changes:

- *Manifest 404.* Point a `<iiif-transcript-player manifest-url="…">` at a
  URL that returns 404. The element renders a `role="alert"` banner. The
  automated equivalent is in `src/element/element-errors.test.ts`, which
  awaits `[role="alert"]` in the shadow tree.
- *Transcript 404.* Serve a manifest whose video canvas carries a caption
  track whose `id` returns 404, while the manifest itself and everything
  else load fine. This is a non-fatal `playererror`: no `role="alert"`
  appears, the panel is simply empty, and the only signal available to
  assistive technology is the status announcement this script checks. The
  automated equivalent is the `element-errors.test.ts` case named "a 404
  VTT is a non-fatal transcript playererror strictly after
  playerrefavailable".

**Expected announcement wording**, as shipped in the term registry
(`src/lib/i18n/terms.ts`) — check against these strings rather than
paraphrasing:

- Transcript loaded: `Transcript loaded, {count} segments`
- Transcript failed or absent: `Transcript unavailable`
- Search match counter: `{current} of {total}`, or `No matches`
- Transcript region label: `Media transcript`
- Segment list label: `Transcript segments`

## NVDA + Firefox script

Run NVDA in its default configuration against Firefox (latest stable).

1. **Region label.** Load the page with NVDA running. Navigate by region
   (NVDA key + F7, or `D` in browse mode) to the transcript panel.
   - **Check:** NVDA announces the region and its accessible name.
2. **Browse mode through segments.** In browse mode, use Down Arrow to read
   through the panel's text.
   - **Check:** segment text reads as continuous text; timestamps do not
     produce confusing or duplicated announcements.
3. **Focus mode through segments.** Tab into the panel — NVDA should switch
   to focus mode on the `role="group"` container — and arrow through
   segments as in the keyboard walkthrough.
   - **Check:** each segment is announced with its role (button) and its
     text. `aria-current="true"` on the active segment is announced (NVDA
     typically says "current").
4. **Search match counter.** Type a query with more than one match.
   - **Check:** NVDA announces the updated count from the
     `aria-live="polite"` region on the search UI, without focus moving to
     it.
5. **Single announcer fire on segment seek.** Activate a segment to seek.
   - **Check:** NVDA announces that segment's text exactly once.
   - **Check:** let playback continue for 30 seconds or more without
     touching anything. NVDA does *not* announce each segment as playback
     auto-advances — the announcer is gated on user-initiated interaction.
6. **Transcript load completion.** Reload the page.
   - **Check:** once the transcript populates, NVDA announces
     `Transcript loaded, N segments` once, via the persistent live region.
7. **Manifest 404 alert.** Load the manifest-404 fixture.
   - **Check:** NVDA announces the error via the `role="alert"` banner,
     interrupting rather than waiting for a polite-region poll.
8. **Transcript 404 announcement.** Load the transcript-404 fixture.
   - **Check:** NVDA announces `Transcript unavailable` via the same
     persistent live region used in check 6 — and does so even though the
     panel is otherwise empty and no `role="alert"` is present. Before this
     fix the case was completely silent to assistive technology, which is
     the gap this row exists to close.
9. **Canvas switch.** On the multi-canvas fixture page, switch canvases
   with NVDA active.
   - **Check:** region label, segment announcements, and the status
     announcements from checks 6 and 8 behave as they did on initial load.
     No stale announcer state leaks across the switch.

## VoiceOver + Safari script

Run VoiceOver (Cmd+F5) against Safari (latest stable). VO+Right Arrow to
navigate, VO+Space to activate.

1. **Region label.** Use the rotor (VO+U) to navigate by landmark to the
   transcript panel.
   - **Check:** VoiceOver announces the region and its accessible name.
2. **Reading through segments** (VO+Right Arrow).
   - **Check:** VoiceOver reads segment text and announces each segment's
     role (button).
3. **Interaction mode through segments.** Tab into the panel and use arrow
   keys as in the keyboard walkthrough. VoiceOver should pass native
   arrow-key handling through to a focused composite widget — confirm that
   is actually true in the version under test rather than assuming it, since
   this is one of the more AT-specific behaviors.
   - **Check:** segment text and `aria-current` state are announced
     equivalently to the NVDA pass.
4. **Search match counter.** As NVDA check 4.
   - **Check:** the updated count is announced without VoiceOver focus
     moving to the counter.
5. **Single announcer fire on segment seek.** As NVDA check 5.
   - **Check:** exactly one announcement per user-initiated seek; silence
     during unattended playback.
6. **Transcript load completion.** As NVDA check 6.
   - **Check:** the completion message is announced once.
7. **Manifest 404 alert.** As NVDA check 7.
   - **Check:** VoiceOver announces the `role="alert"` banner.
8. **Transcript 404 announcement.** As NVDA check 8.
   - **Check:** `Transcript unavailable` is announced via the persistent
     live region.
9. **Canvas switch.** As NVDA check 9.
   - **Check:** behavior is consistent across canvases.

## Results

Every row here needs a human running a real screen reader. Nothing in this
script can be driven automatically: what is being tested is what the
assistive technology *says*, which no DOM assertion can stand in for.

| Commit SHA | Date | Tester | AT/Browser | Check | Pass/Fail | Notes |
|---|---|---|---|---|---|---|
| | | | NVDA+Firefox | 1. Region label | | |
| | | | NVDA+Firefox | 2. Browse mode | | |
| | | | NVDA+Firefox | 3. Focus mode through segments | | |
| | | | NVDA+Firefox | 4. Search match counter | | |
| | | | NVDA+Firefox | 5. Single announcer fire | | |
| | | | NVDA+Firefox | 6. Transcript load completion | | |
| | | | NVDA+Firefox | 7. Manifest 404 alert | | |
| | | | NVDA+Firefox | 8. Transcript 404 announcement | | |
| | | | NVDA+Firefox | 9. Canvas switch | | |
| | | | VoiceOver+Safari | 1. Region label | | |
| | | | VoiceOver+Safari | 2. Reading through segments | | |
| | | | VoiceOver+Safari | 3. Interaction mode through segments | | |
| | | | VoiceOver+Safari | 4. Search match counter | | |
| | | | VoiceOver+Safari | 5. Single announcer fire | | |
| | | | VoiceOver+Safari | 6. Transcript load completion | | |
| | | | VoiceOver+Safari | 7. Manifest 404 alert | | |
| | | | VoiceOver+Safari | 8. Transcript 404 announcement | | |
| | | | VoiceOver+Safari | 9. Canvas switch | | |
