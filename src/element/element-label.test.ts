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
  removeAllElements,
  shadow,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";

const MANIFEST_STUB = withStubMedia(MANIFEST_WITHOUT_CHAPTERS);

describe("<iiif-transcript-player> label attribute", () => {
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

  test("a host-set label becomes the top-level region's accessible name, and two players with different labels are distinguishable", async () => {
    const urlA = "https://example.com/el-label-a.json";
    const urlB = "https://example.com/el-label-b.json";
    mockFetchRoutes({
      [urlA]: { json: { ...MANIFEST_STUB, id: urlA } },
      [urlB]: { json: { ...MANIFEST_STUB, id: urlB } },
    });
    const elA = await mountElement({
      "manifest-url": urlA,
      label: "Interview with Jane Doe",
    });
    const elB = await mountElement({
      "manifest-url": urlB,
      label: "Interview with John Smith",
    });

    const regionA = shadow(elA).querySelector('[role="region"]');
    const regionB = shadow(elB).querySelector('[role="region"]');
    expect(regionA).not.toBeNull();
    expect(regionB).not.toBeNull();
    expect(regionA!.getAttribute("aria-label")).toBe("Interview with Jane Doe");
    expect(regionB!.getAttribute("aria-label")).toBe(
      "Interview with John Smith",
    );
    expect(regionA!.getAttribute("aria-label")).not.toBe(
      regionB!.getAttribute("aria-label"),
    );
  });

  test("without a label attribute, the region falls back to the localized generic name", async () => {
    const url = "https://example.com/el-label-default.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_STUB, id: url } } });
    const el = await mountElement({ "manifest-url": url });
    const region = shadow(el).querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute("aria-label")).toBe("IIIF transcript player");
  });
});
