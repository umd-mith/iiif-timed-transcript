import {
  describe,
  test,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import axe from "axe-core";
import { register } from "./register";
import {
  mountElement,
  untilShadow,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";

// Media stubs: see element-theming.test.ts for why — the lib fixtures point
// <audio>/<video> at https://example.com/…, which the browser really
// requests. withStubMedia swaps in `data:` sources that fail locally and
// identically on every runner.
const MANIFEST_STUB = withStubMedia(MANIFEST_WITH_EMBEDDED_TRANSCRIPT);

// In-page axe-core, not @axe-core/playwright: Vitest browser mode runs test
// code inside the real browser with no `Page` handle available to it, so
// the Playwright-driven axe integration (which needs one) cannot be used
// here. axe.run() traverses open shadow DOM automatically from the context
// node passed to it, which is exactly what the element exposes.
//
// Scope: this covers axe's automatic checks — 1.4.3 (color-contrast),
// 4.1.2 (name/role/value basics: aria-*, button-name, etc.), 1.3.1
// (info/relationships: label, list structure). It does NOT cover 1.4.11
// non-text contrast, focus-outline color, or color-only state indicators —
// axe has no rule for any of those. See src/element/contrast.test.ts (B2)
// for that regression guard.
describe("<iiif-transcript-player> axe scan", () => {
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

  test("mounted element with a populated transcript has no WCAG 2.1 AA axe violations", async () => {
    const url = "https://example.com/el-axe-scan.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "[data-annotation-id]");

    const results = await axe.run(el, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });

    if (results.violations.length > 0) {
      const detail = results.violations
        .map(
          (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`,
        )
        .join("\n");
      throw new Error(`axe violations:\n${detail}`);
    }
    expect(results.violations).toHaveLength(0);
  });
});
