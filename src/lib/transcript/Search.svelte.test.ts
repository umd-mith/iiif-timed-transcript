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
		const onnavigatematch = vi.fn();
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange: vi.fn(),
				onnavigatematch,
				currentMatchIndex: 1,
				totalMatches: 2
			}
		});
		flushSync();

		const prevButton = target.querySelector('button[aria-label="Previous match"]') as HTMLButtonElement;
		prevButton.click();

		expect(onnavigatematch).toHaveBeenCalledWith(0);
	});

	it('navigates to next match', () => {
		const onnavigatematch = vi.fn();
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange: vi.fn(),
				onnavigatematch,
				currentMatchIndex: 0,
				totalMatches: 2
			}
		});
		flushSync();

		const nextButton = target.querySelector('button[aria-label="Next match"]') as HTMLButtonElement;
		nextButton.click();

		expect(onnavigatematch).toHaveBeenCalledWith(1);
	});

	it('wraps navigation at boundaries', () => {
		const onnavigatematch = vi.fn();
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange: vi.fn(),
				onnavigatematch,
				currentMatchIndex: 1,
				totalMatches: 2
			}
		});
		flushSync();

		const nextButton = target.querySelector('button[aria-label="Next match"]') as HTMLButtonElement;
		nextButton.click(); // Should wrap to 0

		expect(onnavigatematch).toHaveBeenCalledWith(0);
	});

	it('shows match counter when matches exist', () => {
		mount(Search, {
			target,
			props: {
				annotations,
				onmatchchange: vi.fn(),
				currentMatchIndex: 0,
				totalMatches: 2
			}
		});
		flushSync();

		const counter = target.querySelector('.match-counter');
		expect(counter).not.toBeNull();
		expect(counter?.textContent).toContain('1 / 2');
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
