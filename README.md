# BirdEcho

**A little outside. A lot to discover.** A mobile-first bird sound identifier
and personal discovery journal for Hacktoberfest Week 1, “Touch Grass.”

BirdEcho genuinely runs BirdNET in your browser. There is no fake prediction
path, backend account, API key, paid API, or cloud audio upload. Your collection
starts empty. Field-guide examples are clearly separate from your discoveries.

## Run locally

Requirements: **Node.js 22.12+**, npm, and a current browser with WebAssembly
SIMD, Web Audio, MediaRecorder, Web Workers, and IndexedDB. No Python or GPU is
needed. Allow roughly 300 MB of disk space and several hundred MB of browser
memory for dependencies, model initialization, and production assets.

```sh
cd birdecho
npm ci
npm run setup:model
npm run dev
```

Open **http://localhost:5173**. The model download verifies the official
checksum and creates four transport chunks. If the chunks are already present,
you can skip `setup:model`. `npm run dev` copies the exact pinned ONNX Runtime
WASM files into the local assets directory before starting Vite.

For a production build:

```sh
npm test
npm run build
npm run preview
```

Publish the entire `dist/` directory to a static HTTPS host. Each model chunk
is smaller than 25 MiB. Do not omit `dist/models/` or `dist/ort/`. No server
functions or runtime secrets are needed. The included Sites manifest refers to
this project's private deployment; remove `.openai/hosting.json` if you deploy
your own independent copy.

## Working demonstration

1. Open BirdEcho and select **Try a sample**.
2. The original 16-second European robin recording is decoded to mono 32 kHz.
3. First use loads the actual ~68 MB BirdNET+ model and verifies its SHA-256.
   You see real download and inference progress, not a simulated timer.
4. The worker evaluates every three-second window, including a padded final
   window, and returns its real bird scores.
5. Play the recording with the audio control. Save a suggested bird with a
   place and some field notes. Sample discoveries are labeled as samples.
6. Open **My collection** and **Field journal**, edit your entry, play it again,
   and reload to confirm it persists. Export the journal to keep the notes and
   original audio together in a readable JSON file.

To record outdoors, select **Start listening**, allow the microphone, and stop
after a clear 10–30 seconds. Recording automatically stops at 30 seconds.
Listen back, then select **Identify birds**. You can also upload audio up to
60 seconds and 30 MB. WAV and MP3 are the most portable upload formats; other
formats depend on your browser's decoder. Upload errors do not invent results.

Microphone access requires **HTTPS or localhost**. A plain HTTP LAN address
(such as your laptop's IP opened on your phone) generally cannot use the
microphone; use the deployed HTTPS site for phone testing. Browsers may ask
for permission, and operating-system microphone settings may also apply.

## What is functional

- Microphone recording, real live audio-level waveform, format negotiation,
  permission-error messages, a 30-second cap, and microphone cleanup.
- Browser audio decoding, proper anti-aliased resampling to 32 kHz mono,
  inference off the UI thread, model download progress, cancellation and retry.
- Actual species names, scientific names, confidence scores, and best matching
  audio segment; only bird classes above a 25% threshold are returned.
- Bird photos and field facts, including bundled robin, great tit, and blackbird
  information and live Wikipedia enrichment for other detected species.
- Playback, persistent IndexedDB discoveries with original audio blobs, unique
  species counts, discovery-day counts, searchable collection and journal,
  editable places and notes, deletion confirmation, and complete JSON export.
- Responsive layouts, mobile navigation, native accessible dialogs, visible
  focus styles, and reduced-motion preferences.

## Privacy and cost

Identification stays on the device. Model chunks are cached when browser
storage allows it. Saved recordings and notes live in IndexedDB on the same
browser and origin. They do not synchronize between devices. Clearing site
data removes the collection; export before doing so. Journal export includes
audio as base64 with its original MIME type. There is currently no import UI.

The app is free to run. The first download uses bandwidth; later inference
uses your device's CPU. The app shell does not claim full offline/PWA support.
Wikipedia receives a species-name request for unbundled field notes and images,
never the recording. Google Fonts receives requests for the interface fonts;
system fonts are used if unavailable. Model and local media are served from
the same host as BirdEcho.

## Model license and limits

BirdNET+ Preview 3.1 is a developer preview released by the BirdNET team under
**CC BY-SA 4.0**, with separate model terms. It is publicly available with
licensed weights, but its research/evaluation language and use restrictions
mean it is not an unrestricted open-source AI license. The educational nature
challenge uses the real model with attribution. See [MODEL_LICENSE.md](MODEL_LICENSE.md)
and the supplied [model terms](public/models/TERMS_OF_USE.txt). Application code
is MIT; third-party audio, images, text and weights keep their own licenses.
Media credits are in [ASSET_CREDITS.md](ASSET_CREDITS.md) and the app.

Confidence is a model score, not a guaranteed probability. The preview has
known limitations for wind, rain, engines, and speech. No location or seasonal
prior is applied, so check that suggested species occur in your area. Empty
or low-confidence recordings produce an honest “try again” state. Mobile
speed and available memory vary. Chrome/Chromium is the verified runtime;
Safari and Firefox should meet the documented browser APIs but require testing
on your particular devices. Native microphone hardware and the sound quality
of field recordings must be checked by a person.

## Project structure

```text
src/main.jsx                 UI, recording lifecycle, discovery journal
src/audio.js                 Audio decoding and Web Audio resampling
src/inference.worker.js      Actual ONNX inference and verified model loading
src/model-utils.mjs          Label parsing, segment planning, bird-score filtering
src/storage.js               IndexedDB persistence of notes and audio blobs
src/style.css                Mobile-first nature-inspired interface
public/models/               Official model chunks, labels, terms, manifest
public/audio/robin.ogg        Real licensed sample recording
public/birds.json             Bundled field notes and photo credits
scripts/download-model.mjs   Reproducible download and integrity verification
tests/model.test.mjs          Parsing, filtering, segmentation, model checksums
```

There are no application secrets. Model binaries and generated WASM assets
are ignored by Git and recreated by the documented setup commands. The lockfile
pins dependencies. This application is isolated inside `birdecho/` and does not
modify the surrounding paper-cut studio.
