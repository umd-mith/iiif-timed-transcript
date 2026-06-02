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

    const errorCall = instance.on.mock.calls.find(
      (call: unknown[]) => call[0] === "error",
    );
    expect(errorCall).toBeDefined();

    const errorHandler = errorCall![1] as (...args: unknown[]) => void;
    errorHandler({ type: "mediaError", error: "download" });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mediaError" }),
    );
  });

  test("isSupported returns true when MediaSource is available", () => {
    const { Ctor } = createMockDashConstructor();
    const adapter = createDashAdapter(Ctor);

    expect(adapter.isSupported()).toBe(true);
  });
});
