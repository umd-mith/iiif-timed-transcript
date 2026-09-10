# Browse and search without disrupting playback

Status: proposed implementation spec. Priority: P1. This document specifies behavior; it does not change the player.

## Outcome

A researcher can listen to a recording, search or read another passage, and return to the passage currently playing without accidentally changing the recording's position.

“Preserve playback position” means browsing never seeks. Playing media continues to advance normally; paused media stays paused at the same time. Browsing never changes playback rate or starts playback.

## Current behavior

- `Search.svelte` reports matching annotations and the selected index through `onmatchchange`, including after typing and previous/next navigation.
- `Transcript.handleMatchChange` updates highlights and immediately seeks to the selected match.
- `SyncController` maps transcript scrolling to media time and sends a seek-driving event.
- The existing auto-scroll toggle disables media-driven transcript scrolling only. It does not disable scroll-to-seek or search-driven seeks.
- Segment activation already supports a host callback that can prevent the default seek.

These are distinct behaviors and must remain independently controllable.

## Scope

Deliver explicit search-result activation, configurable scroll-to-seek, a reading mode, and a return control in both the Svelte components and the default custom element.

Keep the existing search algorithm and segment-based match count. Cross-canvas search, word highlighting, phrase matching across cues, transcript downloads, sharing, and saved preferences are outside this change.

## Interaction contract

`readingMode` is the single public toggle. Internally it names two states:

- **Following** (`readingMode=false`): playback may scroll the transcript, and, when `scrollToSeek` is enabled, configured transcript scrolling may seek.
- **Browsing** (`readingMode=true`): the user has detached the transcript from playback. Playback still updates active-annotation state and the active-passage highlight, but never moves the panel, and transcript scrolling never seeks.

