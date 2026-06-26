import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { KVObject } from 'valve-kv';
import { mergeKvRoots, parseNumbersRecursive, removeDuplicates } from './kv-utils';
import { readResolvedKvRoot, withMapContext } from './vpk-kv';

async function buildUnits() {
  await withMapContext(async (ctx) => {
    console.log(`Reading map data from: ${ctx.source.label}`);

    const result: KVObject = {};

    const unitPaths = ['scripts/npc/npc_units_custom.txt', 'scripts/npc/npc_units.txt'];
    for (const path of unitPaths) {
      const unitsRoot = readResolvedKvRoot(ctx, path);
      if (unitsRoot) {
        mergeKvRoots(result, unitsRoot);
        console.log(`Loaded ${path}`);
      }
    }

    const heroPaths = ['scripts/npc/npc_heroes_custom.txt', 'scripts/npc/npc_heroes.txt'];
    for (const path of heroPaths) {
      const heroesRoot = readResolvedKvRoot(ctx, path);
      if (heroesRoot) {
        mergeKvRoots(result, heroesRoot);
        console.log(`Loaded ${path}`);
      }
    }

    parseNumbersRecursive(result);
    removeDuplicates(result);

    const outPath = join('files', 'units.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

    const count = Object.keys(result).length;
    console.log(`✔ Extracted ${count} units/heroes → ${outPath}`);

    const heroes: KVObject = {};
    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith('npc_dota_hero_')) {
        heroes[key] = value;
      }
    }

    const heroesPath = join('files', 'heroes.json');
    writeFileSync(heroesPath, JSON.stringify(heroes, null, 2), 'utf8');
    console.log(`✔ Extracted ${Object.keys(heroes).length} heroes → ${heroesPath}`);
  });
}

buildUnits().catch((error) => {
  console.error(error);
  process.exit(1);
});
