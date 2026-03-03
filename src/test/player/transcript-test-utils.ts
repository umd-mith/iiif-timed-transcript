import { vi } from "vitest";
import type { TranscriptContext } from "../../lib/player/transcript-context";

export function createMockTranscriptContext(
  overrides: {
    state?: Partial<TranscriptContext["state"]>;
    actions?: Partial<TranscriptContext["actions"]>;
  } = {},
): TranscriptContext {
  return {
    state: {
      annotations: [],
      activeAnnotationId: null,
      searchMatches: [],
      currentMatchIndex: -1,
      highlightedIds: new Set<string>(),
      currentMatchId: null,
      ...overrides.state,
    },
    actions: {
      handleAnnotationClick: vi.fn(),
      handleMatchChange: vi.fn(),
      ...overrides.actions,
    },
  };
}
