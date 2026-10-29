# Run Escape - Cross-Agent Handoff Notes & Bundle Patch Map

> **Instructions for All Agents**: Read the **Active Bundle & Hook Registry** and the most recent entries in the **Chronological Agent Handoff Log** before starting work. When your task is complete, prepend a new entry at the top of the log using the template below.

---

## 1. Active Bundle & Hook Registry

### Current Active Asset Files (Version `?v=7.6` - Upstream `0.13.0`)
| Role | Active File | Imported / Referenced By |
| :--- | :--- | :--- |
| **HTML Entrypoint** | [`index.html`](./index.html) | Browser root (`?v=7.6`) |
| **Main Engine Bundle** | [`assets/index-XWbnxuVz.js`](./assets/index-XWbnxuVz.js) | `index.html`, `MapViewerApp-DKojfbH1.js`, `module-C9loB8SI.js` |
| **Co-Op Facade Entrypoint** | [`assets/multiplayer.js`](./assets/multiplayer.js) | `index.html` (`?v=7.6`, imports `assets/multiplayer/mp-*.js?v=7.6`) |
| **Co-Op Submodules (9)** | [`assets/multiplayer/`](./assets/multiplayer/) | `mp-constants.js`, `mp-event-bus.js`, `mp-prayers.js`, `mp-transport.js`, `mp-lobby-ui.js`, `mp-hud-leaderboard.js`, `mp-actor-renderer.js`, `mp-pickups.js`, `mp-sync-engine.js` |
| **Symbol Discovery & Patcher** | [`scripts/apply_patches.js`](./scripts/apply_patches.js) | `scripts/discover_symbols.js` + `scripts/patches/01..06-*.patch.js` |
| **Cook's Assistant Quest** | [`assets/cooks-assistant.js`](./assets/cooks-assistant.js) | `index.html` (`?v=7.6`) |
| **Tile Coordinate HUD** | [`assets/tile-coords.js`](./assets/tile-coords.js) | `index.html` (`?v=7.6`) |
| **Debug / God Mode** | [`assets/debug-mode.js`](./assets/debug-mode.js) | `index.html` (`?v=7.6`, remove before live production) |
| **Main Stylesheet** | [`assets/index-Cu_WH1lb.css`](./assets/index-Cu_WH1lb.css) | `index.html` |
| **Map Viewer Bundle** | [`assets/MapViewerApp-DKojfbH1.js`](./assets/MapViewerApp-DKojfbH1.js) | `assets/index-XWbnxuVz.js` |
| **Render Worker** | [`assets/RenderDataWorker-CRRhTJTb.js`](./assets/RenderDataWorker-CRRhTJTb.js) | `assets/index-XWbnxuVz.js` |
| **Worker WASM Loader** | [`assets/module-Cg9b2g3N.js`](./assets/module-Cg9b2g3N.js) | `assets/RenderDataWorker-CRRhTJTb.js` (`module-yzz5kVyQ.wasm`) |
| **Main WASM Loader** | [`assets/module-C9loB8SI.js`](./assets/module-C9loB8SI.js) | `assets/index-XWbnxuVz.js` (`module-yzz5kVyQ.wasm`) |
| **OSRS Slim Cache** | [`caches/osrs-241_2026-09-30-slim-4cd931ae`](./caches/osrs-241_2026-09-30-slim-4cd931ae) | [`caches/caches.json`](./caches/caches.json) (`CacheStorage` key `-v11`) |

### Inline Hooks in `assets/index-XWbnxuVz.js`
When merging a new upstream `index-*.js` bundle, ensure the following global hooks and custom patches are preserved or ported to the new bundle:
1. **Client Instance Export (`window.gameClient`)**:
   - Exposes the primary game client instance (`xw`, formerly `vw`) as `window.gameClient = p` during initialization (`xw.create`) and attaches helper methods (`getEnemyDef: Jn`, `getAppearance: E0`, `getSimAppearance: U$`, `iconCache: A0`, `getCharacters: () => Ja`, `getMaps: () => aC`, `getThrallDefs: () => Zh`) so [`assets/multiplayer.js`](./assets/multiplayer.js) can attach to `window.gameClient` and `window.gameClient.sim` (`r$`, formerly `KW`).
