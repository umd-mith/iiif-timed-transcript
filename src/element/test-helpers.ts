import { vi } from "vitest";
import { DEFAULT_TAG } from "./register";

export type ElementHandle = HTMLElement & {
  manifestUrl?: string;
  canvasIndex?: number;
  initialTime?: number;
  autoplay?: boolean;
  annotations?: unknown;
  preprocessManifest?: unknown;
  errorCallback?: unknown;
  readonly playerRef?: unknown;
};

/**
 * Creates <iiif-transcript-player>, sets attributes, optionally sets
 * properties *before* append (case-1 precedence), appends to body, and
 * waits for the inner component (a microtask after connectedCallback).
 */
export async function mountElement(
  attrs: Record<string, string>,
  props: Record<string, unknown> = {},
  tag: string = DEFAULT_TAG,
): Promise<ElementHandle> {
  const el = document.createElement(tag) as ElementHandle;
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  Object.assign(el, props);
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  return el;
}

export function shadow(el: HTMLElement): ShadowRoot {
  const root = el.shadowRoot;
  if (!root) throw new Error("element has no shadow root");
  return root;
}

export async function untilShadow<T extends Element = Element>(
  el: HTMLElement,
  selector: string,
): Promise<T> {
  let found: T | null = null;
  await vi.waitFor(() => {
    found = shadow(el).querySelector<T>(selector);
    if (!found) throw new Error(`not yet: ${selector}`);
  });
  return found!;
}

export function waitForEvent<T = unknown>(
  el: HTMLElement,
  type: string,
  timeoutMs = 5000,
): Promise<CustomEvent<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      el.removeEventListener(type, onEvent);
      reject(new Error(`timed out after ${timeoutMs}ms waiting for "${type}"`));
    }, timeoutMs);
    function onEvent(e: Event) {
      clearTimeout(timer);
      resolve(e as CustomEvent<T>);
    }
    el.addEventListener(type, onEvent, { once: true });
  });
}

/**
 * `data:` media stubs. The element tests only need a canvas whose
 * <video>/<audio> element exists; pointing one at `https://example.com/…`
 * makes the browser issue a real request whose outcome depends on the
 * runner's network posture — where example.com resolves, the media element
 * fires MEDIA_ERR_SRC_NOT_SUPPORTED and Root reports a fatal media-tier
 * error mid-test. These stubs fail locally, immediately, and identically
 * everywhere.
 */
export const STUB_VIDEO_SRC = "data:video/mp4;base64,AAAAAA==";
export const STUB_AUDIO_SRC = "data:audio/mpeg;base64,AAAAAA==";

/**
 * A `data:` URL for `seconds` of silence as 8 kHz 8-bit mono PCM WAV, built
 * at runtime so no multi-kilobyte base64 literal lands in the source. Unlike
 * the stubs above this really decodes, so a test that needs `state.isReady`
 * (and therefore a working `seekTo`) has media the browser will accept.
 */
export function silentWavDataUrl(seconds = 3): string {
  const sampleRate = 8000;
  const samples = Math.round(sampleRate * seconds);
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1)
      view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit PCM silence is 0x80
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

type Json = Record<string, unknown>;

type StubSources = { audio?: string; video?: string };

function stubBody(body: unknown, sources: StubSources): unknown {
  // A painting annotation's `body` may itself be an array (IIIF allows it),
  // not only a single resource or a Choice.
  if (Array.isArray(body)) return body.map((b) => stubBody(b, sources));
  if (!body || typeof body !== "object") return body;
  const b = body as Json;
  if (b["type"] === "Choice" && Array.isArray(b["items"])) {
    return { ...b, items: b["items"].map((i) => stubBody(i, sources)) };
  }
  if (b["type"] === "Sound")
    return { ...b, id: sources.audio ?? STUB_AUDIO_SRC };
  if (b["type"] === "Video")
    return { ...b, id: sources.video ?? STUB_VIDEO_SRC };
  return b;
}

/**
 * Returns a copy of a manifest fixture whose painting bodies point at the
 * `data:` stubs above. Shared lib fixtures (src/test/player/test-fixtures.ts)
 * are left untouched — the lib tests share them.
 */
export function withStubMedia<T extends Json>(
  manifest: T,
  sources: StubSources = {},
): T {
  const items = manifest["items"];
  if (!Array.isArray(items)) return manifest;
  return {
    ...manifest,
    items: items.map((canvas) => {
      const c = canvas as Json;
      if (!Array.isArray(c["items"])) return c;
      return {
        ...c,
        items: c["items"].map((page) => {
          const p = page as Json;
          if (!Array.isArray(p["items"])) return p;
          return {
            ...p,
            items: p["items"].map((annotation) => {
              const a = annotation as Json;
              if (a["motivation"] !== "painting") return a;
              return { ...a, body: stubBody(a["body"], sources) };
            }),
          };
        }),
      };
    }),
  };
}

export function removeAllElements(tag: string = DEFAULT_TAG): void {
  document.querySelectorAll(tag).forEach((n) => n.remove());
}
