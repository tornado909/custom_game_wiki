const fs = require('fs');
const p = require('path');

function rm(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log('Removed', target);
  }
}

function cleanDotaData(root) {
  rm(p.join(root, 'dumper', '.kv-cache'));
  rm(p.join(root, 'files', 'localization'));
  rm(p.join(root, 'files', 'vscripts'));
  rm(p.join(root, 'files', 'abilities.json'));
  rm(p.join(root, 'files', 'ability-hero-map.json'));
  rm(p.join(root, 'files', 'heroes.json'));
  rm(p.join(root, 'files', 'units.json'));
  rm(p.join(root, 'files', 'images-manifest.json'));
}

function cleanWikiAssets(wikiRoot) {
  rm(p.resolve(wikiRoot, 'public', 'localization-data'));
  for (const subdir of ['spellicons', 'items', 'heroes']) {
    rm(p.resolve(wikiRoot, 'public', 'images', subdir));
  }
}

function findRoots(startDir) {
  const dotaData = ['dota-data', '../dota-data', '../../dota-data']
    .map((rel) => p.resolve(startDir, rel))
    .find((dir) => fs.existsSync(dir));
  const wiki = ['.', '..'].map((rel) => p.resolve(startDir, rel)).find((dir) => fs.existsSync(p.join(dir, 'astro.config.mjs')));
  return { dotaData, wiki: wiki ?? startDir };
}

const { dotaData, wiki } = findRoots(p.resolve(__dirname, '..'));
if (dotaData) cleanDotaData(dotaData);
if (wiki) cleanWikiAssets(wiki);
