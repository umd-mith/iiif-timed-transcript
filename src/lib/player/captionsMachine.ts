/**
 * captionsMachine - XState State Machine for Video Caption Policy
 *
 * Owns the WCAG 1.2.2 caption-visibility policy across the transcript-populate
 * / user-toggle / native-CC-menu-change / canvas-switch lifecycle. Replaces
 * the one-shot latch effect that used to live in Viewer.svelte: every defect
 * found in review of that latch was a phase-transition bug this statechart
 * makes explicit and testable.
 *
 * States:
 * - unavailable: no video caption tracks on the current canvas
 * - browserDefault: tracks exist; the browser's own default-track selection
 *   is in effect (the first track shows, per the `default={i === 0}`
 *   attribute Viewer puts on <track>) — nothing has decided anything yet
 * - autoHidden: the one-shot hide once the transcript panel has populated
 * - userControlled.showing / userControlled.hidden: a user (via the toggle
 *   button, or the browser's native CC menu) has expressed a preference,
 *   which a later TRANSCRIPT_POPULATED never rewrites and which persists
 *   across CANVAS_SWITCH
 *
 * Events: TRACKS_CHANGED, TRANSCRIPT_POPULATED, USER_TOGGLE, NATIVE_CHANGE,
 * CANVAS_SWITCH.
 */

import { setup, assign } from "xstate";

export type CaptionsMode = "showing" | "hidden";

export interface CaptionsContext {
  /** The user's expressed preference, once one exists. Persists across CANVAS_SWITCH. */
  preference: CaptionsMode | null;
}

export type CaptionsEvent =
  | { type: "TRACKS_CHANGED"; hasTracks: boolean }
  | { type: "TRANSCRIPT_POPULATED" }
  | { type: "USER_TOGGLE" }
  | { type: "NATIVE_CHANGE"; mode: CaptionsMode }
  | { type: "CANVAS_SWITCH" };

/** Flattened verdict PlayerContext consumers (Viewer, Captions) read. */
export type CaptionsVerdict =
  | "unavailable"
  | "browserDefault"
  | "autoHidden"
  | "showing"
  | "hidden";

/** Shape of an XState snapshot's `.value` for this machine. */
type CaptionsStateValue =
  | "unavailable"
  | "browserDefault"
  | "autoHidden"
  | { userControlled: CaptionsMode };

function createInitialContext(): CaptionsContext {
  return { preference: null };
}

// Guards

function tracksPresent({ event }: { event: CaptionsEvent }): boolean {
  return event.type === "TRACKS_CHANGED" && event.hasTracks;
}

function tracksAbsent({ event }: { event: CaptionsEvent }): boolean {
  return event.type === "TRACKS_CHANGED" && !event.hasTracks;
}

function hasPreferenceShowing({
  context,
}: {
  context: CaptionsContext;
}): boolean {
  return context.preference === "showing";
}

function hasPreferenceHidden({
  context,
}: {
  context: CaptionsContext;
}): boolean {
  return context.preference === "hidden";
}

function nativeReportsShowing({ event }: { event: CaptionsEvent }): boolean {
  return event.type === "NATIVE_CHANGE" && event.mode === "showing";
}

function nativeReportsHidden({ event }: { event: CaptionsEvent }): boolean {
  return event.type === "NATIVE_CHANGE" && event.mode === "hidden";
}

// The three-branch CANVAS_SWITCH routing, shared by every state: a
// persisted preference re-enters userControlled directly (skipping
// browserDefault/autoHidden); no preference re-enters browserDefault.
const canvasSwitchTransitions = [
  { guard: "hasPreferenceShowing", target: "userControlled.showing" },
  { guard: "hasPreferenceHidden", target: "userControlled.hidden" },
  { target: "browserDefault" },
] as const;

export const captionsMachine = setup({
  types: {
    context: {} as CaptionsContext,
    events: {} as CaptionsEvent,
  },
  guards: {
    tracksPresent,
    tracksAbsent,
    hasPreferenceShowing,
    hasPreferenceHidden,
    nativeReportsShowing,
    nativeReportsHidden,
  },
  actions: {
    setPreferenceShowing: assign({ preference: () => "showing" as const }),
    setPreferenceHidden: assign({ preference: () => "hidden" as const }),
    setPreferenceFromNative: assign({
      preference: ({ event }) =>
        event.type === "NATIVE_CHANGE" ? event.mode : null,
    }),
  },
}).createMachine({
  id: "captions",
  initial: "unavailable",
  context: createInitialContext,
  states: {
    unavailable: {
      on: {
        TRACKS_CHANGED: { guard: "tracksPresent", target: "browserDefault" },
        CANVAS_SWITCH: canvasSwitchTransitions,
      },
    },
    browserDefault: {
      on: {
        TRACKS_CHANGED: { guard: "tracksAbsent", target: "unavailable" },
        TRANSCRIPT_POPULATED: { target: "autoHidden" },
        USER_TOGGLE: {
          target: "userControlled.hidden",
          actions: "setPreferenceHidden",
        },
        NATIVE_CHANGE: [
          {
            guard: "nativeReportsHidden",
            target: "userControlled.hidden",
            actions: "setPreferenceFromNative",
          },
          {
            guard: "nativeReportsShowing",
            target: "userControlled.showing",
            actions: "setPreferenceFromNative",
          },
        ],
        CANVAS_SWITCH: canvasSwitchTransitions,
      },
    },
    autoHidden: {
      on: {
        TRACKS_CHANGED: { guard: "tracksAbsent", target: "unavailable" },
        USER_TOGGLE: {
          target: "userControlled.showing",
          actions: "setPreferenceShowing",
        },
        NATIVE_CHANGE: [
          {
            guard: "nativeReportsShowing",
            target: "userControlled.showing",
            actions: "setPreferenceFromNative",
          },
          {
            guard: "nativeReportsHidden",
            target: "userControlled.hidden",
            actions: "setPreferenceFromNative",
          },
        ],
        CANVAS_SWITCH: canvasSwitchTransitions,
      },
    },
    userControlled: {
      // TRANSCRIPT_POPULATED is intentionally unhandled here — the "never
      // rewrite a user-set mode" promise, expressed as the absence of a
      // transition rather than a guard that always fails.
      on: {
        TRACKS_CHANGED: { guard: "tracksAbsent", target: "unavailable" },
        CANVAS_SWITCH: canvasSwitchTransitions,
      },
      initial: "showing",
      states: {
        showing: {
          on: {
            USER_TOGGLE: {
              target: "hidden",
              actions: "setPreferenceHidden",
            },
            NATIVE_CHANGE: {
              guard: "nativeReportsHidden",
              target: "hidden",
              actions: "setPreferenceFromNative",
            },
          },
        },
        hidden: {
          on: {
            USER_TOGGLE: {
              target: "showing",
              actions: "setPreferenceShowing",
            },
            NATIVE_CHANGE: {
              guard: "nativeReportsShowing",
              target: "showing",
              actions: "setPreferenceFromNative",
            },
          },
        },
      },
    },
  },
});

/**
 * Flattens an XState snapshot value (a plain string for top-level states, or
 * `{ userControlled: "showing" | "hidden" }` for the compound state) into
 * the verdict PlayerContext consumers read.
 */
export function captionsVerdict(value: CaptionsStateValue): CaptionsVerdict {
  if (typeof value === "string") return value;
  return value.userControlled;
}
