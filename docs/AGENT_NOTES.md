# Run Escape - Cross-Agent Handoff Notes & Bundle Patch Map

> **Instructions for All Agents**: Read the **Active Bundle & Hook Registry** and the most recent entries in the **Chronological Agent Handoff Log** before starting work. When your task is complete, prepend a new entry at the top of the log using the template below.

---

---

## Chronological Agent Handoff Log

### [2026-10-30] Fix Black Map Square Rendering Across All 20 Maps, Rebuild Slim Cache (`71087aea`) & Harden Fast Slim-Cache Verification

**Model**: Gemini (Antigravity)
**Commit**: (see git log)
**Bundle**: `index-CHsA59DT.js` (`?v=8.6`, MapViewer `MapViewerApp-CwrzFjbT.js`, Worker `RenderDataWorker-DKr4ZjBm.js`, WASM loader `module-BO6hrWmD.js`, styles `index-C3aiJD4m.css`, slim cache `osrs-241_2026-09-30-slim-71087aea`)

**Scope**: Root-caused and fixed black map square rendering across Lumbridge (and the Title Screen), Barbarian Village, Barrows, Wilderness, Kharidian Desert, Karamja, Prifddinas, Grand Exchange, East Varrock, Falador, and small-arena borders, rebuilt the slim cache (`osrs-241_2026-09-30-slim-71087aea`), and hardened `slim-cache.ts`, `Dat2SeqFrameLoader`, `MapManager`, and `WebGLMapViewerRenderer` to prevent recurrence.

**Changes implemented**:
- **Root Cause 1 - Outdated Tile-Visibility Filter in `loadSceneLocEntities` (`scripts/cache/slim-cache.ts`)**:
  - In `0.17.1` and `0.18.0`, upstream replaced the inline `scene.isInside` check in `SceneLocs.ts` with `isTileDrawn(scene, tile.minLevel, level, tileX, tileY, maxLevel)` from `UpperLevels.ts` (which draws upper-level tiles whenever `tile.minLevel <= maxLevel` or `hasWalkwayAbove(...)` is true).
  - However, `loadSceneLocEntities` in `scripts/cache/slim-cache.ts` still skipped any tile where `level > maxLevel && scene.isInside(maxLevel, x, y)`. As a result, animated `LocEntity` props and transformed multilocs on upper-level bridge/wall/walkway tiles were omitted from the slim cache:
    - Missing animation `0:8495` caused `SdMapDataLoader.load()` to throw on map squares `(50, 50)` (Lumbridge spawn & Title Screen, Barbarian Village), `(46, 49)` (Lumbridge, Karamja, Falador), and `(48, 56)` (Barbarian Village, Wilderness, Grand Exchange, East Varrock).
    - Missing animations `0:13133` and `0:5596` caused `SdMapDataLoader.load()` to throw on Prifddinas `(50, 95)` and `(51, 95)`.
    - Missing transformed `LocEntity` models `7:13282`, `7:13283`, `7:14065` (Barrows) and `7:58472`, `7:57663`, `7:57665` (Kharidian Desert) failed to load.
  - Updated `loadSceneLocEntities` in `scripts/cache/slim-cache.ts` to iterate all levels (`0..scene.levels - 1`) and all tiles (`0..scene.sizeX - 1`, `0..scene.sizeY - 1`) without any visibility filter that could drift from `SceneLocs.ts`, and rebuilt `caches/osrs-241_2026-09-30-slim-71087aea` (`26.3 MB`, +42 animation groups in index `0` and +8 model groups in index `7`).
- **Root Cause 2 - Zero-Margin `playArea` Clamping & Permanent `addInvalidMap` Blacklisting (`src/mapviewer/MapManager.ts`, `src/mapviewer/MapManager.test.ts`, `src/mapviewer/webgl/WebGLMapViewerRenderer.ts`, `src/rs/model/seq/SeqFrameLoader.ts`)**:
  - Updated `MapManager.update()` to include `margin = 2` (`MAP_MARGIN = 2` map squares) around `playArea` so the 1-2 border map squares visible within camera `renderDistance` and `PLAY_AREA_FADE` load cleanly while squares outside the slim cache's 2-square margin remain clamped out.
  - Updated `WebGLMapViewerRenderer.queueLoadMap()` `catch (e)` block to delete the failed square from `loadingMapIds` rather than permanently blacklisting it via `addInvalidMap`, and wrapped `Dat2SeqFrameLoader.load()` in `try/catch` (matching `DatSeqFrameLoader` and `ModelLoader`) so a single missing animation archive never crashes an entire 64x64 map square.
- **Preventive Safeguard - Full Map Loc/Model/Animation Coverage in Fast `--verify` Mode (`scripts/cache/slim-cache.ts`)**:
  - Upgraded `npm run verify-slim-cache` (`--verify` fast mode) to decode every map square's `locData` (`ByteBuffer`) across all 20 maps (+ `MAP_MARGIN = 2`) and verify every placed `locType`, `varManager` multiloc transform, `LocModelType` 3D model, and `seqId` animation frame archive in ~8 seconds (`14,446` groups read vs `3,529` previously).

**Tests**: `npx tsc --noEmit` (0 errors), `npm test` (411/411 passed across all 21 test suites), `npm run verify-slim-cache` (verified 14,446 groups in fast mode, 14,607 groups in full mode, and 902/902 map squares across all 20 maps via `SdMapDataLoader` + `loadMinimapData` with 0 failures), `python -m unittest server/test_serve.py` (55 tests OK).

---

### [2026-10-30] Fix Co-Op Multiplayer Monster Spawning (`FlowField.update`), Async/Co-Op Music Autoplay Unlock & Full 20-Map OSRS Music Soundtrack

**Model**: Gemini (Antigravity)
**Commit**: `fd2c917` / `66dd60d` / `54b73a5` (and full 20-map OSRS soundtrack commit - see git log)
**Bundle**: `index-Ha2ZVZWw.js` (`?v=8.6`, MapViewer `MapViewerApp-DiGiAIvF.js`, Worker `RenderDataWorker-DuhWd-BF.js`, WASM loader `module-D4rA2rWo.js`, styles `index-C3aiJD4m.css`, slim cache `osrs-241_2026-09-30-slim-64ff6328`)

**Scope**: Fixed a Co-Op multiplayer bug across Barrows and all maps (Regular `1x`, Extreme `2x`, and Nightmare `3x` difficulties) where only the 5 initial starter enemies spawned and stood frozen without moving or attacking players, fixed `GameAudio` music playback failing when started after async `loadGrid` or Co-Op WebSocket `start_run`, and added authentic OSRS music tracks across the Title Screen and all 20 campaign and fun maps.

**Changes implemented**:
- **Root Cause & Fix (`src/custom/multiplayer/mp-sync-engine.js`, `assets/multiplayer/mp-sync-engine.js`)**:
  - `FlowField.prototype.update(grid, targetX, targetY)` (`src/game/core/world/FlowField.ts`) takes `grid` as its first argument. However, `setupInGameHooks` in `mp-sync-engine.js` called `anchor.flowField.update(Math.floor(anchor.entity.x), Math.floor(anchor.entity.y), sim.grid)` in `sim.findSpawnPoint` and `t.flowField.update(tx, ty, sim.grid)` in `sim.stepEnemies`.
  - Passing `(tx, ty, sim.grid)` bound `grid` to the number `tx` and threw `TypeError: grid.isSolid is not a function` inside `canStep(grid, ...)` on every tick before `origStepEnemies()` or wave spawning could execute, leaving only the 5 manually spawned starter enemies frozen in place while `stepPlayer()` still let players walk through them.
  - Added `updateEntityFlowField(flowField, entity, force)` in `setupInGameHooks` which resolves solid tiles within `d = 1..3` (matching `Sim.updateFlowField()`) and invokes `flowField.update(sim.grid, tileX, tileY)` with the correct `(grid, targetX, targetY)` argument order.
  - Copied `peer.flowField.ditchY = sim.flowField.ditchY` when creating `peer.flowField`, initialized `poisonDamage: 0, poisonEnd: -1, lastHitTick: -999` on remote peer entities, and updated initial Host spawn `sim.flowField.update(sim.grid, ...)` after applying `SPAWN_OFFSETS`.
- **Full OSRS Music Soundtrack (`src/game/client/custom/customMusic.ts`, `src/game/client/custom/customMusic.test.ts`, `src/game/content/custom/customMaps.ts`, `src/game/client/GameClient.ts`, `scripts/sync_dist.cjs`, `assets/music/*.ogg`)**:
  - Added 20 compressed (`32 kHz` Vorbis `.ogg`) OSRS music tracks in `assets/music/*.ogg` (preserved in `scripts/sync_dist.cjs` `PRESERVED_ASSETS`) and assigned every campaign map, fun map, and the Title Screen its regional OSRS theme:
    - Title Screen / Menus: `Scape Main`
    - Campaign Maps: `Harmony` (Lumbridge), `Barbarianism` (Barbarian Village), `Dangerous Way` (Barrows), `Wilderness` (Wilderness), `Arabian` (Kharidian Desert), `Rellekka` (Fremennik Province), `Jungle Troubles` (Karamja), `March of the Shayzien` (Kourend), `Mistrock` (Varlamore), `The Curtain Closes` (Morytania), `Armageddon` (God Wars Dungeon), `Elven Seed` (Prifddinas), `Inferno` (The Inferno), `Fire and Brimstone` (Fight Caves)
    - Fun Maps: `The Trade Parade` (Grand Exchange), `Adventure` (East Varrock), `Massacre` (Falador), `Last Man Standing` (Last Man Standing), `Melodrama` (Castle Wars), `Null and Void` (Pest Control)
