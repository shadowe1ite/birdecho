# Verification

Checked in Chromium through the Codex in-app browser, 12 October 2026 (IST).

- The official, MD5-verified model was reassembled from local chunks, SHA-256
  verified in the browser, and executed using ONNX Runtime Web 1.26.0 WASM.
- The real 16.294-second robin sample produced European Robin (displayed 92%)
  and a second suggestion, Eurasian Chaffinch (83%). No hardcoded species or
  confidence values are used by the application. The secondary suggestion is
  not independently confirmed by a human.
- At a 390 × 844 viewport, actual inference produced the same results. The
  page had no horizontal overflow and displayed its mobile navigation.
- A three-second, 32 kHz mono silence WAV was uploaded through the file picker,
  then evaluated by the real model. No bird passed the threshold; the app
  displayed its no-match state.
- Saving the robin with a place and journal note updated the unique species,
  saved discovery, and discovery-day counts. After a page reload, the entry
  and notes remained in the field journal.
- The persisted audio blob decoded to 16.294 seconds with `readyState=4`.
  Playback changed the media state to `paused=false` and showed the Pause
  control. Audio quality was not judged by listening.
- All three bundled species photos loaded after correcting one source URL.
- Five automated tests passed: CSV quotation handling, indexed taxonomy,
  final-window segmentation, threshold/non-bird filtering, and official model
  integrity. Production builds passed.

Verification limits: physical microphone recording and its sound quality need
testing on a real phone with microphone permission granted. Safari and Firefox
have not been tested here. The embedded browser's automatic download event
could not be observed; the export also offers a persistent explicit download
link for browsers that block automatic downloads. The app does not claim
cross-device synchronization or full offline support.
