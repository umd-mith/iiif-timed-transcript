import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: "https://umd-mith.github.io",
  base: "/svelte-iiif-transcript-player",
  integrations: [
    svelte(),
    tailwind({
      // Tailwind config options
      applyBaseStyles: true,
    }),
  ],
  vite: {
    ssr: {
      // Let Vite handle Svelte components from phosphor-svelte
      noExternal: ["phosphor-svelte"],
    },
  },
});
