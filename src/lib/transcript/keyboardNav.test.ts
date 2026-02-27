// src/lib/transcript/keyboardNav.test.ts
import { describe, it, expect, vi } from 'vitest';
import { keyboardNav } from './keyboardNav';

describe('keyboardNav action', () => {
	it('calls onArrowDown when down arrow pressed', () => {
		const node = document.createElement('div');
		const onArrowDown = vi.fn();

		keyboardNav(node, { onArrowDown });

		const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
		node.dispatchEvent(event);

		expect(onArrowDown).toHaveBeenCalledTimes(1);
	});

	it('calls onArrowUp when up arrow pressed', () => {
		const node = document.createElement('div');
		const onArrowUp = vi.fn();

		keyboardNav(node, { onArrowUp });

		const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
		node.dispatchEvent(event);

		expect(onArrowUp).toHaveBeenCalledTimes(1);
	});

	it('calls onEnter when Enter pressed', () => {
		const node = document.createElement('div');
		const onEnter = vi.fn();

		keyboardNav(node, { onEnter });

		const event = new KeyboardEvent('keydown', { key: 'Enter' });
		node.dispatchEvent(event);

		expect(onEnter).toHaveBeenCalledTimes(1);
	});

	it('calls onEscape when Escape pressed', () => {
		const node = document.createElement('div');
		const onEscape = vi.fn();

		keyboardNav(node, { onEscape });

		const event = new KeyboardEvent('keydown', { key: 'Escape' });
		node.dispatchEvent(event);

		expect(onEscape).toHaveBeenCalledTimes(1);
	});

	it('prevents default for handled keys', () => {
		const node = document.createElement('div');
		keyboardNav(node, { onArrowDown: vi.fn() });

		const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
		node.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it('cleans up event listener on destroy', () => {
		const node = document.createElement('div');
		const onArrowDown = vi.fn();

		const result = keyboardNav(node, { onArrowDown })!;
		result.destroy!();

		const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
		node.dispatchEvent(event);

		expect(onArrowDown).not.toHaveBeenCalled();
	});
});
