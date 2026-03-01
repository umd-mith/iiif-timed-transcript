// src/lib/transcript/keyboardNav.ts
import type { Action } from "svelte/action";

export interface KeyboardNavOptions {
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
}

/**
 * Svelte action for keyboard navigation.
 * Handles arrow keys, Enter, and Escape.
 */
export const keyboardNav: Action<HTMLElement, KeyboardNavOptions> = (
  node,
  options = {},
) => {
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowUp":
        if (options.onArrowUp) {
          event.preventDefault();
          options.onArrowUp();
        }
        break;
      case "ArrowDown":
        if (options.onArrowDown) {
          event.preventDefault();
          options.onArrowDown();
        }
        break;
      case "Enter":
        if (options.onEnter) {
          event.preventDefault();
          options.onEnter();
        }
        break;
      case "Escape":
        if (options.onEscape) {
          event.preventDefault();
          options.onEscape();
        }
        break;
    }
  }

  node.addEventListener("keydown", handleKeydown);

  return {
    destroy() {
      node.removeEventListener("keydown", handleKeydown);
    },
  };
};
