# @umd-mith/svelte-iiif-transcript-player

> IIIF-powered, transcript-synchronized media player for Svelte 5.

**Status:** Early development. API not stable.

## Install

```bash
pnpm add @umd-mith/svelte-iiif-transcript-player
```

## Peer dependencies

- `svelte ^5.0.0`
- `xstate ^5.0.0`

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
