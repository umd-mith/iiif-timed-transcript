import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import TranscriptSearch from './TranscriptSearch.svelte';
import TestContextProvider from '../../test/player/TestContextProvider.svelte';
import TestTranscriptContextProvider from '../../test/player/TestTranscriptContextProvider.svelte';
import { createMockPlayerContext } from '../../test/player/test-utils';
import { createMockTranscriptContext } from './transcript-test-utils';
import type { Annotation } from '../sync/types';

describe('TranscriptSearch', () => {
	let target: HTMLElement;

	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'Hello world' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Goodbye world' }
	];

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	test('renders search input with props (standalone)', () => {
		mount(TranscriptSearch, { target, props: { annotations: mockAnnotations } });
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

	test('uses annotations from TranscriptContext when no prop given', async () => {
		const handleMatchChange = vi.fn();
		const transcriptCtx = createMockTranscriptContext({
			state: { annotations: mockAnnotations },
			actions: { handleMatchChange }
		});

		mount(TestTranscriptContextProvider, {
			target,
			props: {
				context: transcriptCtx,
				children: () => {
					// No annotations prop — should come from context
					mount(TranscriptSearch, { target });
				}
			}
		});
		flushSync();

		// Type into search — if annotations came from context, "Hello" matches a1
		const input = target.querySelector('input[type="search"]') as HTMLInputElement;
		input.value = 'Hello';
		input.dispatchEvent(new Event('input', { bubbles: true }));

		// Wait for debounce
		await new Promise((r) => setTimeout(r, 200));
		flushSync();

		// handleMatchChange should have been called with the match from context annotations
		expect(handleMatchChange).toHaveBeenCalled();
		const [matches] = handleMatchChange.mock.calls[handleMatchChange.mock.calls.length - 1];
		expect(matches).toHaveLength(1);
		expect(matches[0].id).toBe('a1');
	});
});
