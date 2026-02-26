// src/lib/transcript/Search.svelte.test.ts
import { mount } from 'svelte';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

	it('renders search input with correct placeholder', () => {
		mount(Search, { target, props: { annotations } });
		flushSync();

		const input = target.querySelector('input[type="search"]');
		expect(input).not.toBeNull();
		expect(input?.getAttribute('placeholder')).toBe('Search transcript...');
	});
});
