import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const baseDir = path.join(root, 'data', 'uttara-kanda');

const TELUGU_REPLACEMENTS = [
  [/\b7\.\d+\.\d+\b/g, ''],
  [/శ్రీ రామ/gi, 'శ్రీరాముడు'],
  [/లార్డ్ శివ/gi, 'శివుడు'],
  [/సన్ గాడ్/gi, 'సూర్యదేవుడు'],
  [/విండ్ గాడ్/gi, 'వాయుదేవుడు'],
];

function cleanSanskrit(text) {
  return text
    .replace(/।{1,2}\s*7\.\d+\.\d+\s*।{1,2}/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTelugu(text) {
  let value = text.replace(/\s+/g, ' ').trim();
  for (const [pattern, replacement] of TELUGU_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }
  return value.replace(/\s+/g, ' ').trim();
}

async function translateBatch(texts) {
  const separator = '\n[[[SPLIT_MARKER]]]\n';
  const payload = texts.join(separator);
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=sa&tl=te&dt=t&q=' +
    encodeURIComponent(payload);
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }

  const data = await response.json();
  const translated = data[0].map((item) => item[0]).join('');
  const parts = translated.split(separator).map(normalizeTelugu);
  if (parts.length !== texts.length) {
    throw new Error(`Batch split mismatch: expected ${texts.length}, got ${parts.length}`);
  }
  return parts;
}

async function translateWithFallback(texts) {
  try {
    return await translateBatch(texts);
  } catch (error) {
    if (texts.length === 1) {
      throw error;
    }

    const middle = Math.ceil(texts.length / 2);
    const left = await translateWithFallback(texts.slice(0, middle));
    const right = await translateWithFallback(texts.slice(middle));
    return [...left, ...right];
  }
}

async function main() {
  const files = fs
    .readdirSync(baseDir)
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  let completed = 0;
  let nextIndex = 0;

  async function processFile(file) {
    const filePath = path.join(baseDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const verses = data.shlokas.map((verse) => cleanSanskrit(verse.shloka_text || ''));
    const translated = [];

    for (let i = 0; i < verses.length; i += 20) {
      const chunk = verses.slice(i, i + 20);
      const chunkResult = await translateWithFallback(chunk);
      translated.push(...chunkResult);
    }

    data.shlokas.forEach((verse, index) => {
      verse.telugu_translation = translated[index] || verse.telugu_translation;
    });

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    completed += 1;
    console.log(`Updated sarga ${data.sarga} (${completed}/${files.length})`);
  }

  async function worker() {
    while (nextIndex < files.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await processFile(files[currentIndex]);
    }
  }

  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker(), worker(), worker()]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
