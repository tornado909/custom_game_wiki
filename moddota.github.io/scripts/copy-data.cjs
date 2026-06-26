const fs = require('fs');
const p = require('path');

const __dir = p.resolve(__dirname, '..');

for (const rel of ['./dota-data', '../dota-data', '../../dota-data']) {
  const src = p.resolve(__dir, rel);
  if (!fs.existsSync(src)) continue;

  const dst = p.resolve(__dir, 'node_modules/@moddota/dota-data');
  for (const dir of ['files', 'lib']) {
    const from = p.join(src, dir);
    const to = p.join(dst, dir);
    if (fs.existsSync(from)) {
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
  break;
}
