import { createMockPlayerContext } from "./test-utils";
import type { PlayerContext } from "../../lib/player/context";

/**
 * A mock PlayerContext whose fields are reactive, so tests can mutate it after
 * mount (e.g. `ctx.transcriptPopulated = true`) and observe effects re-run.
 */
export function createReactiveMockPlayerContext(
  overrides: Parameters<typeof createMockPlayerContext>[0] = {},
): PlayerContext {
  const ctx = $state(createMockPlayerContext(overrides));
  return ctx;
}
