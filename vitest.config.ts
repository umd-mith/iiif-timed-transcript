import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { elementSveltePlugin } from "./vite.config.element";

const browser = () => ({
  enabled: true,
  provider: playwright(),
  instances: [{ browser: "chromium" as const }],
  headless: true,
});

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        // Library suites: every existing test lives under src/test/.
        // Invariant: src/element is NOT collected here — it would compile the
        // wrapper as an ordinary component.
        plugins: [svelte({ hot: !process.env.VITEST })],
        test: {
          name: "lib",
          include: ["src/test/**/*.test.ts"],
          browser: browser(),
        },
      },
      {
        // Element suites: custom-element compile for src/element/*.svelte,
        // CSS injected (not extracted) so shadow-root styling is testable.
        plugins: [elementSveltePlugin()],
        // The built-artifact smoke tests skip when dist/element is missing.
        // In CI that must be a failure instead (see element-iife-smoke.test.ts)
        // — `process.env` is not available in the browser, so the flag is
        // baked in here.
        define: { __CI__: JSON.stringify(Boolean(process.env["CI"])) },
        test: {
          name: "element",
          include: ["src/element/**/*.test.ts"],
          browser: browser(),
        },
      },
    ],
  },
});
