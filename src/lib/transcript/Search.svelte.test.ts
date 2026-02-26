// src/lib/transcript/Search.svelte.test.ts
import { mount } from 'svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import Search from './Search.svelte';

describe('Transcript.Search', () => {
	const annotations = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'Hello world' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Goodbye world' },
		{ id: 'a3', startTime: 10, endTime: 15, text: 'Testing search' }
	];

	let target: HTMLElement;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	it('renders search input', () => {
		mount(Search, { target, props: { annotations } });
		flushSync();

		const input = target.querySelector('input[type="search"]');
		expect(input).not.toBeNull();
		expect(input?.getAttribute('placeholder')).toBe('Search transcript...');
	});

	it('filters annotations by query', async () => {
		vi.useFakeTimers();
		const onmatchchange = vi.fn();
		mount(Search, { target, props: { annotations, onmatchchange } });
		flushSync();

		const input = target.querySelector('input[type="search"]') as HTMLInputElement;
		input.value = 'world';
		input.dispatchEvent(new Event('input'));
		flushSync();

		// Wait for debounce
		vi.advanceTimersByTime(150);
		await Promise.resolve();

		expect(onmatchchange).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ text: 'Hello world' }),
				expect.objectContaining({ text: 'Goodbye world' })
			])
		);

		vi.useRealTimers();
	});

	it('navigates to previous match', () => {
		const onmatchchange = vi.fn();
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange,
				debounceMs: 0 // Disable debounce for test
			}
		});
		flushSync();

		// Trigger search to show navigation buttons (search for 'search' which matches annotation 3)
		const input = target.querySelector('input[type="search"]') as HTMLInputElement;
		input.value = 'search';
		input.dispatchEvent(new Event('input'));
		flushSync();

		const prevButton = target.querySelector('button[aria-label="Previous match"]') as HTMLButtonElement;
		expect(prevButton).not.toBeNull();
		prevButton.click();
		flushSync();

		// Should navigate from index 0 to last match (wrapping)
		expect(onmatchchange).toHaveBeenCalled();
	});

	it('navigates to next match', () => {
		const onmatchchange = vi.fn();
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange,
				debounceMs: 0 // Disable debounce for test
			}
		});
		flushSync();

		// Trigger search to show navigation buttons (search for 'world' which matches 2 annotations)
		const input = target.querySelector('input[type="search"]') as HTMLInputElement;
		input.value = 'world';
		input.dispatchEvent(new Event('input'));
		flushSync();

		const nextButton = target.querySelector('button[aria-label="Next match"]') as HTMLButtonElement;
		expect(nextButton).not.toBeNull();
		nextButton.click();
		flushSync();

		// Should navigate to next match
		expect(onmatchchange).toHaveBeenCalled();
	});

	it('wraps navigation at boundaries', () => {
		const onmatchchange = vi.fn();
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange,
				debounceMs: 0 // Disable debounce for test
			}
		});
		flushSync();

		// Trigger search (search for 'world' which matches 2 annotations)
		const input = target.querySelector('input[type="search"]') as HTMLInputElement;
		input.value = 'world';
		input.dispatchEvent(new Event('input'));
		flushSync();

		const nextButton = target.querySelector('button[aria-label="Next match"]') as HTMLButtonElement;
		expect(nextButton).not.toBeNull();

		// Click next to go from match 1 to match 2, then once more to wrap to 0
		nextButton.click();
		flushSync();
		nextButton.click(); // Should wrap to 0
		flushSync();

		expect(onmatchchange).toHaveBeenCalled();
	});

	it('shows match counter when matches exist', () => {
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange: vi.fn(),
				debounceMs: 0 // Disable debounce for test
			}
		});
		flushSync();

		// Trigger search (search for 'search' which matches 1 annotation)
		const input = target.querySelector('input[type="search"]') as HTMLInputElement;
		input.value = 'search';
		input.dispatchEvent(new Event('input'));
		flushSync();

		const counter = target.querySelector('.match-counter');
		expect(counter).not.toBeNull();
		expect(counter?.textContent).toContain('of'); // Matches "1 of 1" format
	});

	it('hides navigation buttons when no matches', () => {
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange: vi.fn(),
				currentMatchIndex: -1,
				totalMatches: 0
			}
		});
		flushSync();

		const prevButton = target.querySelector('button[aria-label="Previous match"]');
		const nextButton = target.querySelector('button[aria-label="Next match"]');
		expect(prevButton).toBeNull();
		expect(nextButton).toBeNull();
	});
});
