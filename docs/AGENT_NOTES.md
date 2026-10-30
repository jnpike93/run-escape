# Run Escape - Cross-Agent Handoff Notes & Bundle Patch Map

> **Instructions for All Agents**: Read the **Active Bundle & Hook Registry** and the most recent entries in the **Chronological Agent Handoff Log** before starting work. When your task is complete, prepend a new entry at the top of the log using the template below.

---

## 1. Active Bundle & Hook Registry

### Current Active Asset Files (Version `?v=8.5` - Source-Built `0.14.0`)
| Role | Active File | Imported / Referenced By |
| :--- | :--- | :--- |
| **TypeScript Source Tree** | [`src/`](../src/) | Built via `npm run build` (`vite build && node scripts/sync_dist.cjs`) |
| **HTML Entrypoint** | [`index.html`](../index.html) | Browser root (`?v=8.5`) |
| **Main Engine Bundle** | [`assets/index-6n0QZWUb.js`](../assets/index-6n0QZWUb.js) | `index.html`, `MapViewerApp-CMXrLrwx.js`, `module-DAP8-cqq.js` |
| **Custom Runtime Source** | [`src/custom/`](../src/custom/) | Canonical hand-authored scripts & assets synced into `assets/` by `scripts/sync_dist.cjs` |
| **Co-Op Facade Entrypoint** | [`assets/multiplayer.js`](../assets/multiplayer.js) | `index.html` (`?v=8.5`, synced from `src/custom/multiplayer.js`) |
| **Co-Op Submodules (9)** | [`assets/multiplayer/`](../assets/multiplayer/) | Synced from `src/custom/multiplayer/mp-*.js` |
| **Build & Asset Syncer** | [`scripts/sync_dist.cjs`](../scripts/sync_dist.cjs) | `package.json` (`npm run build`) |
| **Upstream Auto-Syncer** | [`scripts/auto_sync_upstream.cjs`](../scripts/auto_sync_upstream.cjs) | `/etc/cron.d/run-escape-upstream-sync`, `.github/workflows/sync-upstream.yaml` |
| **Cook's Assistant Quest** | [`assets/cooks-assistant.js`](../assets/cooks-assistant.js) | `index.html` (`?v=8.5`, synced from `src/custom/cooks-assistant.js`) |
| **Tile Coordinate HUD** | [`assets/tile-coords.js`](../assets/tile-coords.js) | `index.html` (`?v=8.5`, synced from `src/custom/tile-coords.js`) |
| **Debug / God Mode** | [`assets/debug-mode.js`](../assets/debug-mode.js) | `index.html` (`?v=8.5`, synced from `src/custom/debug-mode.js`) |
| **Main Stylesheet** | [`assets/index-BMrv4NGQ.css`](../assets/index-BMrv4NGQ.css) | `index.html` (`?v=8.5`) |
| **Map Viewer Bundle** | [`assets/MapViewerApp-CMXrLrwx.js`](../assets/MapViewerApp-CMXrLrwx.js) | `assets/index-6n0QZWUb.js` |
| **Render Worker** | [`assets/RenderDataWorker-DJjFWldW.js`](../assets/RenderDataWorker-DJjFWldW.js) | `assets/index-6n0QZWUb.js` |
| **Worker WASM Loader** | [`assets/module--MAiymg_.js`](../assets/module--MAiymg_.js) | `assets/RenderDataWorker-DJjFWldW.js` (`module-yzz5kVyQ.wasm`) |
| **Main WASM Loader** | [`assets/module-DAP8-cqq.js`](../assets/module-DAP8-cqq.js) | `assets/index-6n0QZWUb.js` (`module-yzz5kVyQ.wasm`) |
| **OSRS Slim Cache** | [`caches/osrs-241_2026-09-30-slim-74e0d2b3`](../caches/osrs-241_2026-09-30-slim-74e0d2b3) | [`caches/caches.json`](../caches/caches.json) (`CacheStorage` key `-v12`) |

### Custom Engine & Gameplay Hooks in `src/` (Compiled into `assets/index-6n0QZWUb.js`)
When adding new features or merging upstream changes into `src/` and rebuilding `assets/index-*.js`, follow these upstream-friendly boundaries and preserve all global hooks:
1. **Modular Custom Feature Directories (Upstream-Friendly Boundaries)**:
   - [`src/game/content/custom/`](../src/game/content/custom/): All custom characters (`customCharacters.ts`), maps (`customMaps.ts`), enemies/bosses (`customEnemies.ts`), and secret codes (`secretCodes.ts`) live here and are linked into upstream files (`characters.ts`, `maps.ts`, `enemies.ts`, `GameClient.ts`) via 1-line imports/spreads.
   - [`src/game/ui/`](../src/game/ui/): Standalone custom UI components ([`LeaderboardScreen.tsx`](../src/game/ui/LeaderboardScreen.tsx), [`CoopGameOverSection.tsx`](../src/game/ui/CoopGameOverSection.tsx)) imported by [`GameUi.tsx`](../src/game/ui/GameUi.tsx).
   - [`src/custom/`](../src/custom/): Canonical hand-authored runtime scripts (`multiplayer.js`, `multiplayer/mp-*.js`, `cooks-assistant.js`, `tile-coords.js`, `debug-mode.js`), prayer icons (`prayer/*.png`), and multiplayer unit tests (`multiplayer/multiplayer.test.ts`). `npm run build` copies `src/custom/` into `assets/` (excluding `*.test.*`) via [`scripts/sync_dist.cjs`](../scripts/sync_dist.cjs).
   - [`src/game/types/globals.d.ts`](../src/game/types/globals.d.ts): Typed `Window` declarations for all global bridges between `src/game/` and `src/custom/`.
   - [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) vs root [`CHANGELOG.md`](../CHANGELOG.md): Keep root `CHANGELOG.md`, `docs/DEVELOPMENT.md`, and `package-lock.json` identical to `upstream/main`; write all custom notes in `docs/CHANGELOG.md` (`src/game/ui/changelog.ts` combines both).
2. **Client Instance Export (`window.gameClient`)**:
   - Exposes the primary game client instance in `src/game/GameApp.tsx` as `window.gameClient` during initialization and attaches helper methods (`getEnemyDef`, `getAppearance`, `getSimAppearance`, `iconCache`, `getCharacters`, `getMaps`, `getThrallDefs`) so [`assets/multiplayer.js`](../assets/multiplayer.js) can attach to `window.gameClient` and `window.gameClient.sim`.
3. **Multiplayer Hook Callbacks (`window.multiplayer`)**:
   - References across `src/game/` delegate state transitions, spectator flow-field/pickup guards, minimap player dots, pause checks, and post-run damage leaderboards to `window.multiplayer`.
4. **OSRS Overhead Prayer Hooks (`window._osrsPrayer`, `window._drawOsrsPrayerOverlay`, `window._hideOsrsPrayerBar`)**:
   - Used for Fight Caves (`fight_caves`) protection prayers (`magic` / `ranged` / `melee` via `Q` / `E` / `R`) against `tztok_jad` (NPC 3127) and `tzkal_zuk` (NPC 7706).
   - `window._drawOsrsPrayerOverlay(viewport, sim, alpha, ctx, scale, playerScreenPos)` renders overhead prayer icons and boss attack windup banners.
5. **Custom Maps, Characters, Weapons & Boss Definitions**:
   - `fight_caves` (`src/game/content/custom/customMaps.ts`): Spawns TzTok-Jad (`tztok_jad`, NPC 3127) at 6:00 (`at: 360`) and TzKal-Zuk (`tzkal_zuk`, NPC 7706, collision radius `0.45`, in `src/game/content/custom/customEnemies.ts`) at 12:00 (`at: 720`), plus custom cache archives in `caches/osrs-241_2026-09-30-slim-74e0d2b3/`.
   - Custom secret-code characters in `src/game/content/custom/customCharacters.ts`: `dipper` (NPC `16370`, code `dipperthedog`) and `elias` (NPC `16543`, code `barkelly`), rendered in 2D icons and in 3D via `drawPlayer` / `submitActors`.
   - Custom `blood_burst` -> `blood_barrage` (`id: "blood_barrage"`, `SpotAnim 377`) weapon evolution paired with `rapid_heal`, plus buffed `Saradomin brew` and `Sanfew serum`.

---

## 2. Entry Template (Copy & Prepend Below)

```markdown
### YYYY-MM-DD - [Agent Name / Contributor] - [Short Summary]
- **Commit / PR**: `<commit-hash or PR #>`
- **Files Modified**: `path/to/file1`, `path/to/file2`
- **Bundle / Version Impact**: `?v=X.Y` (note any renamed bundle hashes or symbol changes)
- **What Changed**:
  - Bullet summary of logic, hooks, or server changes.
- **Notes / Invariants for Future Agents**:
  - Specific invariants, edge cases, or merge conflict resolution guidance.
