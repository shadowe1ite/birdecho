import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = 'https://zenodo.org/records/20703646/files/';
await mkdir('public/models', { recursive: true });
async function download(name) {
  const response = await fetch(base + name + '?download=1');
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
console.log('Downloading the official BirdNET+ Preview 3.1 model (68.2 MiB)…');
const model = await download('BirdNET+_V3.0-preview3.1_Global_11K_FP16_pruned.onnx');
if (createHash('md5').update(model).digest('hex') !== '8278be6e7d1a9fc1717cf953e269b2e3') throw new Error('Official model checksum mismatch.');
const chunk = 20 * 1024 * 1024;
const parts = [];
for (let i = 0; i * chunk < model.length; i++) {
  const bytes = model.slice(i * chunk, (i + 1) * chunk);
  const name = `model-${i}.bin`;
  await writeFile(`public/models/${name}`, bytes);
  parts.push({ name, bytes: bytes.length });
}
await writeFile('public/models/manifest.json', JSON.stringify({ version: 'BirdNET+ V3.0 Preview 3.1', bytes: model.length, sha256: createHash('sha256').update(model).digest('hex'), parts }, null, 2));
for (const [remote, local] of [['BirdNET+_V3.0-preview3.1_Global_11K_Labels.csv', 'labels.csv'], ['TERMS_OF_USE.txt', 'TERMS_OF_USE.txt']]) {
  await writeFile(`public/models/${local}`, await download(remote));
}
console.log('Model verified and ready. Chunks reassemble into the unmodified ONNX file.');
