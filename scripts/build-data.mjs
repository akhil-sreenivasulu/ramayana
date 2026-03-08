import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.join(root, 'raw', 'Valmiki_Ramayan_Shlokas.json');
const outputRoot = path.join(root, 'data');

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const raw = fs.readFileSync(inputPath, 'utf8');
const rows = JSON.parse(raw);

const grouped = new Map();

for (const row of rows) {
  const kandaName = row.kanda?.trim() || 'Unknown Kanda';
  const sargaNumber = Number(row.sarga) || 0;
  const shlokaNumber = Number(row.shloka) || 0;
  const kandaSlug = slugify(kandaName);

  if (!grouped.has(kandaSlug)) {
    grouped.set(kandaSlug, {
      name: kandaName,
      slug: kandaSlug,
      sargas: new Map(),
    });
  }

  const kanda = grouped.get(kandaSlug);

  if (!kanda.sargas.has(sargaNumber)) {
    kanda.sargas.set(sargaNumber, []);
  }

  kanda.sargas.get(sargaNumber).push({
    shloka: shlokaNumber,
    shloka_text: row.shloka_text || '',
    transliteration: row.transliteration || '',
    translation: row.translation || '',
    explanation: row.explanation || '',
    comments: row.comments || '',
  });
}

if (fs.existsSync(outputRoot)) {
  fs.rmSync(outputRoot, { recursive: true, force: true });
}
fs.mkdirSync(outputRoot, { recursive: true });

const manifest = {
  generated_at: new Date().toISOString(),
  source: 'https://github.com/AshuVj/Valmiki_Ramayan_Dataset',
  totals: {
    kandas: grouped.size,
    sargas: 0,
    shlokas: rows.length,
  },
  kandas: [],
};

const sortedKandas = [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));

for (const kanda of sortedKandas) {
  const kandaDir = path.join(outputRoot, kanda.slug);
  fs.mkdirSync(kandaDir, { recursive: true });

  const sargaEntries = [...kanda.sargas.entries()].sort((a, b) => a[0] - b[0]);
  const sargaManifest = [];

  for (const [sargaNumber, shlokas] of sargaEntries) {
    shlokas.sort((a, b) => a.shloka - b.shloka);
    const fileName = `sarga-${sargaNumber}.json`;
    const filePath = path.join(kandaDir, fileName);

    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          kanda: kanda.name,
          kanda_slug: kanda.slug,
          sarga: sargaNumber,
          shloka_count: shlokas.length,
          shlokas,
        },
        null,
        2
      )
    );

    sargaManifest.push({
      sarga: sargaNumber,
      shloka_count: shlokas.length,
      path: `data/${kanda.slug}/${fileName}`,
    });

    manifest.totals.sargas += 1;
  }

  manifest.kandas.push({
    name: kanda.name,
    slug: kanda.slug,
    sarga_count: sargaManifest.length,
    shloka_count: sargaManifest.reduce((sum, item) => sum + item.shloka_count, 0),
    sargas: sargaManifest,
  });
}

fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Generated ${manifest.totals.kandas} kandas, ${manifest.totals.sargas} sargas, ${manifest.totals.shlokas} shlokas.`);
