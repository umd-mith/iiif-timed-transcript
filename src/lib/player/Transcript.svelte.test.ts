import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import Transcript from './Transcript.svelte';
import TestContextProvider from './TestContextProvider.svelte';
import TestTranscriptContextConsumer from './TestTranscriptContextConsumer.svelte';
import { createMockPlayerContext } from './test-utils';
import type { Annotation } from '../sync/types';
import type { TranscriptContext } from './transcript-context';

describe('Transcript', () => {
	let target: HTMLElement;

	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'First annotation' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Second annotation' },
		{ id: 'a3', startTime: 10, endTime: 15, text: 'Third annotation' }
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

	test('renders panel but no segments without compound children', () => {
		const ctx = createMockPlayerContext();

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Transcript, { target, anchor, props: { annotations: mockAnnotations } });
				}
			}
		});
		flushSync();

		const panel = target.querySelector('.transcript-panel');
		expect(panel).not.toBeNull();
		// Without compound children, no segments are rendered (compound mode is the only mode)
		const segments = target.querySelectorAll('[data-annotation-id]');
		expect(segments).toHaveLength(0);
	});

	test('shows empty state when no annotations', () => {
		const ctx = createMockPlayerContext();

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Transcript, { target, anchor, props: { annotations: [] } });
				}
			}
		});
		flushSync();

		const emptyMessage = target.querySelector('.empty-message');
		expect(emptyMessage).not.toBeNull();
		expect(emptyMessage?.textContent).toContain('No transcript available');
	});

	describe('TranscriptContext provision', () => {
		test('provides TranscriptContext to children', () => {
			const playerCtx = createMockPlayerContext();
			let capturedTranscriptCtx: TranscriptContext | null = null;

			mount(TestContextProvider, {
				target,
				props: {
					context: playerCtx,
					children: (anchor: any) => {
						mount(Transcript, {
							target,
							anchor,
							props: {
								annotations: mockAnnotations,
								children: () => {
									mount(TestTranscriptContextConsumer, {
										target,
										props: {
											onResult: (ctx: TranscriptContext) => {
												capturedTranscriptCtx = ctx;
											}
										}
									});
								}
							}
						});
					}
				}
			});
			flushSync();

			expect(capturedTranscriptCtx).not.toBeNull();
			expect(capturedTranscriptCtx!.state.annotations).toEqual(mockAnnotations);
			expect(capturedTranscriptCtx!.actions.handleAnnotationClick).toBeInstanceOf(Function);
			expect(capturedTranscriptCtx!.actions.handleMatchChange).toBeInstanceOf(Function);
		});

		test('context state includes search fields', () => {
			const playerCtx = createMockPlayerContext();
			let capturedCtx: TranscriptContext | null = null;

			mount(TestContextProvider, {
				target,
				props: {
					context: playerCtx,
					children: (anchor: any) => {
						mount(Transcript, {
							target,
							anchor,
							props: {
								annotations: mockAnnotations,
								children: () => {
									mount(TestTranscriptContextConsumer, {
										target,
										props: {
											onResult: (ctx: TranscriptContext) => {
												capturedCtx = ctx;
											}
										}
									});
								}
							}
						});
					}
				}
			});
			flushSync();

			expect(capturedCtx!.state.activeAnnotationId).toBeNull();
			expect(capturedCtx!.state.searchMatches).toEqual([]);
			expect(capturedCtx!.state.currentMatchIndex).toBe(-1);
			expect(capturedCtx!.state.highlightedIds).toBeInstanceOf(Set);
			expect(capturedCtx!.state.currentMatchId).toBeNull();
		});

		test('handleAnnotationClick in context seeks media', () => {
			const playerCtx = createMockPlayerContext();
			let capturedCtx: TranscriptContext | null = null;

			mount(TestContextProvider, {
				target,
				props: {
					context: playerCtx,
					children: (anchor: any) => {
						mount(Transcript, {
							target,
							anchor,
							props: {
								annotations: mockAnnotations,
								children: () => {
									mount(TestTranscriptContextConsumer, {
										target,
										props: {
											onResult: (ctx: TranscriptContext) => {
												capturedCtx = ctx;
											}
										}
									});
								}
							}
						});
					}
				}
			});
			flushSync();

			// Click annotation via context action
			capturedCtx!.actions.handleAnnotationClick(mockAnnotations[1]!);

			expect(playerCtx.actions.seekTo).toHaveBeenCalledWith(5); // startTime of a2
		});

	});
});
