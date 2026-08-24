import { describe, test, expect, vi } from "vitest";
import { hoistShadowStyles, warnIfNoStylesFound } from "./cssHoist";

function shadowRootWithStyles(...cssBlocks: string[]): ShadowRoot {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  for (const [i, css] of cssBlocks.entries()) {
    const style = document.createElement("style");
    style.id = `svelte-hoist-fixture-${i}`;
    style.textContent = css;
    root.appendChild(style);
  }
  return root;
}

describe("hoistShadowStyles", () => {
  test("adopts a CSSStyleSheet built from the style node's text and empties the node", () => {
    const root = shadowRootWithStyles(".a { color: red; }");
    const count = hoistShadowStyles(root);
    expect(count).toBe(1);
    expect(root.adoptedStyleSheets).toHaveLength(1);
    expect(root.adoptedStyleSheets[0]!.cssRules[0]!.cssText).toContain(
      "color: red",
    );
    const node = root.querySelector("style")!;
    expect(node.textContent).toBe("");
    // the node stays in place — Svelte's dedupe is a DOM query for it
    expect(root.querySelector("#svelte-hoist-fixture-0")).toBe(node);
  });

  test("concatenates every non-empty style node present in one pass", () => {
    const root = shadowRootWithStyles(
      ".a { color: red; }",
      ".b { color: blue; }",
    );
    hoistShadowStyles(root);
    expect(root.adoptedStyleSheets).toHaveLength(1);
    const rules = Array.from(root.adoptedStyleSheets[0]!.cssRules).map(
      (r) => r.cssText,
    );
    expect(rules[0]).toContain("color: red");
    expect(rules[1]).toContain("color: blue");
  });

  test("a second pass with nothing new hoists nothing and does not duplicate the sheet", () => {
    const root = shadowRootWithStyles(".a { color: red; }");
    hoistShadowStyles(root);
    const second = hoistShadowStyles(root);
    expect(second).toBe(0);
    expect(root.adoptedStyleSheets).toHaveLength(1);
  });

  test("a late-injected style node is hoisted as its own sheet on the next pass", () => {
    const root = shadowRootWithStyles(".a { color: red; }");
    hoistShadowStyles(root);
    const late = document.createElement("style");
    late.id = "svelte-hoist-fixture-late";
    late.textContent = ".c { color: green; }";
    root.appendChild(late);
    const count = hoistShadowStyles(root);
    expect(count).toBe(1);
    expect(root.adoptedStyleSheets).toHaveLength(2);
    expect(late.textContent).toBe("");
  });

  test("two shadow roots with identical content share the same CSSStyleSheet object", () => {
    const rootA = shadowRootWithStyles(".shared { color: purple; }");
    const rootB = shadowRootWithStyles(".shared { color: purple; }");
    hoistShadowStyles(rootA);
    hoistShadowStyles(rootB);
    expect(rootB.adoptedStyleSheets[0]).toBe(rootA.adoptedStyleSheets[0]);
  });

  test("an empty node (already hoisted, or genuinely empty) is left alone", () => {
    const root = shadowRootWithStyles("");
    const count = hoistShadowStyles(root);
    expect(count).toBe(0);
    expect(root.adoptedStyleSheets).toHaveLength(0);
  });
});

describe("warnIfNoStylesFound", () => {
  test("logs when the shadow root has zero style nodes", () => {
    const root = shadowRootWithStyles();
    const log = vi.fn();
    warnIfNoStylesFound(root, log);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toContain("no <style> nodes found");
  });

  test("stays silent once at least one style node exists, hoisted or not", () => {
    const root = shadowRootWithStyles(".a { color: red; }");
    const log = vi.fn();
    warnIfNoStylesFound(root, log);
    expect(log).not.toHaveBeenCalled();
    hoistShadowStyles(root);
    warnIfNoStylesFound(root, log);
    expect(log).not.toHaveBeenCalled();
  });
});
