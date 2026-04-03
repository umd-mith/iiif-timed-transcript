# DASH Video Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DASH adaptive streaming support alongside existing HLS, completing the player's streaming protocol coverage.

**Architecture:** Mirror the existing HLS adapter pattern exactly — a `dashUtils.ts` file with URL detection, typed constructor interface, and adapter factory. Root.svelte gains a `dashConstructor` prop and auto-import fallback. Viewer.svelte wires the adapter in a new `$effect`.

**Tech Stack:** dash.js (optional peer dep), Svelte 5, TypeScript, Vitest browser mode

**Spec:** `docs/plans/2026-04-03-dash-support-design.md`

---

## File Structure

| Action | File                                    | Responsibility                                                                   |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------- |
| Create | `src/lib/media/dashUtils.ts`            | DASH URL detection, DashConstructor/DashAdapter types, createDashAdapter factory |
| Create | `src/test/media/dashUtils.test.ts`      | Unit tests for URL detection and adapter lifecycle                               |
| Modify | `src/lib/player/context.ts`             | Add `"dash-js"` to MediaStrategy, `dashAdapter` to PlayerContext                 |
| Modify | `src/lib/player/PlayerState.svelte.ts`  | Add `dashAdapter` state field                                                    |
| Modify | `src/lib/player/Root.svelte`            | Add `dashConstructor` prop, DASH detection in setupCanvas, resolveDashAdapter    |
| Modify | `src/lib/player/Viewer.svelte`          | Update mediaSrc derived, add DASH adapter $effect wiring                         |
| Modify | `src/lib/index.ts`                      | Export DASH utilities and types                                                  |
| Modify | `src/test/player/Viewer.svelte.test.ts` | DASH adapter wiring tests                                                        |

---

## Task 1: Create `dashUtils.ts` with URL detection

**Files:**

- Create: `src/lib/media/dashUtils.ts`
- Create: `src/test/media/dashUtils.test.ts`

- [ ] **Step 1: Write failing tests for `isDashUrl`**

```ts
// src/test/media/dashUtils.test.ts
import { describe, test, expect, vi } from "vitest";
import {
  isDashUrl,
  createDashAdapter,
  type DashConstructor,
} from "../../lib/media/dashUtils";

describe("isDashUrl", () => {
  test("detects .mpd extension", () => {
    expect(isDashUrl("https://example.com/stream.mpd")).toBe(true);
  });

  test("detects .mpd with query params", () => {
    expect(isDashUrl("https://example.com/stream.mpd?token=abc")).toBe(true);
  });

  test("detects .mpd with fragment", () => {
    expect(isDashUrl("https://example.com/stream.mpd#t=10,20")).toBe(true);
  });

  test("rejects non-DASH URLs", () => {
    expect(isDashUrl("https://example.com/video.mp4")).toBe(false);
    expect(isDashUrl("https://example.com/stream.m3u8")).toBe(false);
  });

  test("detects DASH via application/dash+xml format", () => {
    expect(
      isDashUrl("https://example.com/stream", "application/dash+xml"),
    ).toBe(true);
  });

  test("format detection is case-insensitive", () => {
    expect(
      isDashUrl("https://example.com/stream", "Application/DASH+XML"),
    ).toBe(true);
  });

  test("returns false for non-DASH format with non-DASH URL", () => {
    expect(isDashUrl("https://example.com/video.mp4", "video/mp4")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/test/media/dashUtils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `isDashUrl` and type interfaces**

```ts
// src/lib/media/dashUtils.ts
const DASH_FORMATS = ["application/dash+xml"];

/**
 * Detects whether a URL points to a DASH stream.
 * Checks for .mpd extension (ignoring query/fragment) and
 * known DASH content types from the IIIF manifest format field.
 */
export function isDashUrl(url: string, format?: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith(".mpd")) return true;
  } catch {
    if (url.split("?")[0]?.split("#")[0]?.endsWith(".mpd")) return true;
  }

  if (format && DASH_FORMATS.includes(format.toLowerCase())) return true;

  return false;
}

/**
 * Minimal interface for dash.js MediaPlayer factory, used for dependency
 * injection so consumers provide the actual dashjs library (optional peer dep).
 */
export interface DashConstructor {
  create(): DashInstance;
}

