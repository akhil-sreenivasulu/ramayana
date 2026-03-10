import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const baseDir = path.join(root, 'data', 'uttara-kanda');
const kandaTid = 7;

const TERM_REPLACEMENTS = [
  [/Sungod/gi, 'Sun god'],
  [/windgod/gi, 'Wind god'],
  [/lord Siva/gi, 'Lord Shiva'],
  [/lord Siva's/gi, 'Lord Shiva\'s'],
  [/charanas/gi, 'celestial beings'],
  [/Charanas/gi, 'Celestial beings'],
];

const TELUGU_REPLACEMENTS = [
  [/సన్ గాడ్/gi, 'సూర్యదేవుడు'],
  [/విండ్ గాడ్/gi, 'వాయుదేవుడు'],
  [/లార్డ్ శివ/gi, 'శివుడు'],
  [/సెలెస్టియల్ బీయింగ్స్/gi, 'దివ్యజనులు'],
];

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[\u200b\u00a0]/g, ' ');
}

function cleanField(html) {
  return decodeHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractField(html, fieldName) {
  const pattern = new RegExp(
    `<div class="views-field ${fieldName}">[\\s\\S]*?<div class="field-content">([\\s\\S]*?)<\\/div>\\s*<\\/div>`,
    'i'
  );
  const match = html.match(pattern);
  return match ? cleanField(match[1]) : '';
}

function normalizeEnglish(text) {
  return TERM_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

async function translateToTelugu(text) {
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
  let translated = data[0].map((item) => item[0]).join('').trim();
  for (const [pattern, replacement] of TELUGU_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
}

async function translateSanskritToTelugu(text) {
  const normalized = text
    .replace(/।{1,2}\s*7\.\d+\.\d+\s*।{1,2}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=sa&tl=te&dt=t&q=' +
    encodeURIComponent(normalized);
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Sanskrit translation request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data[0]
    .map((item) => item[0])
    .join('')
    .replace(/7\.\d+\.\d+\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchVerse(sarga, shloka) {
  const url = `https://www.valmiki.iitk.ac.in/content?field_kanda_tid=${kandaTid}&language=dv&field_sarga_value=${sarga}&field_sloka_value=${shloka}&choose=1&etaa=1`;
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Uttara Kanda ${sarga}.${shloka}: ${response.status}`);
  }

  const html = await response.text();
  const translation = extractField(html, 'views-field-field-htetrans');
  const explanation = extractField(html, 'views-field-field-explanation');
  const shlokaText = extractField(html, 'views-field-body')
    .split('\n')
    .filter((line) => !line.trim().startsWith('['))
    .join('\n')
    .trim();

  return {
    shloka_text: shlokaText,
    translation: normalizeEnglish(translation),
    explanation: normalizeEnglish(explanation),
  };
}

async function main() {
  const files = fs.readdirSync(baseDir).filter((file) => file.endsWith('.json'));
  const suspicious = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(baseDir, file), 'utf8'));
    for (const verse of data.shlokas) {
      const teluguCompact = (verse.telugu_translation || '').replace(/\s+/g, '');
      const shlokaCompact = (verse.shloka_text || '').replace(/\s+/g, '');
      if (teluguCompact && (teluguCompact === shlokaCompact || /[अ-ह]/.test(verse.telugu_translation || ''))) {
        suspicious.push({ file, sarga: data.sarga, shloka: verse.shloka });
      }
    }
  }

  for (const item of suspicious) {
    const filePath = path.join(baseDir, item.file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const verse = data.shlokas.find((entry) => entry.shloka === item.shloka);
    const fetched = await fetchVerse(item.sarga, item.shloka);
    const sourceText = fetched.explanation || fetched.translation;

    verse.shloka_text = fetched.shloka_text || verse.shloka_text;
    verse.translation = fetched.translation || verse.translation;
    verse.explanation = fetched.explanation || verse.explanation;

    if (sourceText) {
      verse.telugu_translation = await translateToTelugu(sourceText);
      console.log(`Updated ${item.sarga}.${item.shloka} from English gloss`);
    } else {
      verse.telugu_translation = await translateSanskritToTelugu(verse.shloka_text);
      console.log(`Updated ${item.sarga}.${item.shloka} from Sanskrit meaning`);
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
