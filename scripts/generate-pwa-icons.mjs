import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../public/icons');
const publicDir = path.join(__dirname, '../public');
const source = path.join(__dirname, '../docs/icon-preview/concept-a.png');

const targets = [
  { name: 'icon-512.png', size: 512, pad: 0 },
  { name: 'icon-256.png', size: 256, pad: 0 },
  { name: 'icon-192.png', size: 192, pad: 0 },
  { name: 'icon-128.png', size: 128, pad: 0 },
  { name: 'icon-96.png', size: 96, pad: 0 },
  { name: 'icon-72.png', size: 72, pad: 0 },
  { name: 'icon-48.png', size: 48, pad: 0 },
  { name: 'apple-touch-icon.png', size: 180, pad: 0 },
  { name: 'icon-512-maskable.png', size: 512, pad: 0.12 },
  { name: 'favicon-32.png', size: 32, pad: 0 },
  { name: 'favicon-48.png', size: 48, pad: 0 },
];

fs.mkdirSync(outDir, { recursive: true });

async function renderIcon({ name, size, pad }) {
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round((size - inner) / 2);
  let rendered = sharp(source).resize(inner, inner, { fit: 'cover' });
  if (pad > 0) {
    rendered = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 3, g: 6, b: 15, alpha: 1 },
      },
    }).composite([{ input: await rendered.png().toBuffer(), left: offset, top: offset }]);
  }
  await rendered.png().toFile(path.join(outDir, name));
  console.log(`wrote ${name}`);
}

for (const target of targets) {
  await renderIcon(target);
}

await sharp(source).resize(32, 32, { fit: 'cover' }).png().toFile(path.join(publicDir, 'favicon.png'));
console.log('wrote favicon.png');
