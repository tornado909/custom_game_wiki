import { existsSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { findSteamAppById } from '@moddota/find-steam-app';
import VPK from '../build/util/vpk';
import { loadMapConfig } from './map-config';

const moduleDir = dirname(fileURLToPath(import.meta.url));

function isDirectoryVpk(filePath: string): boolean {
  return /_dir\.vpk$/i.test(filePath) || statSync(filePath).size > 1024;
}

function collectVpkCandidates(configPaths: string[]): string[] {
  const candidates: string[] = [];

  if (process.env.CUSTOM_VPK_PATH) {
    candidates.push(resolve(process.env.CUSTOM_VPK_PATH));
  }

  const roots = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(process.cwd(), '../..'),
    moduleDir,
    resolve(moduleDir, '..'),
    resolve(moduleDir, '../..'),
  ];

  for (const relativePath of configPaths) {
    for (const root of roots) {
      candidates.push(resolve(root, relativePath));
    }
  }

  return candidates;
}

async function workshopCandidates(workshopId: string): Promise<string[]> {
  const dota2Dir = await findSteamAppById(570);
  if (!dota2Dir) return [];

  const paths: string[] = [];
  const workshopRoot = join(dota2Dir, '..', 'workshop', 'content', '570', workshopId);
  if (existsSync(workshopRoot)) {
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.vpk$/i.test(entry.name)) {
          paths.push(fullPath);
        }
      }
    };
    walk(workshopRoot);
  }

  const addonRoot = join(dota2Dir, 'game', 'dota_addons');
  if (existsSync(addonRoot)) {
    for (const entry of readdirSync(addonRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const addonDir = join(addonRoot, entry.name);
      for (const file of readdirSync(addonDir)) {
        if (/\.vpk$/i.test(file)) {
          paths.push(join(addonDir, file));
        }
      }
    }
  }

  return paths;
}

function prioritizeVpk(paths: string[]): string[] {
  const existing = paths.filter((path) => existsSync(path));
  return existing.sort((a, b) => {
    const score = (path: string) => {
      let value = 0;
      if (/_dir\.vpk$/i.test(path)) value += 100;
      if (/2841840871/i.test(path)) value += 50;
      if (/pak01_dir\.vpk$/i.test(path)) value -= 100;
      return value;
    };
    return score(b) - score(a);
  });
}

export async function resolveMapVpkPath(): Promise<string> {
  const config = loadMapConfig();
  const candidates = prioritizeVpk([
    ...collectVpkCandidates(config.vpkSearchPaths),
    ...(await workshopCandidates(config.workshopId)),
  ]);

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    if (!isDirectoryVpk(path)) continue;
    return path;
  }

  throw new Error(
    [
      'Could not locate custom map VPK.',
      `Workshop ID: ${config.workshopId}`,
      'Place the map VPK at one of:',
      ...config.vpkSearchPaths.map((p) => `  - ${p}`),
      'Or set CUSTOM_VPK_PATH to the full path of *_dir.vpk',
    ].join('\n'),
  );
}

export async function openMapVpk(): Promise<{ vpk: VPK; path: string }> {
  const path = await resolveMapVpkPath();
  const vpk = new VPK(path);
  vpk.load();
  return { vpk, path };
}
