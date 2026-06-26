# map-data

Extracts game data from a custom Dota 2 workshop map VPK for the wiki site.

## Build

Place the map VPK in `../vpk/2841840871_dir.vpk` (see `map.config.json`), then:

```bash
npm ci
npm run build
```

Or set `CUSTOM_VPK_PATH` to point at the VPK file directly.

## Build steps

1. `build:abilities` — NPC abilities, hero files, items
2. `build:units` — NPC units and heroes
3. `build:modifiers` — modifiers from Lua scripts and KV
4. `build:localization` — `addon_*.txt` and `resource/localization/*`
5. `build:icons` — spell/item/hero images into the wiki `public/images/`
6. `build:tsc` — TypeScript schemas used by the site
