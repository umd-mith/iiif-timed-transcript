# Poster image support for `IIIFPlayer.Viewer`

**Date:** 2026-06-02
**Branch:** `feat/poster-support` (off `feat/dash-support`, PR #45)
**Status:** Design — approved, pending spec review

## Summary

Add poster-image support to video canvases. A poster is the still image shown
on a `<video>` element before playback begins (the native HTML
[`poster`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/poster)
attribute).

Two layers, in priority order:

1. An explicit `poster` prop on `IIIFPlayer.Viewer` (consumer override).
2. Automatic derivation from the IIIF manifest's `placeholderCanvas`, then
   `accompanyingCanvas`.

Video-only. The resolved URL is passed to the native `<video poster>`
attribute; the browser handles rendering and clears it on play.

## Background: IIIF and posters

IIIF Presentation API 3.0 has a native concept for this. `placeholderCanvas`
is *"a single Canvas that provides additional content for use **before** the
main content ... is rendered"* — the spec's own example is "a film poster to
attract user attention." `accompanyingCanvas` is shown *during* playback (e.g.
album art over audio). Both are full Canvas objects containing an
`AnnotationPage → painting Annotation → Image` body; the image URL must be
extracted from `body.id`, not read as a bare string.

Reference implementation: Clover IIIF (Northwestern) resolves
`placeholderCanvas`/`accompanyingCanvas` to an image URL and passes it to
`<video poster>`. This design mirrors that resolution, minus the
during-playback swap (we are video-only, and the browser drops the poster on
play automatically).

`thumbnail` is deliberately **excluded** from the fallback chain: it is meant
for small navigation grids, and upscaling it to poster size looks soft. Posters
appear only when a manifest author opted in via placeholder/accompanying.

## Resolution precedence

```
explicit `poster` prop  →  canvas.placeholderCanvas (image body)
                        →  canvas.accompanyingCanvas (image body)
                        →  undefined
```

Passing `poster=""` (empty string) suppresses the auto-derived poster — a quiet
escape hatch (documented).

## Components & data flow

### 1. `src/lib/iiif/validators.ts` — extend `CanvasSchema`

`placeholderCanvas` and `accompanyingCanvas` are themselves Canvases. Define one
lightweight `AuxiliaryCanvasSchema`:

```ts
const AuxiliaryCanvasSchema = z.object({
  id: IIIFIdentifier,
  type: z.literal("Canvas"),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  items: z.array(AnnotationPageSchema).optional(),
});
```

Add to `CanvasSchema`:

```ts
placeholderCanvas: AuxiliaryCanvasSchema.optional(),
accompanyingCanvas: AuxiliaryCanvasSchema.optional(),
```

Reusing the existing `AnnotationPageSchema` means the nested
`AnnotationPage → Annotation → Image body` structure validates with no new body
types. The `.refine()` on `CanvasSchema` (dimensions-or-duration) is unchanged;
auxiliary canvases are not subject to it.

### 2. `src/lib/iiif/helpers.ts` — new resolver

```ts
/**
 * Resolves a poster image URL for a canvas from its IIIF placeholderCanvas,
 * falling back to accompanyingCanvas. Returns undefined if neither yields an
 * image. Sibling of getThumbnail — extracts a representative image URL, but
 * the spec-correct "before playback" poster rather than a nav thumbnail.
 */
export function getPosterUrl(canvas: CanvasData): string | undefined;
```

Implementation: for each of `placeholderCanvas`, `accompanyingCanvas` (in
order), traverse `items[].items[]` to the first painting annotation whose body
is an image, and return `body.id`. A body counts as an image when
`body.type === "Image"` or `body.format` starts with `"image/"`. Handles `body`
being a single object or an array (the schema allows both). Returns `undefined`
for any missing or malformed structure rather than throwing. Mirrors Clover's
`getPaintingResource`.

### 3. `src/lib/player/context.ts` + `PlayerState.svelte.ts`

Add a resolved-poster field to the context:

- `context.ts` — add `posterUrl: string | undefined` to `PlayerContext`.
- `PlayerState.svelte.ts` — add `posterUrl = $state<string | undefined>(undefined)`.

Not added to `PlayerRef` (it is internal wiring consumed by `Viewer`, parallel
to `mediaUrl`/`tracks`, which are likewise excluded from the curated ref).

### 4. `src/lib/player/Root.svelte`

- In `loadCanvas`, after the canvas is resolved:
  `player.posterUrl = getPosterUrl(canvas);`
- In `performCanvasSwitch`, clear alongside `mediaUrl`:
  `player.posterUrl = undefined;`

### 5. `src/lib/player/Viewer.svelte`

- Add `poster?: string` to props (with the prop type block).
- `const effectivePoster = $derived(poster ?? ctx.posterUrl);`
- On the `<video>` element only: `poster={effectivePoster || undefined}`.
- `<audio>` is untouched (no poster attribute exists for audio).

### 6. `src/lib/index.ts`

Add `getPosterUrl` to the existing `./iiif/helpers.js` export block (the public
"IIIF Utilities" surface), next to `getThumbnail`.

## Error handling

No new error paths. A missing or broken poster image is non-fatal — the browser
shows the first frame or a blank box, exactly as native `<video>` behaves. The
resolver degrades to `undefined` on malformed input.

## Testing (Vitest browser mode)

Per project conventions: `svelte.mount()` + `flushSync()`, unique manifest URLs
per test.

**`src/test/iiif/helpers.test.ts`** — `getPosterUrl`:

- placeholderCanvas present → its image URL
- no placeholder, accompanyingCanvas present → accompanying image URL
- both present → placeholder wins
- body as array → extracts image URL
- neither aux canvas → `undefined`
- malformed aux canvas (empty items / no image body) → `undefined`

**`src/test/player/Viewer.svelte.test.ts`** — Viewer wiring:

- `poster` prop sets the `<video poster>` attribute
- context `posterUrl` used when no prop given
- explicit prop overrides context `posterUrl`
- `<audio>` never receives a poster attribute

## Out of scope (deliberate)

- **Audio companion art** — rendering an `<img>` for audio canvases
  (`accompanyingCanvas` "during playback" UI) is a separate feature.
- **`thumbnail` fallback** — excluded; spec-purist chain only.
- **Demo page** — optional follow-up; README + tests cover this PR. A
  `historyunerased`-style demo can be added later.

## Docs

README: add `poster` to the `IIIFPlayer.Viewer` prop table, with a note that it
auto-derives from `placeholderCanvas`/`accompanyingCanvas` when omitted, and that
`poster=""` suppresses derivation. Add `getPosterUrl` to the IIIF utilities
listing.

## References

- IIIF Presentation API 3.0 — https://iiif.io/api/presentation/3.0/
- Cookbook 0013 placeholderCanvas — https://iiif.io/api/cookbook/recipe/0013-placeholderCanvas/
- Cookbook 0014 accompanyingCanvas — https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/
- Clover IIIF poster logic — `src/components/Viewer/Player/Player.tsx` in https://github.com/samvera-labs/clover-iiif
- HTML `<video poster>` — https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/poster