```

---

## 3. Chronological Agent Handoff Log

### 2026-10-29 - Antigravity - Slide Unreachable Flying Monster Loot onto Walkable Ground
- **Commit / PR**: Unreachable pickup target discovery and smooth slide (`?v=8.5`)
- **Files Modified**: `src/game/core/Sim.ts`, `src/game/core/entities.ts`, `src/game/core/Sim.test.ts`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`, `index.html`, `assets/index-6n0QZWUb.js`, `assets/MapViewerApp-CMXrLrwx.js`, `assets/module-DAP8-cqq.js`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-6n0QZWUb.js`, `assets/MapViewerApp-CMXrLrwx.js`, `assets/module-DAP8-cqq.js`)
- **What Changed**:
  - Added `isTileReachableForPickup` and `findReachablePickupSpot` in `src/game/core/Sim.ts` and `targetX` / `targetY` on `Pickup` in `src/game/core/entities.ts`.
  - When a pickup is dropped on a solid or unreachable tile (or enters the player's flow-field window on an unreachable tile), it computes the nearest reachable walkable tile (preferring tiles closer to the player) and smoothly glides out of the obstacle onto that tile in `stepPickups`.
  - Added unit test coverage in `src/game/core/Sim.test.ts`.
- **Notes / Invariants for Future Agents**:
  - `gatherPiles` waits until `pickup.targetX === undefined` so bone/coin piles do not merge into a pile that is still sliding out of an obstacle.

### 2026-10-29 - Antigravity - Enhance God Wars Dungeon Multi-Faction Warfare
- **Commit / PR**: Expand God Wars Dungeon faction combat (`?v=8.5`)
- **Files Modified**: `src/game/core/Sim.ts`, `src/game/core/entities.ts`, `src/game/core/Sim.test.ts`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`, `index.html`, `assets/index-COMG5mx1.js`, `assets/MapViewerApp-wfx3-3oW.js`, `assets/module-P02y7iRx.js`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-COMG5mx1.js`, `assets/MapViewerApp-wfx3-3oW.js`, `assets/module-P02y7iRx.js`)
- **What Changed**:
  1. Increased `FOE_RANGE` from `8` to `14` tiles and adjusted `FOE_IGNORE_PLAYER` from `2.5` to `1.8` tiles in `src/game/core/Sim.ts` so rival God Wars armies spot and engage each other across adjacent spawn wedges.
  2. Added ranged and magic faction attacks (`enemyShoot` / `launchProjectiles` / `stepEnemyProjectiles` in `src/game/core/Sim.ts`, `faction` and `targetEnemyUid` on `EnemyProjectile` in `src/game/core/entities.ts`) so ranged/magic faction enemies (`aviansie`, spiritual rangers, spiritual mages) keep distance and fire projectiles at rival faction monsters as well as players.
  3. Allowed aggroed faction monsters (`enemy.aggro`) to still melee-strike rival faction monsters that physically collide with them on their way to the player.
  4. Updated `killEnemy` in `src/game/core/Sim.ts` so monsters killed by rival factions (`byEnemy`) drop XP bones (`"bones"`).
- **Notes / Invariants for Future Agents**:
  - Bosses and elites remain excluded from taking faction damage so their casket drops are never lost off-screen.

### 2026-10-29 - Antigravity - Document Upstream-Friendly Feature Architecture Across All Agent Rules & Skills
- **Commit / PR**: Codify upstream-friendly architecture in all agent instruction files (`?v=8.5`)
- **Files Modified**: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `docs/AGENT_NOTES.md` (plus workspace `c:\Git\AGENTS.md` and `c:\Git\.agents\skills\merge-update\SKILL.md`)
- **Bundle / Version Impact**: `?v=8.5` (no bundle changes)
- **What Changed**:
  - Updated `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `docs/AGENT_NOTES.md`, workspace `c:\Git\AGENTS.md`, and `c:\Git\.agents\skills\merge-update\SKILL.md` so all future agents know where custom code lives (`src/game/content/custom/`, `src/custom/`, standalone `src/game/ui/` components, `src/game/types/globals.d.ts`, and `docs/CHANGELOG.md`) and follow upstream-friendly modularization rules when adding features or resolving merges.
- **Notes / Invariants for Future Agents**:
  - Always follow `AGENTS.md` Section 1.2 ("Upstream-Friendly Architecture & Feature Placement Rules") when adding new features.

### 2026-10-29 - Antigravity - Global Type Bridge, UI/Secret Code Extraction, Gated Debug Mode & Multiplayer Unit Tests
- **Commit / PR**: Upstream-safe codebase modularization and test coverage (`?v=8.5`)
- **Files Modified**: `package-lock.json`, `src/game/types/globals.d.ts`, `src/game/content/custom/secretCodes.ts`, `src/game/client/GameClient.ts`, `src/game/ui/CoopGameOverSection.tsx`, `src/game/ui/GameUi.tsx`, `src/custom/debug-mode.js`, `assets/debug-mode.js`, `src/custom/multiplayer/multiplayer.test.ts`, `scripts/sync_dist.cjs`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`, `index.html`, `assets/index-DlybI6VF.js`, `assets/MapViewerApp-D91SLorV.js`, `assets/module-Dp9wVAh7.js`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-DlybI6VF.js`, `assets/MapViewerApp-D91SLorV.js`, `assets/module-Dp9wVAh7.js`)
- **What Changed**:
  1. Restored `package-lock.json` to match `upstream/main` with zero diffs.
  2. Added `src/game/types/globals.d.ts` declaring typed `Window` extensions (`gameClient`, `multiplayer`, `_osrsPrayer`, `_drawOsrsPrayerOverlay`, `_hideOsrsPrayerBar`, `_cooksAssistant`).
  3. Extracted `redeemSecretCode` from `src/game/client/GameClient.ts` into `src/game/content/custom/secretCodes.ts` and extracted `CoopDamageLeaderboardTable` and `CoopGameOverButtons` from `src/game/ui/GameUi.tsx` into `src/game/ui/CoopGameOverSection.tsx`, shrinking custom diffs in `GameClient.ts` and `GameUi.tsx` by ~230 lines.
  4. Gated `src/custom/debug-mode.js` (`isDebugAllowed()`) so the debug overlay only activates on `localhost` / `127.0.0.1`, when `?debug=1` is in the URL, or when `l33th4x0r` is unlocked in the save.
  5. Added Vitest unit tests in `src/custom/multiplayer/multiplayer.test.ts` covering Co-Op scaling multipliers, input/slot/map sanitization, shared Co-Op XP growth pooling, and Antique Lamp XP split, and updated `scripts/sync_dist.cjs` to skip `*.test.*` when syncing `src/custom/` to `assets/`.
- **Notes / Invariants for Future Agents**:
  - `npm test` now runs 14 test suites (277 tests total), including `src/custom/multiplayer/multiplayer.test.ts`.

