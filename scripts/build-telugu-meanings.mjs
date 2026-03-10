import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.join(root, 'raw', 'Valmiki_Ramayan_Shlokas.json');
const outputPath = path.join(root, 'raw', 'telugu-meanings.json');

const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const existing = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  : {};

const bySarga = new Map();

for (const row of rows) {
  const key = `${row.kanda}||${row.sarga}`;
  if (!bySarga.has(key)) {
    bySarga.set(key, []);
  }

  bySarga.get(key).push(row);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateText(text) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=te&dt=t&q=' +
    encodeURIComponent(text);
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data[0].map((item) => item[0]).join('');
}

function getSourceText(row) {
  return (
    row.explanation?.trim() ||
    row.translation?.trim() ||
    row.comments?.trim() ||
    row.shloka_text?.trim() ||
    ''
  );
}

function flushCache() {
  fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2));
}

async function translateChunk(chunk) {
  const separator = '\n[[[SPLIT_MARKER]]]\n';
  const text = chunk.map((item) => item.source).join(separator);
  const translated = await translateText(text);
  const parts = translated.split(separator);

  if (parts.length !== chunk.length) {
    throw new Error(`Chunk split mismatch: expected ${chunk.length}, got ${parts.length}`);
  }

  parts.forEach((value, index) => {
    existing[chunk[index].key] = value.trim();
  });
}

async function translateSingleItem(item) {
  if (item.source.length <= 2400) {
    existing[item.key] = (await translateText(item.source)).trim();
    return;
  }

  const segments = item.source
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    const midpoint = Math.ceil(item.source.length / 2);
    segments.splice(0, 0, item.source.slice(0, midpoint));
    segments.splice(1, 0, item.source.slice(midpoint));
  }

  const translatedSegments = [];
  for (const segment of segments) {
    translatedSegments.push((await translateText(segment)).trim());
    await delay(20);
  }

  existing[item.key] = translatedSegments.join(' ');
}

async function translateChunkWithFallback(chunk) {
  try {
    await translateChunk(chunk);
  } catch (error) {
    if (chunk.length === 1) {
      await translateSingleItem(chunk[0]);
      return;
    }

    const midpoint = Math.ceil(chunk.length / 2);
    await translateChunkWithFallback(chunk.slice(0, midpoint));
    await translateChunkWithFallback(chunk.slice(midpoint));
  }
}

async function main() {
  const sargas = [...bySarga.entries()];
  let processed = 0;
  let nextIndex = 0;

  async function processSarga(sargaRows) {
    const missing = sargaRows
      .sort((a, b) => Number(a.shloka) - Number(b.shloka))
      .map((row) => ({
        key: `${row.kanda}||${row.sarga}||${row.shloka}`,
        source: getSourceText(row),
      }))
      .filter((item) => item.source && !existing[item.key]);

    if (missing.length === 0) {
      return;
    }

    const chunks = [];
    let current = [];
    let currentLength = 0;

    for (const item of missing) {
      const itemLength = item.source.length + 30;
      if (current.length > 0 && currentLength + itemLength > 4600) {
        chunks.push(current);
        current = [];
        currentLength = 0;
      }

      current.push(item);
      currentLength += itemLength;
    }

    if (current.length > 0) {
      chunks.push(current);
    }

    for (const chunk of chunks) {
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
          await translateChunkWithFallback(chunk);
          break;
        } catch (error) {
          if (attempt === 4) {
            throw error;
          }
          await delay(900 * attempt);
        }
      }

      await delay(20);
    }

    flushCache();
  }

  async function worker() {
    while (nextIndex < sargas.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      await processSarga(sargas[currentIndex][1]);
      processed += 1;
      if (processed % 10 === 0 || processed === sargas.length) {
        console.log(`Processed ${processed}/${sargas.length} sargas`);
      }
    }
  }

  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker(), worker(), worker()]);

  flushCache();
  console.log(`Saved ${Object.keys(existing).length} Telugu meanings to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
