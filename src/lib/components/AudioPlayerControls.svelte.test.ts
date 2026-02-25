import { mount, unmount as svelteUnmount, createRawSnippet } from 'svelte';
import { test, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import AudioPlayerControls from './AudioPlayerControls.svelte';
import { tick } from 'svelte';
import type { IIIFMediaViewerRef } from '../sync/types';

describe('AudioPlayerControls', () => {
	let container: HTMLElement;
	let mockPlayerRef: IIIFMediaViewerRef;
	let component: any;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);

		// Create a mock player ref with minimal required API
		mockPlayerRef = {
			play: vi.fn(),
			pause: vi.fn(),
			seekTo: vi.fn(),
			setPlaybackSpeed: vi.fn(),
			getCurrentTime: vi.fn(() => 0),
			getDuration: vi.fn(() => 100),
			isPlaying: vi.fn(() => false),
			isReady: vi.fn(() => true),
			getPlaybackSpeed: vi.fn(() => 1)
		} as unknown as IIIFMediaViewerRef;
	});

	afterEach(() => {
		if (component) {
			svelteUnmount(component);
			component = null;
		}
		container.remove();
	});

	test('renders with minimal props', () => {
		component = mount(AudioPlayerControls, {
			target: container,
			props: {
				playerRef: mockPlayerRef
			}
		});

		// Should render the controls container
		const controls = container.querySelector('[data-audio-controls]');
		expect(controls).toBeTruthy();
	});

	test('renders play/pause button', () => {
		component = mount(AudioPlayerControls, {
			target: container,
			props: {
				playerRef: mockPlayerRef
			}
		});

		const playPauseButton = container.querySelector('[data-audio-button="play-pause"]');
		expect(playPauseButton).toBeTruthy();
	});

	test('renders progress bar', () => {
		component = mount(AudioPlayerControls, {
			target: container,
			props: {
				playerRef: mockPlayerRef
			}
		});

		const progressBar = container.querySelector('[data-audio-progress]');
		expect(progressBar).toBeTruthy();
	});

	describe('Feature Toggles', () => {
		test('renders skip buttons by default', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef
				}
			});

			const skipButtons = container.querySelectorAll('[data-audio-button="skip"]');
			expect(skipButtons.length).toBeGreaterThan(0);
		});

		test('hides skip buttons when enableSkip is false', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					enableSkip: false
				}
			});

			const skipButtons = container.querySelectorAll('[data-audio-button="skip"]');
			expect(skipButtons.length).toBe(0);
		});

		test('renders speed picker by default', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef
				}
			});

			const speedPicker = container.querySelector('[data-audio-button="speed"]');
			expect(speedPicker).toBeTruthy();
		});

		test('hides speed picker when enableSpeed is false', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					enableSpeed: false
				}
			});

			const speedPicker = container.querySelector('[data-audio-button="speed"]');
			expect(speedPicker).toBeFalsy();
		});
	});

	describe('Configuration Props', () => {
		test('renders default skip amounts (3 buttons)', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef
				}
			});

			const skipButtons = container.querySelectorAll('[data-audio-button="skip"]');
			// Default: [5, 15, 30] = 3 buttons
			expect(skipButtons.length).toBe(3);
		});

		test('renders custom skipAmounts', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					skipAmounts: [10, 30]
				}
			});

			const skipButtons = container.querySelectorAll('[data-audio-button="skip"]');
			expect(skipButtons.length).toBe(2);

			// Check button labels contain the amounts
			expect(skipButtons[0].textContent).toContain('10');
			expect(skipButtons[1].textContent).toContain('30');
		});

		test('renders custom speedOptions in dropdown', async () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					speedOptions: [0.5, 1, 2, 4]
				}
			});

			// Click speed button to open dropdown
			const speedButton = container.querySelector('[data-audio-button="speed"]') as HTMLButtonElement;
			expect(speedButton).toBeTruthy();
			speedButton.click();
			await tick();

			// Check dropdown has 4 options
			const speedOptionsElems = container.querySelectorAll('[data-audio-speed-option]');
			expect(speedOptionsElems.length).toBe(4);
		});
	});

	describe('Player Interaction', () => {
		test('play/pause button calls playerRef.play when paused', async () => {
			mockPlayerRef.isPlaying = vi.fn(() => false);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef
				}
			});

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]') as HTMLButtonElement;
			playPauseButton.click();
			await tick();

			expect(mockPlayerRef.play).toHaveBeenCalled();
		});

		test('play/pause button calls playerRef.pause when playing', async () => {
			mockPlayerRef.isPlaying = vi.fn(() => true);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef
				}
			});
			await tick();

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]') as HTMLButtonElement;
			playPauseButton.click();
			await tick();

			expect(mockPlayerRef.pause).toHaveBeenCalled();
		});

		test('skip buttons call playerRef.seekTo with correct time', async () => {
			mockPlayerRef.getCurrentTime = vi.fn(() => 50);
			mockPlayerRef.getDuration = vi.fn(() => 100);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					skipAmounts: [10, 30]
				}
			});

			const skipButtons = container.querySelectorAll('[data-audio-button="skip"]');

			// Click first skip button (10s)
			(skipButtons[0] as HTMLButtonElement).click();
			await tick();

			// Should seek to 50 + 10 = 60
			expect(mockPlayerRef.seekTo).toHaveBeenCalledWith(60);
		});

		test('speed option calls playerRef.setPlaybackSpeed', async () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					speedOptions: [0.5, 1, 2]
				}
			});

			// Open speed dropdown
			const speedButton = container.querySelector('[data-audio-button="speed"]') as HTMLButtonElement;
			speedButton.click();
			await tick();

			// Click 2x speed option
			const speedOptions = container.querySelectorAll('[data-audio-speed-option]');
			(speedOptions[2] as HTMLButtonElement).click();
			await tick();

			expect(mockPlayerRef.setPlaybackSpeed).toHaveBeenCalledWith(2);
		});

		test('progress bar click calls playerRef.seekTo', async () => {
			mockPlayerRef.getDuration = vi.fn(() => 100);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef
				}
			});

			const progressTrack = container.querySelector('[data-audio-progress-track]') as HTMLElement;

			// Mock getBoundingClientRect for click position
			vi.spyOn(progressTrack, 'getBoundingClientRect').mockReturnValue({
				left: 0,
				width: 200,
				top: 0,
				right: 200,
				bottom: 20,
				height: 20,
				x: 0,
				y: 0,
				toJSON: () => ({})
			});

			// Click at 50% position (100px on 200px width)
			const clickEvent = new MouseEvent('click', {
				clientX: 100,
				bubbles: true
			});
			progressTrack.dispatchEvent(clickEvent);
			await tick();

			// Should seek to 50% of 100s duration = 50s
			expect(mockPlayerRef.seekTo).toHaveBeenCalledWith(50);
		});
	});

	describe('Time Display', () => {
		test('renders current time and duration', () => {
			mockPlayerRef.getCurrentTime = vi.fn(() => 65);
			mockPlayerRef.getDuration = vi.fn(() => 180);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef
				}
			});

			const timeDisplay = container.querySelector('[data-audio-time]');
			expect(timeDisplay).toBeTruthy();
			expect(timeDisplay?.textContent).toContain('1:05'); // 65 seconds
			expect(timeDisplay?.textContent).toContain('3:00'); // 180 seconds
		});

		test('formats time with hours for long audio', () => {
			mockPlayerRef.getCurrentTime = vi.fn(() => 3665); // 1:01:05
			mockPlayerRef.getDuration = vi.fn(() => 7200); // 2:00:00

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef
				}
			});

			const timeDisplay = container.querySelector('[data-audio-time]');
			expect(timeDisplay?.textContent).toContain('1:01:05');
			expect(timeDisplay?.textContent).toContain('2:00:00');
		});

		test('accepts currentTime and duration as reactive props', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					currentTime: 45,
					duration: 120
				}
			});

			const timeDisplay = container.querySelector('[data-audio-time]');
			expect(timeDisplay?.textContent).toContain('0:45');
			expect(timeDisplay?.textContent).toContain('2:00');
		});

		test('accepts isPlaying as reactive prop', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					isPlaying: true
				}
			});

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]');
			expect(playPauseButton?.textContent).toBe('Pause');
		});
	});

	describe('Disabled States', () => {
		test('disables controls when playerRef is null', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: null
				}
			});

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]') as HTMLButtonElement;
			expect(playPauseButton.disabled).toBe(true);
		});

		test('disables controls when duration is 0', () => {
			mockPlayerRef.getDuration = vi.fn(() => 0);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					duration: 0
				}
			});

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]') as HTMLButtonElement;
			expect(playPauseButton.disabled).toBe(true);
		});

		test('enables controls when playerRef exists and duration > 0', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					duration: 100
				}
			});

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]') as HTMLButtonElement;
			expect(playPauseButton.disabled).toBe(false);
		});
	});

	describe('ARIA Announcements', () => {
		test('announces "Playing" when play button clicked', async () => {
			mockPlayerRef.isPlaying = vi.fn(() => false);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					isPlaying: false
				}
			});

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]') as HTMLButtonElement;
			playPauseButton.click();
			await tick();

			const ariaLive = container.querySelector('[role="status"]');
			expect(ariaLive?.textContent).toContain('Playing');
		});

		test('announces "Paused" when pause button clicked', async () => {
			mockPlayerRef.isPlaying = vi.fn(() => true);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					isPlaying: true
				}
			});
			await tick();

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]') as HTMLButtonElement;
			playPauseButton.click();
			await tick();

			const ariaLive = container.querySelector('[role="status"]');
			expect(ariaLive?.textContent).toContain('Paused');
		});

		test('announces new time position when skipping', async () => {
			mockPlayerRef.getCurrentTime = vi.fn(() => 50);
			mockPlayerRef.getDuration = vi.fn(() => 100);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					currentTime: 50,
					duration: 100,
					skipAmounts: [10]
				}
			});

			const skipButton = container.querySelector('[data-audio-button="skip"]') as HTMLButtonElement;
			skipButton.click();
			await tick();

			const ariaLive = container.querySelector('[role="status"]');
			expect(ariaLive?.textContent).toContain('1:00'); // 60 seconds
		});

		test('announces speed change', async () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					speedOptions: [1, 2]
				}
			});

			// Open dropdown
			const speedButton = container.querySelector('[data-audio-button="speed"]') as HTMLButtonElement;
			speedButton.click();
			await tick();

			// Select 2x speed
			const speedOptions = container.querySelectorAll('[data-audio-speed-option]');
			(speedOptions[1] as HTMLButtonElement).click();
			await tick();

			const ariaLive = container.querySelector('[role="status"]');
			expect(ariaLive?.textContent).toContain('2x');
		});
	});

	describe('Speed Synchronization', () => {
		test('initializes currentSpeed from playerRef', () => {
			mockPlayerRef.getPlaybackSpeed = vi.fn(() => 1.5);

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					playbackSpeed: 1.5
				}
			});

			const speedButton = container.querySelector('[data-audio-button="speed"]');
			expect(speedButton?.textContent).toContain('1.5x');
		});
	});

	describe('Icon Snippets', () => {
		test('renders custom playIcon when provided and paused', () => {
			const playIcon = createRawSnippet(() => ({
				render: () => '<span data-testid="custom-play">▶</span>'
			}));

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					isPlaying: false,
					playIcon
				}
			});

			const customIcon = container.querySelector('[data-testid="custom-play"]');
			expect(customIcon).toBeTruthy();
			expect(customIcon?.textContent).toBe('▶');
		});

		test('renders custom pauseIcon when provided and playing', () => {
			const pauseIcon = createRawSnippet(() => ({
				render: () => '<span data-testid="custom-pause">⏸</span>'
			}));

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					isPlaying: true,
					pauseIcon
				}
			});

			const customIcon = container.querySelector('[data-testid="custom-pause"]');
			expect(customIcon).toBeTruthy();
			expect(customIcon?.textContent).toBe('⏸');
		});

		test('falls back to text when no icon snippets provided', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					isPlaying: false
				}
			});

			const playPauseButton = container.querySelector('[data-audio-button="play-pause"]');
			expect(playPauseButton?.textContent).toBe('Play');
		});

		test('renders custom skipIcon with seconds parameter', () => {
			const skipIcon = createRawSnippet((params: () => { seconds: number }) => ({
				render: () => {
					const { seconds } = params();
					return `<span data-testid="custom-skip">Skip ${seconds}s</span>`;
				}
			}));

			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					skipAmounts: [10, 30],
					skipIcon
				}
			});

			const skipIcons = container.querySelectorAll('[data-testid="custom-skip"]');
			expect(skipIcons.length).toBe(2);
			expect(skipIcons[0]?.textContent).toBe('Skip 10s');
			expect(skipIcons[1]?.textContent).toBe('Skip 30s');
		});

		test('falls back to text for skip buttons when no skipIcon', () => {
			component = mount(AudioPlayerControls, {
				target: container,
				props: {
					playerRef: mockPlayerRef,
					skipAmounts: [10]
				}
			});

			const skipButton = container.querySelector('[data-audio-button="skip"]');
			expect(skipButton?.textContent).toContain('10s');
		});
	});
});
