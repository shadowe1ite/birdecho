// BirdNET+ model by Lasseck, Eibl, Klinck and Kahl (2026), CC BY-SA 4.0.
// Integration follows the official birdnet-team browser demo (MIT).
import * as ort from 'onnxruntime-web/wasm';
import { parseLabels, planChunks, collectBirds } from './model-utils.mjs';
ort.env.wasm.numThreads = 1; // Works without SharedArrayBuffer/COOP/COEP, including Safari.
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('/ort/', self.location.origin).href;
let session, labels;
const progress = (id, phase, value) => self.postMessage({ id, type: 'progress', phase, value });
async function checkedFetch(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not download the bird model (${response.status}). Check your connection and try again.`);
  return response;
}
async function load(id) {
  if (session) return;
  progress(id, 'Preparing BirdNET', 0);
  labels = parseLabels(await (await checkedFetch('/models/labels.csv')).text());
  const manifest = await (await checkedFetch('/models/manifest.json')).json();
  const bytes = new Uint8Array(manifest.bytes); let offset = 0;
  let cache; try { cache = await caches.open('birdecho-model-v3.1'); } catch { /* Private mode may disable CacheStorage. */ }
  for (const part of manifest.parts) {
    const path = '/models/' + part.name;
    let response = cache ? await cache.match(path) : null;
    if (!response) {
      response = await checkedFetch(path);
      if (cache) { try { await cache.put(path, response.clone()); } catch { /* Inference still works without storage. */ } }
    }
    const chunk = new Uint8Array(await response.arrayBuffer());
    if (chunk.length !== part.bytes) { if (cache) await cache.delete(path); throw new Error('Incomplete model download. Please try again.'); }
    bytes.set(chunk, offset); offset += chunk.length;
    progress(id, 'Downloading BirdNET · first use only', Math.round(offset / bytes.length * 80));
  }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== manifest.sha256) { if (cache) await caches.delete('birdecho-model-v3.1'); throw new Error('Model integrity check failed. Please try again.'); }
  progress(id, 'Waking up the bird expert', 90);
  session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  self.postMessage({ id, type: 'ready', count: labels.filter(x => x.isBird).length });
}
self.onmessage = async ({ data: { id, audio } }) => {
  try {
    await load(id);
    const chunks = planChunks(audio.length); const matches = new Map();
    for (let i = 0; i < chunks.length; i++) {
      const { start, end } = chunks[i]; const input = new Float32Array(96000);
      input.set(audio.subarray(start, end));
      const tensor = new ort.Tensor('float32', input, [1, input.length]);
      const outputs = await session.run({ [session.inputNames[0]]: tensor });
      const result = Object.values(outputs).find(x => x.dims.length === 2 && x.dims[1] === labels.length);
      if (!result || result.type !== 'float32') throw new Error('Unexpected BirdNET output format.');
      collectBirds(result.data, labels, start / 32000, end / 32000, matches);
      for (const output of Object.values(outputs)) output.dispose();
      tensor.dispose();
      progress(id, `Listening closely · ${i + 1} of ${chunks.length}`, Math.round((i + 1) / chunks.length * 100));
    }
    self.postMessage({ id, type: 'result', birds: [...matches.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 8) });
  } catch (error) { self.postMessage({ id, type: 'error', message: error.message || 'Identification failed. Try again.' }); }
};
