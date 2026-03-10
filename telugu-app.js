const sidebarEl = document.getElementById('sidebar');
const metaEl = document.getElementById('meta');
const sargaNavEl = document.getElementById('sargaNav');
const shlokaMenuEl = document.getElementById('shlokaMenu');
const verseNavEl = document.getElementById('verseNav');
const shlokaListEl = document.getElementById('shlokaList');

const cache = new Map();
let manifest;

const KANDA_ORDER = [
  'bala-kanda',
  'ayodhya-kanda',
  'aranya-kanda',
  'kishkindha-kanda',
  'sundara-kanda',
  'yuddha-kanda',
  'uttara-kanda',
];

const KANDA_LABELS = {
  'bala-kanda': 'బాల కాండ',
  'ayodhya-kanda': 'అయోధ్య కాండ',
  'aranya-kanda': 'అరణ్య కాండ',
  'kishkindha-kanda': 'కిష్కింధా కాండ',
  'sundara-kanda': 'సుందర కాండ',
  'yuddha-kanda': 'యుద్ధ కాండ',
  'uttara-kanda': 'ఉత్తర కాండ',
};

const DEVANAGARI_TO_TELUGU = {
  'अ': 'అ',
  'आ': 'ఆ',
  'इ': 'ఇ',
  'ई': 'ఈ',
  'उ': 'ఉ',
  'ऊ': 'ఊ',
  'ऋ': 'ఋ',
  'ॠ': 'ౠ',
  'ऌ': 'ఌ',
  'ए': 'ఏ',
  'ऐ': 'ఐ',
  'ओ': 'ఓ',
  'औ': 'ఔ',
  'ा': 'ా',
  'ि': 'ి',
  'ी': 'ీ',
  'ु': 'ు',
  'ू': 'ూ',
  'ृ': 'ృ',
  'ॄ': 'ౄ',
  'ॢ': 'ఌ',
  'े': 'ే',
  'ै': 'ై',
  'ो': 'ో',
  'ौ': 'ౌ',
  'ं': 'ం',
  'ः': 'ః',
  'ँ': 'ఁ',
  'ऽ': 'ఽ',
  '्': '్',
  'क': 'క',
  'ख': 'ఖ',
  'ग': 'గ',
  'घ': 'ఘ',
  'ङ': 'ఙ',
  'च': 'చ',
  'छ': 'ఛ',
  'ज': 'జ',
  'झ': 'ఝ',
  'ञ': 'ఞ',
  'ट': 'ట',
  'ठ': 'ఠ',
  'ड': 'డ',
  'ढ': 'ఢ',
  'ण': 'ణ',
  'त': 'త',
  'थ': 'థ',
  'द': 'ద',
  'ध': 'ధ',
  'न': 'న',
  'प': 'ప',
  'फ': 'ఫ',
  'ब': 'బ',
  'भ': 'భ',
  'म': 'మ',
  'य': 'య',
  'र': 'ర',
  'ल': 'ల',
  'व': 'వ',
  'श': 'శ',
  'ष': 'ష',
  'स': 'స',
  'ह': 'హ',
  'ळ': 'ళ',
  'क्ष': 'క్ష',
  'ज्ञ': 'జ్ఞ',
  '०': '౦',
  '१': '౧',
  '२': '౨',
  '३': '౩',
  '४': '౪',
  '५': '౫',
  '६': '౬',
  '७': '౭',
  '८': '౮',
  '९': '౯',
  '।': '।',
  '॥': '॥',
};

