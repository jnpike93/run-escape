# Run Escape - Cross-Agent Handoff Notes & Bundle Patch Map

> **Instructions for All Agents**: Read the **Active Bundle & Hook Registry** and the most recent entries in the **Chronological Agent Handoff Log** before starting work. When your task is complete, prepend a new entry at the top of the log using the template below.

---

## 1. Active Bundle & Hook Registry

### Current Active Asset Files (Version `?v=7.0` - Upstream `0.13.0`)
| Role | Active File | Imported / Referenced By |
| :--- | :--- | :--- |
| **HTML Entrypoint** | [`index.html`](./index.html) | Browser root (`?v=7.0`) |
| **Main Engine Bundle** | [`assets/index-XWbnxuVz.js`](./assets/index-XWbnxuVz.js) | `index.html`, `MapViewerApp-DKojfbH1.js`, `module-C9loB8SI.js` |
| **Co-Op & Custom Hooks** | [`assets/multiplayer.js`](./assets/multiplayer.js) | `index.html` |
| **Main Stylesheet** | [`assets/index-Cu_WH1lb.css`](./assets/index-Cu_WH1lb.css) | `index.html` |
| **Map Viewer Bundle** | [`assets/MapViewerApp-DKojfbH1.js`](./assets/MapViewerApp-DKojfbH1.js) | `assets/index-XWbnxuVz.js` |
| **Render Worker** | [`assets/RenderDataWorker-CRRhTJTb.js`](./assets/RenderDataWorker-CRRhTJTb.js) | `assets/index-XWbnxuVz.js` |
| **Worker WASM Loader** | [`assets/module-Cg9b2g3N.js`](./assets/module-Cg9b2g3N.js) | `assets/RenderDataWorker-CRRhTJTb.js` (`module-yzz5kVyQ.wasm`) |
| **Main WASM Loader** | [`assets/module-C9loB8SI.js`](./assets/module-C9loB8SI.js) | `assets/index-XWbnxuVz.js` (`module-yzz5kVyQ.wasm`) |
| **OSRS Slim Cache** | [`caches/osrs-241_2026-09-30-slim-4cd931ae`](./caches/osrs-241_2026-09-30-slim-4cd931ae) | [`caches/caches.json`](./caches/caches.json) (`CacheStorage` key `-v9`) |

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

### 2026-10-29 - Antigravity - Upstream 0.13.0 Merge (Quests, Amulet of Blood Fury, Pile Merging) + Custom Features (v7.0)
- **Commit / PR**: Upstream `0.13.0` (`index-XWbnxuVz.js`) merge (`?v=7.0`)
- **Files Modified**: `index.html`, `assets/index-XWbnxuVz.js`, `assets/index-Cu_WH1lb.css`, `assets/MapViewerApp-DKojfbH1.js`, `assets/module-C9loB8SI.js`, `assets/module-Cg9b2g3N.js`, `assets/RenderDataWorker-CRRhTJTb.js`, `assets/multiplayer.js`, `caches/caches.json`, `caches/osrs-241_2026-09-30-slim-4cd931ae/*`, `AGENTS.md`, `AGENT_NOTES.md`, `c:/Git/.agents/skills/merge-update/SKILL.md`
- **Bundle / Version Impact**: Bumped cache-busting query string from `?v=6.7` to `?v=7.0` and `CacheStorage` key from `-v8` to `-v9`. Main bundle changed from `index-Ybwr2vLz.js` to `index-XWbnxuVz.js`; CSS from `index-Ck-75d-q.css` to `index-Cu_WH1lb.css`; MapViewer from `MapViewerApp-ws1SF5sq.js` to `MapViewerApp-DKojfbH1.js`; main WASM loader from `module-DiacdDog.js` to `module-C9loB8SI.js`.
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
