const fs = require('fs');
const p = require('path');
const { execSync } = require('child_process');

const __dir = p.resolve(__dirname, '..');

function findDotaDataDir() {
  for (const rel of ['./dota-data', '../dota-data', '../../dota-data']) {
    const src = p.resolve(__dir, rel);
    if (fs.existsSync(src)) return src;
  }
  return null;
}

function copyDotaData(src) {
  const dst = p.resolve(__dir, 'node_modules/@moddota/dota-data');
  for (const dir of ['files', 'lib']) {
    const from = p.join(src, dir);
    const to = p.join(dst, dir);
    if (fs.existsSync(from)) {
      if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
      fs.cpSync(from, to, { recursive: true });
      console.log('Copied', dir, 'from', src);
    }
  }

  const localizationSrc = p.join(src, 'files', 'localization');
  const localizationDst = p.resolve(__dir, 'public/localization-data');
  if (fs.existsSync(localizationSrc)) {
    if (fs.existsSync(localizationDst)) {
      fs.rmSync(localizationDst, { recursive: true, force: true });
    }
    fs.cpSync(localizationSrc, localizationDst, { recursive: true });
    console.log('Copied localization to public/localization-data');
  }
}

function clearCaches() {
  for (const dir of ['.astro', 'node_modules/.vite']) {
    const full = p.resolve(__dir, dir);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log('Cleared cache:', dir);
    }
  }
}

const dotaDataDir = findDotaDataDir();
if (!dotaDataDir) {
  console.warn('dota-data directory not found — skipping data build');
  process.exit(0);
}

console.log('Cleaning old generated files...');
execSync('node scripts/clean-generated.cjs', { cwd: __dir, stdio: 'inherit' });

console.log('Building map data from game/content folders (or VPK fallback)...');
try {
  execSync('npm run build', { cwd: dotaDataDir, stdio: 'inherit' });
} catch (error) {
  console.error('\nBuild failed. Link game/content folders or place the map VPK in vpk/.\n');
  process.exit(1);
}

copyDotaData(dotaDataDir);
clearCaches();
