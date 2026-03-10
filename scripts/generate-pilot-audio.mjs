import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const sourcePath = path.join(root, 'data', 'sundara-kanda', 'sarga-1.json');
const outputDir = path.join(root, 'assets', 'audio', 'sundara-kanda', 'sarga-1');
const tempDir = path.join(root, 'tmp-audio');
const manifestPath = path.join(root, 'data', 'audio-manifest.json');

const DEVANAGARI_TO_ASCII = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ii', 'उ': 'u', 'ऊ': 'uu', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'm', 'ः': 'h', 'ँ': 'm', '्': '',
  'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'nga',
  'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'nya',
  'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na',
  'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
  'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
  'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va',
  'श': 'sha', 'ष': 'sha', 'स': 'sa', 'ह': 'ha', 'ळ': 'la',
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  '।': '.', '॥': '.',
};

function transliterateDevanagari(text) {
  if (!text) return '';
  return text
    .replace(/क्ष/g, 'ksha')
    .replace(/ज्ञ/g, 'gya')
    .replace(/[0-9]/g, (digit) => digit)
    .split('')
    .map((char) => DEVANAGARI_TO_ASCII[char] ?? char)
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/\.+/g, '.')
    .trim();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

ensureDir(outputDir);
ensureDir(tempDir);

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const verses = source.shlokas.slice(0, 10);

const baseManifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : {};

for (const verse of verses) {
  const narrationText = [
    `Shloka ${verse.shloka}.`,
    transliterateDevanagari(verse.shloka_text),
    'Meaning.',
    verse.explanation || verse.telugu_translation || verse.translation || '',
  ]
    .filter(Boolean)
    .join(' ');

  const textPath = path.join(tempDir, `sundara-1-${verse.shloka}.txt`);
  const voiceAiff = path.join(tempDir, `voice-${verse.shloka}.aiff`);
  const droneWav = path.join(tempDir, `drone-${verse.shloka}.wav`);
  const outputMp3 = path.join(outputDir, `shloka-${verse.shloka}.mp3`);

  fs.writeFileSync(textPath, narrationText);

  run('say', ['-v', 'Rishi', '-r', '155', '-f', textPath, '-o', voiceAiff]);

  run('/opt/homebrew/bin/ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'sine=frequency=146.83:sample_rate=44100:duration=40',
    '-f', 'lavfi',
    '-i', 'sine=frequency=220:sample_rate=44100:duration=40',
    '-f', 'lavfi',
    '-i', 'sine=frequency=293.66:sample_rate=44100:duration=40',
    '-filter_complex',
    '[0:a]volume=0.08[a0];[1:a]volume=0.05[a1];[2:a]volume=0.04[a2];[a0][a1][a2]amix=inputs=3:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st=36:d=4[a]',
    '-map', '[a]',
    droneWav,
  ]);

  run('/opt/homebrew/bin/ffmpeg', [
    '-y',
    '-stream_loop', '-1',
    '-i', droneWav,
    '-i', voiceAiff,
    '-filter_complex',
    '[0:a]volume=0.35[bg];[1:a]volume=2.0,adelay=300|300[voice];[bg][voice]amix=inputs=2:duration=shortest:dropout_transition=2[a]',
    '-map', '[a]',
    '-c:a', 'libmp3lame',
    '-q:a', '2',
    outputMp3,
  ]);

  baseManifest[`sundara-kanda||1||${verse.shloka}`] = {
    path: `assets/audio/sundara-kanda/sarga-1/shloka-${verse.shloka}.mp3`,
    label: `Pilot audio for Sundara Kanda Sarga 1 Shloka ${verse.shloka}`,
  };

  console.log(`Generated audio for shloka ${verse.shloka}`);
}

fs.writeFileSync(manifestPath, JSON.stringify(baseManifest, null, 2));
console.log(`Saved audio manifest to ${manifestPath}`);