2. **Multiplayer Hook Callbacks (`window.multiplayer`)**:
   - References in `index-XWbnxuVz.js` delegate state transitions, spectator flow-field/pickup guards, minimap player dots, pause checks, and post-run damage leaderboards (`DZ`) to `window.multiplayer`.
3. **OSRS Overhead Prayer Hooks (`window._osrsPrayer`, `window._drawOsrsPrayerOverlay`, `window._hideOsrsPrayerBar`)**:
   - Used for Fight Caves (`fight_caves`) protection prayers (`magic` / `ranged` / `melee` via `Q` / `E` / `R`) against `tztok_jad` (NPC 3127) and `tzkal_zuk` (NPC 7706).
   - `window._drawOsrsPrayerOverlay(viewport, sim, alpha, ctx, scale, playerScreenPos)` renders overhead prayer icons and boss attack windup banners.
4. **Custom Maps, Characters, Weapons & Boss Definitions**:
   - `fight_caves`: Spawns TzTok-Jad (`tztok_jad`, NPC 3127) at 6:00 (`at: 360`) and TzKal-Zuk (`tzkal_zuk`, NPC 7706, collision radius `0.45`) at 12:00 (`at: 720`), plus custom cache archives in `caches/osrs-241_2026-09-30-slim-4cd931ae/`.
   - Custom secret-code characters in `Ja`: `dipper` (NPC `16370`, code `dipperthedog`) and `elias` (NPC `16543`, code `barkelly`), rendered in 2D icons via `QG` (`t < 0`) and in 3D via `drawPlayer` / `submitActors`.
   - Custom `blood_burst` -> `blood_barrage` (`id: "blood_barrage"`, `SpotAnim 377`) weapon evolution paired with `rapid_heal` (`perLevel: 12`), plus buffed `Saradomin brew` and `Sanfew serum`.

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

