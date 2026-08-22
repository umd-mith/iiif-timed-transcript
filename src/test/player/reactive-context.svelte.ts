import { createMockPlayerContext } from "./test-utils";
import type { PlayerContext } from "../../lib/player/context";

/**
 * PlayerContext with the `readonly` markers dropped. Those markers are
 * advisory guidance for consumers; a test standing in for Root has to write
 * the fields Root writes (`canvasIndex`, `tracks`, ...).
 */
export type MutablePlayerContext = {
  -readonly [K in keyof PlayerContext]: PlayerContext[K];
};

/**
 * A mock PlayerContext whose fields are reactive, so tests can mutate it after
 * mount (e.g. `ctx.transcriptPopulated = true`) and observe effects re-run.
 */
export function createReactiveMockPlayerContext(
  overrides: Parameters<typeof createMockPlayerContext>[0] = {},
): MutablePlayerContext {
  const ctx = $state(createMockPlayerContext(overrides));
  return ctx;
}
