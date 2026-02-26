import { describe, test, expect, vi, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import { setContext, getContext } from 'svelte';
import {
	TRANSCRIPT_CONTEXT_KEY,
	getTranscriptContext,
	type TranscriptContext,
	type TranscriptState
} from './transcript-context';

// We need test helpers to mount components that call setContext/getContext
import TestTranscriptContextProvider from '../../test/player/TestTranscriptContextProvider.svelte';
import TestTranscriptContextConsumer from '../../test/player/TestTranscriptContextConsumer.svelte';

describe('transcript-context', () => {
	let target: HTMLElement;

	afterEach(() => {
		if (target && document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	test('TRANSCRIPT_CONTEXT_KEY is a unique string', () => {
		expect(TRANSCRIPT_CONTEXT_KEY).toBe('iiif-transcript');
		// Must differ from player context key
		expect(TRANSCRIPT_CONTEXT_KEY).not.toBe('iiif-player');
	});

	test('getTranscriptContext throws when no context available', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		expect(() => {
			mount(TestTranscriptContextConsumer, { target, props: { onResult: () => {} } });
			flushSync();
		}).toThrow('Transcript context not found');
	});

	test('getTranscriptContext returns context when provided', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext: TranscriptContext = {
			state: {
				annotations: [
					{ id: 'a1', startTime: 0, endTime: 5, text: 'Hello' }
				],
				activeAnnotationId: null,
				searchMatches: [],
				currentMatchIndex: -1,
				highlightedIds: new Set(),
				currentMatchId: null
			},
			actions: {
				handleAnnotationClick: vi.fn(),
				handleMatchChange: vi.fn()
			}
		};

		let capturedResult: TranscriptContext | null = null;

		mount(TestTranscriptContextProvider, {
			target,
			props: {
				context: mockContext,
				children: () => {
					mount(TestTranscriptContextConsumer, {
						target,
						props: {
							onResult: (ctx: TranscriptContext) => {
								capturedResult = ctx;
							}
						}
					});
				}
			}
		});
		flushSync();

		expect(capturedResult).toBe(mockContext);
	});

	test('TranscriptState has required fields', () => {
		// Type-level test: verify the interface shape compiles
		const state: TranscriptState = {
			annotations: [],
			activeAnnotationId: null,
			searchMatches: [],
			currentMatchIndex: -1,
			highlightedIds: new Set<string>(),
			currentMatchId: null
		};

		expect(state.annotations).toEqual([]);
		expect(state.activeAnnotationId).toBeNull();
		expect(state.searchMatches).toEqual([]);
		expect(state.currentMatchIndex).toBe(-1);
		expect(state.highlightedIds).toBeInstanceOf(Set);
		expect(state.currentMatchId).toBeNull();
	});
});