### 2026-10-29 - Antigravity - Lower Rapid Heal to 2.5/lvl & Disable for 5s on Hit (v7.6)
- **Commit / PR**: Rapid Heal nerf & 5s hit cooldown (`?v=7.6`)
- **Files Modified**: `index.html`, `assets/index-XWbnxuVz.js`, `assets/multiplayer.js`, `assets/multiplayer/mp-*.js`, `assets/MapViewerApp-DKojfbH1.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-C9loB8SI.js`, `scripts/patches/01-core-engine.patch.js`, `scripts/patches/05-weapons-passives.patch.js`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=7.5` to `?v=7.6` across all entry points and submodules.
- **What Changed**:
  - Lowered `rapid_heal` base regen from `4` to `2.5` HP/min per level (`perLevel: 2.5`).
  - Added a 5-second (`5 * gt` = 150 ticks) cooldown on `rapid_heal` whenever the player takes damage (`r.regenPausedUntil = this.tick + 5 * gt` in `damagePlayer` and `sim.player.regenPausedUntil = sim.tick + 150` on Co-Op guests in `assets/multiplayer/mp-sync-engine.js`), subtracting `rapid_heal`'s value from `this.stats.regen` in `stepPlayer` while `this.tick < (n.regenPausedUntil ?? 0)`.
- **Notes / Invariants for Future Agents**:
  - `stepPlayer` only subtracts `rapid_heal`'s passive value during `regenPausedUntil`, leaving temporary potion regen (such as `Sanfew serum`) unaffected.

### 2026-10-29 - Antigravity - Disable Browser Right-Click Context Menu in Game Window (v7.6)
- **Commit / PR**: Disable right-click context menu (?v=7.6)
- **Files Modified**: index.html, ssets/multiplayer.js, ssets/multiplayer/mp-*.js, ssets/index-XWbnxuVz.js, ssets/MapViewerApp-DKojfbH1.js, ssets/RenderDataWorker-CRRhTJTb.js, ssets/module-Cg9b2g3N.js, ssets/module-C9loB8SI.js, scripts/patches/01-core-engine.patch.js, AGENT_NOTES.md
- **Bundle / Version Impact**: Bumped cache-busting query string from ?v=7.5 to ?v=7.6 across all entry points and submodule imports.
- **What Changed**:
  - Added a top-level window.addEventListener('contextmenu', (e) => e.preventDefault()) listener in ssets/multiplayer.js to suppress the native browser right-click context menu across the game window (zK.init() detaches MapViewer.inputManager's default contextmenu listener when initializing the game renderer).
- **Notes / Invariants for Future Agents**:
  - Keeping the contextmenu listener in ssets/multiplayer.js avoids adding an inline bundle hook and persists automatically across upstream bundle updates.

### 2026-10-29 - Antigravity - Adjust Healing Buffs (1/3rd), Decouple Rapid Heal from Blood Barrage & Fix Seq 1979 + SpotAnim 377 (v7.5)
- **Commit / PR**: Healing balance & Blood Barrage animation fix (`?v=7.6`)
- **Files Modified**: `index.html`, `assets/index-XWbnxuVz.js`, `assets/multiplayer.js`, `assets/multiplayer/mp-*.js`, `assets/MapViewerApp-DKojfbH1.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/module-Cg9b2g3N.js`, `assets/module-C9loB8SI.js`, `scripts/patches/01-core-engine.patch.js`, `scripts/patches/04-characters.patch.js`, `scripts/patches/05-weapons-passives.patch.js`, `caches/caches.json`, `caches/osrs-241_2026-09-30-slim-4cd931ae/main_file_cache.{dat2,idx0,idx7}`, `AGENT_NOTES.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=7.4` to `?v=7.5` across all entry points and bumped `CacheStorage` key from `-v10` to `-v11` in both `assets/index-XWbnxuVz.js` and `assets/RenderDataWorker-CRRhTJTb.js`.
- **What Changed**:
  - Decoupled `rapid_heal` from the `blood_burst` -> `blood_barrage` upgrade in `scripts/patches/05-weapons-passives.patch.js` (`evolution: { into: "blood_barrage" }` without `requiresPassive`, and updated the level-up evolution check to `(!S.def.evolution.requiresPassive || g.has(S.def.evolution.requiresPassive))`).
  - Lowered healing buffs to 1/3rd of their previous values: `rapid_heal` (`perLevel: 12 -> 4` HP/min), `blood_burst` (`chance: 0.15, fraction: 0.25, max: 2`), `blood_barrage` (`chance: 0.25, fraction: 0.25, max: 2`), `sanfew_serum` (`heal: 15 -> 5`, `regen: 30 -> 10` HP/min), and `saradomin_brew` (`amount: 25 -> 8` HP).
  - Configured Blood Barrage to use player casting animation `playerSeq: 1979` and visual spot animation `SpotAnim 377` (`castSpotAnim: 377, impactSpotAnim: 377`), updated `drawPlayer` (`scripts/patches/04-characters.patch.js`) and remote Co-Op player rendering (`assets/multiplayer/mp-sync-engine.js`) so `attackSeq === 1979` plays its full 66-tick Barrage casting sequence without being truncated at 12 ticks while moving, and injected `SpotAnim 377`'s missing OSRS archives (`idx7[6375]` model and `idx0[7571]` frame group) into `caches/osrs-241_2026-09-30-slim-4cd931ae`.
- **Notes / Invariants for Future Agents**:
  - Always update `scripts/patches/01..06-*.patch.js` before running `node scripts/apply_patches.js`, and bump `CacheStorage` key in both `01-core-engine.patch.js` and `assets/RenderDataWorker-CRRhTJTb.js` whenever `caches/osrs-241_2026-09-30-slim-4cd931ae/` changes.

### 2026-10-29 - Antigravity - Execute Architecture Modernization Roadmap (Phases 1-5, v7.4)
- **Commit / PR**: Modular Patch Pipeline + `assets/multiplayer/*.js` 9-Module ES Decomposition (`?v=7.6`)
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
