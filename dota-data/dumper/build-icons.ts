import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { withMapContext } from './vpk-kv';

const moduleDir = dirname(fileURLToPath(import.meta.url));

const IMAGE_DIRS = [
  { prefix: 'panorama/images/spellicons/', subdir: 'spellicons' },
  { prefix: 'resource/flash3/images/spellicons/', subdir: 'spellicons' },
  { prefix: 'panorama/images/items/', subdir: 'items' },
  { prefix: 'resource/flash3/images/items/', subdir: 'items' },
  { prefix: 'panorama/images/heroes/', subdir: 'heroes' },
  { prefix: 'resource/flash3/images/heroes/', subdir: 'heroes' },
];

function wikiImagesDir(): string {
  const candidates = [
    resolve(process.cwd(), '../moddota.github.io/public/images'),
    resolve(process.cwd(), 'moddota.github.io/public/images'),
    resolve(moduleDir, '../../moddota.github.io/public/images'),
  ];
  for (const path of candidates) {
    if (existsSync(resolve(path, '..'))) return path;
  }
  return candidates[0];
}

function outputName(filePath: string): string {
  const name = basename(filePath);
  if (name.endsWith('_png.png')) return name;
  if (name.endsWith('.png')) return name.replace(/\.png$/i, '_png.png');
  if (name.endsWith('.vtex_c')) return name.replace(/\.vtex_c$/i, '_png.png');
  return `${name}_png.png`;
}

function isImageFile(filePath: string): boolean {
  return filePath.endsWith('.png') || filePath.endsWith('.vtex_c') || filePath.endsWith('_png.png');
}

async function buildIcons() {
  await withMapContext(async (ctx) => {
    console.log(`Reading map data from: ${ctx.source.label}`);

    const outRoot = wikiImagesDir();
    for (const subdir of ['spellicons', 'items', 'heroes']) {
      const target = join(outRoot, subdir);
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    }

    let copied = 0;
    const seen = new Set<string>();

    for (const { prefix, subdir } of IMAGE_DIRS) {
      const outDir = join(outRoot, subdir);
      mkdirSync(outDir, { recursive: true });

      for (const filePath of ctx.listFiles(
        (file) => file.startsWith(prefix) && isImageFile(file),
      )) {
        const outName = outputName(filePath);
        const dedupeKey = `${subdir}/${outName}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const outPath = join(outDir, outName);
        try {
          writeFileSync(outPath, ctx.readBuffer(filePath));
          copied += 1;
        } catch (error) {
          console.warn(`  Warning: failed to extract ${filePath}: ${error}`);
        }
      }
    }

    const manifestPath = join('files', 'images-manifest.json');
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          source: ctx.source.label,
          copied,
          outputDir: outRoot,
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(`✔ Extracted ${copied} images → ${outRoot}`);
  });
}

buildIcons().catch((error) => {
  console.error(error);
  process.exit(1);
});
