import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import {
  captionsMachine,
  captionsVerdict,
} from "../../lib/player/captionsMachine";

function verdictOf(
  actor: ReturnType<typeof createActor<typeof captionsMachine>>,
): ReturnType<typeof captionsVerdict> {
  return captionsVerdict(actor.getSnapshot().value);
}

describe("captionsMachine", () => {
  it("starts in unavailable", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    expect(verdictOf(actor)).toBe("unavailable");
    actor.stop();
  });

  it("moves to browserDefault once tracks appear", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    expect(verdictOf(actor)).toBe("browserDefault");
    actor.stop();
  });

  it("moves back to unavailable if tracks disappear", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    actor.send({ type: "TRACKS_CHANGED", hasTracks: false });
    expect(verdictOf(actor)).toBe("unavailable");
    actor.stop();
  });

  it("browserDefault -> autoHidden on TRANSCRIPT_POPULATED", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    actor.send({ type: "TRANSCRIPT_POPULATED" });
    expect(verdictOf(actor)).toBe("autoHidden");
    actor.stop();
  });

  it("USER_TOGGLE mid-load wins: a later TRANSCRIPT_POPULATED is ignored", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true }); // browserDefault
    actor.send({ type: "USER_TOGGLE" }); // -> userControlled.hidden
    expect(verdictOf(actor)).toBe("hidden");

    actor.send({ type: "TRANSCRIPT_POPULATED" });
    expect(verdictOf(actor)).toBe("hidden");
    actor.stop();
  });

  it("USER_TOGGLE from autoHidden shows captions", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    actor.send({ type: "TRANSCRIPT_POPULATED" }); // autoHidden
    actor.send({ type: "USER_TOGGLE" });
    expect(verdictOf(actor)).toBe("showing");
    actor.stop();
  });

  it("USER_TOGGLE flips back and forth inside userControlled", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    actor.send({ type: "USER_TOGGLE" }); // hidden
    actor.send({ type: "USER_TOGGLE" }); // showing
    expect(verdictOf(actor)).toBe("showing");
    actor.send({ type: "USER_TOGGLE" }); // hidden
    expect(verdictOf(actor)).toBe("hidden");
    actor.stop();
  });

  it("NATIVE_CHANGE keeps the verdict truthful to the browser's own CC menu", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    actor.send({ type: "TRANSCRIPT_POPULATED" }); // autoHidden
    actor.send({ type: "NATIVE_CHANGE", mode: "showing" });
    expect(verdictOf(actor)).toBe("showing");
    actor.stop();
  });

  it("preference survives a CANVAS_SWITCH", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    actor.send({ type: "USER_TOGGLE" }); // hidden
    actor.send({ type: "CANVAS_SWITCH" });
    expect(verdictOf(actor)).toBe("hidden");
    actor.stop();
  });

  it("CANVAS_SWITCH re-enters browserDefault when no preference exists", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    actor.send({ type: "TRANSCRIPT_POPULATED" }); // autoHidden, no preference
    actor.send({ type: "CANVAS_SWITCH" });
    expect(verdictOf(actor)).toBe("browserDefault");
    actor.stop();
  });

  it("only the selected track's mode is ever read by NATIVE_CHANGE — the caller decides the mode, the machine only records the preference", () => {
    const actor = createActor(captionsMachine);
    actor.start();
    actor.send({ type: "TRACKS_CHANGED", hasTracks: true });
    actor.send({ type: "NATIVE_CHANGE", mode: "hidden" });
    expect(verdictOf(actor)).toBe("hidden");
    actor.send({ type: "CANVAS_SWITCH" });
    expect(verdictOf(actor)).toBe("hidden");
    actor.stop();
  });
});
