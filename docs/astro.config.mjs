import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: "https://umd-mith.github.io",
  base: "/iiif-timed-transcript",
  integrations: [
    svelte(),
    tailwind({
      // Tailwind config options
      applyBaseStyles: true,
    }),
  ],
});