### 2026-10-29 - Antigravity - Implement 5 Upstream-Compatible Repository Structure Improvements
- **Commit / PR**: 5 structural improvements for upstream merge compatibility (`?v=8.5`)
- **Files Modified**: `.gitattributes`, `CHANGELOG.md`, `docs/CHANGELOG.md`, `docs/DEVELOPMENT.md`, `src/game/ui/changelog.ts`, `src/game/ui/LeaderboardScreen.tsx`, `src/game/ui/GameUi.tsx`, `src/game/content/custom/customCharacters.ts`, `src/game/content/custom/customMaps.ts`, `src/game/content/custom/customEnemies.ts`, `src/game/content/characters.ts`, `src/game/content/maps.ts`, `src/game/content/enemies.ts`, `src/custom/**`, `scripts/sync_dist.cjs`, `scripts/auto_sync_upstream.cjs`, `docs/AGENT_NOTES.md`, `index.html`, `assets/index-CEwB6lxo.js`, `assets/MapViewerApp-DsDS0Jt1.js`, `assets/module-1Oh8_OSL.js`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-CEwB6lxo.js`, `assets/MapViewerApp-DsDS0Jt1.js`, `assets/module-1Oh8_OSL.js`)
- **What Changed**:
  1. Added `.gitattributes` and normalized line endings across all 421 tracked files, restoring all 18 untouched upstream files (`LICENSE`, `.prettierignore`, `public/.htaccess`, `src/mapviewer/data/**`, shader files) to match `upstream/main` with zero diffs.
  2. Restored root `CHANGELOG.md` and `docs/DEVELOPMENT.md` to match `upstream/main` and updated `src/game/ui/changelog.ts` to combine `docs/CHANGELOG.md` (custom edition updates) + `CHANGELOG.md` (upstream releases).
  3. Extracted custom characters (`dipper`, `elias`), maps (`fight_caves`), and enemies (`tzkal_zuk`) into `src/game/content/custom/` (`customCharacters.ts`, `customMaps.ts`, `customEnemies.ts`) and spread them into `characters.ts`, `maps.ts`, and `enemies.ts`.
  4. Copied all hand-authored runtime scripts and assets (`multiplayer.js`, `multiplayer/mp-*.js`, `prayer/*.png`, `cooks-assistant.js`, `tile-coords.js`, `debug-mode.js`, `quest-complete.ogg`) into `src/custom/` as the canonical source of truth and updated `scripts/sync_dist.cjs` and `scripts/auto_sync_upstream.cjs` to sync `src/custom/` into `assets/` on build.
  5. Extracted `LeaderboardScreen` from `src/game/ui/GameUi.tsx` into `src/game/ui/LeaderboardScreen.tsx`.
- **Notes / Invariants for Future Agents**:
  - Edit hand-authored runtime scripts in `src/custom/` (or edit both `src/custom/` and `assets/`); running `npm run build` automatically copies `src/custom/*` into `assets/*` via `scripts/sync_dist.cjs`.
  - Add new custom characters/maps/enemies to `src/game/content/custom/` and custom changelog entries to `docs/CHANGELOG.md` (leave root `CHANGELOG.md` untouched for clean upstream fast-forwards).

### 2026-10-29 - Antigravity - Add Armoury Refund Option
- **Commit / PR**: Add `Refund all` button to Armoury screen (`?v=8.5`)
- **Files Modified**: `src/game/core/save.ts`, `src/game/core/save.test.ts`, `src/game/client/GameClient.ts`, `src/game/ui/ArmouryScreen.tsx`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`, `index.html`, `assets/index-4meYiBAc.js`, `assets/MapViewerApp-Dwa6qfoP.js`, `assets/module-C4vb_P1Y.js`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-4meYiBAc.js`, `assets/MapViewerApp-Dwa6qfoP.js`, `assets/module-C4vb_P1Y.js`)
- **What Changed**:
  - Added `getArmourySpent(save)` and `refundArmoury(save)` in `src/game/core/save.ts`, computing exact coins spent across all upgrade steps in `save.armoury` via `getUpgradeLine` and `getArmouryCost`, returning them to `save.coins`, and resetting `save.armoury = {}`.
  - Added `refundArmoury()` to `GameClient` in `src/game/client/GameClient.ts` and a `Refund all` button to the bottom row of `ArmouryScreen` in `src/game/ui/ArmouryScreen.tsx`.
  - Added unit test coverage in `src/game/core/save.test.ts`.
- **Notes / Invariants for Future Agents**:
  - `getArmourySpent` derives spent coins directly from `save.armoury` and `getArmouryCost(line[i])`, so no save schema migration or extra `SaveData` field is required.

### 2026-10-29 - Antigravity - Rename Slayer Tasks Menu Sections to OSRS Slayer Masters & Task Names
- **Commit / PR**: OSRS Slayer Master section headings and Slayer assignment names (`?v=8.5`)
- **Files Modified**: `src/game/ui/QuestScreen.tsx`, `src/game/content/quests.ts`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`, `index.html`, `assets/index-DE-lnfdZ.js`, `assets/MapViewerApp-CxxPRWXZ.js`, `assets/module-Cyc6w5ry.js`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-DE-lnfdZ.js`, `assets/MapViewerApp-CxxPRWXZ.js`, `assets/module-Cyc6w5ry.js`)
- **What Changed**:
  - Added `SLAYER_MASTER_BY_MAP` and `getSlayerGroupTitle` in `src/game/ui/QuestScreen.tsx` to group Slayer Tasks by OSRS Slayer Masters (`Turael (Lumbridge)`, `Mazchna (Barrows)`, `Krystilia (Wilderness)`, `Sumona (Kharidian Desert)`, `Vannaka (Fremennik Province)`, `Duradel (Karamja)`, `Konar quo Maten (Kourend)`, `Chaeldar (Varlamore)`, `Aya (Morytania)`, `Nieve (God Wars Dungeon)`, `Steve (Prifddinas)`, `TzHaar-Ket-Keh (The Inferno)`, and `Spria (Across Gielinor)`).
  - Renamed all 34 entries in `src/game/content/quests.ts` from OSRS quest names to OSRS Slayer assignment names while preserving internal `id` values for full save compatibility.
- **Notes / Invariants for Future Agents**:
  - Preserve `quest.id` strings in `src/game/content/quests.ts` so `save.questsDone` and `src/game/core/save.test.ts` remain backwards-compatible.

### 2026-10-29 - Antigravity - Add 1.75x and 2x UI Scale Options
- **Commit / PR**: Add `1.75x` and `2x` UI Scale options (`?v=8.5`)
- **Files Modified**: `src/game/client/DisplaySettings.ts`, `src/game/client/GameClient.ts`, `src/game/ui/GameUi.tsx`, `README.md`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`, `index.html`, `assets/index-BJ52CiVK.js`, `assets/MapViewerApp-ByrzZakD.js`, `assets/module-Cc1KzfkC.js`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-BJ52CiVK.js`, `assets/MapViewerApp-ByrzZakD.js`, `assets/module-Cc1KzfkC.js`)
- **What Changed**:
  - Extended `UiScaleSetting` in `src/game/client/DisplaySettings.ts`, `cycleUiScale()` in `src/game/client/GameClient.ts`, and the Settings modal UI Scale buttons in `src/game/ui/GameUi.tsx` to include `1.75` (`1.75x`) and `2` (`2x`) alongside `auto`, `1`, `1.25`, and `1.5`.
- **Notes / Invariants for Future Agents**:
  - Valid `uiScale` settings are `"auto" | 1 | 1.25 | 1.5 | 1.75 | 2`.

### 2026-10-29 - Antigravity - Relocate MULTIPLAYER_ARCHITECTURE.md, CHANGELOG.md & AGENT_NOTES.md into `docs/` + Update README.md
- **Commit / PR**: Move documentation files into `docs/` and integrate upstream `README.md` with custom edition differences at the top (`?v=8.5`)
- **Files Modified**: `README.md`, `docs/MULTIPLAYER_ARCHITECTURE.md` (moved from `MULTIPLAYER_ARCHITECTURE.md`), `docs/CHANGELOG.md` (moved from `CHANGELOG.md`), `docs/AGENT_NOTES.md` (moved from `AGENT_NOTES.md`), `docs/DEVELOPMENT.md`, `src/game/ui/changelog.ts`, `src/game/ui/ChangelogPanel.tsx`, `serve.py`, `scripts/auto_sync_upstream.cjs`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `assets/multiplayer.js`, `../AGENTS.md`, `../.agents/skills/merge-update/SKILL.md`
- **Bundle / Version Impact**: `?v=8.5` (rebuilt via `npm run build` after updating `src/game/ui/changelog.ts` and `src/game/ui/ChangelogPanel.tsx` to read `docs/CHANGELOG.md`)
- **What Changed**:
  - Updated `README.md` to use the full upstream `Dynrothe/Run-Escape` README with a comprehensive **Custom Edition Additions & Differences** section and AI Agent Directive at the top.
  - Moved `MULTIPLAYER_ARCHITECTURE.md`, `CHANGELOG.md`, and `AGENT_NOTES.md` into `docs/`.
  - Updated `src/game/ui/changelog.ts` (`../../../docs/CHANGELOG.md?raw`), `src/game/ui/ChangelogPanel.tsx` (`fetch("docs/CHANGELOG.md")`), `serve.py` (`allowed_exact` includes `/docs/CHANGELOG.md` and `/docs/changelog.md`), and `scripts/auto_sync_upstream.cjs` (`CHANGELOG_MD` and `AGENT_NOTES_MD` paths).
  - Updated all agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `README.md`, `assets/multiplayer.js`, `c:\Git\AGENTS.md`, `c:\Git\.agents\skills\merge-update\SKILL.md`) and internal doc links to reference `docs/AGENT_NOTES.md`, `docs/CHANGELOG.md`, and `docs/MULTIPLAYER_ARCHITECTURE.md`.
- **Notes / Invariants for Future Agents**:
  - `CHANGELOG.md`, `AGENT_NOTES.md`, and `MULTIPLAYER_ARCHITECTURE.md` now live inside `docs/`.

### 2026-10-29 - Antigravity - 12 Co-Op Multiplayer, Animation, Balance, Lobby & UI Fixes + Vite Duplicate Bundle Fix (v8.5)
- **Commit / PR**: 12 multiplayer/gameplay/UI fixes & Vite script entry fix (`?v=8.5`)
- **Files Modified**: `vite.config.ts`, `scripts/sync_dist.cjs`, `serve.py`, `src/game/content/weapons.ts`, `src/game/core/Sim.ts`, `src/game/client/GameAssets.ts`, `src/game/client/GameView.ts`, `src/game/client/GameClient.ts`, `src/game/ui/GameUi.tsx`, `src/game/ui/QuestScreen.tsx`, `assets/multiplayer.js`, `assets/cooks-assistant.js`, `assets/multiplayer/mp-lobby-ui.js`, `assets/multiplayer/mp-transport.js`, `assets/multiplayer/mp-hud-leaderboard.js`, `assets/multiplayer/mp-actor-renderer.js`, `assets/multiplayer/mp-pickups.js`, `assets/multiplayer/mp-sync-engine.js`, `index.html`, `CHANGELOG.md`, `AGENT_NOTES.md`, `assets/index-DFhq8KrM.js`, `assets/MapViewerApp-CvUyPoMO.js`, `assets/module-D4Rj_YIr.js`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=8.4` to `?v=8.5` across `index.html`, `assets/multiplayer.js`, and all `assets/multiplayer/mp-*.js` submodules. Main bundle changed to `assets/index-DFhq8KrM.js` (reduced from `1.75 MB` to `1.60 MB` by excluding external `assets/*.js` scripts from Vite's Rollup entry points), MapViewer to `assets/MapViewerApp-CvUyPoMO.js`, and WASM loader to `assets/module-D4Rj_YIr.js`.
- **What Changed**:
  - **Build Pipeline Fix**: Updated `sourceEntryIndexHtmlPlugin()` in `vite.config.ts` to strip external `./assets/*.js` script tags (`multiplayer.js`, `tile-coords.js`, `cooks-assistant.js`, `debug-mode.js`) during Vite's HTML entry analysis so Rollup no longer bundles duplicate copies of those scripts inside `assets/index-*.js`. Updated `scripts/sync_dist.cjs` to sync `?v=X.Y` across `assets/multiplayer/*.js`.
  - **Item 1 (Player Level on Infograph & Leaderboard)**: Synced `level` across `coop_loadout`, `sync_world`, and `input`, displaying `Lv.X` on each player's `#coop-party-hud` infograph card and in the `#coop-leaderboard` table in `GameUi.tsx`.
  - **Item 2 (Weapon Animations & 3D Held Weapon Sync)**: Attached `playerRef` to `SlashFx` in `GameView.ts` so melee slash/sweep arcs render around the attacking player rather than `sim.player`; populated `EquipSlot.WEAPON` in `getCharacterAppearance()`; added sequence IDs `393` and `2062`; buffered early `coop_loadout` packets; preserved weapon `cooldown`/`uses` and `sim.appearanceVersion`; and eliminated duplicate aura/spotAnim playback on Guests.
  - **Item 3 (Shared Co-Op XP & Host Skills)**: Synced the Host's `upgrades` (`metaStats`), `unlockedItems`, and `armoury` in `game_start` (`GameClient.ts`), and computed a shared lobby XP growth multiplier (`1 + hostMetaGrowth + sum(itemGrowth) / partySize`) applied to all bone pickups and synced via `xpGained` and `totalXp`.
  - **Item 4 (Single Unique Chest Per Player)**: Deduplicated casket pickups by `pickupUid` (`_openedCasketUids`), used base item IDs (`latestChest.upgradedFrom || latestChest.itemId`) for `excludeItemId`, mixed `localSlot` into `mixRandomSeed()`, and triggered `client.handleEvents`/`syncOverlay` on the Host when a Guest collects a casket.
  - **Item 5 (Walking Animation Precedence)**: Moved `player.moving` / `p2.moving` ahead of `attack` animation selection in `GameView.ts` and `mp-sync-engine.js`, and prevented `attackSeq` from overriding movement in `Sim.ts`.
  - **Item 6 (Persistent Lobby Player Names)**: Added `localStorage`-backed per-slot player name persistence (`run-escape-coop-player-names` and `run-escape-coop-local-name`), restored names across `welcome`, `reconcileActiveSlots`, `peer_joined`, `lobby_update`, and `returnToLobby()`, and set `this.gameStarted = false` on Host victory.
  - **Item 7 (Antique Lamp `1/x` Split)**: Updated `Sim.useUtility` (`case "xp"`) to grant `1` level in solo play and `1/x` of a level synced across all `x` players on the level (`kind: "lamp_xp"`) in multiplayer.
  - **Item 8 (Blood Barrage & Blood Burst Radius)**: Updated `blood_barrage` (`area: 3.8`, removed `castSpotAnim: 377`) and `blood_burst` (`area: 2.3 -> 2.6 -> 2.9`) in `src/game/content/weapons.ts` to match `ice_barrage` and `ice_burst`.
  - **Item 9 (Guest Spawn Deduplication)**: Guarded `openLobbyModal` against `WebSocket.CONNECTING`, detached old socket callbacks in `connect()`, allowed `welcome` to update `role`/`localSlot` whenever `!this.gameStarted`, deduplicated `game_start` slots, pruned ghost slots in `applyWorldSync`, and added `"peer_leaving"` handling to `serve.py`.
  - **Item 10 (Slayer Tasks Tab)**: Renamed `Quests` UI labels, headings, and notices in `GameUi.tsx`, `QuestScreen.tsx`, and `GameClient.ts` to **Slayer Tasks** (noting Cook's Assistant in Lumbridge as the only quest).
  - **Item 11 (Guest Utility Items & Combat Stats)**: Synced `usedItemId`, `hpDelta`, and `stats` in `coop_loadout` so Guest Bonecrusher, Red/Black Chinchompas, Overload/Zamorak brew self-damage, ground Magnets, and casket/potion combat stats execute authoritatively on the Host.
  - **Item 12 (Multiplayer Difficulty Multiplier)**: Scaled `enemy.damageScale` by `dmgMult` in `scaleEnemyForCoop` (fixing boss special attacks and enemy explosions), fixed normal enemy damage double-rounding, and added a Host-selectable Difficulty Multiplier (`1x` - `3x`) in the Co-Op Lobby.
- **Notes / Invariants for Future Agents**:
  - `sourceEntryIndexHtmlPlugin()` in `vite.config.ts` must continue stripping external `./assets/*.js` module scripts during `vite build` so they are not bundled inside `assets/index-*.js`.

### 2026-10-29 - Antigravity - Legacy Caches, Pre-TypeScript Patch Pipeline & Workspace Cleanup
- **Commit / PR**: Repository legacy file cleanup (`?v=8.4`)
- **Files Modified**: `caches/osrs-241_2026-09-30-slim-4a90e306/` (deleted), `caches/osrs-241_2026-09-30-slim-b1840d05/` (deleted), `caches/osrs-241_2026-09-30-slim-4cd931ae/` (deleted), `scripts/apply_patches.js` (deleted), `scripts/discover_symbols.js` (deleted), `scripts/patches/01..06-*.patch.js` (deleted), `ARCHITECTURE_EVALUATION.md` (deleted), `assets/module.wasm` (deleted), `assets/favicon-BwwwC_CH.ico` (deleted), `scripts/sync_dist.cjs`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `../.agents/skills/merge-update/SKILL.md`, `CHANGELOG.md`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: `?v=8.4` (no bundle hash changes; reclaimed ~65.6 MB of obsolete cache and duplicate asset files)
- **What Changed**:
  - Removed 3 superseded OSRS slim cache directories (`osrs-241_2026-09-30-slim-4a90e306`, `osrs-241_2026-09-30-slim-b1840d05`, `osrs-241_2026-09-30-slim-4cd931ae`), saving 64.51 MB while retaining the active `osrs-241_2026-09-30-slim-74e0d2b3` cache.
  - Removed obsolete pre-TypeScript minified bundle patch scripts (`scripts/apply_patches.js`, `scripts/discover_symbols.js`, `scripts/patches/01..06-*.patch.js`) and `ARCHITECTURE_EVALUATION.md`.
  - Removed duplicate unhashed `assets/module.wasm` (1.05 MB) and unused `assets/favicon-BwwwC_CH.ico`, and updated `scripts/sync_dist.cjs`.
  - Removed untracked local debug screenshots (`*.png`), `scratch_model_55847.dat`, and `scratch/`.
  - Aligned agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `.agents/skills/merge-update/SKILL.md`) with the TypeScript + Vite source workflow.
- **Notes / Invariants for Future Agents**:
  - All engine changes are now authored directly in `src/` and built via `npm run build` (`vite build && node scripts/sync_dist.cjs`); do not recreate `scripts/patches/*.patch.js` or unhashed `assets/module.wasm`.

### 2026-10-29 - Antigravity - Hourly Upstream Auto-Sync Cron on `cuteanimegirls.moe` & GitHub Actions (`scripts/auto_sync_upstream.cjs`)
- **Commit / PR**: Automated upstream cron sync (`?v=8.4`)
- **Files Modified**: `scripts/auto_sync_upstream.cjs`, `.github/workflows/deploy.yaml`, `.github/workflows/sync-upstream.yaml`, `package.json`, `CHANGELOG.md`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: `?v=8.4` (no bundle change on idle check; auto-increments `?v=X.Y` and rebuilds `assets/` whenever `upstream/main` advances)
- **What Changed**:
  - Recorded `upstream/main` (`b29f532`) as a git merge-base parent of `main` so `git rev-list HEAD..upstream/main` and 3-way merges track only new upstream commits.
  - Created [`scripts/auto_sync_upstream.cjs`](./scripts/auto_sync_upstream.cjs) (`npm run sync-upstream`), which acquires a PID lockfile, fetches `origin/main` and `upstream/main`, merges new upstream commits (including automatic root-graft fallback if `upstream` ever force-pushes), bumps `?v=X.Y`, updates `CHANGELOG.md` and `AGENT_NOTES.md`, runs `npx vite build && node scripts/sync_dist.cjs`, verifies `tsc`, `vitest`, `test_serve.py`, and `multiplayer.js`, commits, and reloads PM2 (`ecosystem.config.cjs`).
  - Updated [`.github/workflows/deploy.yaml`](./.github/workflows/deploy.yaml) to configure the `upstream` remote, install npm dependencies, run `auto_sync_upstream.cjs`, and install `/etc/cron.d/run-escape-upstream-sync` on `cuteanimegirls.moe` (running hourly at `0 * * * *` and logging to `/var/log/run-escape-sync.log`).
  - Added [`.github/workflows/sync-upstream.yaml`](./.github/workflows/sync-upstream.yaml) to run `scripts/auto_sync_upstream.cjs` hourly on GitHub Actions and push clean upstream merges directly to `origin/main`.
- **Notes / Invariants for Future Agents**:
  - If `auto_sync_upstream.cjs` encounters source conflicts in `src/` or any verification failure, it automatically aborts and resets to the previous `HEAD` so the live server on `cuteanimegirls.moe` is never left in a broken state.

### 2026-10-29 - Antigravity - Fix PM2 Deployment CommonJS Config under ESM Package (`ecosystem.config.cjs`)
- **Commit / PR**: PM2 `ecosystem.config.cjs` CommonJS fix (`?v=8.4`)
- **Files Modified**: `ecosystem.config.cjs` (renamed from `ecosystem.config.js`), `.github/workflows/deploy.yaml`, `nginx.conf`, `CHANGELOG.md`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: `?v=8.4` (deployment configuration fix; no client bundle changes required)
- **What Changed**:
  - Renamed `ecosystem.config.js` to `ecosystem.config.cjs` so Node/PM2 loads the CommonJS `module.exports` configuration when `"type": "module"` is set in `package.json`.
  - Updated `.github/workflows/deploy.yaml` to invoke `pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs`.
  - Updated `nginx.conf` location deny rule to block `ecosystem.config.(js|cjs)` and `*.cjs` files.
- **Notes / Invariants for Future Agents**:
  - Because `package.json` sets `"type": "module"` for Vite/Vitest ESM compatibility, any Node CommonJS scripts or PM2 config files in the repository must use the `.cjs` extension (`ecosystem.config.cjs`, `scripts/sync_dist.cjs`, `scripts/download-caches.cjs`).

### 2026-10-29 - Antigravity - Full Migration to Unminified TypeScript + Vite Source Base (`Dynrothe/Run-Escape`) (v8.4)
- **Commit / PR**: Source-based TypeScript + Vite migration (`?v=8.4`)
- **Files Modified**: `src/**`, `public/**`, `docs/**`, `scripts/cache/**`, `scripts/dev/**`, `scripts/game/**`, `scripts/download-caches.cjs`, `scripts/sync_dist.cjs`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `README.md`, `CHANGELOG.md`, `AGENTS.md`, `AGENT_NOTES.md`, `index.html`, `assets/multiplayer.js`, `assets/index-TPKpDRK1.js`, `assets/MapViewerApp-CfAkm72z.js`, `assets/RenderDataWorker-DJjFWldW.js`, `assets/module--MAiymg_.js`, `assets/module-BdnIUByq.js`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=8.3` to `?v=8.4`. Built from TypeScript source (`src/`) via `npm run build` (`vite build && node scripts/sync_dist.cjs`) into `assets/index-TPKpDRK1.js`, `assets/MapViewerApp-CfAkm72z.js`, `assets/RenderDataWorker-DJjFWldW.js`, `assets/module--MAiymg_.js`, and `assets/module-BdnIUByq.js`.
- **What Changed**:
  - Imported the complete unminified TypeScript + React + Vite source code from `https://github.com/Dynrothe/Run-Escape` (and added `upstream` git remote).
  - Ported all custom content, balance adjustments, OSRS cache hooks, secret characters (`dipper`, `elias`), Fight Caves (`fight_caves`, `tztok_jad`, `tzkal_zuk`, Protection Prayers), `blood_burst` -> `blood_barrage` evolution, `rapid_heal` 5-second hit pause, Level Best Times Leaderboard (`_LeaderboardScreen`, `mapBest`), UI Scale, Tile Coordinates toggle, `l33th4x0r` level/character unlock, and Co-Op Multiplayer hooks directly into `src/`.
  - Added `sourceEntryIndexHtmlPlugin()` in `vite.config.ts` and `scripts/sync_dist.cjs` so `npm run build` compiles `src/` into `dist/` and syncs the production bundles directly into `assets/` and `index.html` with `?v=X.Y` cache-busting query strings while preserving `assets/multiplayer.js`, `assets/multiplayer/*`, `assets/cooks-assistant.js`, `assets/tile-coords.js`, and `assets/debug-mode.js`.
  - Verified `npx tsc --noEmit` (0 errors), `npm test` (13 test suites, 271/271 tests passing), and `python -m unittest test_serve.py` (39/39 tests passing).

### 2026-10-29 - Antigravity - Level Best Times Leaderboard & Per-Map Stats Tracking (v8.3)
- **Commit / PR**: Level Best Times Leaderboard (`?v=8.3`)
- **Files Modified**: `scripts/patches/01-core-engine.patch.js`, `assets/index-BucZ8BnA.js`, `assets/MapViewerApp-BeWD02jr.js`, `assets/RenderDataWorker-ago4Edys.js`, `assets/module-CSC3QDlL.js`, `assets/module-D8WM9OnE.js`, `assets/multiplayer.js`, `index.html`, `CHANGELOG.md`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=8.2` to `?v=8.3`.
- **What Changed**:
  - Added `mapBest` (`{ seconds, winSeconds, kills, level, characterId }`) to default save state (`Uv`), save deserialization (`lR`), and run completion (`jK`, plus `characterId` in `Sim.getResult()`).
  - Added a dedicated **Leaderboard** screen (`_LeaderboardScreen`) accessible from the Title menu (`Leaderboard` button) displaying best survival time, fastest boss clear, endless record, wins, and top kill count for every Campaign and Fun map.
  - Added `Best time` and `Fastest clear` display to the Map Select details panel (`gJ`).

### 2026-10-29 - Antigravity - Unlock All Levels & Endless Mode with `l33th4x0r` Code (v8.2)
- **Commit / PR**: `l33th4x0r` level & Endless mode unlock (`?v=8.2`)
- **Files Modified**: `scripts/patches/01-core-engine.patch.js`, `scripts/patches/03-maps.patch.js`, `assets/index-BucZ8BnA.js`, `assets/MapViewerApp-BeWD02jr.js`, `assets/RenderDataWorker-ago4Edys.js`, `assets/module-CSC3QDlL.js`, `assets/module-D8WM9OnE.js`, `assets/multiplayer.js`, `index.html`, `sw.js`, `CHANGELOG.md`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=8.1` to `?v=8.2`.
- **What Changed**:
  - Updated `Zr(i, t)` (`MapUnlockCheck`) and `bh(i, t)` (Endless mode unlock check) in `scripts/patches/03-maps.patch.js` to return `true` when `i?.unlockedCodes?.includes("l33th4x0r")`.
  - Updated `redeemCode("l33th4x0r")` toast and confirmation message in `scripts/patches/01-core-engine.patch.js` to indicate that all characters and levels are unlocked.
  - Updated `CHANGELOG.md` and the embedded fallback changelog in `scripts/patches/01-core-engine.patch.js`.

### 2026-10-29 - Antigravity - Upstream 0.14.0 Merge (Morytania, GWD, Prifddinas, Inferno, Castle Wars, Pest Control, 10 Adventurers, Gear Sets) (v8.1)
- **Commit / PR**: Upstream `0.14.0` (`index-BucZ8BnA.js`) merge (`?v=8.1`, CacheStorage `-v12`)
- **Files Modified**: `index.html`, `CHANGELOG.md`, `caches/caches.json`, `caches/osrs-241_2026-09-30-slim-74e0d2b3/*`, `assets/index-BucZ8BnA.js`, `assets/index-BMrv4NGQ.css`, `assets/MapViewerApp-BeWD02jr.js`, `assets/RenderDataWorker-ago4Edys.js`, `assets/module-CSC3QDlL.js`, `assets/module-D8WM9OnE.js`, `assets/multiplayer.js`, `assets/multiplayer/mp-*.js`, `scripts/discover_symbols.js`, `scripts/apply_patches.js`, `scripts/patches/01..06-*.patch.js`, `AGENTS.md`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=7.9` to `?v=8.1` and `CacheStorage` key from `-v11` to `-v12`. Main bundle changed from `index-XWbnxuVz.js` to `index-BucZ8BnA.js`; CSS from `index-Cu_WH1lb.css` to `index-BMrv4NGQ.css`; MapViewer from `MapViewerApp-DKojfbH1.js` to `MapViewerApp-BeWD02jr.js`; RenderDataWorker from `RenderDataWorker-CRRhTJTb.js` to `RenderDataWorker-ago4Edys.js`; worker WASM loader from `module-Cg9b2g3N.js` to `module-CSC3QDlL.js`; main WASM loader from `module-C9loB8SI.js` to `module-D8WM9OnE.js`; OSRS slim cache from `osrs-241_2026-09-30-slim-4cd931ae` to `osrs-241_2026-09-30-slim-74e0d2b3`.
- **What Changed**:
  - Merged upstream `0.14.0` features: **4 new campaign maps** (`morytania` with Verzik Vitur, `god_wars` with faction combat & Nex, `prifddinas` with Zulrah/Zalcano/Corrupted Hunllef, `inferno` with triple JalTok-Jads), **2 new fun maps** (`castle_wars`, `pest_control`), **10 new adventurers**, **12 new quests** + in-run Quest Tracker under the minimap, **7 new class weapons & 8 weapon evolutions**, **3 new passives** (`rigour`, `augury`, `ancient_sceptre`), and **5 Gear Sets** (`Void knight`, `Inquisitor's`, `Crystal armour`, `Torva`, `Virtus`) + DT2 rings and Armoury lines.
  - Injected all 20 custom OSRS cache archives (`idx0` `[7294..7298, 12217]`, `idx1` `[1691]`, `idx5` `[12595, 12851]` opened Lumbridge gates, `idx7` `[199, 2406, 2437, 2504, 2531, 10980, 12750, 13897, 33011, 55847, 61972]`) into `caches/osrs-241_2026-09-30-slim-74e0d2b3`.
  - Updated `scripts/discover_symbols.js` and all 211 rules across `scripts/patches/01..06-*.patch.js` for `0.14.0` symbol shifts (`Client: xw -> jv`, `Sim: r$ -> MK`, `Characters: Ja -> rr`, `Maps: aC -> U6`, `ThrallDefs: Zh -> lu`, `EnemyDefLookup: Jn -> Sn`, `AppearanceLookup: E0 -> qm`, `SimAppearance: U$ -> rZ`, `IconCache: A0 -> Eh`, `IconRasterizer: QG -> PX`, `WaveBuilder: Os -> ii`, `Weapons: ir -> dr`, `WeaponDefLookup: Jr -> ha`, `Passives: hw -> Cv`, `PassiveDefLookup: Qr -> ro`, `PostRunStats: ZZ -> CJ`, `PauseModal: $Z -> IJ`, `SettingsModal: kZ -> oJ`, `AdventurerSelectModal: NZ -> fJ`, `MapDefLookup: Wi -> Pi`, `MapUnlockCheck: Vr -> Zr`).
  - Guarded `0.14.0`'s `KeyQ` quest tracker shortcut when `tztok_jad` or `tzkal_zuk` is alive so pressing `Q` for Protect from Magic in Fight Caves does not fold/unfold the quest tracker.
  - Updated `assets/multiplayer/mp-sync-engine.js`, `mp-actor-renderer.js`, and `mp-constants.js` to sync `0.14.0` boss `shielded` state, `notice` events, new weapon `playerSeq` animations (`393`, `2062`), and the 10 new adventurers and 6 new maps.
- **Notes / Invariants for Future Agents**:
  - In `0.14.0`, `blood_barrage` exists upstream right after `shadow_barrage`; `05-weapons-passives.patch.js` updates upstream's `blood_barrage` entry in-place (preserving `family: "ancient_burst"`) rather than inserting a second `blood_barrage` object.

### 2026-10-29 - Claude Code - Debug stat panel (debug-mode.js v7.9)
- **Commit / PR**: merged onto `main` after v7.8
- **Files Modified**: `assets/debug-mode.js`, `index.html` (only the `debug-mode.js` tag, `?v=7.8` -> `?v=7.9`)
- **Bundle / Version Impact**: None to the engine bundle or `multiplayer.js`, so the other 5 entry points keep `?v=7.8`.
- **What Changed**:
  - **Turning it on**: `debugmode` still turns debug mode on with the old god-mode preset (1M HP, max armour, invulnerable, Shift 3x sprint); `bugmode` turns it off.
  - **Panel**: while debug mode is on, `\` (`KeyboardEvent.code === "Backslash"`) opens a panel of notched sliders, plus an Invulnerable checkbox and "God mode preset" / "All normal" buttons. Settings persist in `localStorage` under `runEscapeDebugPanel`.
  - **Sliders and how they apply**:
    - Max HP: override.
    - Armour, regen, thorns, heal chance, pickup range, damage % (`might`), range/attack size (`area`), projectile speed, extra projectiles (`amount`), duration, luck, XP and coin gain: added on top of the game's own stats in a `sim.updateStats` wrapper.
    - Move speed 1-10x and Shift sprint 1-10x: `sim.stepPlayer` wrapper.
    - Attack speed 1-10x: `sim.cooldownTicks` wrapper, which bypasses the game's 60% / 5-tick cooldown cap, minimum 1 tick.
    - Base damage: flat amount added to each hit in a `sim.damageEnemy` wrapper.
  - **Co-op**: the guest's `coop_debug` message now carries `{on, invuln, hp}`, so the host applies the guest's chosen max HP and only tops it up when it's invulnerable.
- **Notes / Invariants for Future Agents**:
  - Offence sliders only affect the local simulation. In co-op the host fires guests' weapons, so a guest's damage, attack speed and range sliders don't change their attacks; HP, invulnerability and movement do sync.
  - Still **MUST BE REMOVED IF WE GO LIVE**: delete `assets/debug-mode.js`, its tag and comment in `index.html`, and `coop_debug` in both `serve.py` allowlists.

### 2026-10-29 - Antigravity - Serve Live Editable CHANGELOG.md (v7.8)
- **Commit / PR**: Live `CHANGELOG.md` (`?v=7.8`)
- **Files Modified**: `CHANGELOG.md`, `serve.py`, `scripts/patches/01-core-engine.patch.js`, `assets/index-XWbnxuVz.js`, `index.html`, `assets/multiplayer.js`, `assets/multiplayer/mp-*.js`, `assets/MapViewerApp-DKojfbH1.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-C9loB8SI.js`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=7.7` to `?v=7.8`.
- **What Changed**:
  - Extracted the full in-game changelog into root [`CHANGELOG.md`](./CHANGELOG.md) and whitelisted `/CHANGELOG.md` and `/changelog.md` in `serve.py`.
  - Patched `JK` (`"JK live fetch CHANGELOG.md"` in `01-core-engine.patch.js`) to dynamically fetch `CHANGELOG.md` (`{cache: "no-cache"}`) and parse it via `ZK(txt)` whenever the Changelog modal is opened, falling back to `QK`.
- **Notes / Invariants for Future Agents**:
  - Editing `CHANGELOG.md` updates the live in-game changelog immediately without requiring a bundle rebuild.

### 2026-10-29 - Antigravity - In-Game Changelog Summary & Pause Menu Single Info Box (v7.7)
- **Commit / PR**: `68da5c5` (`?v=7.8`)
- **Files Modified**: `scripts/patches/01-core-engine.patch.js`, `assets/index-XWbnxuVz.js`, `index.html`, `assets/multiplayer.js`, `assets/multiplayer/mp-*.js`, `assets/MapViewerApp-DKojfbH1.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-C9loB8SI.js`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=7.6` to `?v=7.8` across all entry points and submodules.
- **What Changed**:
  - Added rule `"In-game changelog custom summary"` in `scripts/patches/01-core-engine.patch.js` to prepend a player-facing summary of `AGENT_NOTES.md` custom features and balance updates at the top of the in-game Changelog modal (`const $K`).
  - Removed native browser `title` hover attributes from rules `"OZ Pause modal hover descriptions (#2)"` and `"OZ Pause modal hover descriptions (#3)"` in `scripts/patches/01-core-engine.patch.js` so hovering items/weapons/passives in the Pause menu displays effects exclusively in the dedicated Pause menu info box.
- **Notes / Invariants for Future Agents**:
  - When updating `const $K` in `01-core-engine.patch.js`, avoid unescaped backticks in the markdown replacement string since `$K` is a template literal in the bundle.

### 2026-10-29 - Antigravity - Lower Rapid Heal to 2.5/lvl & Disable for 5s on Hit (v7.6)
- **Commit / PR**: Rapid Heal nerf & 5s hit cooldown (`?v=7.8`)
- **Files Modified**: `index.html`, `assets/index-XWbnxuVz.js`, `assets/multiplayer.js`, `assets/multiplayer/mp-*.js`, `assets/MapViewerApp-DKojfbH1.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-C9loB8SI.js`, `scripts/patches/01-core-engine.patch.js`, `scripts/patches/05-weapons-passives.patch.js`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=7.5` to `?v=7.8` across all entry points and submodules.
- **What Changed**:
  - Lowered `rapid_heal` base regen from `4` to `2.5` HP/min per level (`perLevel: 2.5`).
  - Added a 5-second (`5 * gt` = 150 ticks) cooldown on `rapid_heal` whenever the player takes damage (`r.regenPausedUntil = this.tick + 5 * gt` in `damagePlayer` and `sim.player.regenPausedUntil = sim.tick + 150` on Co-Op guests in `assets/multiplayer/mp-sync-engine.js`), subtracting `rapid_heal`'s value from `this.stats.regen` in `stepPlayer` while `this.tick < (n.regenPausedUntil ?? 0)`.
- **Notes / Invariants for Future Agents**:
  - `stepPlayer` only subtracts `rapid_heal`'s passive value during `regenPausedUntil`, leaving temporary potion regen (such as `Sanfew serum`) unaffected.

### 2026-10-29 - Antigravity - Disable Browser Right-Click Context Menu in Game Window (v7.6)
- **Commit / PR**: Disable right-click context menu (?v=7.8)
- **Files Modified**: index.html, ssets/multiplayer.js, ssets/multiplayer/mp-*.js, ssets/index-XWbnxuVz.js, ssets/MapViewerApp-DKojfbH1.js, ssets/RenderDataWorker-CRRhTJTb.js, ssets/module-Cg9b2g3N.js, ssets/module-C9loB8SI.js, scripts/patches/01-core-engine.patch.js, AGENT_NOTES.md
- **Bundle / Version Impact**: Bumped cache-busting query string from ?v=7.5 to ?v=7.8 across all entry points and submodule imports.
- **What Changed**:
  - Added a top-level window.addEventListener('contextmenu', (e) => e.preventDefault()) listener in ssets/multiplayer.js to suppress the native browser right-click context menu across the game window (zK.init() detaches MapViewer.inputManager's default contextmenu listener when initializing the game renderer).
- **Notes / Invariants for Future Agents**:
  - Keeping the contextmenu listener in ssets/multiplayer.js avoids adding an inline bundle hook and persists automatically across upstream bundle updates.

### 2026-10-29 - Antigravity - Adjust Healing Buffs (1/3rd), Decouple Rapid Heal from Blood Barrage & Fix Seq 1979 + SpotAnim 377 (v7.5)
- **Commit / PR**: Healing balance & Blood Barrage animation fix (`?v=7.8`)
- **Files Modified**: `index.html`, `assets/index-XWbnxuVz.js`, `assets/multiplayer.js`, `assets/multiplayer/mp-*.js`, `assets/MapViewerApp-DKojfbH1.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-C9loB8SI.js`, `scripts/patches/01-core-engine.patch.js`, `scripts/patches/04-characters.patch.js`, `scripts/patches/05-weapons-passives.patch.js`, `caches/caches.json`, `caches/osrs-241_2026-09-30-slim-4cd931ae/main_file_cache.{dat2,idx0,idx7}`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=7.4` to `?v=7.5` across all entry points and bumped `CacheStorage` key from `-v10` to `-v11` in both `assets/index-XWbnxuVz.js` and `assets/RenderDataWorker-CRRhTJTb.js`.
- **What Changed**:
  - Decoupled `rapid_heal` from the `blood_burst` -> `blood_barrage` upgrade in `scripts/patches/05-weapons-passives.patch.js` (`evolution: { into: "blood_barrage" }` without `requiresPassive`, and updated the level-up evolution check to `(!S.def.evolution.requiresPassive || g.has(S.def.evolution.requiresPassive))`).
  - Lowered healing buffs to 1/3rd of their previous values: `rapid_heal` (`perLevel: 12 -> 4` HP/min), `blood_burst` (`chance: 0.15, fraction: 0.25, max: 2`), `blood_barrage` (`chance: 0.25, fraction: 0.25, max: 2`), `sanfew_serum` (`heal: 15 -> 5`, `regen: 30 -> 10` HP/min), and `saradomin_brew` (`amount: 25 -> 8` HP).
  - Configured Blood Barrage to use player casting animation `playerSeq: 1979` and visual spot animation `SpotAnim 377` (`castSpotAnim: 377, impactSpotAnim: 377`), updated `drawPlayer` (`scripts/patches/04-characters.patch.js`) and remote Co-Op player rendering (`assets/multiplayer/mp-sync-engine.js`) so `attackSeq === 1979` plays its full 66-tick Barrage casting sequence without being truncated at 12 ticks while moving, and injected `SpotAnim 377`'s missing OSRS archives (`idx7[6375]` model and `idx0[7571]` frame group) into `caches/osrs-241_2026-09-30-slim-4cd931ae`.
- **Notes / Invariants for Future Agents**:
  - Always update `scripts/patches/01..06-*.patch.js` before running `node scripts/apply_patches.js`, and bump `CacheStorage` key in both `01-core-engine.patch.js` and `assets/RenderDataWorker-CRRhTJTb.js` whenever `caches/osrs-241_2026-09-30-slim-4cd931ae/` changes.

### 2026-10-29 - Antigravity - Execute Architecture Modernization Roadmap (Phases 1-5, v7.4)
- **Commit / PR**: Modular Patch Pipeline + `assets/multiplayer/*.js` 9-Module ES Decomposition (`?v=7.8`)
- **Files Modified**: `index.html`, `assets/index-XWbnxuVz.js`, `assets/multiplayer.js`, `assets/multiplayer/mp-constants.js`, `assets/multiplayer/mp-event-bus.js`, `assets/multiplayer/mp-prayers.js`, `assets/multiplayer/mp-transport.js`, `assets/multiplayer/mp-lobby-ui.js`, `assets/multiplayer/mp-hud-leaderboard.js`, `assets/multiplayer/mp-actor-renderer.js`, `assets/multiplayer/mp-pickups.js`, `assets/multiplayer/mp-sync-engine.js`, `scripts/discover_symbols.js`, `scripts/apply_patches.js`, `scripts/patches/01-core-engine.patch.js`, `scripts/patches/02-icon-rasterizer.patch.js`, `scripts/patches/03-maps.patch.js`, `scripts/patches/04-characters.patch.js`, `scripts/patches/05-weapons-passives.patch.js`, `scripts/patches/06-multiplayer-hooks.patch.js`, `assets/MapViewerApp-DKojfbH1.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-C9loB8SI.js`, `AGENTS.md`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=7.3` to `?v=7.4` across all entry points and `assets/multiplayer.js` submodule imports.
- **What Changed**:
  - **Automated Symbol Discovery (`scripts/discover_symbols.js`)**: Implemented and verified 21 invariant anchor regex extractors (`Client`, `Sim`, `Characters`, `Maps`, `ThrallDefs`, `EnemyDefLookup`, `AppearanceLookup`, `SimAppearance`, `IconCache`, `IconRasterizer`, `WaveBuilder`, `Weapons`, `WeaponDefLookup`, `Passives`, `PassiveDefLookup`, `PostRunStats`, `PauseModal`, `SettingsModal`, `AdventurerSelectModal`, `MapDefLookup`, `MapUnlockCheck`) with 100% uniqueness assertions.
  - **Domain-Scoped Patch Modules (`scripts/patches/01..06-*.patch.js` & `scripts/apply_patches.js`)**: Replaced the monolithic 105 KB patch script with 6 modular domain patch scripts (<20 KB each) and extended `window.gameClient` with `getWeapons: () => ir`, `getPassives: () => hw`, and `waveBuilder: Os`.
  - **9-Module ES Decomposition of `assets/multiplayer.js`**: Split the 4,804-line `assets/multiplayer.js` monolith into a 120-line root facade (`assets/multiplayer.js`) plus 9 focused ES modules under `assets/multiplayer/` (`mp-constants.js`, `mp-event-bus.js`, `mp-prayers.js`, `mp-transport.js`, `mp-lobby-ui.js`, `mp-hud-leaderboard.js`, `mp-actor-renderer.js`, `mp-pickups.js`, `mp-sync-engine.js`), preserving 100% of all 52 `MultiplayerManager` methods and all global hooks (`window.multiplayer`, `window.multiplayer.bus`, `window._osrsPrayer`, `window._drawOsrsPrayerOverlay`, `window._hideOsrsPrayerBar`, `window.l33th4x0r`).
- **Notes / Invariants for Future Agents**:
  - Edit the specific domain submodule in `assets/multiplayer/mp-*.js` or `scripts/patches/01..06-*.patch.js` rather than recreating monolithic files.
  - When bumping `?v=X.Y`, also update the `?v=X.Y` query strings on the submodule imports in `assets/multiplayer.js` and `assets/multiplayer/mp-*.js`.

### 2026-10-29 - Antigravity - Pull Upstream main (v7.3) & Architecture Evaluation Report (R1-R4)
- **Commit / PR**: Fast-forward pull of `d702c84` (`v7.3`) + `ARCHITECTURE_EVALUATION.md`
- **Files Modified**: `AGENT_NOTES.md`, `ARCHITECTURE_EVALUATION.md` (plus fast-forwarded `v7.3` files from `d702c84`)
- **Bundle / Version Impact**: Synced local workspace to `?v=7.4` and `CacheStorage` key `-v11`.
- **What Changed**:
  - Fast-forwarded local `main` to `origin/main` (`d702c84`: Cook's Assistant quest `assets/cooks-assistant.js`, Jad/Zuk co-op prayer & recovery fixes, real OSRS prayer sprites `assets/prayer/*.png`, tile coordinate HUD `assets/tile-coords.js`, debug mode `assets/debug-mode.js`, and HTTP Range/206 support in `serve.py`).
  - Added `ARCHITECTURE_EVALUATION.md` documenting the 105-rule bundle patch classification (75 Runtime-Extractable vs 30 Core Inline Hooks), 21-symbol automated Invariant Anchor discovery pipeline, and 9-module ES decomposition blueprint for `assets/multiplayer.js`.
  - Updated the Active Bundle & Hook Registry table in `AGENT_NOTES.md` to reflect `?v=7.4`, `-v10`, and the 3 new module scripts.
- **Notes / Invariants for Future Agents**:
  - Note that `assets/cooks-assistant.js`, `assets/tile-coords.js`, and `assets/debug-mode.js` already follow the external runtime script pattern recommended in `ARCHITECTURE_EVALUATION.md`; remember to include their `?v=X.Y` query strings in `index.html` when bumping versions.

### 2026-10-29 - Claude Code - Cook's Assistant, Jad co-op fixes, jad-fix port, prayer sprites, debug mode (v7.3)
- **Commit / PR**: branch `quest-test` merged into `main`
- **Files Modified**: `index.html`, `assets/index-XWbnxuVz.js`, `assets/multiplayer.js`, `assets/MapViewerApp-DKojfbH1.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-C9loB8SI.js`, `serve.py`, `caches/osrs-241_2026-09-30-slim-4cd931ae/main_file_cache.{dat2,idx0,idx5,idx7}`; new `assets/cooks-assistant.js`, `assets/tile-coords.js`, `assets/debug-mode.js`, `assets/quest-complete.ogg`, `assets/prayer/*.png` (force-added past the `*.png` ignore rule)
- **Bundle / Version Impact**: `?v=7.2` -> `?v=7.3` in all 6 entry points. CacheStorage key `-v9` -> `-v10` in the main bundle and `-v5` -> `-v10` in `RenderDataWorker-CRRhTJTb.js`, because the 4cd931ae cache contents changed under the same name.
- **What Changed**:
  - **jad-fix port (e3e53f8)**: Jad recovery 2.2 s (1.2 s enraged), Zuk 2.0 s (1.1 s). No new wind-up while the boss's own projectile is in flight. Jad's Call healers is enrage-only and fires on enrage.
  - **Jad/Zuk co-op fixes**:
    - `bossHit` uses a teammate's own synced prayer and no longer falls back to the host's `window._osrsPrayer`.
    - The guest's wind-up sync carries the blast `targets` (7th array field); `drawBossWindups` guards `r.targets||[]`. Before, it threw every frame on guests for Rockfall and killed the pray banner.
    - The banner is pinned under the boss health bar when the boss is off-screen.
    - Menus (level-up, casket, pause) hide the prayer bar without clearing the prayer.
    - Prayers clear only after the boss has been absent for 3 s (guest sync flicker), or on death or run end.
    - Sounds: a teammate's `playerHit` plays quietly at their position; blocked hits skip the grunt; Jad/Zuk attack sounds play at wind-up start instead of on landing.
  - **Cook's Assistant** (`assets/cooks-assistant.js`, Lumbridge):
    - Cook NPC 4626 at 3210,3216; Space to start or hand in; overhead line on start.
    - Milk 3253,3274; egg 3185,3278; flour 3166,3302; minimap markers.
    - Co-op shared via the `coop_quest` message.
    - Rewards: OSRS quest-complete scroll (pauses the run) with jingle, then 500 coins, an Antique lamp, +3 levels and an Elite casket.
  - **Gates opened in the cache** (index 5): cow pen (region 12851) and farm coop (region 12595). Added index 0 group 12217 and index 7 groups 199, 13897, 10980, 12750, 2504, 2437, 2406, 2531.
  - **Settings**: a "Tile coordinates" toggle (`display.showCoords`, `toggleCoords`) drives `assets/tile-coords.js`.
  - **Prayer sprites**: real OSRS sprites (cache sprites 127-129 and headicons group 440) replace the drawn prayer icons in `multiplayer.js`.
  - **Debug mode** (`assets/debug-mode.js`): secret code `debugmode` gives 1M HP, max armor and Shift for 3x speed; `bugmode` turns it off. A guest in debug mode sends `coop_debug` so the host keeps it topped up. **MUST BE REMOVED IF WE GO LIVE** (shipped on request).
  - **`serve.py`**: `coop_quest` and `coop_debug` added to both allowlists; HTTP Range/206 support for audio.
- **Notes / Invariants for Future Agents**:
  - New inline bundle anchors:
    - `window.__runEscapeItems=tC` (item table) and `window.__runEscapeIcons=A0` (icon cache)
    - `toggleCoords()` and the `showCoords` display key
    - `_rec` recovery logic in `stepBoss`
    - the summon-on-enrage block in `enrage()`
    - the co-op slot check in `bossHit`'s `activePrayer`
    - the `playerHit` sound case
    - the Jad/Zuk `bossAttack` push at wind-up
  - Removing debug mode means deleting `assets/debug-mode.js`, its `<script>` tag and comment in `index.html`, and `coop_debug` from both allowlists in `serve.py`.

### 2026-10-29 - Antigravity - Upstream 0.13.0 Merge (Quests, Amulet of Blood Fury, Pile Merging) + Custom Features (v7.0)
- **Commit / PR**: Upstream `0.13.0` (`index-XWbnxuVz.js`) merge (`?v=7.2`)
- **Files Modified**: `index.html`, `assets/index-XWbnxuVz.js`, `assets/index-Cu_WH1lb.css`, `assets/MapViewerApp-DKojfbH1.js`, `assets/module-C9loB8SI.js`, `assets/module-Cg9b2g3N.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/multiplayer.js`, `caches/caches.json`, `caches/osrs-241_2026-09-30-slim-4cd931ae/*`, `AGENTS.md`, `AGENT_NOTES.md`, `c:/Git/.agents/skills/merge-update/SKILL.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=6.7` to `?v=7.2` and `CacheStorage` key from `-v8` to `-v9`. Main bundle changed from `index-Ybwr2vLz.js` to `index-XWbnxuVz.js`; CSS from `index-Ck-75d-q.css` to `index-Cu_WH1lb.css`; MapViewer from `MapViewerApp-ws1SF5sq.js` to `MapViewerApp-DKojfbH1.js`; main WASM loader from `module-DiacdDog.js` to `module-C9loB8SI.js`.
- **What Changed**:
  - Merged upstream `0.13.0` features: **22 OSRS Quests** screen & post-run quest completion rewards, **Amulet of blood fury** (`id: "amulet_of_blood_fury"`, `objId: 24780`, `healChance`), **bone & coin pile merging** (`gatherPiles` / `slideIntoPile` with dynamic bone model tiers up to Superior dragon bones), and old-school bevelled scrollbars.
  - Merged all 36 custom OSRS cache archives (Corgi `16370`, Chihuahua `16543`, Fight Caves map `9551` & rock/wall models `9258..9297`, TzKal-Zuk `7706` model `33011`, framemap `1691`, and animations `7294..7298`) into `caches/osrs-241_2026-09-30-slim-4cd931ae`.
  - Ported all 104 custom engine rules to `assets/index-XWbnxuVz.js` (`0.13.0` symbol shifts: Client `vw -> xw`, Sim `KW -> r$`, Characters `Qa -> Ja`, Maps `eC -> aC`, Map lookup `ys -> Wi`, Map unlock `No -> Vr`, Enemy lookup `hi -> Jn`, Sim appearance `_$ -> U$`, Icon rasterizer `qG -> QG`, Settings modal `uZ -> kZ`, Adventurer select `vZ/wZ -> NZ/BZ`, Pause modal `OZ -> $Z`).
  - Kept our custom **Blood Burst & Blood Barrage (`id: "blood_barrage"`)** evolution (`SpotAnim 377`) paired with **Rapid Heal** (`+12 HP regen/min` per level), buffed **Saradomin brew** and **Sanfew serum**, **Fight Caves** (TzTok-Jad at 6:00, TzKal-Zuk at 12:00), **Dipper & Elias**, secret codes (`l33th4x0r`, `dipperthedog`, `barkelly`), UI scale, and Co-Op Multiplayer.
  - Updated `assets/multiplayer.js` (`stepRemotePlayerPickups` and `applyWorldSync`) to reset `pileUid = 0` on remote-attracted and synced pickups so `0.13.0` pile merging works seamlessly in Co-Op.
- **Notes / Invariants for Future Agents**:
  - When porting `patch_0130.js` to a future upstream bundle, use a compact Node transformation script (`build_patch_*.js`) rather than emitting a >100 KB `write_file` call directly.
  - Preserve `healChance` in the gear stat label table and `this.gatherPiles()` inside `stepPickups()`.

### 2026-10-29 - Antigravity - Multi-Agent Handoff Protocol & PR #6 Merge Fix
- **Commit / PR**: Workspace protocol setup + PR #6 merge artifact fix
- **Files Modified**: `AGENTS.md`, `AGENT_NOTES.md`, `README.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `MULTIPLAYER_ARCHITECTURE.md`, `serve.py`, `test_serve.py`, `assets/multiplayer.js`, `c:/Git/.agents/skills/merge-update/SKILL.md`, `c:/Git/AGENTS.md`
- **Bundle / Version Impact**: Current active version is `?v=6.7` (`index-Ybwr2vLz.js`).
- **What Changed**:
  - Established [`AGENTS.md`](./AGENTS.md) and [`AGENT_NOTES.md`](./AGENT_NOTES.md) and added explicit agent directives to [`README.md`](./README.md), [`CLAUDE.md`](./CLAUDE.md), [`.cursorrules`](./.cursorrules), [`.github/copilot-instructions.md`](./.github/copilot-instructions.md), [`MULTIPLAYER_ARCHITECTURE.md`](./MULTIPLAYER_ARCHITECTURE.md), [`serve.py`](./serve.py), and [`assets/multiplayer.js`](./assets/multiplayer.js).
  - Added the `merge-update` skill to coordinate parallel subagents during upstream or contributor branch merges.
  - Resolved a lingering merge conflict artifact in `_register_ws_client` inside [`serve.py`](./serve.py) and [`test_serve.py`](./test_serve.py) from PR #6 where bare `return` statements prevented room creation and caused 2 unit test failures; all 39 unit tests in `test_serve.py` now pass.
- **Notes / Invariants for Future Agents**:
  - `_register_ws_client` in `serve.py` must always return a 6-tuple `(bool, role, slot, host_slot, active_slots, peer_count)`.
  - Always bump `?v=X.Y` in all 6 bundle/HTML locations when changing client JS/WASM/CSS assets.

### 2026-10-28 - Antigravity - Fight Caves TzKal-Zuk (NPC 7706) & Collision Radius Fix
- **Commit / PR**: `d1c331f`, `3fe80ee`
- **Files Modified**: `index.html`, `assets/index-Ybwr2vLz.js`, `assets/multiplayer.js`, `assets/MapViewerApp-ws1SF5sq.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-DiacdDog.js`, `caches/osrs/main_file_cache.*`, `caches/2009/main_file_cache.*`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=6.6` to `?v=6.7`.
- **What Changed**:
  - Added TzKal-Zuk (`tzkal_zuk`, NPC 7706) at 12:00 in `fight_caves`, with TzTok-Jad (`tztok_jad`, NPC 3127) spawning at 6:00.
  - Set `tzkal_zuk` collision radius to `0.45` in `assets/index-Ybwr2vLz.js` so tile-centered boss spawns do not clip or get stuck.
  - Updated `assets/multiplayer.js` prayer hotkeys (`KeyQ`, `KeyE`, `KeyR`) and `window._drawOsrsPrayerOverlay` to recognize both `tztok_jad` and `tzkal_zuk` (`Slam` mapped to melee prayer).
- **Notes / Invariants for Future Agents**:
  - Binary cache files (`caches/osrs/main_file_cache.dat2` and `caches/2009/main_file_cache.dat2`) contain patched NPC/model indices for NPC 7706. Do not overwrite `caches/` with unpatched upstream caches without re-applying the NPC 7706 cache patch.

### 2026-10-28 - Jules (Sentinel / Code Health) - WebSocket Relay Security & Unit Tests
- **Commit / PR**: PR #2 (`04127a2`), PR #5 (`af8056c`), PR #6 (`955c088`), PR #7 (`4a4fdd0`)
- **Files Modified**: `serve.py`, `test_serve.py`, `.jules/sentinel.md`
- **Bundle / Version Impact**: None (backend only).
- **What Changed**:
  - Strict hostname extraction in `serve.py` via `(urllib.parse.urlparse(url).hostname or "").lower()` to prevent authority userinfo bypasses in `Origin` validation.
  - Added `_safe_close_socket` helper, `_sanitize_room_id` tests, and default port unit tests in `test_serve.py`.
- **Notes / Invariants for Future Agents**:
  - Never use `urlparse(origin).netloc.split(":")[0]` for host validation in `serve.py`. Always run `python -m unittest test_serve.py` after touching `serve.py`.
