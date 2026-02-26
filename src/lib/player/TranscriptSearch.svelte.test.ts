import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import TranscriptSearch from './TranscriptSearch.svelte';

describe('TranscriptSearch', () => {
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

	test('renders search input', () => {
		mount(TranscriptSearch, { target });
		flushSync();

		const input = target.querySelector('input[type="search"]');
		expect(input).not.toBeNull();
	});

	test('accepts placeholder prop', () => {
		mount(TranscriptSearch, { target, props: { placeholder: 'Custom placeholder' } });
		flushSync();

		const input = target.querySelector('input[type="search"]');
		expect(input?.getAttribute('placeholder')).toBe('Custom placeholder');
	});
});
