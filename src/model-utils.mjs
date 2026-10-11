export function parseCsvLine(line) {
  const fields = []; let field = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ';' && !quoted) { fields.push(field); field = ''; }
    else field += char;
  }
  fields.push(field); return fields;
}
export function parseLabels(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = parseCsvLine(lines.shift());
  for (const name of ['idx', 'sci_name', 'com_name', 'class']) if (!header.includes(name)) throw new Error('Invalid BirdNET labels.');
  const labels = [];
  for (const line of lines) {
    const row = parseCsvLine(line); const get = name => row[header.indexOf(name)]?.trim();
    labels[Number(get('idx'))] = { scientific: get('sci_name'), common: get('com_name'), isBird: get('class') === 'Aves' };
  }
  if (!labels.length || labels.some(label => !label?.scientific)) throw new Error('Incomplete BirdNET labels.');
  return labels;
}
export function planChunks(length, rate = 32000) {
  const window = rate * 3; const chunks = [];
  for (let start = 0; start < length; start += window) {
    chunks.push({ start, end: Math.min(length, start + window) });
  }
  return chunks;
}
export function collectBirds(scores, labels, start, end, existing = new Map(), threshold = .25) {
  if (scores.length !== labels.length) throw new Error('Model output does not match species labels.');
  for (let i = 0; i < scores.length; i++) {
    const score = Number(scores[i]); const label = labels[i];
    if (!label.isBird || !Number.isFinite(score) || score < threshold || score > 1) continue;
    if (!existing.has(label.scientific) || existing.get(label.scientific).confidence < score) {
      existing.set(label.scientific, { ...label, confidence: score, start, end });
    }
  }
  return existing;
}