- **Music Playback & Settings Slider Fix (`src/game/client/GameAudio.ts`, `src/game/client/GameClient.ts`, `src/game/ui/GameUi.tsx`, `server/serve.py`)**:
  - Started `this.audio.playMusic(music)` synchronously at the beginning of `GameClient.startRun()` before `await this.loadGrid(mapId)` so the browser's user-gesture activation is preserved on first-time map loads.
  - Updated `GameAudio.unlock` and `GameAudio.setSettings` to resume `this.music.element.play()` if `this.music.element.paused && !this.settings.muted` (e.g., on the Title Screen or when a Co-Op run starts asynchronously via WebSocket `start_run`).
  - Enabled the `Music` volume slider on the main `Settings` screen (`<SoundSettings ui={ui} client={client} music />`) and added explicit `audio/ogg` MIME mapping in `server/serve.py`.
- **Integration Tests (`src/custom/multiplayer/multiplayer.test.ts`, `src/game/client/custom/customMusic.test.ts`)**:
  - Added real-`Sim` Co-Op integration tests on Barrows across Regular (`1x`) and Nightmare (`3x`) difficulty verifying that wave monsters spawn continuously beyond the initial 5 rats, chase players via `FlowField`, deal contact damage, and broadcast via `sync_world`, plus music coverage tests across all 20 maps.

**Tests**: `npx tsc --noEmit` (0 errors), `npm test` (411/411 passed across all 21 test suites), `npm run verify-slim-cache` (verified 3,529 groups), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Merge Upstream `0.18.0` (`3e5885c`), Rebuild Slim Cache (`64ff6328`), Fix Out-of-Bounds Map Square Worker Flood & Add Co-Op `0.18.0` Sync

**Model**: Gemini (Antigravity)
**Commit**: `2033144`
**Bundle**: `index-CHTowyrV.js` (`?v=8.6`, MapViewer `MapViewerApp-B6q-pfZW.js`, Worker `RenderDataWorker-DuhWd-BF.js`, WASM loader `module-VGKAynAb.js`, styles `index-C3aiJD4m.css`, slim cache `osrs-241_2026-09-30-slim-64ff6328`)

**Scope**: Merged upstream `main` (`59b6eff..3e5885c`, release `0.18.0` and `sim-collision-snapshots`) into `main`, regenerated and verified the slim cache (`osrs-241_2026-09-30-slim-64ff6328`, 14,394 groups in full mode) for all new `0.18.0` weapon stances, power-ups (`sled`, `giant_essence`, `evil_bob`, `fairy_ring`, `drill_demon`), and Toktz-mej-tal fire loc animations, fixed `MapManager` / `WebGLMapViewerRenderer` out-of-bounds map square worker flooding and `invalidMapIds` clearing on plane changes, and integrated all `0.18.0` features into Co-Op Multiplayer.

