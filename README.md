# Run Escape

Credit to [https://jere.io/run-escape/](https://jere.io/run-escape/) ([@Dynrothe](https://github.com/Dynrothe/Run-Escape)).

---

## Custom Edition Additions & Differences

This repository extends [Dynrothe/Run-Escape](https://github.com/Dynrothe/Run-Escape) with multiplayer co-op, custom maps, quests, bosses, adventurers, weapons, OSRS music, mobile support, balance adjustments, and automated upstream synchronization:

- **2-4 Player Co-Op Multiplayer (`server/serve.py` & `src/custom/multiplayer/`)**:
  - Host-authoritative RFC 6455 WebSocket room relay (`OSRS-XXXX` room codes) across all 20 maps with synchronized waves, enemies, bosses, projectiles, 3D equipment/weapon model baking, per-weapon stances, power-ups (Sled, Giant rune essence, Evil Bob, Fairy ring, Drill Demon), overhead HP bars, chat, revives, spectator mode, persistent per-player lobby names, a **Lobby Ready Check** requiring all players to ready up before starting, and automatic **In-Game Lobby Locking** so latecomers cannot join or disrupt an active run.
  - Shared Co-Op XP scaling based on the Host's shop skills and pooled item/character XP bonuses divided across the party, unique casket item rolls per player, a Host-selectable Co-Op Difficulty Multiplier (`1x` - `3x`), live party HUD cards (levels, HP, active prayers, weapons, and passives), and a post-run **Co-Op Run Leaderboard** with individual damage and point scores.
- **Leaderboards, Level Top Score System & Challenge Modes**:
  - Dedicated **Leaderboard** screen on the Title menu and Map Select panel tracking top point score, best survival time, fastest boss clear, endless record, wins, and top kill count per map.
  - **Level Top Score System**: Run scores calculated from monsters slain, kill pace (kills/min), bosses defeated, fast boss clear speed, character level, survival time, and endless rounds, scaled by each map's difficulty multiplier (`1.00x` Lumbridge to `3.33x` The Inferno).
  - **Challenge Modes (Extreme One Chunk Man & Nightmare Man)**: Choose **Extreme One Chunk Man** (**2x** map difficulty for **1.5x** points) or **Nightmare Man** (**3x** map difficulty for **2.5x** points) on the Map Selection screen or in Co-Op lobbies.
- **Barbarian Village Campaign, Penance Fighter & New Weapons/Gear**:
  - **Barbarian Village (Gunnarsgrunn)** campaign map (unlocked after beating **Lumbridge**), spanning Barbarian Village, the Stronghold of Security, and Edgeville Dungeon against barbarian villagers, axe-throwers, shieldmaidens, berserkers, Ice Mountain wolves, Dwarven Mine scorpions, minotaurs, giant spiders, shades, and ankou, with five campaign bosses: **The Minotaur Warlord** (3:45), **Obor** (7:30), **Haakon the Champion** (9:30), **Bryophyta** (11:15), and **Chieftain Gunthor the Brave** (15:00).
  - Unlocks the **Penance Fighter** adventurer (clad in a **Fighter torso**, **Berserker helm**, **Penance skirt**, **Penance gloves**, and **Runner boots**, starting with a **Bronze battleaxe**), the **Battleaxe** weapon line (Bronze -> Dragon -> **Leaf-bladed battleaxe**), the **Zombie axe**, **Hill giant club**, **Bryophyta's staff**, **Skull sceptre**, **Fighter torso**, and all four Fremennik helmets (**Berserker helm**, **Warrior helm**, **Archer helm**, and **Seers helm**).
- **Fight Caves Map & Overhead Protection Prayers (`Q` / `E` / `R`)**:
  - Custom **Fight Caves** map featuring **TzTok-Jad** (6:00) and **TzKal-Zuk** (12:00), with toggleable OSRS Overhead Protection Prayers (**Protect from Magic**, **Protect from Missiles**, **Protect from Melee**) to block boss attacks.
- **Cook's Assistant Quest & Slayer Tasks**:
  - Playable **Cook's Assistant** quest in Lumbridge (`src/custom/cooks-assistant.js`): speak to the Lumbridge Cook and gather an **Egg**, **Bucket of Milk**, and **Pot of Flour** across Lumbridge for bonus XP, coins, an **Antique Lamp**, and a reward casket.
  - **Slayer Tasks & Slayer Masters**: The progression checklist tab and HUD tracker feature **Slayer Tasks** grouped by OSRS Slayer Masters (**Turael**, **Mazchna**, **Krystilia**, **Sumona**, **Vannaka**, **Duradel**, **Konar quo Maten**, **Chaeldar**, **Aya**, **Nieve**, **Steve**, **TzHaar-Ket-Keh**, and **Spria**).
- **Secret Adventurers, Claws Weapon Line, Evolutions & Combat Balance**:
  - Secret-code adventurers in **Settings -> Save & Codes**: **Dipper the Corgi** (`dipperthedog`, Bork Wave), **Elias the Chihuahua** (`barkelly`, Ankle Bite), and **Nova the Cat** (`novathecat`, Neite starting with **Dragon claws**, custom pounce/chase/death animations).
  - **Bronze through Dragon Claws**: Added the **Claws** weapon line (**Bronze** -> **Iron** -> **Steel** -> **Black** -> **Mithril** -> **Adamant** -> **Rune** -> **Dragon claws**, evolving into **Burning claws** with the **Tome of fire**) with double-slash attacks (`60%` + `100%` damage per swing).
  - **Blood Burst -> Blood Barrage** evolution (paired with Rapid Heal, full multi-target AoE radius matching Ice Burst and Ice Barrage), rebalanced **Rapid Heal** (`+2.5 HP/min` per level, paused for 5s on hit), buffed **Saradomin brew** / **Sanfew serum**, enhanced **God Wars Dungeon Faction Warfare** (`14`-tile aggro range, inter-faction ranged/magic projectiles, XP bone drops from faction kills), and **Unreachable Loot Recovery** (pickups dropped over impassable terrain slide onto the nearest walkable tile).
- **Full OSRS Soundtrack, Mobile Browser Support & Quality of Life**:
  - **Full OSRS Soundtrack**: Added OSRS music tracks across the Title screen (**Scape Main**) and all 20 campaign and fun maps (**Harmony**, **Barbarianism**, **Dangerous Way**, **Wilderness**, **Arabian**, **Rellekka**, **Jungle Troubles**, **March of the Shayzien**, **Mistrock**, **The Curtain Closes**, **Armageddon**, **Elven Seed**, **Inferno**, **Fire and Brimstone**, **The Trade Parade**, **Adventure**, **Massacre**, **Last Man Standing**, **Melodrama**, and **Null and Void**).
  - **Android & iOS Mobile Browser Support**: Floating **Virtual Touch Thumbstick** for movement, **two-finger pinch-to-zoom**, **Fullscreen** mode with automatic landscape lock and hardware safe-area inset support (`100dvh` / `visualViewport`), PWA web app manifest, on-screen **Full / Pause** HUD buttons, tap-to-inspect item and slot tooltips, and responsive UI scaling (**0.45x - 2x**).
  - **Armoury & Settings**: **Refund all** button in the Armoury, **UI Scale** options (**Auto**, **0.5x** - **2x**), **Music** volume slider, **Tile Coordinates** HUD toggle, **Secret code** redemption, an **About** section in Settings linking to the [GitHub repository](https://github.com/jnpike93/run-escape), and disabled browser right-click context menu in the game viewport.
 
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
pick on a level up, where **R** rerolls and **X** skips for coins), **Esc** pauses, **Q** shows or hides the quest tracker, **M** mutes and the
mouse wheel zooms.

On a phone or tablet, hold it sideways and drag anywhere to move. The buttons on screen pause and
use your items, and everything else is a tap.

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

