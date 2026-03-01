import { describe, test, expect, vi } from "vitest";
import {
  isHlsUrl,
  isHlsNativelySupported,
  createHlsAdapter,
} from "../../lib/media/hlsUtils";

describe("isHlsUrl", () => {
  test("detects .m3u8 extension", () => {
    expect(isHlsUrl("https://example.com/stream.m3u8")).toBe(true);
  });

  test("detects .m3u8 with query params", () => {
    expect(isHlsUrl("https://example.com/stream.m3u8?token=abc")).toBe(true);
  });

  test("detects .m3u8 with fragment", () => {
    expect(isHlsUrl("https://example.com/stream.m3u8#t=10,20")).toBe(true);
  });

  test("rejects non-HLS URLs", () => {
    expect(isHlsUrl("https://example.com/video.mp4")).toBe(false);
    expect(isHlsUrl("https://example.com/audio.mp3")).toBe(false);
  });

  test("detects HLS via application/vnd.apple.mpegurl format", () => {
    expect(
      isHlsUrl("https://example.com/stream", "application/vnd.apple.mpegurl"),
    ).toBe(true);
  });

  test("detects HLS via application/x-mpegURL format", () => {
    expect(
      isHlsUrl("https://example.com/stream", "application/x-mpegURL"),
    ).toBe(true);
  });

  test("format detection is case-insensitive", () => {
    expect(
      isHlsUrl("https://example.com/stream", "Application/X-MPEGURL"),
    ).toBe(true);
  });

  test("returns false for non-HLS format with non-HLS URL", () => {
    expect(isHlsUrl("https://example.com/video.mp4", "video/mp4")).toBe(false);
  });
});

describe("isHlsNativelySupported", () => {
  test("returns true when canPlayType reports support", () => {
    const el = document.createElement("video");
    vi.spyOn(el, "canPlayType").mockReturnValue("maybe");

    expect(isHlsNativelySupported(el)).toBe(true);
  });

  test("returns false when canPlayType reports no support", () => {
    const el = document.createElement("video");
    vi.spyOn(el, "canPlayType").mockReturnValue("");

    expect(isHlsNativelySupported(el)).toBe(false);
  });

  test("works without argument by creating its own element", () => {
    const result = isHlsNativelySupported();
    expect(typeof result).toBe("boolean");
  });
});

describe("createHlsAdapter", () => {
  function createMockHlsInstance() {
    return {
      loadSource: vi.fn(),
      attachMedia: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
  }

  function createMockHlsConstructor(instance = createMockHlsInstance()) {
    // Must use function (not arrow) to be constructable with `new`
    function Ctor(this: any) {
      Object.assign(this, instance);
    }
    Ctor.isSupported = vi.fn(() => true);
    Ctor.Events = {
      MANIFEST_PARSED: "hlsManifestParsed",
      ERROR: "hlsError",
    };
    return { Ctor: Ctor as any, instance };
  }

  test("attach loads source and attaches to media element", () => {
    const { Ctor, instance } = createMockHlsConstructor();
    const adapter = createHlsAdapter(Ctor);
    const video = document.createElement("video");

    adapter.attach(video, "https://example.com/stream.m3u8");

    expect(instance.loadSource).toHaveBeenCalledWith(
      "https://example.com/stream.m3u8",
    );
    expect(instance.attachMedia).toHaveBeenCalledWith(video);
  });

  test("detach destroys the hls instance", () => {
    const { Ctor, instance } = createMockHlsConstructor();
    const adapter = createHlsAdapter(Ctor);
    const video = document.createElement("video");

    adapter.attach(video, "https://example.com/stream.m3u8");
    adapter.detach();

    expect(instance.destroy).toHaveBeenCalled();
  });

  test("detach is safe to call when not attached", () => {
    const { Ctor } = createMockHlsConstructor();
    const adapter = createHlsAdapter(Ctor);

    expect(() => adapter.detach()).not.toThrow();
  });

  test("attach replaces previous instance on re-attach", () => {
    const instance1 = createMockHlsInstance();
    const instance2 = createMockHlsInstance();
    let callCount = 0;
    function Ctor(this: any) {
      callCount++;
      Object.assign(this, callCount === 1 ? instance1 : instance2);
    }
    (Ctor as any).isSupported = vi.fn(() => true);
    (Ctor as any).Events = {
      MANIFEST_PARSED: "hlsManifestParsed",
      ERROR: "hlsError",
    };

    const adapter = createHlsAdapter(Ctor as any);
    const video = document.createElement("video");

    adapter.attach(video, "https://example.com/stream1.m3u8");
    adapter.attach(video, "https://example.com/stream2.m3u8");

    expect(instance1.destroy).toHaveBeenCalled();
    expect(instance2.loadSource).toHaveBeenCalledWith(
      "https://example.com/stream2.m3u8",
    );
  });

  test("calls onError when hls reports an error", () => {
    const instance = createMockHlsInstance();
    const { Ctor } = createMockHlsConstructor(instance);
    const onError = vi.fn();
    const adapter = createHlsAdapter(Ctor);
    const video = document.createElement("video");

    adapter.attach(video, "https://example.com/stream.m3u8", { onError });

    // Find the ERROR event handler registered via on()
    const errorCall = instance.on.mock.calls.find(
      (call: unknown[]) => call[0] === "hlsError",
    );
    expect(errorCall).toBeDefined();

    // Simulate HLS error
    const errorHandler = errorCall![1] as (...args: unknown[]) => void;
    errorHandler("hlsError", { type: "networkError", fatal: true });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "networkError", fatal: true }),
    );
  });

  test("isSupported delegates to Hls.isSupported", () => {
    const { Ctor } = createMockHlsConstructor();
    const adapter = createHlsAdapter(Ctor);

    expect(adapter.isSupported()).toBe(true);
    expect(Ctor.isSupported).toHaveBeenCalled();
  });
});
