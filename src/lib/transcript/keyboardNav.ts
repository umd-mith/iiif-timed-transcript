// src/lib/transcript/keyboardNav.ts

/**
 * Compute the next focused index for roving tabindex keyboard navigation.
 * Returns null if the key is not a navigation key.
 */
export function getNextIndex(
  key: string,
  currentIndex: number,
  length: number,
): number | null {
  switch (key) {
    case "ArrowDown":
      return currentIndex < length - 1 ? currentIndex + 1 : 0;
    case "ArrowUp":
      return currentIndex > 0 ? currentIndex - 1 : length - 1;
    case "Home":
      return 0;
    case "End":
      return length - 1;
    default:
      return null;
  }
}

/**
 * Focus the segment button at the given index within a container.
 */
export function focusSegmentAtIndex(
  container: HTMLElement,
  index: number,
): void {
  const buttons = container.querySelectorAll<HTMLElement>(
    "[data-annotation-id]",
  );
  buttons[index]?.focus();
}
