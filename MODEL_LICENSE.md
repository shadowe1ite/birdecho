# Model provenance and licensing

BirdEcho uses the unmodified **BirdNET+ V3.0 developer preview, Preview 3.1,
Global 11K, FP16 pruned ONNX** model. This is a real trained acoustic neural
network, not a lookup table, demonstration classifier, or simulated service.

- Official distribution: https://doi.org/10.5281/zenodo.20703646
- Source and browser reference implementation: https://github.com/birdnet-team/birdnet-V3.0-dev
- Model and labels: **CC BY-SA 4.0** — https://creativecommons.org/licenses/by-sa/4.0/
- Terms supplied with the model: [TERMS_OF_USE.txt](public/models/TERMS_OF_USE.txt)
- Download MD5: `8278be6e7d1a9fc1717cf953e269b2e3`
- Model size: 71,528,628 bytes (68.2 MiB).

Attribution: Lasseck, M., Eibl, M., Klinck, H., & Kahl, S. (2026). *BirdNET+
V3.0 model developer preview (Preview 3.1).* Zenodo.

The weights are split into four binary transport chunks to fit common static
host asset limits. They are reassembled byte-for-byte and SHA-256 checked
before use. No weights, outputs, label order, or architecture have been
modified. Redistributed chunks and labels remain under CC BY-SA 4.0; any model
derivative must satisfy that license. The application source is separately MIT.

The model terms describe the preview as provided for research and evaluation,
and explicitly prohibit military uses and uses facilitating poaching. These
additional terms must be considered alongside the Creative Commons license.
BirdEcho is an independent educational demonstration; no endorsement is implied.
The model is openly available with licensed weights, but these extra restrictions
mean it should not be described as unrestricted, OSI-style open-source AI.

Do not confuse this license with **BirdNET V2.4** weights, which use
CC BY-NC-SA 4.0. This project does not bundle or use V2.4.

The integration follows the official MIT-licensed browser demo's conventions:
32 kHz mono waveform input, float32 `[1, 96000]` tensors, three-second windows,
and already activated confidence outputs matched against the explicit CSV
indices. BirdEcho filters the taxonomy to `class=Aves`, keeps the maximum score
per species across windows, and displays matches at or above 0.25. It does not
apply a second sigmoid or softmax.

ONNX Runtime Web is MIT-licensed: https://github.com/microsoft/onnxruntime.
The worker runs the WASM CPU provider with one thread; neither WebGPU nor
cross-origin isolation is required. The browser must support WebAssembly SIMD,
Web Workers, Web Audio, and IndexedDB. BirdNET has known preview limitations
with speech, wind, rain, and other non-target noise. Scores are not calibrated
probabilities or confirmed sightings.

Upstream reference code copyright: (c) 2025 BirdNET-Team, MIT license.
Full license: https://github.com/birdnet-team/birdnet-V3.0-dev/blob/main/LICENSE
