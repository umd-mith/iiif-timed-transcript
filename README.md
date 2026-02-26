# @umd-mith/svelte-iiif-transcript-player

> IIIF-powered, transcript-synchronized media player for Svelte 5.

**Status:** Early development. API not stable.

## Install

> **Note:** This package is not yet published to npm. Use one of the methods below:

### Install from GitHub

```bash
pnpm add github:umd-mith/svelte-iiif-transcript-player
```

### Local Development

```bash
git clone https://github.com/umd-mith/svelte-iiif-transcript-player.git
cd svelte-iiif-transcript-player
pnpm install
pnpm run build
```

## Peer dependencies

- `svelte ^5.0.0`
- `xstate ^5.0.0`

## Quick Start

### Compound Component API

Build custom IIIF media players with composable components:

```svelte
<script>
  import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';

  const manifestUrl = 'https://example.org/manifest.json';
  const annotations = [
    { id: 'a1', startTime: 0, endTime: 5, text: 'First segment' },
    { id: 'a2', startTime: 5, endTime: 10, text: 'Second segment' }
  ];
</script>

<IIIFPlayer.Root {manifestUrl} canvasIndex={0}>
  <IIIFPlayer.Viewer />

  <IIIFPlayer.Controls>
    <IIIFPlayer.PlayButton />
    <IIIFPlayer.Progress />
    <IIIFPlayer.Skip seconds={10} />
    <IIIFPlayer.Speed />
    <IIIFPlayer.Time />
  </IIIFPlayer.Controls>

  <IIIFPlayer.Transcript {annotations} enableSearch>
    <IIIFPlayer.TranscriptSearch />
    <IIIFPlayer.TranscriptSegments />
  </IIIFPlayer.Transcript>
</IIIFPlayer.Root>
```

### Pre-Built Components

For quick integration, use the pre-built components:

```svelte
<script>
  import {
    IIIFMediaViewer,
    AudioPlayerControls,
    TranscriptPanel
  } from '@umd-mith/svelte-iiif-transcript-player';

  let viewer;
</script>

<IIIFMediaViewer bind:this={viewer} {manifestUrl} />
<AudioPlayerControls playerRef={viewer} skipAmounts={[10, 30]} />
<TranscriptPanel {annotations} {viewer} enableSearch />
```

## Using `annotation.metadata`

The `Annotation` type includes an optional `metadata` field (`Record<string, unknown>`) for consumer-specific data. The library components don't read metadata directly — instead, you access it in custom segment snippets.

### Speaker labels

```svelte
<script>
  import { TranscriptPanel } from '@umd-mith/svelte-iiif-transcript-player';
</script>

<TranscriptPanel {annotations} {viewer}>
  {#snippet segment({ annotation, isActive, onClick })}
    <div data-annotation-id={annotation.id} onclick={onClick}>
      {#if annotation.metadata?.speaker}
        <strong>{annotation.metadata.speaker}:</strong>
      {/if}
      <span class:active={isActive}>{annotation.text}</span>
    </div>
  {/snippet}
</TranscriptPanel>
```

### Review flags

```svelte
{#snippet segment({ annotation, isActive, onClick })}
  <div
    data-annotation-id={annotation.id}
    onclick={onClick}
    class:needs-review={annotation.metadata?.reviewStatus === 'needs-review'}
  >
    {annotation.text}
    {#if annotation.metadata?.confidence != null && annotation.metadata.confidence < 0.5}
      <span class="low-confidence-badge">Low confidence</span>
    {/if}
  </div>
{/snippet}
```

### Paragraph merging with speakers

```ts
import { mergeIntoParagraphs } from '@umd-mith/svelte-iiif-transcript-player';

// Build a speaker map from metadata
const speakers = new Map(
  annotations
    .filter(a => a.metadata?.speaker)
    .map(a => [a.id, a.metadata!.speaker as string])
);

const paragraphs = mergeIntoParagraphs(annotations, { speakers });
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

For AI-assisted contributions, include commit trailers:

```
Assisted-by: Claude <noreply@anthropic.com>
```

## License

BSD 3-Clause Clear - see [LICENSE](LICENSE) for details.
