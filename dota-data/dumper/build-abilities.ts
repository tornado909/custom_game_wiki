import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { KVObject } from 'valve-kv';
import { mergeKvRoots, parseNumbersRecursive, removeDuplicates } from './kv-utils';
import { readResolvedKvRoot, withMapContext } from './vpk-kv';

function heroKeyFromAbilityFile(filePath: string): string | null {
  const match =
    filePath.match(/scripts\/npc\/abilities\/heroes\/[^/]+\/hero_(\w+)\.txt$/) ||
    filePath.match(/scripts\/npc\/heroes\/npc_dota_hero_(\w+)\.txt$/);
  return match?.[1] ?? null;
}

async function buildAbilities() {
  await withMapContext(async (ctx) => {
    console.log(`Reading map data from: ${ctx.source.label}`);

    const root: KVObject = {};
    const abilityHeroMap: Record<string, string> = {};

    const basePaths = [
      'scripts/npc/npc_abilities_custom.txt',
      'scripts/npc/npc_abilities.txt',
      'scripts/npc/npc_abilities_override.txt',
    ];
    for (const path of basePaths) {
      const baseRoot = readResolvedKvRoot(ctx, path);
      if (baseRoot) {
        mergeKvRoots(root, baseRoot);
        console.log(`Loaded ${path}`);
      }
    }

    const heroFiles = ctx.listFiles(
      (file) =>
        (file.startsWith('scripts/npc/abilities/') || file.startsWith('scripts/npc/heroes/')) &&
        file.endsWith('.txt'),
    );
    console.log(`Found ${heroFiles.length} hero ability files`);

    for (const filePath of heroFiles) {
      const heroName = heroKeyFromAbilityFile(filePath);
      const heroRoot = readResolvedKvRoot(ctx, filePath);
      if (!heroRoot) continue;
      for (const [key, value] of Object.entries(heroRoot)) {
        if (key === 'Version') continue;
        root[key] = value;
        if (heroName) abilityHeroMap[key] = heroName;
      }
    }

    const itemPaths = ['scripts/npc/npc_items_custom.txt', 'scripts/npc/items.txt'];
    for (const path of itemPaths) {
      const itemsRoot = readResolvedKvRoot(ctx, path);
      if (itemsRoot) {
        mergeKvRoots(root, itemsRoot);
        console.log(`Loaded ${path}`);
      }
    }

    parseNumbersRecursive(root);
    removeDuplicates(root);

    const outPath = join('files', 'abilities.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(root, null, 2), 'utf8');

    const mapPath = join('files', 'ability-hero-map.json');
    writeFileSync(mapPath, JSON.stringify(abilityHeroMap, null, 2), 'utf8');

    const count = Object.keys(root).length;
    console.log(`✔ Extracted ${count} abilities + items → ${outPath}`);
    console.log(`✔ Hero map: ${Object.keys(abilityHeroMap).length} abilities → ${mapPath}`);
  });
}

buildAbilities().catch((error) => {
  console.error(error);
  process.exit(1);
});
