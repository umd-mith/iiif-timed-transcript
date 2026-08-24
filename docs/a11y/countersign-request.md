# Countersign request: independent accessibility review

**To:** UMD Libraries accessibility staff
**From:** Trevor Muñoz, MITH (`tmunoz@umd.edu`)
**Re:** Independent review of the `<iiif-transcript-player>` conformance report

## Why this request exists

`@umd-mith/svelte-iiif-transcript-player` ships a self-authored VPAT 2.5 INT
Accessibility Conformance Report at WCAG 2.1 AA, committed in the repository
at [`docs/a11y/vpat-2.5-int.md`](vpat-2.5-int.md). Self-authored reports are
standard practice and procurement accepts them. But their credibility rests
on who wrote them, and here the author, the sole maintainer, and the
requesting unit are one person at the same institution as the eventual
buyer. That is not a claim of bad faith. It is a structural gap, and an
independent reviewer closes it cheaply — without the cost of a paid
third-party audit — by breaking the author-equals-assessor identity.

## What we're asking for

A review pass against committed evidence, not an audit from scratch. There
is also real testing we cannot do ourselves, described in the next section.

1. **Read the report** at `docs/a11y/vpat-2.5-int.md`, checked out at commit
   `e74e616` — the SHA recorded in the report's own "Scope: commit SHA" row.
   Please pull that exact commit rather than the tip of `main`: the claims
   are pinned to it.
2. **Spot-check the evidence** the Remarks cite:
   - [`keyboard-walkthrough.md`](keyboard-walkthrough.md)
   - [`screen-reader-scripts.md`](screen-reader-scripts.md)
   - [`zoom-reflow-checklist.md`](zoom-reflow-checklist.md)
   - [`forced-colors-rtl.md`](forced-colors-rtl.md)
   - CI's axe-core scan, the committed contrast-ratio test, and
     `element-reflow.test.ts`, all of which run on every push. Ask us for the
     CI run at the scope SHA if it isn't visible from your access level.
   - The "Accessibility" section of `README.md`
3. **Look hardest at the rows a self-assessor has the wrong incentives
   around** — the 1.2.x media rows, since transcripts are the whole point of
   this component. Specifically: confirm 1.2.5 is genuinely Does Not Support
   and not quietly satisfied by the transcript panel, since a transcript does
   not satisfy audio description at AA; and confirm 1.2.2 is a real Supports
   rather than "tracks are attached." There should be a visible, working
   captions toggle on a video canvas with caption tracks, and its
   `aria-pressed` state should stay truthful after toggling both from that
   button and from the browser's own caption menu.
4. **Re-derive rather than trust.** Run some of the scripts yourself instead
   of taking our recorded results wholesale. Committing the scripts to the
   repository is what makes that possible, and it is the point of having
   done so.
5. **Sign off, or flag findings**, in the format at the end of this note.

## What is not yet evaluated, and where we need you most

Four rows in the report are load-bearing. Two are claimed on recorded
evidence; two are not claimed at all, because the passes that would settle
them need equipment or judgment we do not have here:

- **4.1.2 Name, Role, Value — Not Evaluated.** This is the row we would most
  like your help with. The open question is not what the DOM contains but
  whether NVDA and VoiceOver correctly expose an _open shadow root's_
  accessibility tree, which is where those two have historically diverged.
  `screen-reader-scripts.md` has both scripts written and no results
  recorded. Running them is the single highest-value thing this review could
  produce.
- **1.4.4 Resize Text — Not Evaluated.** Pending the 200% text-only zoom
  pass. Text-only zoom is browser chrome with no automation surface, and
  whether anything is clipped is a judgment call.
- **The forced-colors pass** in `forced-colors-rtl.md` is entirely
  unrecorded: it needs Windows with a contrast theme enabled. If nobody on
  your side has that machine, tell us and we'll find one.
- **Control-bar tab order and the Enter/Space seek checks** in
  `keyboard-walkthrough.md` are blank because the automated run used headless
  Chromium, which has no H.264 decoder — the media-dependent controls render
  disabled and leave the tab sequence. Any real browser settles them in about
  a minute.

Two rows are claimed and worth your skepticism: **2.1.2 No Keyboard Trap**
and **2.4.3 Focus Order** rest on recorded keyboard results, and 2.4.3 names
the two things about it still unconfirmed. If you disagree with either
reading, say so — that is exactly the disagreement this request is for.

## What we are not asking for

- A paid third-party audit (Deque, TPGi, Level Access). We'd reserve that for
  if this moves from one collection's item pages into the shared university
  theme library, where the blast radius would justify the spend.
- JAWS testing. Out of scope for this pass; add it later only if procurement
  specifically requires it.
- Sign-off on WCAG 2.2. This report claims 2.1 AA only, deliberately.

## Sign-off format

Once the review is complete, the report's "Reviewed by" row will be updated
to read:

```
reviewed by <reviewer name>, <date>, scope: element build at commit <scope-sha>
```

Please reply with those three fields — your name as you'd like it recorded,
the date you completed the review, and confirmation of the scope SHA you
actually reviewed against — plus any results you recorded, so we can commit
them into the Results tables alongside your sign-off.
