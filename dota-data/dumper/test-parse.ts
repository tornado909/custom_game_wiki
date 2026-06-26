import VPK from '../build/util/vpk';
import { deserialize, isKvObject, KVObject } from 'valve-kv';
import { resolveMapVpkPath } from './vpk-source';

async function main() {
  const path = await resolveMapVpkPath();
  const vpk = new VPK(path);
  vpk.load();

  const paths = [
    'scripts/npc/npc_abilities_custom.txt',
    'scripts/npc/npc_items_custom.txt',
    'scripts/npc/npc_heroes_custom.txt',
    'scripts/npc/npc_units_custom.txt',
    'resource/addon_english.txt',
    'resource/addon_russian.txt',
  ];

  for (const filePath of paths) {
    console.log(filePath, vpk.files.includes(filePath) ? 'YES' : 'NO');
    if (!vpk.files.includes(filePath)) continue;
    const text = vpk.getFile(filePath).toString('utf8');
    console.log('  size', text.length);
    try {
      const parsed = deserialize(text);
      const rootKey = Object.keys(parsed)[0];
      const root = parsed[rootKey] as KVObject;
      console.log('  root', rootKey, 'entries', isKvObject(root) ? Object.keys(root).length : 'n/a');
    } catch (error) {
      console.log('  parse error', error);
    }
  }

  const heroFiles = vpk.files.filter(
    (file) => file.startsWith('scripts/npc/abilities/') && file.endsWith('.txt'),
  );
  console.log('hero ability files', heroFiles.length);
}

main().catch(console.error);
