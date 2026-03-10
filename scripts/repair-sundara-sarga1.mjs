import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputPath = path.join(root, 'data', 'sundara-kanda', 'sarga-1.json');
const kandaTid = 5;
const sargaNumber = 1;
const totalShlokas = 201;

const TERM_REPLACEMENTS = [
  [/Sungod/gi, 'Sun god'],
  [/windgod/gi, 'Wind god'],
  [/lord Siva/gi, 'Lord Shiva'],
  [/Charanas/gi, 'celestial beings'],
  [/charanas/gi, 'celestial beings'],
];

const TELUGU_REPLACEMENTS = [
  [/సన్ గాడ్/gi, 'సూర్యదేవుడు'],
  [/సూర్య దేవుడు/gi, 'సూర్యదేవుడు'],
  [/విండ్ గాడ్/gi, 'వాయుదేవుడు'],
  [/విండ్ దేవుడు/gi, 'వాయుదేవుడు'],
  [/లార్డ్ శివ/gi, 'శివుడు'],
  [/సెలెస్టియల్ బీయింగ్స్/gi, 'దివ్యజనులు'],
  [/బార్డ్స్/gi, 'గాయకులు'],
  [/చరణాస్/gi, 'చారణులు'],
  [/చరణులు, ఖగోళ బర్డ్స్/gi, 'చారణుల ఆకాశమార్గం'],
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

async function fetchVerse(shloka) {
  const url = `https://www.valmiki.iitk.ac.in/content?field_kanda_tid=${kandaTid}&language=dv&field_sarga_value=${sargaNumber}&field_sloka_value=${shloka}&choose=1&etaa=1`;
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch verse ${shloka}: ${response.status}`);
  }

  const html = await response.text();
  const shlokaText = extractField(html, 'views-field-body');
  const translation = extractField(html, 'views-field-field-htetrans');
  const explanation = extractField(html, 'views-field-field-explanation');

  const normalizedExplanation = normalizeEnglish(explanation);
  const teluguTranslation = normalizedExplanation
    ? await translateToTelugu(normalizedExplanation)
    : '';

  return {
    shloka,
    shloka_text: shlokaText,
    transliteration: '',
    translation,
    explanation: normalizedExplanation,
    telugu_translation: teluguTranslation,
    comments: '',
  };
}

async function main() {
  const repaired = [];

  for (let shloka = 1; shloka <= totalShlokas; shloka += 1) {
    const verse = await fetchVerse(shloka);
    repaired.push(verse);
    console.log(`Fetched ${shloka}/${totalShlokas}`);
  }

  // Manual cleanup for the verses the user explicitly flagged.
  const manualTelugu = {
    1: 'రావణుడు అపహరించిన సీతా దేవి ఆచూకీని తెలుసుకోవాలని శత్రువులను జయించగల హనుమంతుడు సంకల్పించాడు. చారణులు సంచరించే ఆకాశమార్గాన్ని అతను అనుసరించాడు.',
    2: 'ఎవరూ సాహసించలేని దుష్కర కార్యాన్ని చేయాలని నిశ్చయించుకున్న ఆ వానరవీరుడు, తల మెడలను ఎత్తి నిలబడి గోపాలకంలో ప్రధాన ఎద్దువలె ప్రకాశించాడు.',
    3: 'అపారబలశాలి, ధీరుడైన హనుమంతుడు వైడూర్యరత్నపు కాంతిలా మెరిసే పచ్చికతో కూడిన చిత్తడి నేలల మీద స్వేచ్ఛగా సంచరించాడు.',
    4: 'బుద్ధిమంతుడైన హనుమంతుడు పక్షులను భయపెట్టుతూ, తన వక్షస్థలంతో చెట్లను కదిలిస్తూ, అనేక మృగాలను చెదరగొడుతూ, విక్రమించిన సింహంలా కనిపించాడు.',
    5: 'నీలం, ఎరుపు, మాంజిష్ఠం, ఆకుపచ్చ, తెలుపు, నలుపు వంటి నానా రంగుల ఖనిజ శిలలతో ఆ పర్వతం అద్భుతంగా అలంకరించబడి కనిపించింది.',
    6: 'ఆ పర్వతాన్ని తమ పరివారాలతో యక్షులు, కిన్నరులు, గంధర్వులు, దేవసమాన తేజస్సు గల పన్నగులు తరచుగా సందర్శించేవారు. వారు తమ ఇష్టప్రకారం ఏ రూపమైనా ధరించగలవారు.',
    7: 'ఏనుగులతో నిండిన ఆ మహా పర్వతపు అడుగున నిలిచిన వానరశ్రేష్ఠుడు, సరస్సు మధ్యలో నిలిచిన గజరాజులా కనిపించాడు.',
    8: 'సూర్యదేవునికి, దేవేంద్రునికి, వాయుదేవునికి, స్వయంభువైన బ్రహ్మదేవునికి, శివగణాలందరికీ అంజలి ఘటించి నమస్కరించిన హనుమంతుడు, లంకకు బయలుదేరాలని నిశ్చయించుకున్నాడు.',
    9: 'తూర్పు దిశగా ముఖం చేసి తన తండ్రియైన వాయుదేవునికి అంజలి ఘటించిన హనుమంతుడు, దక్షిణదిశగా ప్రయాణించేందుకు తన దేహాన్ని విస్తరించుకున్నాడు.',
    10: 'రామకార్యసిద్ధి కోసం దూకాలని సంకల్పించిన హనుమంతుడు, పౌర్ణమి వేళ సముద్రం ఉప్పొంగినట్లే, చూస్తున్న వానరవీరుల ముందే తన కాయాన్ని విస్తరించుకున్నాడు.',
  };

  const manualEnglish = {
    5: {
      shloka_text: 'नीललोहितमांजिष्ठपत्रवर्णैः सितासितैः। स्वभावविहितैश्चित्रैर्धातुभिः समलङ्कृतम्।।5.1.5।।',
      translation:
        'नीललोहितमांजिष्ठपत्रवर्णैः with blue, red, yellow, green, white and black shades, स्वभावविहितैः naturally formed, चित्रैः wonderful, धातुभिः with mineral ores, समलङ्कृतम् adorned all over.',
      explanation:
        'The mountain looked richly adorned all over with naturally formed mineral ores of many colours such as blue, red, yellow, green, white and black.',
    },
    6: {
      shloka_text: 'कामरूपिभिराविष्टमभीक्ष्णं सपरिच्छदैः। यक्षकिन्नरगन्धर्वैर्देवकल्पैश्च पन्नगैः।।5.1.6।।',
      translation:
        'कामरूपिभिः by beings who could assume forms at will, सपरिच्छदैः along with their retinues, यक्षकिन्नरगन्धर्वैः by yakshas, kinneras and gandharvas, देवकल्पैः godlike, पन्नगैः by nagas, अभीक्ष्णम् often, आविष्टम् frequented.',
      explanation:
        'It was often frequented by yakshas, kinneras, gandharvas and radiant nagas, all accompanied by their retinues and able to assume any form at will.',
    },
  };

  for (const verse of repaired) {
    if (manualTelugu[verse.shloka]) {
      verse.telugu_translation = manualTelugu[verse.shloka];
    }

    if (manualEnglish[verse.shloka]) {
      verse.shloka_text = manualEnglish[verse.shloka].shloka_text;
      verse.translation = manualEnglish[verse.shloka].translation;
      verse.explanation = manualEnglish[verse.shloka].explanation;
    }
  }

  const output = {
    kanda: 'Sundara Kanda',
    kanda_slug: 'sundara-kanda',
    sarga: 1,
    shloka_count: repaired.length,
    shlokas: repaired,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Updated ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
