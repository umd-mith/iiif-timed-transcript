# Design: `onPlayerInit` callback for external player access

**Date:** 2026-03-09
**Status:** Draft
**Responds to:** [Issue #25](https://github.com/your-org/svelte-iiif-transcript-player/issues/25)

## Problem

Consumers that need player state outside `IIIFPlayer.Root`'s subtree (sibling components, parent-level orchestration) have no clean access path. The children snippet exposes state only within the snippet scope, and `getPlayerContext()` / `tryGetPlayerContext()` only work inside the subtree.

The workaround — an IIFE inside the children snippet that writes to `$state` during render with `untrack()` — is brittle and undiscoverable.

## Decision: callback, not `bind:`

Issue #25 proposes `bind:player`. We rejected this because:

1. **Inverts data flow.** Root owns state; a `$bindable` prop creates an upward write during Root's lifecycle, exposing partially-initialized state at each setup step.
2. **Shape ambiguity.** The internal `PlayerStateManager` has more fields than the curated snippet object. A binding must choose what to expose, then keep a synthetic object in sync or leak internals.
3. **Ecosystem misalignment.** Compound component libraries (Bits UI, Melt UI, Radix Svelte) use context + snippets, not `bind:` on root components.

A one-directional callback (`onPlayerInit`) fires at a well-defined lifecycle point with a purpose-built type.

## Design

### New type: `PlayerRef`

```ts
export interface PlayerRef {
  readonly state: PlayerState;
  readonly actions: PlayerActions;
  readonly annotations: Annotation[];
  readonly chapters: Chapter[];
  readonly activeChapterId: string | null;
  readonly canvasIndex: number;
  readonly canvasCount: number;
  readonly canvases: CanvasInfo[];
  readonly mediaType: "audio" | "video";
}
```

**Included** (orchestration-relevant): playback state/actions, content metadata, canvas navigation, media type.

**Excluded** (internal wiring): `mediaElement`, `hlsAdapter`, `mediaStrategy`, `tracks`, `mediaUrl`. Consumers needing these should use `getPlayerContext()` from inside the subtree.

At runtime, the callback passes the `PlayerStateManager` instance directly. `PlayerStateManager` satisfies the `PlayerRef` interface without any adapter code. TypeScript narrows the surface; no runtime proxy or wrapper object is created.

### New prop: `onPlayerInit`

```ts
onPlayerInit?: (player: PlayerRef) => void;
```

Added to `IIIFPlayer.Root`'s props.

### Firing point

Inside `fetchManifestData()`, after `loadCanvas()` completes on the first successful load:

```ts
let initFired = false;

async function fetchManifestData() {
  try {
    let manifestPromise = manifestCache.get(manifestUrl);
    if (!manifestPromise) {
      manifestPromise = fetchAndValidateManifest(manifestUrl);
      manifestCache.set(manifestUrl, manifestPromise);
    }

    manifestData = await manifestPromise;
    player.canvases = buildCanvasInfoList(manifestData.validated);
    loadCanvas(player.canvasIndex);

    if (!initFired) {
      initFired = true;
      onPlayerInit?.(player);
    }
  } catch (error) {
    manifestCache.delete(manifestUrl);
    player.state.error =
      error instanceof Error ? error : new Error(String(error));
    player.state.isReady = false;
  }
}
```

**Behaviors:**

- Fires exactly once per Root mount instance — after manifest fetch and first canvas load succeed. `initFired` is component-local state, so consumers who remount Root (e.g., `{#key canvasIndex}` around Root) get a fresh callback on each mount. This is correct: each mount is a new player with its own manifest parse and media element.
- Does not fire on canvas switches within a single mount. Canvas changes are observable reactively through the ref.
- Does not fire on failed loads. If manifest fetch fails and the consumer calls `retry()`, the callback fires on the first successful retry (guarded by `initFired`).
- At firing time: `canvases`, `mediaType`, `chapters`, `annotations`, `canvasIndex` are populated. `state.isReady` is still `false` (media element hasn't loaded yet). `state.duration` is `0`.

### Naming rationale

`onPlayerInit` rather than `onPlayerReady` because at firing time the media is not yet playable. "Init" communicates that the player is initialized (manifest parsed, canvas loaded) without implying media readiness. This preserves naming space for a future `onPlayerReady` (media loaded) or `onCanvasInit` (per-canvas lifecycle) if needed.

### Consumer usage

```svelte
<script lang="ts">
  import {
    IIIFPlayer,
    type PlayerRef,
  } from "@umd-mith/svelte-iiif-transcript-player";

  let player = $state<PlayerRef | null>(null);

  const isPlaying = $derived(player?.state.isPlaying ?? false);
  const isAudio = $derived(player?.mediaType === "audio");
  const canvasLabel = $derived(
    player ? player.canvases[player.canvasIndex]?.label : "",
  );
</script>

<IIIFPlayer.Root
  {manifestUrl}
  onPlayerInit={(p) => {
    player = p;
  }}
>
  <IIIFPlayer.Viewer />
  <IIIFPlayer.Controls>
    <IIIFPlayer.PlayButton />
    <IIIFPlayer.Progress />
  </IIIFPlayer.Controls>
</IIIFPlayer.Root>

<TranscriptPanel annotations={player?.annotations ?? []} {isPlaying} />
<AudioPlayerControls {isPlaying} mediaType={isAudio ? "audio" : "video"} />
```

Reactivity works because the ref is the `PlayerStateManager` instance, which uses `$state` and `$derived` internally. Any `$derived` chain built on `player?.state.currentTime` updates automatically.

### Backward compatibility

- Children snippet unchanged — `{ player }` snippet parameter still works.
- `getPlayerContext()` / `tryGetPlayerContext()` unchanged.
- `onPlayerInit` is optional — omitting it changes nothing.

### Exports

One new export from `src/lib/index.ts`: the `PlayerRef` type.

`onPlayerInit` is a prop on Root, not a standalone export.

### Future extensibility

- **`onCanvasInit`** — per-canvas lifecycle hook, fires after each canvas switch. Not included now; add when there's a real use case.
- **`onPlayerReady`** — fires when media is playable (`state.isReady === true`). Naming space is preserved.
- **Proxy upgrade** — if runtime encapsulation becomes necessary, the `PlayerRef` type stays the same; only the internal construction changes (getters instead of direct reference).

## Testing

### Compile-time: type satisfaction

```ts
import type { PlayerRef } from "./context";
import { PlayerStateManager } from "./PlayerState.svelte";

const _typeCheck: PlayerRef = new PlayerStateManager();
```

Fails at build time if `PlayerStateManager` drifts from `PlayerRef`.

### Component test: callback fires with correct ref

```ts
test("calls onPlayerInit after manifest loads", async () => {
  let receivedRef: PlayerRef | null = null;

  render(Root, {
    manifestUrl: "/test-manifest.json",
    onPlayerInit: (player) => {
      receivedRef = player;
    },
  });

  await waitFor(() => expect(receivedRef).not.toBeNull());

  expect(receivedRef!.state).toBeDefined();
  expect(receivedRef!.actions).toBeDefined();
  expect(receivedRef!.canvases.length).toBeGreaterThan(0);
  expect(receivedRef!.mediaType).toMatch(/^(audio|video)$/);
});
```

### Component test: fires at most once on retry

```ts
test("calls onPlayerInit only once on retry", async () => {
  const initSpy = vi.fn();

  fetchMock
    .mockRejectOnce(new Error("network"))
    .mockResolvedOnce(validManifest);

  render(Root, {
    manifestUrl: "/test-manifest.json",
    onPlayerInit: initSpy,
  });

  // Error state — callback hasn't fired
  await waitFor(() => expect(/* error visible */));
  expect(initSpy).not.toHaveBeenCalled();

  // Trigger retry, then verify
  await waitFor(() => expect(initSpy).toHaveBeenCalledOnce());
});
```

### Not tested

- **Reactivity after callback** — Svelte's `$state` contract, not ours.
- **Runtime exclusion of `mediaElement`** — TypeScript enforces the boundary; runtime casting is out of scope per the "narrow interface over instance" approach.

## Changes summary

| File                         | Change                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| `src/lib/player/context.ts`  | Add `PlayerRef` interface                                       |
| `src/lib/player/Root.svelte` | Add `onPlayerInit` prop, `initFired` guard, callback invocation |
| `src/lib/index.ts`           | Export `PlayerRef` type                                         |
| `README.md`                  | New "Accessing player state outside Root" section               |
| Tests                        | Type satisfaction check, callback firing tests                  |
