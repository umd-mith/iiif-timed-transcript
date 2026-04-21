---
"@umd-mith/svelte-iiif-transcript-player": patch
---

Add explicit `.js` / `/index.js` extensions to all internal relative imports so the package's `dist/` output conforms to the Node ESM spec (directory imports and extensionless specifiers are not permitted in Node ESM).

This fixes `ERR_UNSUPPORTED_DIR_IMPORT` and `ERR_MODULE_NOT_FOUND` errors seen when the package is resolved by Node's native resolver — for example during Astro SSR prerendering, or when another Vite plugin (such as `@tailwindcss/vite` v4, which transitively registers a Node ESM loader hook via `@tailwindcss/node`) forwards resolution to Node's defaults.

No API changes. Consumers using `ssr.noExternal: ['@umd-mith/svelte-iiif-transcript-player']` in their Vite/Astro config remain the recommended pattern for SSR contexts.
