---
"@umd-mith/svelte-iiif-transcript-player": patch
---

Fix regression: treat MEDIA_ERR_DECODE as transient when metadata already loaded

MEDIA_ERR_DECODE (code 3) can fire transiently during initial buffering of large files.
If the media element already has a valid duration, the decode error is a false alarm.
Previously this permanently blocked playback, breaking large WAV files that played fine in 0.12.0.
