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
      return typeof window !== "undefined" && "MediaSource" in window;
    },
  };
}
