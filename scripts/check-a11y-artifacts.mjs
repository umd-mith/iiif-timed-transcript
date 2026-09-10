// Checks that the four manual-test-script artifacts exist under docs/a11y/
// and are structurally complete (required headings + a Results table). Run
// via `pnpm run test:a11y-docs`. A plain Node script, not a Vitest test:
// these files are read with node:fs, which is not available inside the
// browser-mode Vitest projects (vitest.config.ts). Same precedent as
// scripts/postbuild-element.mjs.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const specs = [
  {
    file: "docs/a11y/keyboard-walkthrough.md",
    headings: [
      "## Walkthrough",
      "## Multi-canvas and canvas-switch pass",
      "## Results",
    ],
  },
  {
    file: "docs/a11y/screen-reader-scripts.md",
    headings: [
      "## NVDA + Firefox script",
      "## VoiceOver + Safari script",
      "## Results",
    ],
  },
  {
    file: "docs/a11y/zoom-reflow-checklist.md",
    headings: ["## 200% text-only zoom", "## 320px viewport", "## Results"],
  },
  {
    file: "docs/a11y/forced-colors-rtl.md",
    headings: ["## Forced-colors pass", "## RTL pass", "## Results"],
  },
];

const failures = [];

for (const spec of specs) {
  const path = resolve(root, spec.file);
  if (!existsSync(path)) {
    failures.push(`${spec.file}: missing`);
    continue;
  }
  const content = readFileSync(path, "utf-8");
  for (const heading of spec.headings) {
    if (!content.includes(heading)) {
      failures.push(`${spec.file}: missing heading "${heading}"`);
    }
  }
  if (!/\|\s*Commit SHA\s*\|/.test(content)) {
    failures.push(`${spec.file}: Results table missing "Commit SHA" column`);
  }
}

if (failures.length > 0) {
  console.error("a11y doc artifact check failed:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`a11y doc artifact check passed (${specs.length} files).`);
