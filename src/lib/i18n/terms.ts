/**
 * Every UI-chrome string keys off one of these. The union covers what
 * exists today (control labels, transcript panel strings, the error
 * banner) plus keys reserved for the companion a11y spec's A-workstream
 * (Captions toggle, auto-scroll pause, the A5 status announcements) so
 * those strings are registry-routed from birth instead of swept in later.
 */
export type TermKey =
  | "transcript.loading"
  | "transcript.unavailable"
  | "transcript.searchPlaceholder"
  | "transcript.searchLabel"
  | "transcript.searchPrevious"
  | "transcript.searchNext"
  | "transcript.searchNoMatches"
  | "transcript.searchMatchCount"
  | "transcript.segmentsLabel"
  // Reserved for the a11y spec's A3 (auto-scroll pause control).
  | "transcript.autoscrollPause"
  // Reserved for the a11y spec's A5 (transcript status announcements).
  | "transcript.loadedAnnouncement"
  | "transcript.unavailableAnnouncement"
  | "player.errorLabel"
  | "player.controlsLabel"
  | "player.playButton.play"
  | "player.playButton.pause"
  | "player.playButton.loading"
  | "player.skipForward"
  | "player.skipBack"
  | "player.speedLabel"
  | "player.progressLabel"
  | "player.progressValueText"
  | "player.timeLabel"
  | "player.canvasNavLabel"
  | "player.chaptersLabel"
  | "player.chaptersEmpty"
  // Reserved for the a11y spec's A1 (Captions toggle).
  | "captions.toggleLabel";

/**
 * English is the built-in default: every key resolves even when no other
 * locale is registered, and it is the fallback for any key a registered
 * locale doesn't cover. `Record<TermKey, string>` (not `Partial`) — the
 * compiler rejects a missing key here.
 */
export const EN_TERMS: Record<TermKey, string> = {
  "transcript.loading": "Loading transcript…",
  "transcript.unavailable": "No transcript available.",
  "transcript.searchPlaceholder": "Search transcript...",
  "transcript.searchLabel": "Search transcript",
  "transcript.searchPrevious": "Previous match",
  "transcript.searchNext": "Next match",
  "transcript.searchNoMatches": "No matches",
  "transcript.searchMatchCount": "{current} of {total}",
  "transcript.segmentsLabel": "Transcript segments",
  "transcript.autoscrollPause": "Pause auto-scroll",
  "transcript.loadedAnnouncement": "Transcript loaded, {count} segments",
  "transcript.unavailableAnnouncement": "Transcript unavailable",
  "player.errorLabel": "Error:",
  "player.controlsLabel": "Media controls",
  "player.playButton.play": "Play",
  "player.playButton.pause": "Pause",
  "player.playButton.loading": "Loading...",
  "player.skipForward": "Skip forward {seconds} seconds",
  "player.skipBack": "Skip back {seconds} seconds",
  "player.speedLabel": "Playback speed",
  "player.progressLabel": "Playback progress",
  "player.progressValueText": "{current} of {duration}",
  "player.timeLabel": "Playback time",
  "player.canvasNavLabel": "Canvases",
  "player.chaptersLabel": "Chapters",
  "player.chaptersEmpty": "No chapters available.",
  "captions.toggleLabel": "Toggle captions",
};
