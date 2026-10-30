# Changelog

What's changed in Run Escape, newest first. The game shows this on its title screen too (click
the version in the corner), so it's written for players.

## Custom Edition Updates (v8.5)

### Co-Op Multiplayer, Combat & Balance Updates

- **Player Level on Infograph & Leaderboard**: Added live player levels (`Lv.X`) to each player's Co-Op party infograph card and the post-run Co-Op Damage Leaderboard.
- **Weapon Animation & 3D Equipment Sync**: Fixed melee slash/sweep animations so they render around the attacking player rather than all players, removed duplicate aura/spotAnim playback on Guests, and ensured each player's starting and upgraded weapons render in their hands with preserved cooldowns.
- **Shared Co-Op XP & Host Skills**: Synchronized Co-Op XP gains using the Host's shop skills (`upgrades`), and pooled item/character XP bonuses across all players in the lobby divided by the party size (`1 + hostMetaGrowth + sum(itemGrowth) / partySize`).
- **Unique Single Casket Rolls**: Fixed duplicate script bundling and casket pickup handling so each casket opens once and grants each player one unique chest item (including Armoury-upgraded gear exclusions).
- **Walking Animation Priority**: Prioritized walking/running animations over attack animations while moving so characters never slide in an attack pose.
- **Persistent Lobby Player Names**: Custom player names are now saved and restored per player slot when returning to a lobby or reconnecting.
- **Antique Lamp Co-Op Split**: Rubbing an Antique Lamp grants `100%` of 1 level in solo play and splits XP into `1/x` of a level across all `x` players on the level in multiplayer.
- **Blood Barrage & Blood Burst Radius**: Aligned Blood Barrage (`area: 3.8`) and Blood Burst (`area: 2.3 -> 2.6 -> 2.9`) with Ice Barrage and Ice Burst so they target the same screen area and monster count.
- **Guest Spawn Deduplication**: Fixed duplicate WebSocket slot registration and added `peer_leaving` cleanup so Guests never see duplicate player entities at spawn.
- **Slayer Tasks Tab & Slayer Masters**: Renamed the Quests checklist tab, HUD tracker, and completion notices to **Slayer Tasks** (leaving **Cook's Assistant** in Lumbridge as the game's quest), grouped by OSRS Slayer Masters (**Turael**, **Mazchna**, **Krystilia**, **Sumona**, **Vannaka**, **Duradel**, **Konar quo Maten**, **Chaeldar**, **Aya**, **Nieve**, **Steve**, **TzHaar-Ket-Keh**, and **Spria**) with OSRS Slayer assignment names.
- **Guest Utility Items & Combat Stats**: Fixed **Bonecrusher**, **Red/Black Chinchompas**, self-damaging potions (**Overload**, **Zamorak brew**), ground Magnets, and casket gear/potion combat stats for Co-Op Guests.
- **Armoury Refund Option**: Added a **Refund all** button to the Armoury screen to refund all coins spent on casket gear upgrades and reset Armoury upgrade tiers.
- **Upstream-Compatible Repository Structure**: Normalized repository line endings via `.gitattributes`, aligned `package-lock.json` with upstream, separated `docs/CHANGELOG.md` from upstream `CHANGELOG.md`, modularized custom content and secret codes into `src/game/content/custom/`, separated hand-authored runtime scripts into `src/custom/` (with gated `debug-mode.js` and Vitest unit tests in `src/custom/multiplayer/multiplayer.test.ts`), added typed `Window` declarations in `src/game/types/globals.d.ts`, and extracted `LeaderboardScreen.tsx` and `CoopGameOverSection.tsx` into standalone UI components.
- **UI Scale Options**: Added **1.75x** and **2x** UI Scale options in Settings (**Auto**, **1x**, **1.25x**, **1.5x**, **1.75x**, **2x**).
- **Co-Op Difficulty Multiplier**: Fixed boss special attacks and enemy explosions ignoring the Co-Op damage multiplier (`damageScale`), prevented double-rounding damage loss on normal enemies, and added a Host-selectable Difficulty Multiplier (`1x` - `3x`) in the Co-Op Lobby.

## Custom Edition Updates (v8.4)

### Architecture & Build Pipeline

- **Source-Based TypeScript + Vite Migration**: Migrated the repository to the full unminified TypeScript + React + Vite source base (`src/`, `vite.config.ts`, `package.json`, `scripts/sync_dist.cjs`) with `upstream` tracking `https://github.com/Dynrothe/Run-Escape.git`. Running `npm run build` compiles `src/` and synchronizes the production bundles into `assets/` and `index.html`.
- **Automated Upstream Cron Sync (`scripts/auto_sync_upstream.cjs`)**: Added hourly automated `upstream/main` merge, Vite bundle rebuild, cache-busting bump, test suite verification, and PM2 service reload via `/etc/cron.d/run-escape-upstream-sync` on `cuteanimegirls.moe` and `.github/workflows/sync-upstream.yaml`.
- **PM2 CommonJS Config Compatibility (`ecosystem.config.cjs`)**: Renamed `ecosystem.config.js` to `ecosystem.config.cjs` and updated `.github/workflows/deploy.yaml` and `nginx.conf` so PM2 loads the CommonJS ecosystem configuration cleanly alongside `"type": "module"` in `package.json`.
- **Repository & Asset Cleanup**: Removed 64.5 MB of superseded OSRS slim caches, obsolete pre-TypeScript bundle patch scripts (`scripts/patches/`), and duplicate WASM/favicon assets.

### Balance & Combat Adjustments

- **Rapid Heal**: Rebalanced to **+2.5 HP/min per level** (+12.5 HP/min at level 5). Taking any hit pauses Rapid Heal regeneration for **5 seconds**.
- **Blood Burst -> Blood Barrage**: Evolve Blood Burst into Blood Barrage!

### New Content & Modes

- **Co-Op Multiplayer & Damage Leaderboard**: Co-Op rooms with synchronized waves, enemies, bosses, shared ground loot, revives, overhead chat, and a live party Damage Dealt HUD leaderboard (now supporting all `0.14.0` maps, adventurers, and bosses).
- **Level Best Times Leaderboard**: View your best survival time, fastest boss clear, endless record, wins, and top kill count for every level from the Title screen **Leaderboard** menu and Map Select panel.
- **Fight Caves & Inferno Bosses**: Enter the **Fight Caves** map, complete with **Protection Prayers (Q / E / R)** to block Magic, Ranged, and Melee boss attacks.
- **Cook's Assistant Quest (Lumbridge)**: Speak to the Lumbridge Cook and gather an **Egg**, **Bucket of Milk**, and **Pot of Flour** across Lumbridge to complete the quest for bonus XP, coins, and a guaranteed chest.
- **Secret Adventurers & Codes**: Redeem secret codes in **Settings -> Save & Codes** to unlock **Dipper the Corgi** (Bork Wave), **Elias the Chihuahua** (Ankle Bite), or all adventurers, levels, and Endless mode.

### Quality of Life

- **Pause Menu & HUD**: Hovering weapons, passives, and equipment in the Pause menu displays item effects exclusively in the dedicated Pause menu info box without a duplicate floating tooltip. Added **UI Scale** (**Auto**, **1x**, **1.25x**, **1.5x**) and **Tile Coordinates** toggles in Settings.
