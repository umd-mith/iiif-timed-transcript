---
"@umd-mith/iiif-timed-transcript": patch
---

Fix transcript auto-scroll firing on load: the sync controller no longer drives media-driven scrolling until playback has actually advanced the time, so the page no longer jumps to the transcript before the user presses play (#55).
