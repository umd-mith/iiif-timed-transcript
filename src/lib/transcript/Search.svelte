<!-- src/lib/transcript/Search.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Annotation } from "../sync/types";
  import { t } from "../i18n/registry.svelte";

  interface Props {
    /** Array of annotations to search through */
    annotations: Annotation[];
    /**
     * Placeholder text for search input.
     * @default "Search transcript…"
     */
    placeholder?: string;
    /**
     * Debounce delay for search input in milliseconds.
     * @default 150
     */
    debounceMs?: number;
    /** Callback fired when search matches or current index change */
    onmatchchange?:
      | ((matches: Annotation[], currentIndex: number) => void)
      | undefined;
    /**
     * Synchronous input-intent callback, fired on every keystroke from the
     * raw input event — before the debounce that drives `onmatchchange`.
     * Search never acts on this itself; it exists for a host (or
     * `TranscriptSearch`) to react to typing before matches resolve.
     */
    onqueryinput?: ((value: string) => void) | undefined;
    /**
     * Fired when the selected match is explicitly activated: Enter in the
     * search input, or the "Go to match" button (rendered only when
     * `showActivation` is true).
     */
    onmatchactivate?:
      | ((annotation: Annotation, index: number) => void)
      | undefined;
    /**
     * Fired only from explicit previous/next navigation, after `currentIndex`
     * updates, with the newly-selected match — never from typing or
     * activation. Lets a host (`TranscriptSearch`) scroll the browsed match
     * into view without also auto-scrolling on every keystroke (spec: typing
     * must not scroll).
     */
    onmatchnavigate?:
      | ((annotation: Annotation, index: number) => void)
      | undefined;
    /**
     * External reset signal (a context-level counter, typically). Any change
     * from its previous value — not its initial value on mount — clears the
     * query and resets selection to the first match. Lets a host clear the
     * otherwise-private `query` state (e.g. on canvas switch) without a
     * bindable query prop.
     */
    resetSignal?: number | undefined;
    /**
     * Renders the "Go to match" activation control and enables Enter-to-
     * activate. Search stays agnostic about *why* — a host decides based on
     * its own seek-behavior/reading-mode policy.
     * @default false
     */
    showActivation?: boolean;
    /** CSS class for the search container */
    class?: string;
  }

  let {
    annotations,
    placeholder: placeholderProp,
    debounceMs = 150,
    onmatchchange,
    onqueryinput,
    onmatchactivate,
    onmatchnavigate,
    resetSignal,
    showActivation = false,
    class: className = "",
  }: Props = $props();

  const placeholder = $derived(
    placeholderProp ?? t("transcript.searchPlaceholder"),
  );

  let query = $state("");
  let currentIndex = $state(0);
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let isComposing = $state(false);
  // The input is intentionally uncontrolled (no `value={query}`) so typing
  // never fights the debounce — the DOM owns the displayed text between
  // keystrokes. An external reset (resetSignal, below) is the one path that
  // must also clear what's visibly in the box, so it writes to the element
  // directly rather than relying on a value binding.
  let inputEl: HTMLInputElement | null = $state(null);

  // Derived: filter annotations by search query
  const matches = $derived.by(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return annotations.filter((ann) =>
      ann.text.toLowerCase().includes(lowerQuery),
    );
  });

  // Watch matches and notify parent (including when search is cleared)
  $effect(() => {
    if (query.trim()) {
      onmatchchange?.(matches, currentIndex);
    } else {
      onmatchchange?.([], -1);
    }
  });

  // Reset currentIndex when matches change
  $effect(() => {
    const matchCount = matches.length;
    if (matchCount > 0 && currentIndex >= matchCount) {
      currentIndex = 0;
    }
  });

  // Cleanup on component destroy
  onDestroy(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
  });

  // External reset signal (canvas-switch query clearing — see the
  // `resetSignal` prop doc). `previousResetSignal` is a plain variable
  // (not $state), captured once at component setup, so the first run of the
  // effect below always sees `current === previousResetSignal` and never
  // fires on mount — same pattern as Transcript's `previousReadingMode`.
  // svelte-ignore state_referenced_locally
  let previousResetSignal = resetSignal;
  $effect(() => {
    const current = resetSignal;
    if (current === previousResetSignal) return;
    previousResetSignal = current;
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
    query = "";
    currentIndex = 0;
    if (inputEl) inputEl.value = "";
  });

  // Commits a query value immediately, cancelling any pending debounce.
  // Resets the selection to the first match only when the query actually
  // changes — an unchanged commit (e.g. Enter pressed with no pending edit)
  // must not clobber a selection the reader navigated to via prev/next.
  function commitQuery(value: string) {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
    if (value !== query) {
      query = value;
      currentIndex = 0;
    }
  }

  // Debounced input handler
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    // Synchronous intent signal — fires before debounce, on every keystroke.
    onqueryinput?.(value);

    // Debounce search
    if (debounceTimeout) clearTimeout(debounceTimeout);

    debounceTimeout = setTimeout(() => commitQuery(value), debounceMs);
  }

  function handleCompositionStart() {
    isComposing = true;
  }

  function handleCompositionEnd() {
    isComposing = false;
  }

  // Activates the currently selected match. Reads `matches`/`currentIndex`
  // fresh (both may have just been recomputed by `commitQuery`) rather than
  // trusting a value that predates a synchronous query commit.
  function activate() {
    if (matches.length === 0) return;
    const idx = currentIndex >= matches.length ? 0 : currentIndex;
    const match = matches[idx];
    if (!match) return;
    if (idx !== currentIndex) currentIndex = idx;
    onmatchactivate?.(match, idx);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    if (!showActivation) return;
    // IME composition guard: the isComposing flag tracked via
    // compositionstart/end is the source of truth; event.isComposing is
    // checked too for browsers that report it on the confirming keydown.
    if (isComposing || event.isComposing) return;

    event.preventDefault();
    // Evaluate the current input first — never activate against a query
    // that's still waiting on debounce.
    commitQuery((event.currentTarget as HTMLInputElement).value);
    activate();
  }

  // Navigation. Fires onmatchnavigate — distinct from the debounced
  // onmatchchange — so a host can scroll the browsed match into view without
  // also auto-scrolling on every keystroke (typing never scrolls).
  function navigatePrevious() {
    if (matches.length === 0) return;
    currentIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1;
    const match = matches[currentIndex];
    if (match) onmatchnavigate?.(match, currentIndex);
  }

  function navigateNext() {
    if (matches.length === 0) return;
    currentIndex = currentIndex >= matches.length - 1 ? 0 : currentIndex + 1;
    const match = matches[currentIndex];
    if (match) onmatchnavigate?.(match, currentIndex);
  }

  // Match count display
  const matchCountDisplay = $derived.by(() => {
    if (!query.trim()) return "";
    if (matches.length === 0) return t("transcript.searchNoMatches");
    return t("transcript.searchMatchCount", {
      current: currentIndex + 1,
      total: matches.length,
    });
  });
</script>

<div class="search-container {className}" role="search">
  <input
    type="search"
    {placeholder}
    bind:this={inputEl}
    oninput={handleInput}
    onkeydown={handleKeydown}
    oncompositionstart={handleCompositionStart}
    oncompositionend={handleCompositionEnd}
    aria-label={t("transcript.searchLabel")}
    autocomplete="off"
    spellcheck="false"
  />

  <span class="match-counter" aria-live="polite" aria-atomic="true"
    >{matchCountDisplay}</span
  >

  {#if matches.length > 0}
    <button
      type="button"
      onclick={navigatePrevious}
      aria-label={t("transcript.searchPrevious")}
    >
      ↑
    </button>

    <button
      type="button"
      onclick={navigateNext}
      aria-label={t("transcript.searchNext")}
    >
      ↓
    </button>

    {#if showActivation}
      <button
        type="button"
        onclick={activate}
        aria-label={t("transcript.searchActivate")}
      >
        {t("transcript.searchActivate")}
      </button>
    {/if}
  {/if}
</div>

<style>
  .search-container {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  input {
    flex: 1;
    min-width: 0;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
