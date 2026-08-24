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

1. **Read the report** at `docs/a11y/vpat-2.5-int.md`, checked out at the tip of
   branch `docs/a11y-acr` — not `main`, and not the element-build SHA in the
   report's Product Information table. That SHA names the element surface the
   claims describe, but the report and its evidence were written across the
   branch, so no single mid-branch commit holds both.
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

## Context you may find useful

There is no settled house style to copy here, which is part of why we want a
second reader.

**Avalon Media System has no conformance report.** Avalon is the repository
platform many of the collections that would embed this component actually
run, and it publishes no VPAT. Its community opened
[avalonmediasystem/avalon#6852](https://github.com/avalonmediasystem/avalon/issues/6852)
in May 2026 to write one, with the same rationale we're working from — "it's
now expected that software platforms will have this available" — and the
issue is still open with its single task unchecked. So there is no peer
artifact in this software category to check our wording against.

**Audio description is a shared gap, not an idiosyncratic one.** Avalon
tracks audio-description support as open work
([#6397](https://github.com/avalonmediasystem/avalon/issues/6397),
[#6665](https://github.com/avalonmediasystem/avalon/issues/6665)). We say
this here rather than in the report because it is context for a reviewer, not
a defence: our 1.2.5 row reads Does Not Support and should be judged on its
own terms.

**The nearest published comparison is a commercial one.** The Avalon issue
cites Swank Motion Pictures' K-12 streaming platform ACR (September 2025,
audited by Accessiblü) as its model. Two things there are worth knowing when
you read ours. First, that report punts the whole 1.2.x block to "dependent
on the specific licensed content and not evaluated," where ours scores the
component's own behavior and separates it from manifest content — we think
ours is more useful to a buyer, but it's a real divergence and we'd like your
read on it. Second, it marks several Level A and AA criteria "Not Evaluated"
despite its own Terms section saying that level is for Level AAA only. Ours
does the same thing on **five** rows — 1.3.4, 1.4.4, 1.4.12, 2.5.2 and 4.1.2
— deliberately, and the report now declares the deviation in full under
Terms rather than leaving a reader to notice it. If you think the format
requires a scored level instead, tell us: the remedy we would prefer is to
run the outstanding passes and score the rows properly.

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
