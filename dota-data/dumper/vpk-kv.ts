import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { deserializeFile, isKvObject, KVObject } from 'valve-kv';
import { openMapContext, type MapContext } from './map-source';

let cachedContext: MapContext | null = null;

function primeVpkKvCache(ctx: MapContext): string {
  const cacheDir = resolve('dumper', '.kv-cache');
  if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });

  const prefixes = ['scripts/npc/', 'resource/', 'panorama/localization/'];
  for (const filePath of ctx.listFiles()) {
    if (!prefixes.some((prefix) => filePath.startsWith(prefix))) continue;
    if (!filePath.endsWith('.txt')) continue;
    const outPath = join(cacheDir, filePath);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, ctx.readBuffer(filePath));
  }

  return cacheDir;
}

export async function withMapContext<T>(
  run: (ctx: MapContext) => T | Promise<T>,
): Promise<T> {
  const ctx = await openMapContext();
  if (ctx.source.kind === 'vpk') {
    ctx.kvRoot = primeVpkKvCache(ctx);
  }
  cachedContext = ctx;
  return run(ctx);
}

export function readResolvedKvRoot(ctx: MapContext, internalPath: string): KVObject | null {
  const filePath =
    ctx.source.kind === 'folders'
      ? ctx.resolvePath(internalPath)
      : join(ctx.kvRoot, internalPath);

  if (!filePath || !existsSync(filePath)) return null;

  try {
    const parsed = deserializeFile(filePath);
    const rootKey = Object.keys(parsed)[0];
    return parsed[rootKey] as KVObject;
  } catch (error) {
    console.warn(`  Warning: failed to parse ${internalPath}: ${error}`);
    return null;
  }
}

export function extractLocalizationTokens(root: KVObject | null): Record<string, string> | null {
  if (!root || !isKvObject(root)) return null;
  const tokensRaw = root.Tokens ?? root.tokens;
  if (!tokensRaw || !isKvObject(tokensRaw)) return null;
  const tokens: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokensRaw)) {
    if (typeof key === 'string' && typeof value === 'string' && !key.startsWith('[english]')) {
      tokens[key] = value;
    }
  }
  return tokens;
}

/** @deprecated use withMapContext */
export const withKvCache = withMapContext;