const sortKandas = (kandas) =>
  [...kandas].sort((a, b) => {
    const ai = KANDA_ORDER.indexOf(a.slug);
    const bi = KANDA_ORDER.indexOf(b.slug);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

function parseHash() {
  const cleaned = location.hash.replace(/^#\/?/, '');
  const [kandaSlug, sarga, shloka] = cleaned.split('/');
  return {
    kandaSlug,
    sarga: sarga ? Number(sarga) : null,
    shloka: shloka ? Number(shloka) : null,
  };
}

function setHash(kandaSlug, sarga, shloka) {
  location.hash = `/${kandaSlug}/${sarga}${shloka ? `/${shloka}` : ''}`;
}

function getKandaLabel(kanda) {
  return KANDA_LABELS[kanda.slug] || kanda.name;
}

function transliterateSanskritToTelugu(text) {
  if (!text) {
    return '';
  }

  return text
    .replace(/क्ष/g, DEVANAGARI_TO_TELUGU['क्ष'])
    .replace(/ज्ञ/g, DEVANAGARI_TO_TELUGU['ज्ञ'])
    .split('')
    .map((char) => DEVANAGARI_TO_TELUGU[char] || char)
    .join('');
}

function renderSidebar(current) {
  const kandas = sortKandas(manifest.kandas);

  sidebarEl.innerHTML = `
    <h2>కాండలు మరియు సర్గలు</h2>
    ${kandas
      .map(
        (kanda) => `
      <details class="kanda" ${current.kandaSlug === kanda.slug ? 'open' : ''}>
        <summary>${getKandaLabel(kanda)} (${kanda.sarga_count} సర్గలు)</summary>
        <div class="sarga-links">
          ${kanda.sargas
            .map(
              (s) =>
                `<a href="#/${kanda.slug}/${s.sarga}" title="${s.shloka_count} శ్లోకాలు">సర్గ ${s.sarga}</a>`
            )
            .join('')}
        </div>
      </details>`
      )
      .join('')}
  `;
}

async function loadSarga(path) {
  if (cache.has(path)) return cache.get(path);
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  const data = await response.json();
  cache.set(path, data);
  return data;
}

function renderSargaNav(kanda, currentSarga) {
  const currentIndex = kanda.sargas.findIndex((s) => s.sarga === currentSarga.sarga);
  const prev = kanda.sargas[currentIndex - 1];
  const next = kanda.sargas[currentIndex + 1];

  sargaNavEl.innerHTML = `
    ${prev ? `<a href="#/${kanda.slug}/${prev.sarga}">మునుపటి సర్గ</a>` : ''}
    ${next ? `<a href="#/${kanda.slug}/${next.sarga}">తర్వాతి సర్గ</a>` : ''}
  `;
}

function renderShlokas(kanda, sargaData, route) {
  metaEl.textContent = `${getKandaLabel(kanda)} - సర్గ ${sargaData.sarga} - ${sargaData.shloka_count} శ్లోకాలు`;

  const selectedVerse =
    sargaData.shlokas.find((verse) => verse.shloka === route.shloka) || sargaData.shlokas[0];

  shlokaMenuEl.innerHTML = sargaData.shlokas
    .map(
      (verse) =>
        `<a class="${verse.shloka === selectedVerse.shloka ? 'active' : ''}" href="#/${kanda.slug}/${sargaData.sarga}/${verse.shloka}">${verse.shloka}</a>`
    )
    .join('');

  const selectedIndex = sargaData.shlokas.findIndex((verse) => verse.shloka === selectedVerse.shloka);
  const prevVerse = sargaData.shlokas[selectedIndex - 1];
  const nextVerse = sargaData.shlokas[selectedIndex + 1];

  verseNavEl.innerHTML = `
    ${prevVerse ? `<a href="#/${kanda.slug}/${sargaData.sarga}/${prevVerse.shloka}">మునుపటి శ్లోకం</a>` : ''}
    <span class="verse-indicator">శ్లోకం ${selectedVerse.shloka} / ${sargaData.shloka_count}</span>
    ${nextVerse ? `<a href="#/${kanda.slug}/${sargaData.sarga}/${nextVerse.shloka}">తర్వాతి శ్లోకం</a>` : ''}
  `;

  const teluguPronunciation = transliterateSanskritToTelugu(selectedVerse.shloka_text);

  shlokaListEl.innerHTML = `
    <section class="shloka-card" id="shloka-${selectedVerse.shloka}">
      <h3>శ్లోకం ${selectedVerse.shloka}</h3>
      <div class="shloka-text">${selectedVerse.shloka_text || 'N/A'}</div>
      ${teluguPronunciation ? `<div class="telugu-pronunciation"><strong>తెలుగు ఉచ్చారణ:</strong> ${teluguPronunciation}</div>` : ''}
      ${
        selectedVerse.telugu_translation
          ? `<div class="telugu-meaning"><strong>తెలుగు భావం:</strong> ${selectedVerse.telugu_translation}</div>`
          : ''
      }
      ${selectedVerse.transliteration ? `<div class="transliteration"><strong>Roman:</strong> ${selectedVerse.transliteration}</div>` : ''}
      ${selectedVerse.explanation ? `<div class="english-note"><strong>English note:</strong> ${selectedVerse.explanation}</div>` : ''}
    </section>
  `;
}

function defaultRoute() {
  const firstKanda = sortKandas(manifest.kandas)[0];
  const firstSarga = firstKanda.sargas[0];
  setHash(firstKanda.slug, firstSarga.sarga, 1);
}

async function renderFromRoute() {
  const route = parseHash();

  if (!route.kandaSlug || !route.sarga) {
    defaultRoute();
    return;
  }

  const kanda = manifest.kandas.find((item) => item.slug === route.kandaSlug);
  if (!kanda) {
    defaultRoute();
    return;
  }

  const sarga = kanda.sargas.find((item) => item.sarga === route.sarga);
  if (!sarga) {
    setHash(kanda.slug, kanda.sargas[0].sarga, 1);
    return;
  }

  renderSidebar(route);
  renderSargaNav(kanda, sarga);

  try {
    const sargaData = await loadSarga(sarga.path);
    if (!route.shloka || !sargaData.shlokas.some((verse) => verse.shloka === route.shloka)) {
      setHash(kanda.slug, sargaData.sarga, sargaData.shlokas[0].shloka);
      return;
    }

    renderShlokas(kanda, sargaData, route);
  } catch (error) {
    metaEl.textContent = 'ఎంచుకున్న సర్గను లోడ్ చేయలేకపోయాం.';
    shlokaMenuEl.innerHTML = '';
    verseNavEl.innerHTML = '';
    shlokaListEl.innerHTML = `<p>${error.message}</p>`;
  }
}

async function boot() {
  const response = await fetch('data/manifest.json');
  manifest = await response.json();
  renderSidebar(parseHash());
  window.addEventListener('hashchange', renderFromRoute);
  renderFromRoute();
}

boot();