**Changes implemented**:
- **Upstream `0.18.0` Merge (`src/game/core/Sim.ts`, `src/game/core/entities.ts`, `src/game/client/GameAssets.ts`, `src/game/client/GameClient.ts`, `src/game/client/GameView.ts`, `src/game/content/powerups.ts`, `src/game/content/stances.ts`, `src/mapviewer/webgl/loc/UpperLevels.ts`, `src/mapviewer/webgl/loc/SceneLocs.ts`, `src/mapviewer/webgl/buffer/SceneBuffer.ts`, `scripts/cache/slim-cache.ts`, `scripts/game/collision-snapshot.ts`)**:
  - Merged per-weapon stances (`stances.ts`, walk-first `819` baking), 5 new power-ups (`Sled`, `Giant rune essence`, `Evil Bob`, `Fairy ring`, `Drill Demon`), Toktz-mej-tal real fire patches (`loc 5499`, `seq 475`, `sim.fires`), Prifddinas walkways & roof hiding (`UpperLevels.ts`), blocked-terrain faction war timeout (`canWalkStraight` / `foeWait`), and endless casket scarcity past 15 minutes.
  - Added custom weapon item IDs (`20756` Hill giant club, `9013`/`21276` Skull sceptre, `22370` Bryophyta's staff) to `src/game/content/stances.ts`.
  - Rebuilt and verified `caches/osrs-241_2026-09-30-slim-64ff6328` (`26.0 MB`) from the local full OSRS 241 cache and removed `caches/osrs-241_2026-09-30-slim-fa564245`.
- **Map Rendering & Worker Pool Fixes (`src/mapviewer/MapManager.ts`, `src/mapviewer/MapManager.test.ts`, `src/mapviewer/webgl/WebGLMapViewerRenderer.ts`, `src/game/client/GameClient.ts`)**:
  - Clamped `MapManager.update()` map square bounds (`mapStartX..mapEndX`, `mapStartY..mapEndY`) to `playArea` (`[baseX, baseY, baseX + sizeX, baseY + sizeY]`) and called `this.syncPlayArea()` in `GameClient` constructor, `startRun()`, and `leaveRun()`, preventing `camera ± 128` (`renderDistance`) from queuing unbaked border map squares outside the arena into `RenderDataWorkerPool`.
  - Preserved `invalidMapIds` across `MapManager.clearMaps()` / `setPlane()` transitions (e.g. entering or leaving God Wars Dungeon `plane: 2`).
  - Updated `WebGLMapViewerRenderer.queueLoadMap()` and `render()` to mark failed map square loads invalid (`addInvalidMap`) and clean up `loadingMapIds` when `!isValidMapData(mapData)`.
- **Co-Op Multiplayer `0.18.0` Integration & Bug Fixes (`src/custom/multiplayer/mp-constants.js`, `mp-lobby-ui.js`, `mp-actor-renderer.js`, `mp-pickups.js`, `mp-sync-engine.js`, `multiplayer.test.ts`, `assets/multiplayer/`)**:
  - Added missing `penance_fighter` (`weapon: 'battleaxe'`) to `ALL_CHARACTERS` in `mp-constants.js`.
  - Fixed `sim.relocate(enemy, behind)` hook in `mp-sync-engine.js` to pass `behind = true` through to `origRelocate` so the Fairy Ring power-up teleports nearby enemies behind the player in Co-Op.
  - Fixed Guest `sled` pickup in `mp-pickups.js`, `mp-actor-renderer.js`, and `mp-sync-engine.js` so a Guest picking up a Sled activates sledding on that Guest (rather than hijacking the Host's `sim.sledEndTick`) and renders `${dynKey}_sled` (`seqIds: [819, 1461, 1462]`) for sledding peers.
  - Added per-weapon stance baking (`819` walk-first) and Host -> Guest `sync_world` synchronization for `sim.rocks`, `sim.rampages`, `sim.rings`, `sim.fires`, `playerShout`, `powerUpHit`, and `powerUpEnded`.

**Tests**: `npx tsc --noEmit` (0 errors), `npm test` (407/407 passed across all 20 test suites), `npm run verify-slim-cache` (verified 3,529 groups in 5.30s; `--verify-full` verified 14,394 groups across all 20 maps in 29.35s), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Merge Upstream `0.17.1` - `0.17.2` (`59b6eff`), Sentinel `usedItemId` Spoofing Fix (`acb15a3`) & Debug Panel Game Speed Slider (`c56f7fa`)

**Model**: Gemini (Antigravity)
**Commit**: `8dea2e4`
**Bundle**: `index-DDOLshWh.js` (`?v=8.6`, MapViewer `MapViewerApp-Pk2JB77M.js`, Worker `RenderDataWorker-D4-1qx-e.js`, WASM loader `module-qsFJRNBT.js`, styles `index-C3aiJD4m.css`, slim cache `osrs-241_2026-09-30-slim-fa564245`)

**Scope**: Merged upstream `main` (`efc49f6..59b6eff`, releases `0.17.1` and `0.17.2`) into `main`, integrated the Jules Sentinel security fix (`acb15a3` on `origin/sentinel/fix-coop-loadout-useditemid-spoofing-12907676329992050147`) preventing Guest `usedItemId` spoofing in Co-Op loadout sync, and integrated the Debug Panel `gameSpeed` slider and top-pinned layout (`c56f7fa` on `origin/debug-panel`).

**Changes implemented**:
- **Upstream `0.17.1` & `0.17.2` Merge (`CHANGELOG.md`, `docs/GAMEPLAY.md`, `package.json`, `package-lock.json`, `src/game/content/items.ts`, `src/game/content/sets.ts`, `src/game/core/Loot.ts`, `src/game/core/Sim.ts`, `src/game/core/world/Collision.ts`, `src/mapviewer/webgl/loc/SceneLocs.ts`, and test files)**:
  - Merged `0.17.1` casket set-piece rework (`SET_PIECE_CHANCE` lowered from `30%` to `15%`, capped at 1 rarity tier above casket roll, and tracking `declinedSets` when alching/rerolling a started set's piece), Crystal armour unlock requirement (`beatMap: "prifddinas"`), and Grand Exchange / building wall visibility fix (`isTileDrawn` in `SceneLocs.ts`).
  - Merged `0.17.2` flow-field reachability check in `findFreeSpot` (`Collision.ts`) and `walkableSpot` (`Sim.ts`), integrating it with custom `findReachablePickupSpot` and `stepPickupSlide` in `Sim.dropPickup` so caskets/power-ups inside multi-tile solid blocks (e.g. 3x3 Pest Control portals) snap directly to the nearest reachable tile while 1-tile/edge obstacle drops smoothly slide toward the player.
- **Sentinel Security Fix for `usedItemId` Spoofing (`.jules/sentinel.md`, `src/custom/multiplayer/mp-actor-renderer.js`, `src/custom/multiplayer/multiplayer.test.ts`, `assets/multiplayer/mp-actor-renderer.js`)**:
  - Added allowlist validation (`ALLOWED_USED_ITEMS = new Set(['bonecrusher', 'red_chinchompa', 'black_chinchompa'])`) and inventory/loadout ownership verification (`hasItemInMsgOrPeer`) before executing `usedItemId` simulation effects on the Host, plus unit tests in `multiplayer.test.ts`.
- **Debug Panel Game Speed Slider & Top Pinning (`src/custom/debug-mode.js`, `assets/debug-mode.js`)**:
  - Added the `Game` slider group (`gameSpeed`, `0.25x` - `10x`, Host-authoritative in Co-Op via `hookGameSpeed`) and pinned `#debug-panel` to `top: 8px` with `box-sizing: border-box` and `max-height: calc((100vh - 16px) / var(--ui-scale, 1))`.

**Tests**: `npx tsc --noEmit` (0 errors), `npm test` (340/340 passed across all 17 test suites), `npm run verify-slim-cache` (verified 3,472 groups in 5.99s), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK), `node --check src/custom/debug-mode.js` (OK).

---

### [2026-10-30] Halve Dipper & Elias 3D Model Scale (`3.0` -> `1.5`)

**Model**: Gemini (Antigravity)
**Commit**: `4157404`
**Bundle**: `index-T4QWDNBf.js` (`?v=8.6`, MapViewer `MapViewerApp-BqlDYSTn.js`, Worker `RenderDataWorker-BqUjTjOH.js`, WASM loader `module-BtUvp74D.js`, styles `index-C3aiJD4m.css`, slim cache `osrs-241_2026-09-30-slim-fa564245`)

**Scope**: Reduced the 3D actor model scale for **Dipper** (`dipper`, Corgi) and **Elias** (`elias`, Chihuahua) by half (`3.0` -> `1.5`, and height offset `0.22` -> `0.11`) across singleplayer gameplay, the title/character select attract screen, and Co-Op multiplayer peer rendering.

**Changes implemented**:
- **Dog Actor Constants (`src/game/client/custom/dogActors.ts`)**:
  - Exported `DOG_ACTOR_SCALE = 1.5` (previously `3.0`) and `DOG_HEIGHT_OFFSET = 0.11` (previously `0.22`).
- **Singleplayer, Title Screen & Co-Op Rendering (`src/game/client/GameView.ts`, `src/game/client/GameClient.ts`, `src/custom/multiplayer/mp-sync-engine.js`, `assets/multiplayer/mp-sync-engine.js`)**:
  - Updated `GameView.drawPlayer` and `GameClient.submitActors` to use `DOG_ACTOR_SCALE` and `DOG_HEIGHT_OFFSET`.
  - Updated `mp-sync-engine.js` remote peer dog actor rendering to use `scale: 1.5` and `getCenterHeight() - 0.11`.

**Tests**: `npx tsc --noEmit` (0 errors), `npm run build` (`index-T4QWDNBf.js`), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Add Extreme One Chunk Man (2x Diff, 1.5x Pts) & Nightmare Man (3x Diff, 2.5x Pts) Challenge Modes

**Model**: Gemini (Antigravity)
**Commit**: `84e04d6`
**Bundle**: `index-D6Ox1VYG.js` (`?v=8.5`, MapViewer `MapViewerApp-DXw8zrc2.js`, Worker `RenderDataWorker-BqUjTjOH.js`, WASM loader `module-DMrSu1Mm.js`, styles `index-C3aiJD4m.css`, slim cache `osrs-241_2026-09-30-slim-fa564245`)

**Scope**: Added selectable **Extreme One Chunk Man** (`2x` map difficulty for `1.5x` points) and **Nightmare Man** (`3x` map difficulty for `2.5x` points) challenge modes alongside **Normal** mode (`1x` difficulty, `1x` points) across simulation enemy/boss scaling, run & leaderboard point calculations, singleplayer Map Selection / HUD / Result screens, and Co-Op lobbies.

**Changes implemented**:
- **Challenge Mode Definitions & Points Calculation (`src/game/core/custom/customSave.ts`, `src/game/core/save.ts`)**:
  - Defined `ChallengeMode` (`"normal" | "extreme_one_chunk" | "nightmare"`), `CHALLENGE_MODES`, `getChallengeMode`, `getChallengeDifficultyMultiplier`, and `getChallengePointsMultiplier`.
  - Updated `calculateRunPointsBreakdown` and `calculateLevelPointsBreakdown` to scale run points by `1.5x` in **Extreme One Chunk Man** and `2.5x` in **Nightmare Man**, and persisted `challengeMode` on `MapBestRecord` when a new high score is set.
- **Simulation Enemy & Boss Scaling (`src/game/core/Sim.ts`)**:
  - Added `challengeMode` to `SimOptions`, `Sim`, and `RunResult`, and scaled monster and boss HP and damage (`this.challengeDifficulty`: `2x` for `"extreme_one_chunk"`, `3x` for `"nightmare"`) in `Sim.spawnEnemy`.
- **Client, Map Selection UI, HUD, Results & Co-Op (`src/game/client/GameStore.ts`, `src/game/client/GameClient.ts`, `src/game/ui/GameUi.tsx`, `src/game/ui/LeaderboardScreen.tsx`, `src/custom/multiplayer/mp-lobby-ui.js`, `src/custom/multiplayer/mp-hud-leaderboard.js`, `assets/multiplayer/`)**:
  - Added `selectChallengeMode` and `cycleChallengeMode` to `GameClient`, a **Challenge Mode** selector card list in `MapDetailsPanel` plus a quick-cycle `Mode` button in `.ui-select-bar`, an active mode badge in the HUD, a `Mode` row in `ResultModal`, and mode bonus lines in `LeaderboardScreen` tooltips.
  - Updated Co-Op lobby and leaderboard scoring so `2x` (`Extreme One Chunk Man`) awards `1.5x` points and `3x` (`Nightmare Man`) awards `2.5x` points.

**Tests**: `npx tsc --noEmit` (0 errors), `npm test` (325/325 passed across all 16 test suites), `npm run verify-slim-cache` (verified 3,472 groups in 5.73s), `npm run build` (`index-D6Ox1VYG.js`), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Prevent Slim-Cache Verification Timeouts (`npm run verify-slim-cache` in 5s, 8x Faster `slim-cache`, Worker Guard)

**Model**: Gemini (Antigravity)
**Commit**: `6b78204`
**Bundle**: `index-JOj9ctmV.js` (`?v=8.5`, MapViewer `MapViewerApp-BqlUigRJ.js`, Worker `RenderDataWorker-BqUjTjOH.js`, WASM loader `module-o5mm7YQ2.js`, styles `index-C3aiJD4m.css`, slim cache `osrs-241_2026-09-30-slim-fa564245`)

**Scope**: Eliminated slim-cache verification and generation timeouts by guarding `expose(worker)` in `RenderDataWorker.ts` when imported in Node, adding a 5-second `npm run verify-slim-cache` (`--verify` / `--verify-full`) mode to `scripts/cache/slim-cache.ts`, optimizing `loadWhatTheGameLoads` in `scripts/cache/slim-cache.ts` (cutting full slim-cache generation from 389s to ~50s while reading the exact same 14,343 cache groups), and invoking `tsx` directly via `node ./node_modules/tsx/dist/cli.mjs` in `package.json`.

**Changes implemented**:
- **Worker IPC Guard (`src/mapviewer/worker/RenderDataWorker.ts`)**:
  - Guarded `expose(worker)` with `if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope)` and re-exported `createWorkerState` and `clearWorkerStateCaches` from `./WorkerState` so importing `RenderDataWorker.ts` in Node CLI scripts never attaches a permanent `process` listener that hangs the event loop.
- **Fast Slim-Cache Verification & Generation (`scripts/cache/slim-cache.ts`, `scripts/cache/load-util.ts`, `package.json`, `AGENTS.md`)**:
  - Added `--verify` (`npm run verify-slim-cache`, ~5s) and `--verify-full` (~25s) modes to `scripts/cache/slim-cache.ts` with explicit `process.exit(0)` and missing-archive detection.
  - Stubbed CPU-only WebGL vertex packing (`SceneBuffer`), software minimap rasterization (`MapImageRenderer`), per-frame vertex matrix transforms (`SeqModelAnimator.prototype.animate`, `LocModelLoader.prototype.transformModel`), and scene lighting (`Scene.prototype.light`) in `scripts/cache/slim-cache.ts`, deduplicated NPC/player animation bakes, and built one merged `Scene` per map (`loadSceneLocEntities`), producing the identical 14,343 group reads (`osrs-241_2026-09-30-slim-fa564245`) in ~25s per pass instead of ~195s.
  - Updated `package.json` cache scripts to invoke `node ./node_modules/tsx/dist/cli.mjs` directly rather than `npx tsx` on Windows.

**Tests**: `npx tsc --noEmit` (0 errors), `npm run verify-slim-cache` (verified 3,472 groups in 5.63s), `npm test` (323/323 passed across all 16 test suites), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Download Full `osrs-241_2026-09-30` Local Cache, Rebuild Authentic Slim Cache (`fa564245`) & Restore Genuine Models (`10555` Penance Skirt)

**Model**: Gemini (Antigravity)
**Commit**: `7cb4ce6`
**Bundle**: `index-aozrqZGM.js` (`?v=8.5`, MapViewer `MapViewerApp-B3h7dzLA.js`, Worker `RenderDataWorker-CmraDDTI.js`, WASM loader `module-BBylQNgT.js`, styles `index-C3aiJD4m.css`, slim cache `osrs-241_2026-09-30-slim-fa564245`)

**Scope**: Downloaded the full 182 MiB OSRS 241 cache (`caches/osrs-241_2026-09-30/`) locally and added `/caches/osrs-241_2026-09-30/` to `.gitignore` for local cache searching (`scripts/cache/find-objs.ts`, `scripts/cache/find-npcs.ts`) and slim-cache regeneration. Removed all temporary slim-cache model/sprite/sequence substitute overrides (`ObjType.post`, `NpcType.post`, `SpotAnimType.post`, `SeqType.post`, and `chivalry.iconSpriteId: undefined`) and regenerated `caches/osrs-241_2026-09-30-slim-fa564245` (26.0 MB) from the full cache so **Penance fighter** wears genuine OSRS item `10555` (`Penance skirt`, `maleModel: 19252`, `model: 19194`) on his legs (`EquipSlot.LEGS`) and all custom + upstream `0.17.0` items, NPCs, bosses, sequences, and sprites use their authentic cache archives.

**Changes implemented**:
- **Local Full Cache & Gitignore (`.gitignore`, `scripts/cache/load-util.ts`)**:
  - Downloaded `caches/osrs-241_2026-09-30/` locally via `scripts/download-caches.cjs` and added `/caches/osrs-241_2026-09-30/` to `.gitignore`.
  - Updated `loadCacheInfos()` in `scripts/cache/load-util.ts` so CLI search and slim-cache scripts automatically discover `./caches/osrs-241_2026-09-30/info.json` on disk while `caches/caches.json` serves only the slim cache entry to browser clients.
- **Slim Cache Generation (`scripts/cache/slim-cache.ts`, `caches/osrs-241_2026-09-30-slim-fa564245/`, `caches/caches.json`)**:
  - Updated `scripts/cache/slim-cache.ts` to chunk `ActorBakeLoader` requests into batches of 40 (preventing `SceneBuffer` array-length overflow in Node), include Cook's Assistant 3D world assets (`npcId: 4626` with `seqIds: [808, 860]`, and `objId: 1927, 1944, 1933`), and preserve negative `iconObjId` NPC icons (`-12676` Corgi, `-12516` Chihuahua).
  - Generated and verified `caches/osrs-241_2026-09-30-slim-fa564245` (`26.0 MB`) and replaced `caches/osrs-241_2026-09-30-slim-74e0d2b3`.
- **Authentic Model Restoration (`src/rs/config/objtype/ObjType.ts`, `src/rs/config/npctype/NpcType.ts`, `src/rs/config/spotanimtype/SpotAnimType.ts`, `src/rs/config/seqtype/SeqType.ts`, `src/game/content/custom/customOverrides.ts`)**:
  - Removed temporary `post()` model/sequence/sprite overrides so item `10555` (`Penance skirt`), all Barbarian Village weapons/helmets/bosses (`Obor` `7416`, `Bryophyta` `8195`), and all upstream `0.16.0` - `0.17.0` weapons/evolutions/animations use their genuine OSRS 241 models.

**Tests**: `npx tsc --noEmit` (0 errors), `npx vitest run` (323/323 passed across all 16 test suites), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Merge Upstream `0.15.0` - `0.17.0` (`efc49f6`) & Add Slim-Cache Overrides for New Weapons, Evolutions & Sequences

**Model**: Gemini (Antigravity)
**Commit**: `9235cfe`
**Bundle**: `index-DSKGIPvH.js` (`?v=8.5`, MapViewer `MapViewerApp-8YMVHdhe.js`, Worker `RenderDataWorker-CfhowBko.js`, WASM loader `module-Dy8rI3c4.js`, styles `index-C3aiJD4m.css`)

**Scope**: Merged upstream `main` (`b29f532..efc49f6`, releases `0.15.0`, `0.16.0`, and `0.17.0`) into `main`, integrating the new Collection Log screen, 9 new weapon evolutions (3-level evolved weapons), Thunder khopesh, Dinh's bulwark, Chivalry passive, Smithing/Crafting/Woodcutting skills, level-up Skip button (`X`), post-run weapon Damage/Kills/DPS breakdown, and weapon stat lines, while preserving all custom maps (`barbarian_village`, `fight_caves`), adventurers (`penance_fighter`, `dipper`, `elias`), 2-step Adventurer/Map selection UI, Co-Op Multiplayer, Leaderboard/Top Score system, and slim-cache compatibility.

**Changes implemented**:
- **Upstream Conflict Resolution (`CLAUDE.md`, `package.json`, `src/game/client/GameClient.ts`, `src/game/client/GameStore.ts`, `src/game/core/Sim.ts`, `src/game/core/save.ts`, `src/game/ui/GameUi.tsx`)**:
  - Updated `package.json` version to `0.17.0` while retaining custom `build` (`vite build && node scripts/sync_dist.cjs`) and `sync-upstream` scripts.
  - Merged `Screen` (`"leaderboard" | "collectionLog"`), `SlotView` (`desc`, `stats`, `evolution`), and `GameStore` audio/display defaults in `GameStore.ts` and `GameClient.ts`.
  - Merged `this.damageTaken += amount;` with `slot: player.slot` in `Sim.stepPoison()`, and retained `MAX_CASKETS` clamping alongside `evolutionsMade` migration in `save.ts` (`SAVE_VERSION = 7`).
  - Merged `CollectionLogScreen`, `SkipButton`, `.ui-slot-tip` rich weapon/evolution tooltips, and the 2-column `ResultModal` (with Bosses and Damage/Kills/DPS tables alongside `Run points`, `CoopDamageLeaderboardTable`, and `CoopGameOverButtons`) in `GameUi.tsx`, and added `<ChoiceStats stats={weaponStats(weapon, weapon.levels[0])} />` to `AdventurerDetailsPanel`.
- **3-Level Evolved Weapons & Knockback Alignment (`src/game/content/custom/customWeapons.ts`, `src/game/content/custom/customOverrides.ts`)**:
  - Updated `leaf_bladed_battleaxe` (`knockback: 1.3`, 3 levels via `evolvedLevels`: `35 -> 40 -> 46` damage) and `blood_barrage` (`38 -> 44 -> 49` damage) to match upstream `0.17.0`'s 3-level evolved weapon standard and knockback progression invariant.
- **Slim-Cache Compatibility for Upstream `0.16.0` - `0.17.0` Assets (`src/rs/config/objtype/ObjType.ts`, `src/rs/config/spotanimtype/SpotAnimType.ts`, `src/rs/config/seqtype/SeqType.ts`, `src/game/content/custom/customOverrides.ts`)**:
  - Added `ObjType.post()` slim-cache model & recolor mappings for all 11 new `0.16.0` - `0.17.0` weapons/evolutions (`25739` Sanguine Scythe of Vitur, `26233` Ancient godsword, `29577` Burning claws, `21003` Elder maul, `21015` Dinh's bulwark, `28682` Dinh's blazing bulwark, `30388` Thunder khopesh, `28540` Corrupted twisted bow, `28547` Corrupted tumeken's shadow, `24425` Eldritch Nightmare staff, `25731` Holy sanguinesti staff).
  - Added `SpotAnimType.post()` slim-cache model & sequence mappings for `1171` (Burning claws special), `559` (Thunder khopesh special), and `1197` (Kree'arra ranged projectile).
  - Added `SeqType.post()` slim-cache frame mappings for new player attack sequences `9171`, `7514`, `7511`, `7516`, and `3157`, and set `chivalry.iconSpriteId = undefined` in `PASSIVE_OVERRIDES` (falling back to Holy symbol `iconObjId: 1718`) so `RenderDataWorker` loads with zero missing-archive errors on `osrs-241_2026-09-30-slim-74e0d2b3`.

**Tests**: `npx tsc --noEmit` (0 errors), `npx vitest run` (323/323 passed across all 16 test suites), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Add Barbarian Village Campaign Map, 5 Bosses, Penance Fighter Adventurer, Boss Weapons, Slim-Cache Model Overrides & 2-Step Adventurer/Map Select

**Model**: Gemini (Antigravity)
**Commit**: (pending - see git log)
**Bundle**: `index-Mngv7-1o.js` (`?v=8.5`, MapViewer `MapViewerApp-BntXPpQf.js`, Worker `RenderDataWorker-BY4GINAV.js`, WASM loader `module-BBQH_A-N.js`, styles `index-iAqwhHYZ.css`)

**Scope**: Created a playable **Barbarian Village** campaign map (`id: "barbarian_village"`) placed right after **Lumbridge** in the campaign progression (`MAPS`), spanning the Barbarian Village settlement, Gunthor's longhall, the Stronghold of Security entrance, the River Lum bridge, Ice Mountain, and Edgeville, complete with 12 custom wave enemy archetypes, 5 custom bosses (including Obor and Bryophyta from Edgeville Dungeon), the **Penance Fighter** adventurer in full Barbarian Assault & Fremennik gear, 6 custom weapons (including the **Battleaxe** line, **Leaf-bladed battleaxe**, **Zombie axe**, **Hill giant club**, **Bryophyta's staff**, and **Skull sceptre**), campaign gear unlocks for the **Fighter torso** and all four **Fremennik helmets**, 3 quests, slim-cache 3D/2D model overrides in `ObjType.post()` and `NpcType.post()`, a dedicated **Special** adventurer category for **Dipper** and **Elias**, a 2-step **Adventurer -> Map** selection screen flow, and 2-4 player Co-Op Multiplayer support.

**Changes implemented**:
- **Custom Enemies & Bosses (`src/game/content/custom/customEnemies.ts`, `src/rs/config/npctype/NpcType.ts`)**:
  - Added 12 Barbarian Village wave enemies using verified slim-cache NPC and player appearance models: `dungeon_rat` (`npcId: 2865`), `village_goblin` (`npcId: 2245`), `barbarian_villager` (`npcId: 2491`), `ice_wolf` (`npcId: 3024`), `mine_scorpion` (`npcId: 12812`), `barbarian_axeman` (player appearance with iron chainbody, bronze med helm, and steel battleaxe), `stronghold_minotaur` (`npcId: 3018`), `barbarian_shieldmaiden` (`npcId: 1280`), `pit_spider` (`npcId: 2514`), `stronghold_shade` (translucent dark shadow warrior with `red_magic_missile` projectiles), `sepulchre_ankou` (translucent crimson skeletal spirit with `dark_energy_ball` projectiles), and `barbarian_berserker` (horned-helm dual-axe berserker).
  - Added 5 Barbarian Village & Edgeville Dungeon bosses: `minotaur_warlord` (3:45 Stronghold of Security boss), `obor` (7:30 Edgeville Dungeon hill giant boss, `npcId: 7416`), `haakon_the_champion` (9:30 longhall warlord), `bryophyta` (11:15 Edgeville Dungeon moss giant boss, `npcId: 8195`), and final boss `gunthor_the_brave` (15:00 Chieftain of Barbarian Village).
  - Added `NpcType.post()` slim-cache model & recolor overrides in `src/rs/config/npctype/NpcType.ts` for `7416` (`Obor`) and `8195` (`Bryophyta`) using the 5-part Hill Giant rig (`[17463, 17446, 17430, 17466, 17460]`) so both bosses animate with zero missing-archive errors in the slim cache.
- **Custom Adventurer, Slim-Cache Model Overrides & 2-Step Selection UI (`src/game/content/custom/customCharacters.ts`, `src/game/content/custom/customOverrides.ts`, `src/rs/config/objtype/ObjType.ts`, `src/game/ui/GameUi.tsx`, `src/game/ui/GameUi.css`)**:
  - Added `penance_fighter` (`name: "Penance fighter"`, `style: "melee"`, `startingWeapon: "battleaxe"`, wearing Berserker helm `3751`, Fighter torso `10551`, Penance skirt `10555`, Penance gloves `10553`, and Runner boots `10552`, `bonus: { meleeMight: 0.1, cooldown: 0.1, armor: 0.5, moveSpeed: 0.05 }`, unlocked by beating `barbarian_village`), inserted right after `barbarian` in `applyCustomCharacters`.
  - Added `ObjType.post()` slim-cache model & recolor overrides in `src/rs/config/objtype/ObjType.ts` for `10555` (Penance skirt), `3753` (Warrior helm), `3749` (Archer helm), `1377` (Dragon battleaxe), `20727` (Leaf-bladed battleaxe), `28810` (Zombie axe), `20756` (Hill giant club), `22370` (Bryophyta's staff), `9013` (Skull sceptre), and `21276` (Skull sceptre (i)) so their 3D worn models and 2D inventory icons render with zero missing-archive errors in `RenderDataWorker`.
  - Added `isSpecialCharacter(characterId)` in `customCharacters.ts` so `dipper` and `elias` render under their own **Special** adventurer category.
  - Updated `CharacterScreen` in `GameUi.tsx` into a 2-step flow: **Step 1 (Adventurer Selection)** shows the Adventurer grid on the left and Adventurer + Starting Weapon details on the right; **Step 2 (Map Selection)** shows the Map list on the left and Map Details + Unlock Tasks on the right (`scrollbar-gutter: stable`), eliminating the map box scrollbar flicker when hovering maps with different detail heights.
- **Custom Weapons, Gear & Quests (`src/game/content/custom/customWeapons.ts`, `src/game/content/custom/customOverrides.ts`, `src/game/content/items.ts`, `src/game/content/armoury.ts`)**:
  - Added `CUSTOM_WEAPONS`: `battleaxe` (Common 8-level Bronze -> Dragon progression, unlocked by beating `barbarian_village`, evolves into `leaf_bladed_battleaxe` with `protect_melee`), `zombie_axe` (Rare melee weapon unlocked by beating `barbarian_village`, `+50%` vs undead and `+35%` 2nd hit vs bosses/elites), `hill_giant_club` (Rare melee weapon unlocked by killing `obor`, 3rd-swing stunning Club Crush), `bryophytas_staff` (Rare magic weapon unlocked by killing `bryophyta`, splashing poison nature bolts), and `skull_sceptre` (Rare magic weapon unlocked by killing `minotaur_warlord`, skull strikes + `+50%` vs undead, upgrades to Skull sceptre (i)).
  - Added `CUSTOM_CASKET_GEAR` (`warrior_helm` `3753`, `archer_helm` `3749` with Armoury upgrade lines into `slayer_helmet`) and `CUSTOM_GEAR_OVERRIDES` (`fighter_torso` `10551`, `berserker_helm` `3751`, `farseer_helm` `3755`), all unlocked by beating `barbarian_village`.
  - Added `CUSTOM_QUESTS`: `stronghold_of_security`, `edgeville_dungeon_giants`, and `gunthors_longhall`.
- **Custom Map Definition & Progression (`src/game/content/custom/customMaps.ts`, `src/game/content/maps.ts`, `src/game/core/custom/customSave.ts`)**:
  - Added `barbarian_village` (`name: "Barbarian Village"`, `iconObjId: 1373` Rune battleaxe, `arena: { baseX: 47 * 64, baseY: 52 * 64, sizeX: 3 * 64, sizeY: 3 * 64 }`, `spawn: { x: 3082.5, y: 3423.5 }`, `difficulty: { hp: 1.15, damage: 1.1 }`) inserted right after `lumbridge` via `applyCustomMaps(MAPS)` so it unlocks after beating Lumbridge and unlocks Barrows when beaten.
  - Registered `barbarian_village` in `ALL_REGIONS` in `src/custom/multiplayer/mp-constants.js`.
- **Tests & Documentation (`src/game/core/Sim.test.ts`, `src/game/core/save.test.ts`, `src/custom/multiplayer/multiplayer.test.ts`, `docs/CHANGELOG.md`)**:
  - Added unit tests for `barbarian_village` campaign unlocks, Penance Fighter, weapons, gear, quests, and multiplayer region sanitization; updated `docs/CHANGELOG.md` and rebuilt the production bundle (`npm run build`).

**Tests**: `npx tsc --noEmit` (0 errors), `npx vitest run` (294/294 passed across all 14 test suites), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Add Level & Run Point System across Leaderboard, Results, Map Select & Co-Op

**Model**: Gemini (Antigravity)
**Commit**: `44aa956` (updated in follow-up commit)
**Bundle**: `index-Dr6qKGiO.js` (`?v=8.5`, MapViewer `MapViewerApp-5oVuIFE3.js`, WASM loader `module-CyeDrdpA.js`)

**Scope**: Added a deterministic per-level best-run Top Score system so players can compare their best run point scores per level, on the post-run Results screen, and in Co-Op.

**Changes implemented**:
- **Core Point Calculation & Save Tracking (`src/game/core/custom/customSave.ts`, `src/game/core/save.ts`, `src/game/core/save.test.ts`)**:
  - Extended `MapBestRecord` with `bossesKilled` and `points` (best single-run top score on that level).
  - Implemented `getMapDifficultyMultiplier`, `calculateRunPointsBreakdown`, `calculateRunPoints`, `calculateLevelPointsBreakdown`, and `calculateLevelPoints`.
  - Formula combines **Monster Kill Score** (`kills * (10 + min(300, kills / minutes) * 0.04)`), **Survival & Level Progression** (`effectiveSec * 2 + (level - 1) * 75`, with normal runs capped at `bossAt` to prevent boss stalling), **Boss & Clear Speed Bonus** (`bosses * 500 + 5,000 victory + max(0, 3,000 - (winSeconds - bossAt) * 25)`), and **Endless Round Bonus** (`(R - 1) * 4,000 + (R - 1)^2 * 1,000`), all multiplied by the **Map Difficulty Multiplier** (`0.6 * hp + 0.4 * damage`, ranging from `1.00x` Lumbridge to `3.00x` Fight Caves and `3.33x` The Inferno).
  - Retroactively computes best-run level top scores for existing saves via `calculateLevelPointsBreakdown`.
- **UI & Client Integration (`src/game/ui/LeaderboardScreen.tsx`, `src/game/ui/GameUi.tsx`, `src/game/client/GameClient.ts`, `src/game/client/GameStore.ts`)**:
  - Added a per-level top score column and hover breakdown tooltips to `LeaderboardScreen.tsx`.
  - Added `Run points` and a `"New high score in <Map>!"` banner to `ResultModal`, and `Top score` to `MapDetails`.
- **Co-Op Run Leaderboard Points (`src/custom/multiplayer/mp-hud-leaderboard.js`, `src/game/ui/CoopGameOverSection.tsx`, `src/custom/multiplayer/multiplayer.test.ts`)**:
  - Added individual player point scoring (`killPts + dmgPts + lvlPts + clearPts` scaled by map and Co-Op difficulty) and a `Points` column to the Co-Op post-run leaderboard.
- **Custom Changelog (`docs/CHANGELOG.md`)**:
  - Documented the Level Top Score System under `Co-Op Multiplayer & Leaderboards` and rebuilt the production bundle.

**Tests**: `npx tsc --noEmit` (0 errors), `npx vitest run` (55/55 passed in `save.test.ts`, `multiplayer.test.ts`, `changelog.test.ts`), `python -m unittest server/test_serve.py` (55 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Fix Nginx `location /` `add_header` Inheritance Stripping COOP/COEP Headers

**Model**: Gemini (Antigravity)
**Commit**: (pending - see git log)
**Bundle**: `index-iGd6J9MJ.js` (`?v=8.5`)

**Scope**: Fixed a regression in `server/nginx.conf` where a standalone `add_header Access-Control-Allow-Origin` inside `location /` suppressed inheritance of all `server`-level `add_header` directives (including `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`), while `proxy_hide_header` stripped the backend's headers.

**Changes implemented**:
- Moved `add_header Access-Control-Allow-Origin "https://run-escape.cuteanimegirls.moe" always;` to the `server` block in `server/nginx.conf` and removed the lone `add_header` directive from `location /` so all `server`-level security and COOP/COEP/CORP headers are inherited on `/`.
- Added `test_nginx_conf_preserves_coop_coep_headers` in `server/test_serve.py` to enforce that any `location` block using `add_header` explicitly includes `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`.

**Tests**: `python -m unittest server/test_serve.py` (55 tests OK).

---

### [2026-10-30] Deduplicate `favicon.ico` & Streamline Custom Changelog to Gameplay Overview

**Model**: Gemini (Antigravity)
**Commit**: `da06c42`
**Bundle**: `index-iGd6J9MJ.js` (`?v=8.5`, MapViewer `MapViewerApp-DkX-kaAf.js`, WASM loader `module-D8SqyX4g.js`)

**Scope**: Removed the duplicate root `favicon.ico` (leaving `public/favicon.ico` as the single canonical icon), updated `server/serve.py` and `server/nginx.conf` to serve `/favicon.ico` from `public/favicon.ico`, rewrote `docs/CHANGELOG.md` into a high-level overview of player-facing gameplay differences only, updated agent rule files to enforce gameplay-only custom changelogs, and rebuilt the production bundle.

**Changes implemented**:
- Removed duplicate root `favicon.ico` via `git rm favicon.ico` (`public/favicon.ico` has identical SHA-256 and is copied by Vite during `npm run build`).
- Added fallback in `server/serve.py` (`send_head`) to serve `/public/favicon.ico` when root `favicon.ico` is absent, and added `"/public/favicon.ico"` to `allowed_exact`.
- Added `location = /favicon.ico { alias /opt/run-escape/public/favicon.ico; ... }` in `server/nginx.conf`.
- Streamlined `docs/CHANGELOG.md` under `## Custom Edition` into three concise, player-facing sections (`Co-Op Multiplayer & Leaderboards`, `Maps, Bosses, Quests & Adventurers`, and `Combat, Balance & Quality of Life`), removing internal technical/security/performance logs.
- Updated `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, and `.github/copilot-instructions.md` to require `docs/CHANGELOG.md` to remain a high-level gameplay-only overview.
- Rebuilt production assets (`assets/index-iGd6J9MJ.js`, `assets/MapViewerApp-DkX-kaAf.js`, `assets/module-D8SqyX4g.js`).

**Tests**: `npx tsc --noEmit` (0 errors), `npx vitest run src/game/ui/changelog.test.ts` (4 tests OK), `python -m unittest server/test_serve.py` (54 tests OK), `node --check src/custom/multiplayer.js` (OK).

---

### [2026-10-30] Fix Production Deploy Workflow SHA & Relocate Backend Files into `server/`

**Model**: Gemini (Antigravity)
**Commit**: `39b78f3`, `d20b637`
**Bundle**: `index-mmaGS3Nd.js` (`?v=8.5`)

**Scope**: Moved `serve.py`, `test_serve.py`, `nginx.conf`, and `ecosystem.config.cjs` out of the repository root into `server/`, removed root `__pycache__/`, updated all scripts, CI/CD workflows, and documentation references, and fixed the `appleboy/ssh-action@v1.0.3` commit SHA in `.github/workflows/deploy.yaml` (`029f5b4aeeeb58fdfe1410a5d17f967dacf36262`).

**Changes implemented**:
- Moved `serve.py` -> `server/serve.py` (`DIRECTORY` updated to `os.path.dirname(os.path.dirname(os.path.abspath(__file__)))` so it serves the repository root).
- Moved `test_serve.py` -> `server/test_serve.py` (`sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))` added so `python -m unittest server/test_serve.py` and `python -m unittest discover -s server` run cleanly from the root).
- Moved `nginx.conf` -> `server/nginx.conf` (added `server(/|$)|` to the Nginx path deny block).
- Moved `ecosystem.config.cjs` -> `server/ecosystem.config.cjs` (`script: 'server/serve.py'`, removed unprovisioned `user: 'run-escape'` field).
- Fixed `appleboy/ssh-action` SHA in `.github/workflows/deploy.yaml` from invalid `4a03da89e0a912dec21b8dc5c787aec75c59c01e` to `029f5b4aeeeb58fdfe1410a5d17f967dacf36262` (`v1.0.3`).
- Updated `.github/workflows/deploy.yaml`, `scripts/auto_sync_upstream.cjs`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `README.md`, and `docs/MULTIPLAYER_ARCHITECTURE.md`.

**Tests**: `python -m unittest server/test_serve.py` (54 tests OK), `npx tsc --noEmit` (0 errors), `npm test` (290 tests OK).

---

### [2026-10-30] Upstream-Safe Performance & Multiplayer Stability Optimizations

**Model**: Gemini (Antigravity)
**Commit**: `9ac73b9`
**Bundle**: `index-D7NfIRw6.js` (`?v=8.5`)

**Scope**: End-to-end verification, micro-benchmarking, and implementation of upstream-safe performance and protocol stability optimizations across `nginx.conf`, `serve.py`, `src/game/core/custom/`, `src/game/core/Sim.ts`, `src/mapviewer/worker/customNpcIcon.ts`, `src/game/ui/ChangelogPanel.tsx`, and `src/custom/`.

**Changes implemented**:
- **Nginx & Python Delivery (`nginx.conf`, `serve.py`, `test_serve.py`)**:
  - Added direct `/assets/` location block in `nginx.conf` (`sendfile on; tcp_nopush on; expires 365d;`) with full COOP/COEP/CORP/HSTS headers, offloading 11.73 MB of static assets from single-threaded `serve.py`.
  - Enabled level-6 `gzip` in `nginx.conf` for JS/JSON/WASM/CSS/TTF/SVG (-83.4% non-audio payload size, from 8.72 MB to 1.44 MB), explicitly excluding `application/octet-stream` and `audio/ogg` to preserve HTTP `Range` support on `/caches/*.dat2`.
  - Fixed `/caches/` extension regex in `nginx.conf` to `^/caches/.*\.(bin|dat2?|idx\d*|xtea|json|gz)$` so `main_file_cache.dat2` and `main_file_cache.idx0`-`idx255` are served properly with COOP/COEP headers.
  - Updated `serve.py` `end_headers()` to emit `Cache-Control: public, max-age=31536000, immutable` for `/caches/` and versioned/hashed `/assets/` files while keeping `no-cache, no-store, must-revalidate` for `/index.html`.
  - Added a zero-re-serialization byte-splicing fast path in `serve.py` `_process_ws_text_message` (-56.0% CPU time on `sync_world`), a single-chunk zero-copy fast path in `read_exact`, and a 1-player room broadcast skip.
- **Unreachable Pickup Recovery & Custom Sim Hooks (`pickupRecovery.ts`, `customSimHooks.ts`, `Sim.ts`, `customNpcIcon.ts`, `ChangelogPanel.tsx`)**:
  - Removed redundant per-tick `isPickupSpotReachable` checks on resting pickups in `stepPickupSlide` (64.6x to 221.9x speedup) and added a mid-slide reachability recovery guard in `Sim.slideIntoPile` when `!pile`.
  - Pre-filtered stationary enemies once before the `r = 1..32` ring search in `findReachablePickupSpot`, stepped directly across perimeter cells (`stepX = Math.abs(dy) === r ? 1 : r * 2`), checked tile walkability once per perimeter tile, and used squared distances (5.13x speedup).
  - Scoped `targetEnemyUid` lookup in `Sim.stepEnemyProjectiles` to `if (projectile.homing > 0)` and guarded shooter lookup in `stepFactionProjectileHit` with `if (!hitFoe.aggro && !hitFoe.foe)` (2.67x speedup).
  - Early-returned in `stepCustomRegen` when `player.hp >= player.maxHp`, replaced per-vertex `Math.sqrt` in `customNpcIcon.ts` with a single post-loop `Math.sqrt(brSq)`, and reverted `ChangelogPanel.tsx` to match `upstream/main` verbatim (eliminating redundant runtime `fetch("docs/CHANGELOG.md")`).
- **Co-Op Sync Engine, Pickups & Render Loops (`mp-sync-engine.js`, `mp-pickups.js`, `mp-hud-leaderboard.js`, `mp-prayers.js`, `cooks-assistant.js`, `tile-coords.js`)**:
  - Decoupled `sync_world` broadcasts to 25 Hz (`sim.tick % 2 === 0` or immediate flush on non-damage events/state changes) while harvesting `sim.events` into `_pendingVisEvents` at 50 Hz, stripping redundant `enemyId` from `damage` events (preventing >64 KB `1009` disconnects), and normalizing Guest velocity extrapolation by `tickDelta`.
  - Coalesced per-tick bone XP and coin `coop_pickup` frames via `queueCoopPickup`/`flushCoopPickups` during `sim.step` to prevent Magnet/Bonecrusher bursts from exceeding `MAX_FRAMES_PER_SEC = 120` (`1008` disconnects).
  - Removed 28x spawn-loop and 50 Hz per-peer `sim.updateFlowField()` thrashing on the Host by updating `t.flowField` directly every 8 ticks or on tile crossings, preserved global `sim.countAlive()` across target buckets, memoized `sim.currentWave()`, and hoisted `applyBossWindup` out of Guest `applyWorldSync`.
  - Added in-place DOM updates for HP-only changes in `mp-hud-leaderboard.js`, cached `#osrs-prayer-bar` and gated Jad/Zuk scans behind `sim.shownBoss` in `mp-prayers.js`, eliminated per-frame `getComputedStyle` reflows when away from the Cook in `cooks-assistant.js`, and cached DOM nodes/tile coordinates in `tile-coords.js`.

**Tests**: 290 Vitest tests across 14 suites + 54 Python unit tests in `test_serve.py` - all pass. `npx tsc --noEmit` clean.

---

### [2026-10-30] Security Hardening Round 2 - Full Codebase Audit

**Model**: Gemini 2.5 Pro (Antigravity)
**Commit**: `0acb92b`
**Bundle**: `index-CC-eTnSU.js` (`?v=8.5`)

**Scope**: Full codebase audit of all previously unaudited subsystems: TypeScript engine/Sim, GameClient, secret codes/debug-mode, mapviewer/cache parsers, nginx/CSP/CI-CD infrastructure, React UI components.

**All findings and fixes**:
- H-1: Removed `coop_debug` from `GUEST_ALLOWED_MSG_TYPES` in `serve.py`
- H-2/H-3: Removed `debug-mode.js` `<script>` from `index.html`; removed `?debug=1` URL param gate from `isDebugAllowed()`
- H-4: Added HSTS `max-age=31536000` to `nginx.conf`
- H-5: Scoped `Access-Control-Allow-Origin` away from global `*`
- H-6: Pinned `actions/checkout` and `actions/setup-node` to full SHAs in `sync-upstream.yaml`
- H-7: Added `--ignore-scripts` to production `npm install` in `deploy.yaml`
- M-1: `window.gameClient` now DEV-only; `_gameClientBridge` exposes minimal multiplayer surface
- M-2: `hpDelta` from peers clamped to +-200 per packet
- M-3: Peer `weapon.bonus` clamped to 0.5 (was 5)
- M-4: `PEER_STAT_BOUNDS` expanded to cover 7 additional combat stats
- M-5: `unlockedItems` filtered by character allowlist in `mp-transport.js`
- M-6: `window.l33th4x0r` gated behind `isDebugAllowed()`
- M-7: `charName` fallback now uses `sanitizeName()` in `mp-sync-engine.js`
- M-8: Removed `unsafe-eval` from CSP `script-src`
- M-9/M-10/M-11/M-12: Added `X-Frame-Options`, `Referrer-Policy`, rate limiting, `server_tokens off` to nginx
- M-13/M-14: Added `do_OPTIONS` to `serve.py`; `X-Real-IP` validated as IP format
- M-15/L-16: Added `user: 'run-escape'` and `NODE_ENV: 'production'` to `ecosystem.config.cjs`
- M-16: `appleboy/ssh-action` SHA-pinned in `deploy.yaml`
- M-17/M-18/M-19: `caches.json` name validated; `fetchXteas` checks `resp.ok`; `fetchCacheList` re-throws
- M-20/M-21: `sectorCluster.size` bounded at 32 MB; `Range` header uses open-ended `bytes=X-`
- L-1: `game_over` always enforces `senderSlot` host check
- L-2/L-3: `totalXp` capped at 1e9; coin `val` capped at 50,000
- L-4/L-5: `Math.random()` removed from RNG seed fallback; ring-ambush target uses `sim.rng`
- L-6/L-7/L-8/L-9: Python version hidden; `connect-src` narrowed; `casketsOpened` bounded; localStorage check structured
- L-10/L-11/L-12: `ByteBuffer.readString` loop bounded; `DatTypeLoader.load` bounds-checked; `Archive.decode` underflow caught
- L-13/L-14/L-15: nginx `/caches/` extension allowlist; WS upgrade guard; ACAO suppressed on 101
- L-17: `--ignore-scripts` added to `sync-upstream.yaml` npm install

**Tests**: 48 Vitest (12 multiplayer + 36 save), 49 Python - all pass. `npx tsc --noEmit` clean. `npm run build` clean.

**Open items**:
- SRI (`integrity=`) on `<script>`/`<link>` tags: tracked for future sprint (needs Vite plugin)
- `window.gameClient` bridge: `_gameClientBridge` added; full migration of mp-*.js references to bridge is a future refactor
- `fight_caves` always unlocked: intentional design decision - document if gating is desired
- PM2 `user: 'run-escape'` requires ops to create the user on the production server

---

## 1. Active Bundle & Hook Registry

### Current Active Asset Files (Version `?v=8.5` - Source-Built `0.14.0`)
| Role | Active File | Imported / Referenced By |
| :--- | :--- | :--- |
| **TypeScript Source Tree** | [`src/`](../src/) | Built via `npm run build` (`vite build && node scripts/sync_dist.cjs`) |
| **HTML Entrypoint** | [`index.html`](../index.html) | Browser root (`?v=8.5`) |
| **Main Engine Bundle** | [`assets/index-Dr6qKGiO.js`](../assets/index-Dr6qKGiO.js) | `index.html`, `MapViewerApp-5oVuIFE3.js`, `module-CyeDrdpA.js` |
| **Backend & Server Config** | [`server/`](../server/) | `server/serve.py`, `server/test_serve.py`, `server/nginx.conf`, `server/ecosystem.config.cjs` |
| **Custom Runtime Source** | [`src/custom/`](../src/custom/) | Canonical hand-authored scripts & assets synced into `assets/` by `scripts/sync_dist.cjs` |
| **Co-Op Facade Entrypoint** | [`assets/multiplayer.js`](../assets/multiplayer.js) | `index.html` (`?v=8.5`, synced from `src/custom/multiplayer.js`) |
| **Co-Op Submodules (9)** | [`assets/multiplayer/`](../assets/multiplayer/) | Synced from `src/custom/multiplayer/mp-*.js` |
| **Build & Asset Syncer** | [`scripts/sync_dist.cjs`](../scripts/sync_dist.cjs) | `package.json` (`npm run build`) |
| **Upstream Auto-Syncer** | [`scripts/auto_sync_upstream.cjs`](../scripts/auto_sync_upstream.cjs) | `/etc/cron.d/run-escape-upstream-sync`, `.github/workflows/sync-upstream.yaml` |
| **Cook's Assistant Quest** | [`assets/cooks-assistant.js`](../assets/cooks-assistant.js) | `index.html` (`?v=8.5`, synced from `src/custom/cooks-assistant.js`) |
| **Tile Coordinate HUD** | [`assets/tile-coords.js`](../assets/tile-coords.js) | `index.html` (`?v=8.5`, synced from `src/custom/tile-coords.js`) |
| **Debug / God Mode** | [`assets/debug-mode.js`](../assets/debug-mode.js) | NOT loaded from `index.html` (security fix - load manually in dev only) |
| **Main Stylesheet** | [`assets/index-BMrv4NGQ.css`](../assets/index-BMrv4NGQ.css) | `index.html` (`?v=8.5`) |
| **Map Viewer Bundle** | [`assets/MapViewerApp-5oVuIFE3.js`](../assets/MapViewerApp-5oVuIFE3.js) | `assets/index-Dr6qKGiO.js` |
| **Render Worker** | [`assets/RenderDataWorker-BZS73kvJ.js`](../assets/RenderDataWorker-BZS73kvJ.js) | `assets/index-Dr6qKGiO.js` |
| **Worker WASM Loader** | [`assets/module-DQGm7-d_.js`](../assets/module-DQGm7-d_.js) | `assets/RenderDataWorker-BZS73kvJ.js` (`module-yzz5kVyQ.wasm`) |
| **Main WASM Loader** | [`assets/module-CyeDrdpA.js`](../assets/module-CyeDrdpA.js) | `assets/index-Dr6qKGiO.js` (`module-yzz5kVyQ.wasm`) |
| **OSRS Slim Cache** | [`caches/osrs-241_2026-09-30-slim-74e0d2b3`](../caches/osrs-241_2026-09-30-slim-74e0d2b3) | [`caches/caches.json`](../caches/caches.json) (`CacheStorage` key `-v12`) |

### Custom Engine & Gameplay Hooks in `src/` (Compiled into `assets/index-mmaGS3Nd.js`)
When adding new features or merging upstream changes into `src/` and rebuilding `assets/index-*.js`, follow these upstream-friendly boundaries and preserve all global hooks:
1. **Modular Custom Feature Directories (Upstream-Friendly Boundaries)**:
   - [`src/game/content/custom/`](../src/game/content/custom/): All custom characters (`customCharacters.ts`), maps (`customMaps.ts`), enemies/bosses (`customEnemies.ts`), secret codes (`secretCodes.ts`), and in-place content array overrides (`customOverrides.ts`) live here and are linked into upstream files (`characters.ts`, `maps.ts`, `enemies.ts`, `items.ts`, `passives.ts`, `shop.ts`, `quests.ts`, `weapons.ts`, `GameClient.ts`) via 1-line `applyCustom*(...)` calls or spreads.
   - [`src/game/core/custom/`](../src/game/core/custom/): Custom simulation hooks (`pickupRecovery.ts`, `customSimHooks.ts`) and custom save/Armoury helpers (`customSave.ts`) delegated from `Sim.ts` and `save.ts`.
   - [`src/game/client/custom/`](../src/game/client/custom/) & [`src/mapviewer/worker/customNpcIcon.ts`](../src/mapviewer/worker/customNpcIcon.ts): Custom 3D dog actor & Co-Op event resolution helpers (`dogActors.ts`) and custom negative-ID NPC item icon rendering (`customNpcIcon.ts`).
   - [`src/game/ui/`](../src/game/ui/): Standalone custom UI components ([`LeaderboardScreen.tsx`](../src/game/ui/LeaderboardScreen.tsx), [`CoopGameOverSection.tsx`](../src/game/ui/CoopGameOverSection.tsx), [`CustomSettingsControls.tsx`](../src/game/ui/CustomSettingsControls.tsx)) imported by [`GameUi.tsx`](../src/game/ui/GameUi.tsx).
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

### 2026-10-29 - Antigravity - Co-Op WebSocket, Server, CI/CD, and Save Security Hardening
- **Commit / PR**: Security audit fixes across `serve.py`, `src/custom/`, `scripts/auto_sync_upstream.cjs`, `.github/workflows/deploy.yaml`, and `src/game/core/` (`?v=8.5`)
- **Files Modified**: `serve.py`, `test_serve.py`, `.jules/sentinel.md`, `src/custom/multiplayer/mp-constants.js`, `src/custom/multiplayer/mp-pickups.js`, `src/custom/multiplayer/mp-actor-renderer.js`, `src/custom/multiplayer/mp-hud-leaderboard.js`, `src/custom/multiplayer/mp-transport.js`, `src/custom/cooks-assistant.js`, `src/custom/debug-mode.js`, `src/custom/multiplayer/multiplayer.test.ts`, `scripts/auto_sync_upstream.cjs`, `.github/workflows/deploy.yaml`, `src/game/core/save.ts`, `src/game/core/custom/customSave.ts`, `src/game/core/save.test.ts`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`, `index.html`, `assets/*`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-BRo3grs5.js`, `assets/MapViewerApp-CARmEJbT.js`, `assets/module-B73_pgVO.js`)
- **What Changed**:
  1. **WebSocket Role/Slot Enforcement & DoS Protection (`serve.py`, `test_serve.py`)**: Removed `"game_over"` from `GUEST_ALLOWED_MSG_TYPES`, restricted Guest `coop_pickup` broadcasts to `kind == "lamp_xp"`, stripped Host-only keys from Guest `lobby_update` frames, stamped `parsed_msg["slot"] = current_slot` alongside `senderSlot`, released `rooms_lock` prior to room-full `sendall`, closed dead peer sockets on `sendall` failure, added per-connection frame rate limiting (`MAX_FRAMES_PER_SEC = 120`), and set `CustomHandler.timeout = SOCKET_TIMEOUT`.
  2. **Client Multiplayer, Quest & Debug Hardening (`src/custom/`)**: Added `sanitizeHexColor` (preventing inline CSS injection via `rarityColor`) and `sanitizePeerStats` (clamping Guest combat stats, `itemGrowth`, `w.bonus`, and rate-limiting `usedItemId` in `coop_loadout`), required `senderSlot === this.hostSlot` on Host-authoritative `coop_pickup`, `lobby_update`, and `game_over` messages, required `st.status === "held" && st.holder === slot` before Cook's Assistant ingredient delivery, and gated `applyHostGodSlots` / `setHostGodSlot` behind `if (!enabled) return;` in `debug-mode.js`.
  3. **CI/CD, Upstream Sync & Save Clamping (`auto_sync_upstream.cjs`, `deploy.yaml`, `save.ts`, `customSave.ts`)**: Replaced shell-interpolated git commands with `spawnSync("git", [...])` (`tryRunArgs`), added `--ignore-scripts` to `npm install`, bound secrets via `env:` in `deploy.yaml`, clamped `getMetaStats` upgrade ranks, and allowlisted `unlockedCodes`, `mapBest.characterId`, and `recordRun` `enemyKills`.
- **Notes / Invariants for Future Agents**:
  - Any new Host-authoritative WebSocket event type or field MUST be excluded from `GUEST_ALLOWED_MSG_TYPES` in `serve.py` and verified via `msg.senderSlot === this.hostSlot` on the client.

### 2026-10-29 - Antigravity - Extract Core, Content, Client, UI, and Worker Custom Modules for Conflict-Free Upstream Merges
- **Commit / PR**: Modularize `src/game/core/custom/`, `customOverrides.ts`, `dogActors.ts`, `CustomSettingsControls.tsx`, and `customNpcIcon.ts` (`?v=8.5`)
- **Files Modified**: `src/game/core/custom/pickupRecovery.ts`, `src/game/core/custom/customSimHooks.ts`, `src/game/core/custom/customSave.ts`, `src/game/content/custom/customOverrides.ts`, `src/game/client/custom/dogActors.ts`, `src/game/ui/CustomSettingsControls.tsx`, `src/mapviewer/worker/customNpcIcon.ts`, `src/game/core/Sim.ts`, `src/game/core/save.ts`, `src/game/content/characters.ts`, `src/game/content/enemies.ts`, `src/game/content/items.ts`, `src/game/content/passives.ts`, `src/game/content/shop.ts`, `src/game/content/quests.ts`, `src/game/content/weapons.ts`, `src/game/client/GameClient.ts`, `src/game/client/GameView.ts`, `src/game/ui/GameUi.tsx`, `src/game/ui/QuestScreen.tsx`, `src/mapviewer/worker/ItemIconLoader.ts`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-_XaPOUDC.js`, `assets/MapViewerApp-BmOUVpXD.js`, `assets/RenderDataWorker-DcR-K3gg.js`, `assets/module-BDqjycDY.js`, `assets/module-CgKfmabq.js`)
- **What Changed**:
  1. Extracted `src/game/content/custom/customOverrides.ts` (`applyCustomCharacters`, `applyCustomEnemies`, `applyCustomItems`, `applyCustomPassives`, `applyCustomShopUpgrades`, `applyCustomQuests`, `applyCustomWeapons`) and restored the upstream array definitions in `characters.ts`, `enemies.ts`, `items.ts`, `passives.ts`, `shop.ts`, `quests.ts`, and `weapons.ts` to match `upstream/main` verbatim plus a 2-line `applyCustom*(...)` hook.
  2. Extracted `src/game/core/custom/pickupRecovery.ts`, `src/game/core/custom/customSimHooks.ts`, and `src/game/core/custom/customSave.ts`, reducing inline custom diffs in `Sim.ts` by ~240 lines and in `save.ts` by ~66 lines.
  3. Extracted `src/game/client/custom/dogActors.ts`, `src/game/ui/CustomSettingsControls.tsx`, and `src/mapviewer/worker/customNpcIcon.ts`, reducing inline diffs in `GameUi.tsx` by ~122 lines, `GameClient.ts`/`GameView.ts` by ~45 lines, and `ItemIconLoader.ts` to +4 lines.
- **Notes / Invariants for Future Agents**:
  - Never modify existing entries inline inside `characters.ts`, `enemies.ts`, `items.ts`, `passives.ts`, `shop.ts`, `quests.ts`, or `weapons.ts`; add overrides in `src/game/content/custom/customOverrides.ts`.

### 2026-10-29 - Antigravity - Cover All Impassable Terrain Edge Cases for Loot Recovery
- **Commit / PR**: Full terrain/obstacle reachability for pickup recovery (`?v=8.5`)
- **Files Modified**: `src/game/core/world/ArenaGrid.ts`, `src/game/core/Sim.ts`, `src/game/core/Sim.test.ts`, `docs/CHANGELOG.md`, `docs/AGENT_NOTES.md`, `index.html`, `assets/index-BVZZQOP0.js`, `assets/MapViewerApp-nN8IR_T3.js`, `assets/module-RmiAZVN8.js`
- **Bundle / Version Impact**: `?v=8.5` (`assets/index-BVZZQOP0.js`, `assets/MapViewerApp-nN8IR_T3.js`, `assets/module-RmiAZVN8.js`)
- **What Changed**:
  1. Added `ArenaGrid.getPiece(tileX, tileY)` backed by `this.pieces = this.findOpenPieces()` in `src/game/core/world/ArenaGrid.ts` so full-arena connected-component walkability (respecting all `SOLID_FLAGS`, directional `WALL_FLAGS`, diagonal corner rules, and non-jumpable ditches) can be queried in `O(1)`.
  2. Replaced `isTileReachableForPickup` with `isPickupSpotReachable(x, y)` and `isBlockedByStationaryEnemy(x, y)` in `src/game/core/Sim.ts`, checking:
     - `grid.contains` and `!grid.isSolid(tileX, tileY)` (objects, trees, rocks, water, lava, floor decorations),
     - `grid.getPiece(tileX, tileY) === grid.getPiece(flowField.targetX, flowField.targetY)` (walled enclosures, islands beyond the `48x48` flow field, and across the Wilderness Ditch),
     - `flowField.isReachable(tileX, tileY)` when inside the `48x48` flow field,
     - `isCircleFree(this.grid, x, y, PLAYER_RADIUS)` (standalone inset trees/rocks/signposts, directional walls/fences, corner posts, and sub-tile obstacle edges),
     - `!isBlockedByStationaryEnemy(x, y)` (stationary enemy/portal collision circles).
  3. Expanded outward search radius in `findReachablePickupSpot` to `32` tiles with fallback from sub-tile offset to tile centre `(tx + 0.5, ty + 0.5)`.
- **Notes / Invariants for Future Agents**:
  - `isPickupSpotReachable` uses `PLAYER_RADIUS` (`0.35`) so any spot a pickup slides to is guaranteed to be physically reachable by the player's collision circle.

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
