import {
  describe,
  test,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { register } from "./register";
import {
  mountElement,
  untilShadow,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";

const MANIFEST_STUB = withStubMedia(MANIFEST_WITHOUT_CHAPTERS);

describe("<iiif-transcript-player> crossorigin passthrough", () => {
  beforeAll(() => {
    register();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    removeAllElements();
    manifestCache.clear();
  });

  test("the crossorigin attribute reaches the underlying media element", async () => {
    const url = "https://example.com/el-crossorigin.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_STUB, id: url } } });
    const el = await mountElement({
      "manifest-url": url,
      crossorigin: "anonymous",
    });
    const audio = await untilShadow<HTMLAudioElement>(el, "audio");
    expect(audio.crossOrigin).toBe("anonymous");
  });
});
