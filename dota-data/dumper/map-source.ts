import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import VPK from '../build/util/vpk';
import { loadMapConfig } from './map-config';
import { resolveMapVpkPath } from './vpk-source';

const moduleDir = dirname(fileURLToPath(import.meta.url));

export type MapSourceKind = 'folders' | 'vpk';

export interface MapSource {
  kind: MapSourceKind;
  label: string;
  gameRoot: string | null;
  contentRoot: string | null;
  vpk: VPK | null;
  vpkPath: string | null;
}

export interface MapContext {
  source: MapSource;
  kvRoot: string;
  listFiles: (predicate?: (path: string) => boolean) => string[];
  exists: (internalPath: string) => boolean;
  readBuffer: (internalPath: string) => Buffer;
  readText: (internalPath: string) => string;
  resolvePath: (internalPath: string) => string | null;
}

const CONTENT_PREFIXES = [
  'panorama/',
  'maps/',
  'materials/',
  'models/',
  'particles/',
  'sounds/',
  'soundevents/',
];

function projectRoots(): string[] {
  return [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(process.cwd(), '../..'),
    moduleDir,
    resolve(moduleDir, '..'),
    resolve(moduleDir, '../..'),
  ];
}

function resolveFolder(name: string, envVar: string, configPath?: string): string | null {
  if (process.env[envVar]) {
    const fromEnv = resolve(process.env[envVar]!);
    if (existsSync(fromEnv)) return fromEnv;
  }
  if (configPath) {
    for (const root of projectRoots()) {
      const path = resolve(root, configPath);
      if (existsSync(path) && statSync(path).isDirectory()) return path;
    }
  }
  for (const root of projectRoots()) {
    const path = resolve(root, name);
    if (existsSync(path) && statSync(path).isDirectory()) return path;
  }
  return null;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function isContentPath(internalPath: string): boolean {
  const normalized = normalizePath(internalPath);
  return CONTENT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function walkDirectory(absoluteDir: string, relativePrefix: string, out: Map<string, string>): void {
  if (!existsSync(absoluteDir)) return;

  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const normalized = normalizePath(relPath);
      if (entry.isDirectory()) {
        walk(fullPath, normalized);
      } else {
        out.set(normalized, fullPath);
      }
    }
  };

  walk(absoluteDir, normalizePath(relativePrefix));
}

function buildFolderIndex(source: MapSource): Map<string, string> {
  const index = new Map<string, string>();
  if (source.gameRoot) walkDirectory(source.gameRoot, '', index);
  if (source.contentRoot) walkDirectory(source.contentRoot, '', index);
  return index;
}

export function resolveInternalPath(source: MapSource, index: Map<string, string>, internalPath: string): string | null {
  const normalized = normalizePath(internalPath);
  const fromIndex = index.get(normalized);
  if (fromIndex) return fromIndex;

  if (source.kind !== 'folders') return null;

  if (isContentPath(normalized)) {
    if (source.contentRoot) {
      const contentPath = join(source.contentRoot, normalized);
      if (existsSync(contentPath)) return contentPath;
    }
    if (source.gameRoot) {
      const gamePath = join(source.gameRoot, normalized);
      if (existsSync(gamePath)) return gamePath;
    }
    return null;
  }

  if (source.gameRoot) {
    const gamePath = join(source.gameRoot, normalized);
    if (existsSync(gamePath)) return gamePath;
  }

  return null;
}

export async function resolveMapSource(): Promise<MapSource> {
  const config = loadMapConfig();
  const gameRoot = resolveFolder('game', 'GAME_DIR', config.gameDir);
  const contentRoot = resolveFolder('content', 'CONTENT_DIR', config.contentDir);

  if (gameRoot || contentRoot) {
    return {
      kind: 'folders',
      label: `game${gameRoot ? ` (${gameRoot})` : ''} + content${contentRoot ? ` (${contentRoot})` : ''}`,
      gameRoot,
      contentRoot,
      vpk: null,
      vpkPath: null,
    };
  }

  const vpkPath = await resolveMapVpkPath();
  const vpk = new VPK(vpkPath);
  vpk.load();
  return {
    kind: 'vpk',
    label: vpkPath,
    gameRoot: null,
    contentRoot: null,
    vpk,
    vpkPath,
  };
}

export async function openMapContext(): Promise<MapContext> {
  const source = await resolveMapSource();
  const folderIndex = source.kind === 'folders' ? buildFolderIndex(source) : null;

  const listFiles = (predicate?: (path: string) => boolean): string[] => {
    const files = source.vpk ? source.vpk.files : [...(folderIndex?.keys() ?? [])];
    return predicate ? files.filter(predicate) : files;
  };

  const exists = (internalPath: string): boolean => {
    const normalized = normalizePath(internalPath);
    if (source.vpk) return source.vpk.files.includes(normalized);
    return folderIndex?.has(normalized) ?? false;
  };

  const resolvePath = (internalPath: string): string | null => {
    if (source.vpk) return exists(internalPath) ? internalPath : null;
    return resolveInternalPath(source, folderIndex!, internalPath);
  };

  const readBuffer = (internalPath: string): Buffer => {
    if (source.vpk) return source.vpk.getFile(normalizePath(internalPath));
    const absolutePath = resolvePath(internalPath);
    if (!absolutePath) throw new Error(`File not found: ${internalPath}`);
    return readFileSync(absolutePath);
  };

  const kvRoot =
    source.kind === 'folders' && source.gameRoot
      ? source.gameRoot
      : resolve('dumper', '.kv-cache');

  return {
    source,
    kvRoot,
    listFiles,
    exists,
    resolvePath,
    readBuffer,
    readText: (internalPath: string) => readBuffer(internalPath).toString('utf8'),
  };
}
