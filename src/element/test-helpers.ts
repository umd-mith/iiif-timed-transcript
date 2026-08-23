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
): Promise<CustomEvent<T>> {
  return new Promise((resolve) => {
    el.addEventListener(type, (e) => resolve(e as CustomEvent<T>), {
      once: true,
    });
  });
}

export function removeAllElements(tag: string = DEFAULT_TAG): void {
  document.querySelectorAll(tag).forEach((n) => n.remove());
}
