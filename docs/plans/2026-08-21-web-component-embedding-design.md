# Web-component embedding for non-Svelte hosts

**Date:** 2026-08-21
**Status:** Design — pending spec review

## Summary

Ship an additional, opt-in build artifact — a custom element,
`<iiif-transcript-player>` — that wraps the existing `IIIFPlayer` compound
component tree so the library can be dropped into a page with no Svelte
runtime and no JS build step. The existing Svelte-native compound-component
API (`IIIFPlayer.Root`, `.Viewer`, `.Controls`, `.Transcript`, ...) is
untouched; this is a new, additive entry point built from the same source.

**Motivating consumer:** [Avalon Media System](https://av.lib.umd.edu/), a
Rails application (ERB views, no JS bundler) that currently uses its own
Ramp-based player. The design assumes a **full player replacement** on an
Avalon item page — this custom element takes over the whole playback +
transcript UI, not just a slice of it.

## Prior art consulted

[d-flood/triiiceratops](https://github.com/d-flood/triiiceratops) — a
Svelte-based IIIF viewer distributed as a web component — is directly
analogous prior art and the main influence on this design (see "Architecture"
below for the specific patterns borrowed). Aaron Straup Cope's public IIIF
work (`go-iiif` etc.) is server-side image/tile tooling and has no bearing on
this problem.

## Non-goals (this design)

- **Deep slot-level customization** (overriding transcript segment/chapter
  rendering the way `IIIFPlayer.TranscriptSegments`'s `SegmentSnippet` prop
  does today) is explicitly deferred. The element ships one fixed default
  composition and arrangement of the existing compound components. A future
  plugin-style extension API (see triiiceratops's `window.Triiiceratops.plugins`)
  is a candidate if this need becomes concrete — not designed here.
- **Authenticated/restricted media playback** is not implemented. A hook is
  reserved (see "Auth hook") so it isn't a breaking change later, but no
  credential-passing logic ships in this pass.
- **Avalon manifest conformance is not this library's problem to fully solve.**
  Avalon's manifests have documented Presentation 3 conformance gaps
  (`type: "manifest"` instead of `"Manifest"`, zero-value Canvas dimensions,
  a non-standard `choiceHint` property on `Choice`) per the
  `avalon-iiif-interoperability-memo`. Core parsing/validation stays strict
  and correct for well-formed IIIF. A separate, optional compatibility layer
  (below) exists for the specific, documented Avalon issues — it does not
  attempt to anticipate undocumented ones.

## Architecture

### One wrapper element, existing components unchanged

A new component, `src/lib/element/IIIFTranscriptPlayerElement.svelte`,
internally composes the current `IIIFPlayer.Root` → `Viewer` / `Controls` /
`Transcript` (→ `TranscriptSearch`, `TranscriptSegments`) tree in today's
default arrangement. Only this wrapper carries
`<svelte:options customElement={{ shadow: "open", props: {...} }}>` — every
existing compound component compiles exactly as it does today for Svelte
consumers. `svelte-check` cannot apply `customElement` per-file, so it will
emit `options_missing_custom_element` for this one file; ignore it the same
way triiiceratops documents (`--compiler-warnings` allowlist), not with a
blanket suppression.

Rejected alternatives:

- **One custom element per compound piece** — would require reimplementing
  Svelte's context propagation across real DOM/shadow boundaries. Far higher
  cost, and buys compositional flexibility outside Svelte that isn't needed
  given deep customization is out of scope for this pass.
- **Imperative `mount()`/`unmount()` helper, no custom element** — simpler
  build, but no Shadow DOM means the player's CSS collides with Avalon's
  existing Bootstrap-based page styles. Given this replaces the player
  entirely on a page we don't control, style isolation outweighs the
  simplicity of skipping the custom-element compiler mode.

### Build targets

Two new outputs, both compiled from the wrapper with
`compilerOptions: { customElement: true }` and `emitCss: false` (so scoped
styles ship inside the JS bundle and reach the shadow root via Svelte's
`append_styles`, which targets `getRootNode()`, instead of being extracted to
a light-DOM stylesheet that would never arrive):

1. **IIFE** — `dist/element/iiif-transcript-player.iife.js`. Single
   self-contained file (`inlineDynamicImports: true`), `es2022` target,
   minified. This is the `<script src="...">` drop-in for Avalon's ERB view —
   no bundler, no module resolution required on the host page.
2. **ESM custom-element module** — for future bundler-based non-Svelte
   consumers (e.g. a plain Vite/webpack site, or a React app importing the
   module directly). Not required for the Avalon integration but cheap to
   produce alongside (1) from the same Vite config family, and avoids a
   second design pass when that need arrives.

New `package.json` `exports` entry, e.g. `"./element"` and
`"./element/iife"`, pointing at these new `dist/element/*` files. The
existing `"."` export (`dist/index.js`, the Svelte-native compound-component
API) is unchanged — this is additive, not a breaking change to the current
package contract.

### Attribute / property surface

- **Scalar config as reflected attributes** — `manifest-url`, `canvas-index`,
  `theme`. Settable from a Rails ERB template with no JavaScript.
- **Complex/optional config as JSON-string attribute or JS property** —
  e.g. chapter/track data. Accept either form (attribute for no-JS pages,
  property for scripted pages), parsed defensively — invalid JSON in an
  attribute degrades to "unset," it does not throw.
- **Property-only inputs** for anything non-serializable: error callbacks,
  the auth hook (below). These are documented as unsupported via attribute,
  matching how triiiceratops's `plugins` and `searchProvider` are
  property-only.

### Ref & readiness

`PlayerRef` (the existing curated ref type) is exposed as a getter-only
property on the element via an exported binding
(`export { playerRefValue as playerRef }`), the same mechanism Svelte's
`create_custom_element` uses to define prototype getters — this is how
triiiceratops exposes its `viewerState`. Readiness is signaled with a
`queueMicrotask`-dispatched, bubbling + composed `playerrefavailable`
`CustomEvent`, dispatched outside the reactive cycle that mounts the player.
This reuses the existing `onPlayerInit` contract (fires after manifest +
first-canvas parse, not "playable") — bridged across the shadow boundary
rather than redefined.

### Auth hook (reserved, not implemented)

A property-only `fetchCredentials` hook: `(request: { url: string }) =>
{ headers?: Record<string,string> } | undefined`, assignable as
`element.fetchCredentials = fn`. If present, the player's internal manifest
fetch runs through it to attach returned headers. **Not wired to HLS segment
fetches in this pass** — `hls.js`/native HLS playback take the manifest's own
credentials mode, which this hook does not currently influence; extending it
to segment-level auth is future work if Avalon's restricted-media case
becomes concrete. Shipping the hook now, even underused, avoids a breaking
property-shape change when auth support is built out.

### Avalon-conformance compatibility layer — separate and optional

- `src/lib/iiif/validators.ts`, `helpers.ts`, and the underlying
  `@umd-mith/iiif-media-parsers` calls are **unchanged** — strict Presentation
  3, correct for any well-formed manifest regardless of source.
- A new, separately-exported preprocessing module,
  `src/lib/iiif/avalonCompat.ts`, normalizes only the specific issues named in
  the interoperability memo, applied to the raw manifest JSON before it
  reaches `ManifestSchema`:
  - `type: "manifest"` (any-case) on a top-level resource → `"Manifest"`.
  - Canvas `width`/`height` of `0` → stripped (treated as absent, letting
    existing duration/dimension handling take over) rather than passed
    through to fail `CanvasSchema`'s positive-integer check.
  - Unrecognized `choiceHint` property on a `Choice` → stripped before
    validation; ignored, not interpreted.
- Not applied by default. The custom element opts in via a `compat="avalon"`
  attribute; every other consumer (Svelte-native or the plain custom element
  with no `compat` attribute) never runs this code path.
- This module intentionally does **not** attempt to generalize to "tolerant
  IIIF parsing" — it fixes the three named, evidenced defects only. New
  Avalon issues get added here as they're found, not anticipated speculatively.

## Data flow

Attributes/properties on the host element → parsed/validated (optionally
through `avalonCompat` first) → same `PlayerState`/`Root.svelte` machinery
that exists today, unmodified. The wrapper element is purely an adapter at
the boundary; no player logic is duplicated or reimplemented for the
custom-element build.

## Error handling

No new error semantics inside the player. The wrapper surfaces existing
`PlayerState` error states two ways, mirroring triiiceratops's dual API:

- an element property callback, `onPlayerError`, if assigned; and
- an equivalent bubbling + composed `playererror` `CustomEvent` on the host,
  for consumers using `addEventListener` instead of property assignment.

`avalonCompat` normalization failures (malformed input it can't fix) fall
through to the existing manifest-parse error path unchanged — the compat
layer only fixes known-shape defects, it does not add new validation.

## Testing

- Existing Vitest browser-mode suite for the compound components is
  unaffected.
- New tests mount the actual registered custom element
  (`document.createElement('iiif-transcript-player')`, or the tag from
  `customElements.define`) into a test page that also loads unrelated global
  CSS, asserting Shadow DOM style isolation — this is the one thing that
  cannot be verified by testing the Svelte components directly.
- Attribute/property/event wiring tests: reflected attributes update
  internal state; JSON-string and object forms of complex props both work;
  `playerrefavailable` fires with a usable `PlayerRef`; `playererror` fires
  and matches the property-callback path.
- `avalonCompat` unit tests against the three documented defects (lowercase
  manifest type, zero-dimension canvas, `choiceHint`), plus a "leaves
  well-formed input untouched" case.
- A manual smoke page (`docs/` or `examples/`) approximating Avalon's
  Bootstrap-heavy layout, loading the IIFE via `<script src>`, before this
  ever touches a real Avalon page.

## Out of scope (deliberate)

- Deep slot/snippet-level customization of the custom element's internal
  rendering (see "Non-goals").
- Authenticated/restricted stream playback beyond the reserved
  `fetchCredentials` hook shape.
- Generalized "tolerant IIIF parsing" beyond the three named Avalon defects.
- Framework-specific wrapper packages (React/Vue component wrappers around
  the custom element) — the ESM build target makes this possible later but
  none is built now.
- Actually integrating with Avalon/av.lib.umd.edu — this spec covers the
  library-side artifact only.

## References

- Prior art: [d-flood/triiiceratops](https://github.com/d-flood/triiiceratops)
  (`packages/core/src/lib/components/TriiiceratopsViewerElement.svelte`,
  `vite.config.element.ts`, `custom-element.ts`).
- `avalon-iiif-interoperability-memo.md` (2026-08-21) — source of the three
  documented Avalon Presentation 3 conformance defects.
- Svelte 5 custom element compilation —
  `compilerOptions.customElement`, `<svelte:options customElement={...}>`.
- IIIF Presentation API 3.0 — https://iiif.io/api/presentation/3.0/
