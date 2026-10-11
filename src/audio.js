export async function decodeAudio(blob) {
  if (!blob.size || blob.size > 30 * 1024 * 1024) throw new Error('Choose an audio recording smaller than 30 MB.');
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('Your browser does not support audio decoding. Try a current Chrome, Firefox, or Safari.');
  const context = new Audio(); let decoded;
  try { decoded = await context.decodeAudioData(await blob.arrayBuffer()); }
  catch { throw new Error('This audio format could not be read. Try a WAV, MP3, M4A, or OGG file.'); }
  finally { await context.close(); }
  if (decoded.duration < 1) throw new Error('That recording is too short. Capture at least 3 seconds of birdsong.');
  if (decoded.duration > 60.1) throw new Error('Choose a recording of 60 seconds or less so identification stays quick on your phone.');
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 32000), 32000);
  const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
  const mono = await offline.startRendering();
  return { samples: new Float32Array(mono.getChannelData(0)), duration: decoded.duration };
}
export const time = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
