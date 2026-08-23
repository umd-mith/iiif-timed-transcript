// The <script src> drop-in: hls.js is bundled and installed as the
// module-level default, then the element is registered. Loading this file
// twice (or next to the ESM build) is a warning, not a throw — see register().
import Hls from "hls.js";
import type { HlsConstructor } from "../lib/media/hlsUtils.js";
import { setDefaultHlsConstructor } from "./mediaDefaults.js";
import {
  register,
  DEFAULT_TAG,
  IIIFTranscriptPlayerElement,
} from "./register.js";

setDefaultHlsConstructor(Hls as unknown as HlsConstructor);
register();

export { register, DEFAULT_TAG, IIIFTranscriptPlayerElement };
