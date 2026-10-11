import { mkdir, copyFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('onnxruntime-web'));
await mkdir('public/ort', { recursive: true });
for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
  await copyFile(join(root, file), join('public/ort', file));
}
try { await access('public/models/model-0.bin'); }
catch { throw new Error('BirdNET weights missing. Run npm run setup:model before building.'); }
