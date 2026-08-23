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

type Json = Record<string, unknown>;

function stubBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const b = body as Json;
  if (b["type"] === "Choice" && Array.isArray(b["items"])) {
    return { ...b, items: b["items"].map(stubBody) };
  }
  if (b["type"] === "Sound") return { ...b, id: STUB_AUDIO_SRC };
  if (b["type"] === "Video") return { ...b, id: STUB_VIDEO_SRC };
  return b;
}

/**
 * Returns a copy of a manifest fixture whose painting bodies point at the
 * `data:` stubs above. Shared lib fixtures (src/test/player/test-fixtures.ts)
 * are left untouched — the lib tests share them.
 */
export function withStubMedia<T extends Json>(manifest: T): T {
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
              return { ...a, body: stubBody(a["body"]) };
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
