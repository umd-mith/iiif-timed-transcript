<script lang="ts">
  import type { CanvasInfo } from "./context";
  import type { Snippet } from "svelte";
  import { getPlayerContext } from "./context";
  import { formatTimestamp } from "../transcript/utils";

  interface Props {
    onCanvasChange?: (canvas: CanvasInfo) => void;
    canvas?: Snippet<
      [{ canvas: CanvasInfo; isActive: boolean; onClick: () => void }]
    >;
    empty?: Snippet;
    class?: string;
  }

  let {
    onCanvasChange,
    canvas: canvasSnippet,
    empty,
    class: className = "",
  }: Props = $props();

  const playerContext = getPlayerContext();
  const { actions } = playerContext;

  const canvases = $derived(playerContext.canvases);
  const canvasIndex = $derived(playerContext.canvasIndex);

  function handleCanvasClick(canvas: CanvasInfo) {
    actions.switchCanvas(canvas.index);
    onCanvasChange?.(canvas);
  }
</script>

<nav class="canvas-nav {className}" aria-label="Canvases">
  {#if canvases.length <= 1}
    {#if empty}
      {@render empty()}
    {/if}
  {:else}
    {#each canvases as cv (cv.id)}
      {#if canvasSnippet}
        {@render canvasSnippet({
          canvas: cv,
          isActive: canvasIndex === cv.index,
          onClick: () => handleCanvasClick(cv),
        })}
      {:else}
        <button
          type="button"
          data-canvas-index={cv.index}
          data-state={canvasIndex === cv.index ? "active" : "inactive"}
          aria-current={canvasIndex === cv.index ? "true" : undefined}
          onclick={() => handleCanvasClick(cv)}
        >
          <span class="canvas-label">{cv.label}</span>
          {#if cv.duration}
            <span class="canvas-duration">{formatTimestamp(cv.duration)}</span>
          {/if}
        </button>
      {/if}
    {/each}
  {/if}
</nav>

<style>
  button {
    all: unset;
    display: block;
    width: 100%;
    cursor: pointer;
  }

  button:focus {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  button:focus:not(:focus-visible) {
    outline: none;
  }
</style>