interface DashInstance {
  initialize(el: HTMLMediaElement, src: string, autoPlay: boolean): void;
  destroy(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

export interface DashAdapter {
  attach(
    el: HTMLMediaElement,
    src: string,
    options?: { onError?: (data: unknown) => void },
  ): void;
  detach(): void;
  isSupported(): boolean;
}
```

- [ ] **Step 4: Run tests to verify `isDashUrl` tests pass**

Run: `pnpm vitest run src/test/media/dashUtils.test.ts`
Expected: `isDashUrl` tests PASS, adapter tests not yet written

- [ ] **Step 5: Commit**

```bash
git add src/lib/media/dashUtils.ts src/test/media/dashUtils.test.ts
git commit -m "feat(media): add isDashUrl detection and DASH type interfaces"
```

---

## Task 2: Implement `createDashAdapter`

**Files:**

- Modify: `src/lib/media/dashUtils.ts`
- Modify: `src/test/media/dashUtils.test.ts`

- [ ] **Step 1: Write failing tests for `createDashAdapter`**

Add to `src/test/media/dashUtils.test.ts`:

```ts
describe("createDashAdapter", () => {
  function createMockDashInstance() {
    return {
      initialize: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
  }

  function createMockDashConstructor(instance = createMockDashInstance()) {
    return {
      Ctor: { create: vi.fn(() => instance) } as unknown as DashConstructor,
      instance,
    };
  }

  test("attach initializes dash player on media element", () => {
    const { Ctor, instance } = createMockDashConstructor();
    const adapter = createDashAdapter(Ctor);
    const video = document.createElement("video");

    adapter.attach(video, "https://example.com/stream.mpd");

    expect(instance.initialize).toHaveBeenCalledWith(
      video,
      "https://example.com/stream.mpd",
      false,
    );
  });

  test("detach destroys the dash instance", () => {
    const { Ctor, instance } = createMockDashConstructor();
    const adapter = createDashAdapter(Ctor);
    const video = document.createElement("video");

    adapter.attach(video, "https://example.com/stream.mpd");
    adapter.detach();

    expect(instance.destroy).toHaveBeenCalled();
  });

  test("detach is safe to call when not attached", () => {
    const { Ctor } = createMockDashConstructor();
    const adapter = createDashAdapter(Ctor);

    expect(() => adapter.detach()).not.toThrow();
  });

  test("attach replaces previous instance on re-attach", () => {
    const instance1 = createMockDashInstance();
    const instance2 = createMockDashInstance();
    let callCount = 0;
    const Ctor = {
      create: vi.fn(() => {
        callCount++;
        return callCount === 1 ? instance1 : instance2;
      }),
    } as unknown as DashConstructor;

    const adapter = createDashAdapter(Ctor);
    const video = document.createElement("video");

    adapter.attach(video, "https://example.com/stream1.mpd");
    adapter.attach(video, "https://example.com/stream2.mpd");

    expect(instance1.destroy).toHaveBeenCalled();
    expect(instance2.initialize).toHaveBeenCalledWith(
      video,
      "https://example.com/stream2.mpd",
      false,
    );
  });

  test("calls onError when dash reports an error", () => {
    const instance = createMockDashInstance();
    const { Ctor } = createMockDashConstructor(instance);
    const onError = vi.fn();
    const adapter = createDashAdapter(Ctor);
    const video = document.createElement("video");

    adapter.attach(video, "https://example.com/stream.mpd", { onError });

    // Find the error event handler registered via on()
    const errorCall = instance.on.mock.calls.find(
      (call: unknown[]) => call[0] === "error",
    );
    expect(errorCall).toBeDefined();

    // Simulate DASH error
    const errorHandler = errorCall![1] as (...args: unknown[]) => void;
    errorHandler({ type: "mediaError", error: "download" });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mediaError" }),
    );
  });

  test("isSupported returns true (DASH uses MSE which is widely supported)", () => {
    const { Ctor } = createMockDashConstructor();
    const adapter = createDashAdapter(Ctor);

    expect(adapter.isSupported()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/test/media/dashUtils.test.ts`
Expected: FAIL — `createDashAdapter` not defined

- [ ] **Step 3: Implement `createDashAdapter`**

Add to `src/lib/media/dashUtils.ts`:

```ts
/**
 * Creates a DASH adapter that manages the dash.js lifecycle on a media element.
 * The dash.js MediaPlayer factory is injected so the library remains an optional peer dep.
 */
export function createDashAdapter(Dash: DashConstructor): DashAdapter {
  let instance: DashInstance | null = null;

  return {
    attach(el, src, options) {
      if (instance) {
        instance.destroy();
        instance = null;
      }

      instance = Dash.create();

      if (options?.onError) {
        const onError = options.onError;
        instance.on("error", (data: unknown) => {
          onError(data);
        });
      }

      instance.initialize(el, src, false);
    },

    detach() {
      if (instance) {
        instance.destroy();
        instance = null;
      }
    },

    isSupported() {
      // DASH uses Media Source Extensions (MSE), supported by all modern browsers
      return typeof window !== "undefined" && "MediaSource" in window;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/test/media/dashUtils.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/media/dashUtils.ts src/test/media/dashUtils.test.ts
git commit -m "feat(media): implement createDashAdapter factory"
```

---

## Task 3: Update context, PlayerState, and exports

**Files:**

- Modify: `src/lib/player/context.ts`
- Modify: `src/lib/player/PlayerState.svelte.ts`
- Modify: `src/lib/index.ts`

- [ ] **Step 1: Update `MediaStrategy` type in `context.ts`**

In `src/lib/player/context.ts`:

- Add import: `import type { DashAdapter } from "../media/dashUtils";`
- Change line 46: `export type MediaStrategy = "native" | "hls-js" | "dash-js";`
- Add to `PlayerContext` interface after `hlsAdapter`: `readonly dashAdapter: DashAdapter | null;`
- Update JSDoc on `MediaStrategy` to include `'dash-js'` description
- Update `PlayerRef` JSDoc to mention `dashAdapter` in excluded fields list

- [ ] **Step 2: Add `dashAdapter` state to `PlayerState.svelte.ts`**

In `src/lib/player/PlayerState.svelte.ts`:

- Add import: `import type { DashAdapter } from "../media/dashUtils";`
- After line 44 (`hlsAdapter`), add: `dashAdapter = $state.raw<DashAdapter | null>(null);`

- [ ] **Step 3: Add DASH exports to `index.ts`**

In `src/lib/index.ts`, in the Media Utilities section:

```ts
export { isDashUrl, createDashAdapter } from "./media/dashUtils";
export type { DashConstructor, DashAdapter } from "./media/dashUtils";
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (no type errors)

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/context.ts src/lib/player/PlayerState.svelte.ts src/lib/index.ts
git commit -m "feat(player): add dash-js MediaStrategy and DashAdapter to context"
```

---

## Task 4: Wire DASH detection and adapter in Root.svelte

**Files:**

- Modify: `src/lib/player/Root.svelte`

- [ ] **Step 1: Add imports and `dashConstructor` prop**

In `src/lib/player/Root.svelte`:

- Add to imports: `import { isDashUrl, createDashAdapter, type DashConstructor } from "../media/dashUtils";`
- Add `dashConstructor` prop after `hlsConstructor`:
  ```ts
  dashConstructor,
  ```
- Add to props type:

  ```ts
  dashConstructor?: DashConstructor;
  ```

- [ ] **Step 2: Add DASH detection in `setupCanvas`**

In the `setupCanvas` function, change the media strategy block (around lines 227-238) from:

```ts
if (isHlsUrl(primaryResource.id, primaryResource.format)) {
  if (isHlsNativelySupported()) {
    player.mediaStrategy = "native";
  } else {
    player.mediaStrategy = "hls-js";
    resolveHlsAdapter();
  }
} else {
  player.mediaStrategy = "native";
}
```

To:

```ts
if (isHlsUrl(primaryResource.id, primaryResource.format)) {
  if (isHlsNativelySupported()) {
    player.mediaStrategy = "native";
  } else {
    player.mediaStrategy = "hls-js";
    resolveHlsAdapter();
  }
} else if (isDashUrl(primaryResource.id, primaryResource.format)) {
  player.mediaStrategy = "dash-js";
  resolveDashAdapter();
} else {
  player.mediaStrategy = "native";
}
```

- [ ] **Step 3: Add `resolveDashAdapter` function**

After `resolveHlsAdapter`, add:

```ts
async function resolveDashAdapter() {
  const Dash =
    dashConstructor ??
    (await import("dashjs")
      .then(
        (m) =>
          (m.default ?? m) as unknown as { MediaPlayer: () => DashConstructor },
      )
      .then((dashjs) => dashjs.MediaPlayer())
      .catch(() => {
        console.warn(
          "[IIIFPlayer] DASH stream detected but dashjs is not installed. " +
            "Install it with: npm install dashjs",
        );
        return null;
      }));
  if (Dash) {
    player.dashAdapter = createDashAdapter(Dash);
  }
}
```

- [ ] **Step 4: Clean up DASH adapter on canvas reset**

In the canvas reset section (around line 119 where `player.hlsAdapter?.detach()` is called), add:

```ts
player.dashAdapter?.detach();
```

- [ ] **Step 5: Run typecheck and tests**

Run: `pnpm typecheck && pnpm vitest run src/test/player/Root.svelte.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/player/Root.svelte
git commit -m "feat(player): add DASH detection and dashConstructor prop to Root"
```

---

## Task 5: Wire DASH adapter in Viewer.svelte

**Files:**

- Modify: `src/lib/player/Viewer.svelte`
- Modify: `src/test/player/Viewer.svelte.test.ts`

- [ ] **Step 1: Update `mediaSrc` derived**

Change line 27-29 in `Viewer.svelte` from:

```ts
const mediaSrc = $derived(
  ctx.mediaStrategy === "hls-js" ? undefined : ctx.mediaUrl,
);
```

To:

```ts
const mediaSrc = $derived(
  ctx.mediaStrategy === "native" ? ctx.mediaUrl : undefined,
);
```

This is cleaner — native sets src, both adapters manage it themselves.

- [ ] **Step 2: Add DASH adapter wiring `$effect`**

After the HLS adapter `$effect` block, add:

```ts
// DASH adapter wiring: attach when strategy is dash-js and adapter exists
$effect(() => {
  const el = localMediaElement;
  const adapter = ctx.dashAdapter;
  if (!el || !adapter) return;

  adapter.attach(el, ctx.mediaUrl, {
    onError: (data: unknown) => {
      const errorData = data as {
        error?: string;
        event?: { type?: string };
      };
      const isFatal =
        errorData.error === "download" || errorData.error === "mediasource";
      if (isFatal) {
        ctx.state.error = new Error(
          `DASH error: ${errorData.error || "unknown"}`,
        );
        ctx.state.isReady = false;
      } else {
        console.warn(
          `[IIIFPlayer] Non-fatal DASH error: ${errorData.error || "unknown"}`,
        );
      }
    },
  });

  return () => {
    adapter.detach();
  };
});
```

- [ ] **Step 3: Write Viewer tests for DASH adapter wiring**

Add to `src/test/player/Viewer.svelte.test.ts`, in a new describe block after "HLS adapter wiring":

```ts
describe("DASH adapter wiring", () => {
  test("attaches adapter when mediaStrategy is dash-js", async () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockAdapter = {
      attach: vi.fn(),
      detach: vi.fn(),
      isSupported: () => true,
    };

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/stream.mpd",
      mediaType: "video",
      mediaStrategy: "dash-js",
      dashAdapter: mockAdapter,
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    await vi.waitFor(() => {
      expect(mockAdapter.attach).toHaveBeenCalledWith(
        expect.any(HTMLVideoElement),
        "https://example.com/stream.mpd",
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });
  });

  test("does not set src attribute when mediaStrategy is dash-js", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockAdapter = {
      attach: vi.fn(),
      detach: vi.fn(),
      isSupported: () => true,
    };

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/stream.mpd",
      mediaType: "video",
      mediaStrategy: "dash-js",
      dashAdapter: mockAdapter,
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    const videoElement = target.querySelector("video") as HTMLVideoElement;
    expect(videoElement?.getAttribute("src")).toBeNull();
  });
});
```

- [ ] **Step 4: Update `createMockPlayerContext` in test-utils.ts**

In `src/test/player/test-utils.ts`, add `dashAdapter: null` to the default context (after `hlsAdapter: null`).

- [ ] **Step 5: Run all tests**

Run: `pnpm vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/player/Viewer.svelte src/test/player/Viewer.svelte.test.ts src/test/player/test-utils.ts
git commit -m "feat(player): wire DASH adapter in Viewer with error handling"
```

---

## Task 6: Run full quality checks and format

- [ ] **Step 1: Run Prettier**

Run: `pnpm prettier --write src/lib/media/dashUtils.ts src/test/media/dashUtils.test.ts src/lib/player/context.ts src/lib/player/PlayerState.svelte.ts src/lib/player/Root.svelte src/lib/player/Viewer.svelte src/lib/index.ts src/test/player/Viewer.svelte.test.ts src/test/player/test-utils.ts`

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests PASS

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit any formatting fixes**

```bash
git add -A && git commit -m "style: format DASH support files"
```

(Skip if no changes.)
