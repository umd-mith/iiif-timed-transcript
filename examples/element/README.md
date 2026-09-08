# Element smoke pages

Manual checks for the `<iiif-transcript-player>` IIFE. Build first, then serve the repo root (file:// blocks nothing here, but a server is closer to a host page):

    pnpm build
    npx serve .                    # serves on :3000
    python3 -m http.server 8000    # or this, on :8000

The URLs below use `PORT` — substitute whichever port your server printed
(`3000` for `npx serve`, `8000` for `http.server`).

Open:

- `http://localhost:PORT/examples/element/plain.html` — Cookbook 0219 (video + VTT transcript) and a local AVAnnotate-shaped fixture whose eight transcript segments all share one annotation id (`fixtures/avannotate-duplicate-ids.json`, derived from a Scholarly Editing "Voices" interview; its audio still loads from scholarlyediting.org). Hostile page CSS must not leak in; events log at the bottom. The fixture is local because scholarlyediting.org sends no `Access-Control-Allow-Origin`, so its manifests cannot be fetched from another origin.
- `http://localhost:PORT/examples/element/avalon-bootstrap.html` — Choice-wrapped HLS from av.lib.umd.edu ("Jenny Cotton oral history interview", a public item) inside a Bootstrap layout; playback works, one canvas so no canvas nav, and no transcript panel (Avalon's supplements are PDFs).
- `http://localhost:PORT/examples/element/drupal-theme.html` — Cookbook 0219 inside the UMD Libraries Drupal theme's global stylesheet (loaded from jsDelivr); the player keeps its own defaults against the theme's inherited typography/colour, and a **Toggle .dark-theme** button proves the theme's class-based dark mode can be followed purely through `--iiif-player-*`.

What to look for: captions visible on the Cookbook video until the transcript populates (then hidden, toggleable via the CC button in the control bar); all eight duplicate-id segments present in the second player on plain.html; no "No transcript available." banner on Avalon; `playererror` with `source: "transcript"` only if a VTT fails; Bootstrap's button reset does not restyle the player controls.
