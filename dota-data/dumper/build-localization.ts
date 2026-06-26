import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { extractLocalizationTokens, readResolvedKvRoot, withMapContext } from './vpk-kv';

async function buildLocalization() {
  await withMapContext(async (ctx) => {
    console.log(`Reading map data from: ${ctx.source.label}`);

    const byLanguage: Record<string, Record<string, string>> = {};

    const locFiles = ctx.listFiles(
      (file) =>
        (file.startsWith('resource/localization/') && file.endsWith('.txt')) ||
        (file.startsWith('resource/') && /^resource\/addon_[^/]+\.txt$/i.test(file)) ||
        (file.startsWith('panorama/localization/') && file.endsWith('.txt')),
    );
    console.log(`Found ${locFiles.length} localization files`);

    for (const filePath of locFiles) {
      const fileName = filePath.split('/').pop()!.replace('.txt', '');
      let language: string | null = null;

      if (fileName.startsWith('addon_')) {
        language = fileName.slice('addon_'.length).replace(/_old$/i, '');
      } else {
        const lastUnderscore = fileName.lastIndexOf('_');
        if (lastUnderscore !== -1) {
          language = fileName.slice(lastUnderscore + 1);
        }
      }
      if (!language) continue;

      const root = readResolvedKvRoot(ctx, filePath);
      const tokens = extractLocalizationTokens(root);
      if (!tokens || Object.keys(tokens).length === 0) continue;

      if (!byLanguage[language]) byLanguage[language] = {};
      Object.assign(byLanguage[language], tokens);
    }

    const outDir = join('files', 'localization');
    mkdirSync(outDir, { recursive: true });

    const languages = Object.keys(byLanguage).sort();
    for (const language of languages) {
      const tokens = byLanguage[language];
      const outPath = join(outDir, `${language}.json`);
      writeFileSync(outPath, JSON.stringify(tokens, null, 2), 'utf8');
      console.log(`✔ ${language}: ${Object.keys(tokens).length} tokens → ${outPath}`);
    }

    writeFileSync(join(outDir, '_languages.json'), JSON.stringify(languages, null, 2), 'utf8');
    console.log(`✔ Done. Wrote ${languages.length} language files to ${outDir}`);
  });
}

buildLocalization().catch((error) => {
  console.error(error);
  process.exit(1);
});
