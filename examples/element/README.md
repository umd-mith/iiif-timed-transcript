# Element smoke pages

Manual checks for the `<iiif-transcript-player>` IIFE. Build first, then serve the repo root (file:// blocks nothing here, but a server is closer to a host page):

    pnpm build
    npx serve .           # or: python3 -m http.server 8000

Open:

- `http://localhost:3000/examples/element/plain.html` — Cookbook 0219 (video + VTT transcript), Voices (embedded text, duplicate ids); hostile page CSS must not leak in; events log at the bottom.
- `http://localhost:3000/examples/element/avalon-bootstrap.html` — Choice-wrapped HLS from av.lib.umd.edu inside a Bootstrap layout; playback + canvas nav, no transcript panel (Avalon's supplements are PDFs).
- `http://localhost:3000/examples/element/drupal-theme.html` — Cookbook 0219 inside the UMD Libraries Drupal theme's global stylesheet (loaded from jsDelivr); the player keeps its own defaults against the theme's inherited typography/colour, and a **Toggle .dark-theme** button proves the theme's class-based dark mode can be followed purely through `--iiif-player-*`.

What to look for: captions visible on the Cookbook video until the transcript populates (then hidden, but available in native controls); no "No transcript available." banner on Avalon; `playererror` with `source: "transcript"` only if a VTT fails; Bootstrap's button reset does not restyle the player controls.
