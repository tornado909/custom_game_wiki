import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

export interface MapConfig {
  workshopId: string;
  mapTitle: string;
  gameDir?: string;
  contentDir?: string;
  vpkSearchPaths: string[];
}

const DEFAULT_CONFIG: MapConfig = {
  workshopId: '2841840871',
  mapTitle: 'Custom Map Wiki',
  gameDir: 'game',
  contentDir: 'content',
  vpkSearchPaths: ['vpk/2841840871_dir.vpk', 'vpk/2841840871.vpk'],
};

const moduleDir = dirname(fileURLToPath(import.meta.url));

function configCandidates(): string[] {
  const roots = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(process.cwd(), '../..'),
    moduleDir,
    resolve(moduleDir, '..'),
    resolve(moduleDir, '../..'),
  ];
  const paths = new Set<string>();
  for (const root of roots) {
    paths.add(join(root, 'map.config.json'));
  }
  return [...paths];
}

export function loadMapConfig(): MapConfig {
  for (const path of configCandidates()) {
    if (!existsSync(path)) continue;
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<MapConfig>;
    return {
      workshopId: parsed.workshopId ?? DEFAULT_CONFIG.workshopId,
      mapTitle: parsed.mapTitle ?? DEFAULT_CONFIG.mapTitle,
      gameDir: parsed.gameDir ?? DEFAULT_CONFIG.gameDir,
      contentDir: parsed.contentDir ?? DEFAULT_CONFIG.contentDir,
      vpkSearchPaths: parsed.vpkSearchPaths ?? DEFAULT_CONFIG.vpkSearchPaths,
    };
  }
  return DEFAULT_CONFIG;
}
