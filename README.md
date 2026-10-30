# Run Escape

Credit to [https://jere.io/run-escape/](https://jere.io/run-escape/) ([@Dynrothe](https://github.com/Dynrothe/Run-Escape)).

---

## Custom Edition Additions & Differences

This repository extends [Dynrothe/Run-Escape](https://github.com/Dynrothe/Run-Escape) with multiplayer co-op, custom maps, quests, bosses, balance adjustments, and automated upstream synchronization:

- **2-4 Player Co-Op Multiplayer (`serve.py` & `assets/multiplayer/`)**:
  - Host-authoritative RFC 6455 WebSocket room relay (`OSRS-XXXX` room codes) with synchronized waves, enemies, bosses, projectiles, 3D equipment/weapon model baking, overhead HP bars, chat, revives, spectator mode, persistent per-player lobby names, and a live party infograph (showing player levels, HP, weapons, and passives) plus a post-run Co-Op Damage Leaderboard.
  - Shared Co-Op XP scaling based on the Host's shop skills and pooled item/character XP bonuses divided across the party, unique casket item rolls per player, and a Host-selectable Co-Op Difficulty Multiplier (`1x` - `3x`).
- **Fight Caves Map & Overhead Protection Prayers (`Q` / `E` / `R`)**:
  - Custom **Fight Caves** map featuring **TzTok-Jad** (6:00) and **TzKal-Zuk** (12:00), with toggleable OSRS Overhead Protection Prayers (**Protect from Magic**, **Protect from Missiles**, **Protect from Melee**) to block boss attacks.
- **Cook's Assistant Quest & Slayer Tasks**:
  - Playable **Cook's Assistant** quest in Lumbridge (`assets/cooks-assistant.js`): speak to the Lumbridge Cook and gather an **Egg**, **Bucket of Milk**, and **Pot of Flour** across Lumbridge for bonus XP, coins, an **Antique Lamp**, and a reward casket.
  - Renamed the progression checklist tab and HUD tracker to **Slayer Tasks**.
- **Level Best Times Leaderboard**:
  - Dedicated **Leaderboard** screen on the Title menu and Map Select panel tracking best survival time, fastest boss clear, endless record, wins, and top kill count per map.
- **Custom Adventurers, Evolutions & Balance Adjustments**:
  - Secret-code adventurers **Dipper the Corgi** (`dipperthedog`, Bork Wave) and **Elias the Chihuahua** (`barkelly`, Ankle Bite).
  - **Blood Burst -> Blood Barrage** evolution (paired with Rapid Heal, matched to Ice Barrage's `3.8` radius), rebalanced **Rapid Heal** (`+2.5 HP/min` per level, paused for 5s on hit), and buffed **Saradomin brew** / **Sanfew serum**.
- **Quality of Life & Automated Upstream Sync**:
  - **UI Scale** (**Auto**, **1x**, **1.25x**, **1.5x**, **1.75x**, **2x**) and **Tile Coordinates** HUD toggles in Settings, plus disabled browser right-click context menu in the game viewport.
 
> **[!IMPORTANT] AGENT DIRECTIVE (Antigravity, Jules, Claude Code, GitHub Copilot, Cursor, Codex, Windsurf)**
> If you are an automated coding agent or AI assistant reading or modifying this repository, you MUST strictly follow the protocol in [`AGENTS.md`](./AGENTS.md):
> 1. **Read First**: Read [`AGENTS.md`](./AGENTS.md), [`docs/AGENT_NOTES.md`](./docs/AGENT_NOTES.md), and [`.jules/sentinel.md`](./.jules/sentinel.md) BEFORE making any edits or resolving merge conflicts.
> 2. **Source-First Build & Cache-Busting**: Edit TypeScript source in [`src/`](./src/) and run `npm run build` (`vite build && node scripts/sync_dist.cjs`) to synchronize `?v=X.Y` across [`index.html`](./index.html) and [`assets/`](./assets/).
> 3. **Leave a Handoff Note**: Before finishing your task, commit, or PR, update [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) and prepend a structured entry under `## 3. Chronological Agent Handoff Log` in [`docs/AGENT_NOTES.md`](./docs/AGENT_NOTES.md).

---

## Original Project Overview

A Vampire Survivors-style game set in the real Old School RuneScape world, in the browser.

Run around Lumbridge while hordes of chickens, goblins, zombies and ghosts close in, pick up their
bones to level up, and survive fifteen minutes until the Wise Old Man comes for you. Beat him and
the Barrows opens up, then the Wilderness, and on through the Kharidian Desert, the Fremennik
Province, Karamja, Kourend, Varlamore, Morytania, the God Wars Dungeon and Prifddinas to the
Inferno.

Everything you see comes straight from the OSRS game cache: the map, every NPC and its animations,
your character (built from body kits and worn items), item icons, spell effects and sounds. It's
built on [rs-map-viewer](https://github.com/dennisdev/rs-map-viewer), the code behind
[osrs.world](https://osrs.world).

> Run Escape is a fan project. It isn't affiliated with or endorsed by Jagex. Old School RuneScape
> and everything in its game cache belong to Jagex, and the cache isn't part of this repository:
> you download it yourself (see below).

## What's in it

- **12 campaign maps**, each opened by beating the one before, each with its own monsters, three
  mid-run bosses and a final boss: from the Wise Old Man and the Barrows brothers to the King
  Black Dragon, TzTok-Jad, Vorkath, Nex, the Corrupted Hunllef and three JalTok-Jads at once.
- **6 fun maps**, open from the start and endless: the Grand Exchange's scammers, East Varrock's
  F2P pkers past the Wilderness Ditch, Falador on 6 June 2006, Last Man Standing, Castle Wars and
  Pest Control.
- **33 adventurers**, each with a starting weapon and a bonus, unlocked by beating maps and doing
  tasks on them.
- **Weapons that upgrade the OSRS way** (bronze to dragon, Fire Strike to Fire Wave) and
  **evolve** with the right passive (a maxed dragon scimitar with Piety becomes the Abyssal whip),
  plus raid weapons from the Scythe of Vitur to Tumeken's shadow, and a Godsword whose hilt you
  pick.
- **Gear from reward caskets**, worn on your character, with **set bonuses** (Void, Torva, Virtus,
  Inquisitor's, Crystal) and an **Armoury** to upgrade it for good between runs.
- **Endless mode** for every map you've beaten, **skills** to train with the coins you bank, and
  **quests** that pay out over many runs.

[docs/GAMEPLAY.md](docs/GAMEPLAY.md) goes through all of it, map by map. [docs/CHANGELOG.md](docs/CHANGELOG.md)
has what changed in each version.

## You can play the game at https://jere.io/run-escape

## Cache version

The game is built on one Old School RuneScape cache, and only runs on that one: every NPC, item,
animation and spot animation id in `src/game/content/` was checked against it.

| Cache                 | Game build        | Date              | OpenRS2 Archive                                                 |
| --------------------- | ----------------- | ----------------- | --------------------------------------------------------------- |
| `osrs-241_2026-09-30` | OSRS revision 241 | 30 September 2026 | [cache 2727](https://archive.openrs2.org/caches/runescape/2727) |

It's set by `GAME_CACHE_NAME` in [`src/game/cache.ts`](src/game/cache.ts), and a test checks this
table names the same cache. Moving to a newer cache means checking the content against it first
(`scripts/cache/validate-decoders.ts`, `check-items.ts` and `check-fun-outfits.ts` help), then
changing both.

## Getting started

You need [Node.js](https://nodejs.org/) 20 or newer.

```sh
npm install
npm run download-caches
npm start
```

and open http://localhost:5173.

`npm run download-caches` fetches the game's cache (see [Cache version](#cache-version)) from the
[OpenRS2 Archive](https://archive.openrs2.org/) into `caches/`; you can also copy a `caches/` folder
over from another checkout. The first load copies the 227 MB cache into
the browser's cache storage, so later loads are quick.

### Controls

**WASD** or the arrow keys to move; weapons fire on their own. **1-4** use your utility items (and
pick on a level up), **Esc** pauses, **Q** shows or hides the quest tracker, **M** mutes and the
mouse wheel zooms.

### Tests and tools

```sh
npm test                   # the game's tests (vitest)
npx tsc --noEmit -p .      # type check
npm run lint               # format everything with Prettier
```

`scripts/game/simulate-run.ts` has a bot play full runs for balancing, and `scripts/cache/` has
tools for finding NPCs, items, animations and scenery in the cache.
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) lists them all, with how the code is laid out and how
to host a build.

## Hosting

```sh
npm run build
npm run slim-cache
```

writes the game to `dist/` with a slim copy of the cache in `dist/caches/` (only what the game
reads, about 26 MB instead of 227 MB). The page has to be served with
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, over
HTTPS. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#hosting) has the details, with nginx and Apache
examples.

## Contributing

Issues and pull requests are welcome.

- Format with Prettier (`npm run lint`), and keep `npm test` and the type check passing.
- Content is plain data in `src/game/content/`, with real cache ids; the tools in `scripts/cache/`
  find them. After changing content, `npm run slim-cache` checks that everything it needs is in the
  cache.
- Note what you change under a version in [docs/CHANGELOG.md](docs/CHANGELOG.md). It's written for players,
  and the game shows it on its title screen.

## Credits

- Jagex, for Old School RuneScape
- [dennisdev/rs-map-viewer](https://github.com/dennisdev/rs-map-viewer) (BSD-2-Clause, see
  [LICENSE](LICENSE))
- [RuneLite](https://github.com/runelite/runelite)
- [OpenRS2 Archive](https://archive.openrs2.org/) and [RuneScape Archive](https://rs-archive.github.io/) - caches
- [OSRS Wiki](https://oldschool.runescape.wiki/) - item spawns and sound ids
- [2004scape](https://github.com/2004scape/Server) and [2009scape](https://gitlab.com/2009scape/2009scape) - NPC spawns
- [RuneStar](https://github.com/RuneStar/fonts) - fonts
- [Blurite](https://github.com/blurite/pathfinder) - pathfinding
- [RuneApps Model Viewer](https://github.com/skillbert/rsmv) - procedural textures

## License

[BSD-2-Clause](LICENSE).

## Getting started

You need [Node.js](https://nodejs.org/) 20 or newer.

```sh
npm install
npm run download-caches
npm start
```

and open http://localhost:5173.

`npm run download-caches` fetches the game's cache (see [Cache version](#cache-version)) from the
[OpenRS2 Archive](https://archive.openrs2.org/) into `caches/`; you can also copy a `caches/` folder
over from another checkout. The first load copies the 227 MB cache into
the browser's cache storage, so later loads are quick.

### Controls

**WASD** or the arrow keys to move; weapons fire on their own. **1-4** use your utility items (and
pick on a level up), **Esc** pauses, **Q** shows or hides the quest tracker, **M** mutes and the
mouse wheel zooms.

### Tests and tools

```sh
npm test                   # the game's tests (vitest)
npx tsc --noEmit -p .      # type check
npm run lint               # format everything with Prettier
```

`scripts/game/simulate-run.ts` has a bot play full runs for balancing, and `scripts/cache/` has
tools for finding NPCs, items, animations and scenery in the cache.
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) lists them all, with how the code is laid out and how
to host a build.

## Hosting

```sh
npm run build
npm run slim-cache
```

writes the game to `dist/` with a slim copy of the cache in `dist/caches/` (only what the game
reads, about 26 MB instead of 227 MB). The page has to be served with
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, over
HTTPS. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#hosting) has the details, with nginx and Apache
examples.

## Contributing

Issues and pull requests are welcome.

- Format with Prettier (`npm run lint`), and keep `npm test` and the type check passing.
- Content is plain data in `src/game/content/`, with real cache ids; the tools in `scripts/cache/`
  find them. After changing content, `npm run slim-cache` checks that everything it needs is in the
  cache.
- Note what you change under a version in [docs/CHANGELOG.md](docs/CHANGELOG.md). It's written for players,
  and the game shows it on its title screen.

## Credits

- Jagex, for Old School RuneScape
- [dennisdev/rs-map-viewer](https://github.com/dennisdev/rs-map-viewer) (BSD-2-Clause, see
  [LICENSE](LICENSE))
- [RuneLite](https://github.com/runelite/runelite)
- [OpenRS2 Archive](https://archive.openrs2.org/) and [RuneScape Archive](https://rs-archive.github.io/) - caches
- [OSRS Wiki](https://oldschool.runescape.wiki/) - item spawns and sound ids
- [2004scape](https://github.com/2004scape/Server) and [2009scape](https://gitlab.com/2009scape/2009scape) - NPC spawns
- [RuneStar](https://github.com/RuneStar/fonts) - fonts
- [Blurite](https://github.com/blurite/pathfinder) - pathfinding
- [RuneApps Model Viewer](https://github.com/skillbert/rsmv) - procedural textures

## License

[BSD-2-Clause](LICENSE).

