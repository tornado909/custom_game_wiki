# Custom Map Wiki

Technical wiki for workshop map **2841840871** (Thunder's COT RPG Old School).

## Data source

The build reads addon files directly from linked folders (preferred):

| Folder | Contents |
|--------|----------|
| `game/` | scripts, resource, localization, flash3 images |
| `content/` | panorama, maps, panorama images |

Create symlinks with `make_symlinks.bat`, or set `GAME_DIR` / `CONTENT_DIR` env vars.

If `game/` or `content/` are missing, the build falls back to `vpk/2841840871.vpk`.

## Setup

```bash
# 1. Link addon folders (Windows)
make_symlinks.bat

# 2. Install dependencies
cd dota-data && npm ci
cd ../moddota.github.io && npm ci

# 3. Start wiki (cleans old data, rebuilds, copies to site)
cd moddota.github.io
npm run dev
```

## Features

- **Abilities / Modifiers / Units** from NPC KV (`#base` includes supported)
- **Localization** browse + **Compare** mode (missing keys between languages)
- **Icons** from game/content image folders

`npm run dev` removes previously generated files before each rebuild so only current addon data is shown.

## Manual rebuild

```bash
cd dota-data
npm run build
cd ../moddota.github.io
node scripts/copy-data.cjs
```

Config: `map.config.json`
