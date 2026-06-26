import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { isKvObject, KVObject } from 'valve-kv';
import { readResolvedKvRoot, withMapContext } from './vpk-kv';
import type { MapContext } from './map-source';

const GENERIC_MODIFIERS = new Set<string>([
  'modifier_attack_immune',
  'modifier_attribute_bonus',
  'modifier_bashed',
  'modifier_break',
  'modifier_debuff_immune',
  'modifier_disarmed',
  'modifier_hidden',
  'modifier_invulnerable',
  'modifier_magic_immune',
  'modifier_muted',
  'modifier_phased',
  'modifier_rooted',
  'modifier_silence',
  'modifier_stunned',
  'modifier_lua',
  'modifier_lua_horizontal_motion',
  'modifier_lua_vertical_motion',
  'modifier_lua_motion_both',
  'modifier_datadriven',
]);

const MODIFIER_PATTERN = /\b(modifier_[a-z0-9_]+)\b/gi;

function collectModifiersFromText(text: string, bucket: Set<string>): void {
  for (const match of text.matchAll(MODIFIER_PATTERN)) {
    bucket.add(match[1].toLowerCase());
  }
}

function collectModifiersFromKv(value: unknown, bucket: Set<string>): void {
  if (typeof value === 'string') {
    collectModifiersFromText(value, bucket);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectModifiersFromKv(item, bucket);
    return;
  }
  if (isKvObject(value)) {
    for (const nested of Object.values(value)) collectModifiersFromKv(nested, bucket);
  }
}

function collectModifiersFromMap(ctx: MapContext): Set<string> {
  const modifiers = new Set<string>();

  for (const filePath of ctx.listFiles()) {
    if (!filePath.startsWith('scripts/vscripts/')) continue;
    if (!/\.(lua|txt)$/i.test(filePath)) continue;
    try {
      collectModifiersFromText(ctx.readText(filePath), modifiers);
    } catch {
      // ignore unreadable entries
    }
  }

  const kvPaths = [
    'scripts/npc/npc_abilities_custom.txt',
    'scripts/npc/npc_abilities.txt',
    'scripts/npc/npc_abilities_override.txt',
    'scripts/npc/npc_items_custom.txt',
    'scripts/npc/items.txt',
    'scripts/npc/npc_units_custom.txt',
    'scripts/npc/npc_units.txt',
    'scripts/npc/npc_heroes_custom.txt',
    'scripts/npc/npc_heroes.txt',
  ];
  for (const path of kvPaths) {
    const root = readResolvedKvRoot(ctx, path);
    if (root) collectModifiersFromKv(root, modifiers);
  }

  for (const filePath of ctx.listFiles(
    (f) =>
      (f.startsWith('scripts/npc/abilities/') || f.startsWith('scripts/npc/heroes/')) &&
      f.endsWith('.txt'),
  )) {
    const root = readResolvedKvRoot(ctx, filePath);
    if (root) collectModifiersFromKv(root, modifiers);
  }

  const dumpPath = join('dumper', 'dump');
  if (existsSync(dumpPath)) {
    for (const line of readFileSync(dumpPath, 'utf8').split(/\r?\n/)) {
      if (line.startsWith('modifier_')) modifiers.add(line.trim().toLowerCase());
    }
  }

  return modifiers;
}

function heroKeyFromUnitName(unitName: string): string | null {
  const match = unitName.match(/^npc_dota_hero_(.+)$/);
  return match?.[1] ?? null;
}

async function buildModifiers() {
  await withMapContext(async (ctx) => {
    console.log(`Reading map data from: ${ctx.source.label}`);

  const heroesPath = join('files', 'heroes.json');
  const abilitiesPath = join('files', 'abilities.json');
  const abilityHeroMapPath = join('files', 'ability-hero-map.json');

  const heroes: Record<string, KVObject> = existsSync(heroesPath)
    ? JSON.parse(readFileSync(heroesPath, 'utf8'))
    : {};
  const abilities: Record<string, unknown> = existsSync(abilitiesPath)
    ? JSON.parse(readFileSync(abilitiesPath, 'utf8'))
    : {};
  const abilityHeroMap: Record<string, string> = existsSync(abilityHeroMapPath)
    ? JSON.parse(readFileSync(abilityHeroMapPath, 'utf8'))
    : {};

  const heroKeys = new Set<string>();
  for (const heroName of Object.keys(heroes)) {
    const key = heroKeyFromUnitName(heroName);
    if (key) heroKeys.add(key);
  }
  for (const hero of Object.values(abilityHeroMap)) heroKeys.add(hero);

  const itemNames = Object.keys(abilities).filter((name) => name.startsWith('item_'));
  const abilityNames = Object.keys(abilities).filter(
    (name) => !name.startsWith('item_') && !name.startsWith('special_bonus'),
  );

  const allModifiers = [...collectModifiersFromMap(ctx)].sort();
  const result: Record<string, string[]> = {
    generic: [],
    items: [],
    other: [],
  };
  for (const hero of heroKeys) result[hero] = [];

  const pushTo = (group: string, mod: string) => {
    if (!result[group]) result[group] = [];
    result[group].push(mod);
  };

  for (const mod of allModifiers) {
    if (GENERIC_MODIFIERS.has(mod)) {
      result.generic.push(mod);
      continue;
    }

    let assigned = false;
    for (const item of itemNames) {
      const itemBase = item.replace(/^item_/, '');
      if (
        mod.includes(`modifier_${itemBase}`) ||
        mod.includes(`modifier_${item}`) ||
        mod.includes('modifier_item_')
      ) {
        result.items.push(mod);
        assigned = true;
        break;
      }
    }
    if (assigned) continue;

    for (const hero of heroKeys) {
      if (mod === `modifier_${hero}` || mod.startsWith(`modifier_${hero}_`)) {
        pushTo(hero, mod);
        assigned = true;
        break;
      }
    }
    if (assigned) continue;

    for (const ability of abilityNames.sort((a, b) => b.length - a.length)) {
      const body = mod.slice('modifier_'.length);
      if (body === ability || body.startsWith(`${ability}_`)) {
        const hero = abilityHeroMap[ability];
        pushTo(hero && heroKeys.has(hero) ? hero : 'other', mod);
        assigned = true;
        break;
      }
      const hero = abilityHeroMap[ability];
      if (hero && ability.startsWith(`${hero}_`)) {
        const suffix = ability.slice(hero.length + 1);
        if (suffix.length >= 4 && (body === suffix || body.startsWith(`${suffix}_`))) {
          pushTo(hero, mod);
          assigned = true;
          break;
        }
      }
    }
    if (assigned) continue;

    for (const hero of heroKeys) {
      if (mod.includes(`_${hero}_`) || mod.endsWith(`_${hero}`)) {
        pushTo(hero, mod);
        assigned = true;
        break;
      }
    }
    if (!assigned) result.other.push(mod);
  }

  for (const key of Object.keys(result)) {
    result[key] = [...new Set(result[key])].sort();
  }

  const outPath = join('files', 'vscripts', 'modifier_list.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

  const totalAssigned = Object.values(result).reduce((acc, arr) => acc + arr.length, 0);
  console.log(
    `✔ Grouped ${totalAssigned} modifiers (${result.other.length} unassigned) → ${outPath}`,
  );
  });
}

buildModifiers().catch((error) => {
  console.error(error);
  process.exit(1);
});
