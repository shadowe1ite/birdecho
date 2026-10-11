import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Some hosted CI networks are rejected by Zenodo's direct file route.
// Try Zenodo's public record API as well, but always verify the original
// model checksum before writing any deployable assets.
const record = '20703646';
const base = 'https://zenodo.org';
const expectedModelMd5 = '8278be6e7d1a9fc1717cf953e269b2e3';
await mkdir('public/models', { recursive: true });

async function download(name) {
  const encoded = encodeURIComponent(name);
  const urls = [
    `${base}/api/records/${record}/files/${encoded}/content`,
    `${base}/records/${record}/files/${encoded}?download=1`,
    `${base}/records/${record}/files/${name}?download=1`,
  ];
  let lastError;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/octet-stream', 'User-Agent': 'BirdEcho/1.0 (educational bird sound identification)' },
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.byteLength) throw new Error('Empty response');
      console.log(`Fetched ${name} via ${new URL(url).pathname} (${bytes.byteLength} bytes)`);
      return bytes;
    } catch (error) {
      lastError = error;
      console.warn(`Model source ${new URL(url).pathname} failed: ${error.message}`);
    }
  }
  throw new Error(`Unable to download ${name} from the official Zenodo record: ${lastError?.message}`);
}
console.log('Downloading the official BirdNET+ Preview 3.1 model (68.2 MiB)…');
const model = await download('BirdNET+_V3.0-preview3.1_Global_11K_FP16_pruned.onnx');
if (createHash('md5').update(model).digest('hex') !== expectedModelMd5)
  throw new Error('Official model checksum mismatch.');
const chunk = 20 * 1024 * 1024;
const parts = [];
for (let i = 0; i * chunk < model.length; i++) {
  const bytes = model.slice(i * chunk, (i + 1) * chunk);
  const name = `model-${i}.bin`;
  await writeFile(`public/models/${name}`, bytes);
  parts.push({ name, bytes: bytes.length });
}
await writeFile('public/models/manifest.json', JSON.stringify({
  version: 'BirdNET+ V3.0 Preview 3.1',
  bytes: model.length,
  sha256: createHash('sha256').update(model).digest('hex'),
  parts,
}, null, 2));
for (const [remote, local] of [
  ['BirdNET+_V3.0-preview3.1_Global_11K_Labels.csv', 'labels.csv'],
  ['TERMS_OF_USE.txt', 'TERMS_OF_USE.txt'],
]) {
  await writeFile(`public/models/${local}`, await download(remote));
}
console.log('Model verified and ready. Chunks reassemble into the unmodified ONNX file.');
