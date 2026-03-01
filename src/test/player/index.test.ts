import { describe, test, expect } from "vitest";
import { IIIFPlayer } from "../../lib/player/index";

describe("IIIFPlayer namespace", () => {
  test("exports Chapters component", () => {
    expect(IIIFPlayer.Chapters).toBeDefined();
  });

  test("exports CanvasNav component", () => {
    expect(IIIFPlayer.CanvasNav).toBeDefined();
  });

  // Verify existing components still exported
  test("exports all existing components", () => {
    expect(IIIFPlayer.Root).toBeDefined();
    expect(IIIFPlayer.Viewer).toBeDefined();
    expect(IIIFPlayer.Controls).toBeDefined();
    expect(IIIFPlayer.PlayButton).toBeDefined();
    expect(IIIFPlayer.Progress).toBeDefined();
    expect(IIIFPlayer.Skip).toBeDefined();
    expect(IIIFPlayer.Speed).toBeDefined();
    expect(IIIFPlayer.Time).toBeDefined();
    expect(IIIFPlayer.Transcript).toBeDefined();
    expect(IIIFPlayer.TranscriptSearch).toBeDefined();
    expect(IIIFPlayer.TranscriptSegments).toBeDefined();
  });
});
