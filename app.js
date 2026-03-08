const sidebarEl = document.getElementById('sidebar');
const metaEl = document.getElementById('meta');
const sargaNavEl = document.getElementById('sargaNav');
const shlokaMenuEl = document.getElementById('shlokaMenu');
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

function renderSidebar(current) {
  const kandas = sortKandas(manifest.kandas);

  sidebarEl.innerHTML = `
    <h2>All Chapters (Sargas)</h2>
    ${kandas
      .map(
        (kanda) => `
      <details class="kanda" ${current.kandaSlug === kanda.slug ? 'open' : ''}>
        <summary>${kanda.name} (${kanda.sarga_count} chapters)</summary>
        <div class="sarga-links">
          ${kanda.sargas
            .map(
              (s) =>
                `<a href="#/${kanda.slug}/${s.sarga}" title="${s.shloka_count} shlokas">S${s.sarga}</a>`
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
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  const data = await response.json();
  cache.set(path, data);
  return data;
}

function renderSargaNav(kanda, currentSarga) {
  const currentIndex = kanda.sargas.findIndex((s) => s.sarga === currentSarga.sarga);
  const prev = kanda.sargas[currentIndex - 1];
  const next = kanda.sargas[currentIndex + 1];

  sargaNavEl.innerHTML = `
    ${prev ? `<a href="#/${kanda.slug}/${prev.sarga}">Prev Chapter</a>` : ''}
    ${next ? `<a href="#/${kanda.slug}/${next.sarga}">Next Chapter</a>` : ''}
  `;
}

function renderShlokas(kanda, sargaData) {
  metaEl.textContent = `${kanda.name} - Chapter (Sarga) ${sargaData.sarga} - ${sargaData.shloka_count} shlokas`;

  shlokaMenuEl.innerHTML = sargaData.shlokas
    .map((verse) => `<a href="#/${kanda.slug}/${sargaData.sarga}/${verse.shloka}">${verse.shloka}</a>`)
    .join('');

  shlokaListEl.innerHTML = sargaData.shlokas
    .map(
      (verse) => `
      <section class="shloka-card" id="shloka-${verse.shloka}">
        <h3>Shloka ${verse.shloka}</h3>
        <div class="shloka-text">${verse.shloka_text || 'N/A'}</div>
        ${verse.transliteration ? `<div class="transliteration">${verse.transliteration}</div>` : ''}
        ${verse.translation ? `<div class="translation"><strong>Meaning:</strong> ${verse.translation}</div>` : ''}
        ${verse.explanation ? `<div class="explanation"><strong>Explanation:</strong> ${verse.explanation}</div>` : ''}
        ${verse.comments ? `<div class="comments"><strong>Comments:</strong> ${verse.comments}</div>` : ''}
      </section>
    `
    )
    .join('');
}

function defaultRoute() {
  const firstKanda = sortKandas(manifest.kandas)[0];
  const firstSarga = firstKanda.sargas[0];
  setHash(firstKanda.slug, firstSarga.sarga);
}

async function renderFromRoute() {
  const route = parseHash();

  if (!route.kandaSlug || !route.sarga) {
    defaultRoute();
    return;
  }

  const kanda = manifest.kandas.find((k) => k.slug === route.kandaSlug);
  if (!kanda) {
    defaultRoute();
    return;
  }

  const sarga = kanda.sargas.find((s) => s.sarga === route.sarga);
  if (!sarga) {
    setHash(kanda.slug, kanda.sargas[0].sarga);
    return;
  }

  renderSidebar(route);
  renderSargaNav(kanda, sarga);

  try {
    const sargaData = await loadSarga(sarga.path);
    renderShlokas(kanda, sargaData);

    if (route.shloka) {
      const target = document.getElementById(`shloka-${route.shloka}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  } catch (error) {
    metaEl.textContent = 'Unable to load selected chapter.';
    shlokaMenuEl.innerHTML = '';
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