Enter Browsing by: turning off the “Follow along” switch; in `activate` search mode, synchronous query input (before debounce); browsing search matches; or deliberate scrolling with `scrollToSeek=false`. Clearing a query removes highlights but stays in Browsing. Segment clicks and “Go to match” seek explicitly but stay in Browsing. Return to Following by: the “Jump to current” button (scrolls to the media's current time, then follows) or turning “Follow along” back on. A reason (explicit, search, scroll) behind a Browsing entry may be tracked internally but is not exposed yet. The UI labels are a “Follow along” switch (on = Following, off = Browsing) and, while Browsing, a “Jump to current” button; “Following” and “Browsing” are internal state names, never shown to users.

### Search

In the new explicit search behavior:

1. Typing updates highlights, the match count, and the selected match after the existing debounce. It never seeks or changes playback state.
2. Editing a nonempty query enters Browsing immediately on input — before debounce or rendering can cause scrolling. `Search` emits a synchronous `onqueryinput(value)` intent callback from the input event; `TranscriptSearch` consumes it and sets Browsing through the transcript context. `Search` stays playback-agnostic and must not use the debounced `onmatchchange` for this transition. Selection of the first match happens once matches resolve after debounce. Neither step moves keyboard focus nor automatically scrolls the panel on each keystroke.
3. Previous/next changes the selected match and scrolls it into view. It does not seek. The selected search match and the passage currently playing remain visually distinguishable.
4. A new “Go to match” button or Enter in the search input activates the selected match: seek once to its start time, preserving whether media was playing or paused. Clicking a transcript segment or using its existing Enter/Space activation remains an explicit seek.
5. Activation stays in Browsing. Continuing playback must not immediately pull the reader away from the search results.
6. Clearing the query removes search highlights without seeking, scrolling, or leaving Browsing. Zero matches disables activation and match navigation.
7. Enter during IME composition does not activate a result. Enter before debounce completes evaluates the current input first, then activates that query's selected result. It must not seek to a stale result.

Do not add a separate result list in this release. The transcript, selected-match styling, counter, and activation button provide the result interface.

### Reading mode

Turning off the “Follow along” switch enters Browsing. While Browsing:

- User scrolling never seeks, regardless of the configured scroll-to-seek preference.
- Playback continues to update the active-passage highlight and public active-annotation state, but never scrolls the transcript.
- Explicit segment activation, “Go to match,” player controls, and host seek APIs continue to work.
- Selecting/copying transcript text must not trigger segment activation on pointer release.
- Reading mode is panel-local. Reading one panel must not disable another panel's following behavior or alter shared playback except through an explicit seek.

When scroll-to-seek is disabled, deliberate user scrolling also enters Browsing so the next playback update cannot pull the panel back. Programmatic scrolling, resizing, content loading, and focus movement must not be mistaken for that gesture. Observe user input intent rather than treating every DOM `scroll` event as user intent.

When scroll-to-seek is enabled and reading mode is off, preserve the existing scroll-driven seeking behavior.

### Jump to current

Show the “Jump to current” button while Browsing is active and a transcript is available. Activating it:

1. Reads the media's current time at activation, not the time Browsing began.
2. Scrolls the corresponding passage into view without any media seek.
3. Returns to Following. The existing pause-auto-scroll control reflects that enabled state.
4. Keeps the query, match selection, playback state, and rate unchanged. Keeping an existing query does not re-enter Browsing; editing it re-enters Browsing only in `activate` mode or while reading mode is already active.

If playback is between cues, target the next cue; before the first cue, target the first; after the last, target the last. For overlaps, use the player's existing active-annotation selection rule. Do not mark a fallback cue as currently playing if its time range does not contain the current time.

Turning “Follow along” back on has the same effect as “Jump to current”. An explicit host write disabling reading mode follows the same contract. With no annotations, return to Following without scrolling; do not seek as a fallback.

“Jump to current” returns to Following, so the button disappears on activation. Transfer focus only when the disappearing “Jump to current” button currently owns focus: move it to the persistent “Follow along” switch rather than letting it fall to the document body. When the return happens another way — a host property write, or any path where the button does not hold focus — preserve the existing focus; do not steal it from elsewhere on the page.

## Proposed API and compatibility

Ship this as an additive, opt-in minor release. Existing integrations retain search-driven seeking and scroll-driven seeking until configured otherwise. Documentation and demos recommend the new configuration. Changing defaults requires a separately announced breaking release.

| Surface                         | Addition                                                                              | Default / contract                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `IIIFPlayer.Transcript`         | `searchSeekBehavior: "change" \| "activate"`                                          | `"change"` preserves existing behavior; `"activate"` implements explicit search.                              |
| `IIIFPlayer.Transcript`         | `scrollToSeek: boolean`                                                               | `true`; can change at runtime without rebuilding the player.                                                  |
| `IIIFPlayer.Transcript`         | bindable `readingMode: boolean`                                                       | `false`; reading mode overrides both automatic scrolling and implicit seeking.                                |
| `Search` and `TranscriptSearch` | `onmatchactivate(annotation, index)`, `onqueryinput(value)`                           | Explicit-activation and synchronous input-intent callbacks, both separate from the debounced `onmatchchange`. |
| Transcript context              | reading state and enter/return actions                                                | Available to custom controls; panel-local.                                                                    |
| `<iiif-transcript-player>`      | `search-seek-behavior`, `scroll-to-seek`, `reading-mode` and corresponding properties | Same defaults and semantics as Svelte.                                                                        |

Recommended host configuration: `searchSeekBehavior="activate"`, `scrollToSeek={false}`. Playback follows the transcript until the reader searches, scrolls, or explicitly enables reading mode.

Browsing takes precedence even when `searchSeekBehavior="change"`: typing and match navigation must not seek while Browsing. In Following, `change` keeps its legacy behavior, including previous/next seeking; `activate` browses only and seeks solely through the `onmatchactivate` path. A host that seeks inside its own `onmatchchange` owns that side effect — the library cannot suppress it — so such hosts should check the reading state exposed on the transcript context before seeking.

Keep `onmatchchange`'s signature, notification behavior, and existing override semantics. Hosts that currently seek inside their own callback remain responsible for that side effect; document migration to `onmatchactivate`. The library must not claim it can suppress host-authored seeks. Default activation seeks once through the transcript context; a supplied activation callback replaces that default, consistent with the existing match callback override pattern.

The standalone `Search` remains independent of playback: it renders the activation control and emits `onmatchactivate` and the synchronous `onqueryinput(value)` only, never reading or writing playback or reading state. Show the activation control only when `searchSeekBehavior="activate"` or reading mode is active; in `change` mode with reading mode off, a no-new-props integration renders no activation control and keeps its existing UI. `TranscriptSearch` owns the playback wiring — it supplies the activation handler (the transcript-context default), consumes `onqueryinput` to enter Browsing, and performs the seek through the context, never inside `Search`. Retain `onSegmentClick` cancellation for segment activation.

The custom element must own value-based parsing and reflection for `scroll-to-seek` and `reading-mode` through a single manual owner — not Svelte's `type: "Boolean"` presence parsing and not Svelte-generated reflection, which would fight the manual writes. Canonicalize each attribute against its own default: an absent `reading-mode` is false, an absent `scroll-to-seek` is true; `"false"` (case-insensitive) is false; `"true"`, the empty string, and a bare attribute (`<iiif-transcript-player reading-mode>`) are true. Any other value follows the element's existing validation/error conventions. Properties accept real booleans directly. Reflect a user-driven `readingMode` change back to `reading-mode` through a guarded write that compares against the current canonical value and returns early when unchanged, so `attributeChangedCallback` cannot re-enter and loop; reflection emits no playback events. Test markup attributes, property writes, attribute removal, and properties set before element upgrade.

A single “Follow along” control governs the track-audio axis; it replaces the former auto-scroll pause button rather than shipping beside it. Two controls on one axis read as interchangeable, so they are folded into one: turning “Follow along” off enters Browsing, which stops both media→scroll and scroll-to-seek. The old pause-auto-scroll capability (stop scrolling but keep scroll-to-seek) is not preserved — a panel that does not follow playback while scrolling still moves the playhead is incoherent for users, not a feature worth a control. “Follow along” defaults on (Following is the default state, `readingMode=false`). The existing `transcript.autoscrollPause` / `autoscrollResume` strings are superseded by a “Follow along” label and the “Jump to current” label.

Control surface and styling contract. The bare Svelte components ship semantics and state only — no appearance — exactly as today's pause control does (`<button aria-pressed>`). “Follow along” is a toggle exposing its state on the element (`role="switch"` with `aria-checked`, plus a `data-following` hook), and “Jump to current” is a plain `<button>` rendered only while Browsing; the host supplies all CSS. A styled host or demo applies CSS to those same elements (the switch and pill are skin, not new widgets). The default `<iiif-transcript-player>` renders a styled control set in its shadow DOM, reflects the `reading-mode` attribute per the custom-element rules above, and exposes a `:state(browsing)` custom state for host theming — consistent with the element's existing `:state(playing)` / `loading` / `error`. Returning to Following — by any path — enables following and the control reflects that enabled state; there is no prior paused preference to restore, since the pause control no longer exists.

## Lifecycle and accessibility

- Keep reading mode and configured preferences across canvas switches within a mounted player. In `activate` mode, or while reading mode is active, clear the query and selected result on canvas switch and do not activate stale annotations or automatically return to following; in `change` mode with reading mode off, preserve today's behavior (the query persists and match recomputation follows the existing `onmatchchange` path). Because the query string is otherwise private to `Search`, clearing it requires an external reset path — a bindable query or a context-level reset signal that `Search` honors.
- On annotation replacement in `activate` mode, or while reading mode is active, recalculate matches and clamp selection without activation (no implicit seek); in `change` mode with reading mode off, replacement follows the existing re-notification path. Cancel stale debounce and scroll work on replacement or teardown.
- Enabling reading mode or disabling scroll-to-seek must invalidate pending scroll-driven seeks. The scroll-driven seek actor awaits readiness and then calls `seekTo` inside the actor, before it resolves, so the `seekTo` has already fired by the time any consuming transition runs — guarding that transition is too late. The policy check must run immediately before the side effect: either the actor compares a policy generation/epoch token captured when it was queued against the current value and returns without seeking when it changed, or seeking moves into a guarded machine action the policy can block. A late animation, timer, or actor completion must not seek after the new policy takes effect. Test this by disabling scroll-to-seek (and, separately, enabling reading mode) while an earlier seek is still awaiting readiness, then re-enabling the policy afterward.
- Returning, browsing search results, and consumer `scrollToAnnotation` calls are programmatic transcript movement; they must never feed back into scroll-to-seek, including after a smooth-scroll animation ends.
- New controls use native buttons, visible focus, localized labels, and appropriate pressed/disabled states. Preserve existing transcript keyboard navigation.
- Announce match counts and mode changes politely. Do not announce every cue during uninterrupted playback or move focus as time advances.
- Respect reduced-motion preferences. Keep controls usable on narrow screens and prevent panel scrolling from unnecessarily moving the surrounding page.
- No persistence across page reloads or destroyed/recreated player instances is introduced. Host-supplied properties establish the next instance's state.

## Acceptance and release gates

| Scenario                                                      | Config                                           | Required result                                                                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playing at 30s; type a query matching 120s                    | `activate`                                       | Match updates; Browsing entered immediately on input (before debounce); media advances naturally from 30s; no seek/play/pause call.                                                                             |
| Paused at 30s; browse next/previous matches                   | `activate`                                       | Results scroll; media remains paused at 30s.                                                                                                                                                                    |
| Activate a match at 120s                                      | `activate`                                       | Exactly one seek to 120s; playing/paused state and rate remain unchanged.                                                                                                                                       |
| Scroll with scroll-to-seek off                                | `scrollToSeek=false`                             | Enter reading mode; neither a seek nor subsequent playback-driven scroll occurs.                                                                                                                                |
| Enable reading mode while scroll-to-seek is on                | `readingMode=true`, `scrollToSeek=true`          | Scroll→seek and media→scroll both stop; media→highlight and active-annotation state keep updating; explicit segment activation still works.                                                                     |
| Return when current time (75s) is inside a cue                | `readingMode` entered, then Return               | Scroll the active cue into view; media is not rewound; returns to Following.                                                                                                                                    |
| Return when current time (75s) is between cues                | `readingMode` entered, then Return               | Scroll the next cue into view without marking any cue as active; media is not rewound; returns to Following.                                                                                                    |
| Clear query, get zero results, or replace annotations         | `activate`                                       | No implicit seek; no stale activation; selection clamped without activation.                                                                                                                                    |
| Toggle policy off while a scroll-driven seek awaits readiness | scroll-to-seek off, or reading mode on, mid-seek | No delayed seek occurs after the setting takes effect, even once the awaiting actor resolves; re-enabling the policy afterward does not replay it.                                                              |
| Render two transcript panels                                  | `activate`                                       | Reading state stays independent; both track actual media time.                                                                                                                                                  |
| Existing integration with no new props                        | default (`change`, `scrollToSeek=true`)          | Legacy search-driven and scroll-driven seeking, and the `onmatchchange`/`onSegmentClick` contracts, remain intact.                                                                                              |
| Activation control in legacy change mode                      | default (`change`, reading mode off)             | No activation control renders; existing search and scroll UI unchanged.                                                                                                                                         |
| Query and canvas switch in legacy change mode                 | default (`change`, reading mode off)             | Query and selection follow existing behavior (not cleared by the new rule); no new Browsing transition.                                                                                                         |
| Return focus ownership vs host property write                 | `readingMode` entered                            | Focus moves to the “Follow along” switch only when the “Jump to current” button owned focus; returning to Following via a host property write does not move focus.                                              |
| Single folded control across surfaces                         | default                                          | Exactly one track-audio control (“Follow along”); no separate pause-auto-scroll button. Bare components expose `role="switch"`/`aria-checked`; the element adds `:state(browsing)` and reflects `reading-mode`. |
| Custom element configured through markup and properties       | `activate` via element                           | Both routes implement the same behavior; `scroll-to-seek="false"` parses as false; browsing emits no seeked event.                                                                                              |

Automate these behavioral cases at search, transcript/sync, and custom-element boundaries using actual user interactions where practical. Retain existing regression coverage. Manually verify keyboard-only use, screen-reader announcements/focus, text selection, touch scrolling, and reduced motion. Test both native and streaming playback to confirm that the feature changes only interaction policy.

Implement in three reviewable steps: separate match updates from activation; add synchronization policy and reading/return controls; expose custom-element configuration and update documentation. Each step retains compatibility coverage. Completion requires the recommended configuration to pass the entire journey: listen, search, browse, activate, browse again, return.
