import { writeFileSync } from 'fs';
import VPK from '../build/util/vpk';
import { resolveMapVpkPath } from './vpk-source';

async function main() {
  const path = await resolveMapVpkPath();
  const vpk = new VPK(path);
  vpk.load();

  const lines: string[] = [`VPK: ${path}`, `Total files: ${vpk.files.length}`];

  const groups: Record<string, string[]> = {};
  for (const file of vpk.files) {
    const lower = file.toLowerCase();
    for (const key of ['abilities', 'npc_', 'localization', 'addon_', 'heroes', 'items', 'units']) {
      if (lower.includes(key)) {
        (groups[key] ??= []).push(file);
      }
    }
  }

  for (const [key, files] of Object.entries(groups)) {
    lines.push('', `${key} (${files.length}):`);
    for (const file of files.slice(0, 30)) lines.push(`  ${file}`);
    if (files.length > 30) lines.push(`  ... +${files.length - 30} more`);
  }

  writeFileSync('dumper/vpk-inspect.txt', lines.join('\n'), 'utf8');
  console.log(lines.slice(0, 80).join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
