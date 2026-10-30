# Changelog

What's changed in Run Escape, newest first. The game shows this on its title screen too (click
the version in the corner), so it's written for players.

## Custom Edition Updates (v8.5)

### Performance & Multiplayer Stability Optimizations

- **Server & Infrastructure Directory Isolation (`server/`)**: Relocated `serve.py`, `test_serve.py`, `nginx.conf`, and `ecosystem.config.cjs` out of the repository root into `server/` to keep the root directory aligned with upstream and isolate server files outside the static web root, and fixed the pinned `appleboy/ssh-action` v1.0.3 commit SHA in `.github/workflows/deploy.yaml`.
- **Static Asset Offloading & Gzip Compression**: Added direct Nginx `sendfile` serving and immutable caching for `/assets/`, enabled level-6 `gzip` compression for JS/JSON/WASM/CSS/TTF (reducing non-audio payload size by 83.4%, from 8.72 MB to 1.44 MB), and fixed `/caches/` regex matching for `.dat2` and `.idx0`-`.idx255` archives with full COOP/COEP headers.
- **Unreachable Loot Recovery Speedup (64x-221x Faster)**: Removed redundant per-tick `isPickupSpotReachable` checks on resting pickups in `stepPickupSlide`, pre-filtered stationary enemies once before `findReachablePickupSpot` ring searches, stepped directly across perimeter cells, and added mid-slide pile interruption recovery in `Sim.slideIntoPile`.
- **Co-Op 25 Hz World Sync & Event Buffering**: Decoupled `sync_world` broadcasts to 25 Hz while buffering `sim.events` at the full 50 Hz simulation rate (with immediate flush on non-damage boss/state events) and normalizing Guest entity velocity interpolation by `tickDelta`.
- **Magnet & Late-Wave Co-Op Disconnect Prevention**: Coalesced per-tick bone XP and coin `coop_pickup` frames so Magnet/Bonecrusher bursts never exceed `MAX_FRAMES_PER_SEC`, and stripped unused `enemyId` fields from `damage` events to keep late-wave frames under the 64 KB WebSocket limit.
- **Co-Op Dijkstra FlowField & Wave Memoization**: Eliminated 50 Hz per-peer and 28x spawn-loop flowfield thrashing on the Host by updating `t.flowField` directly every 8 ticks or on tile crossings, preserved global `countAlive()` accuracy across target buckets, memoized `sim.currentWave()`, and hoisted closures out of Guest `applyWorldSync`.
- **WebSocket Relay Zero-Re-Serialization Fast Path**: Added a byte-splicing fast path in `serve.py` for unmodified JSON relay frames (-56% CPU time on `sync_world`), zero-copy single-chunk `read_exact`, and 1-player room broadcast skipping.
- **God Wars Projectile & Render-Loop Cleanups**: Scoped `targetEnemyUid` lookups in `Sim.stepEnemyProjectiles` to homing projectiles only (2.67x faster), eliminated per-frame `getComputedStyle` reflows in `cooks-assistant.js`, cached DOM nodes in `tile-coords.js` and `mp-prayers.js`, updated Party HUD HP bars in place in `mp-hud-leaderboard.js`, and removed redundant runtime changelog fetches in `ChangelogPanel.tsx`.

### Security Hardening - Round 2 (Full Codebase Audit)

- **Debug Mode Removed from Production**: Removed `debug-mode.js` from `index.html`; it is no longer loaded for any player. The `?debug=1` URL bypass and `localStorage` substring gate are also eliminated.
- **Co-Op God-Mode Fix**: Guests can no longer send `coop_debug` messages through the relay to trigger god-mode on the host's simulation.
- **Multiplayer Stat Clamp Expansion**: Peer-supplied `hpDelta` is now capped at +-200 per packet; `weapon.bonus` from peers is capped at 0.5 (legitimate max); 7 additional combat stats (`critChance`, `critDamage`, `pierce`, `split`, `bounces`, `healChance`, `healOnKill`) are now bounded in `sanitizePeerStats`.
- **Coin/XP Caps**: Host-broadcast `totalXp` is capped at 1 billion and coin pickup values at 50,000 per pickup to prevent run-state inflation.
- **Console API Locked Down**: `window.gameClient` is DEV-only; `window.l33th4x0r` is gated behind `isDebugAllowed()`; `window.game` alias is DEV-only.
- **HSTS Enabled**: Added `Strict-Transport-Security` with a 1-year max-age to prevent SSL-stripping on first request.
- **CSP Hardened**: Removed `unsafe-eval` from `script-src`; narrowed `connect-src` from open `ws:/wss:` wildcards to specific hostname; `Access-Control-Allow-Origin` scoped away from global `*`.
- **Cache Parser Hardening**: `caches.json` name field is now validated against an allowlist pattern; `fetchXteas` checks HTTP status and validates XTEA key schema; `sectorCluster.size` allocation is bounded at 32 MB; `ByteBuffer.readString` no longer infinite-loops on unterminated null strings; `Archive.decode` chunk-table underflow is caught.
- **CI/CD Hardening**: GitHub Actions `checkout` and `setup-node` pinned to full SHAs; `appleboy/ssh-action` SHA-pinned; `npm install --ignore-scripts` enforced on both production server and CI runner.
- **nginx Hardened**: Added `X-Frame-Options: DENY`, `Referrer-Policy`, rate limiting (`30 req/s`), `server_tokens off`, WebSocket-only guard on `/ws`, extension allowlist on `/caches/`.
- **serve.py Hardened**: Added `do_OPTIONS` returning 204; `X-Real-IP` validated as IP format before use; Python version suppressed from `Server:` header; ACAO suppressed on WebSocket 101 responses.



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
- **Unreachable Loot Recovery**: Pickups (caskets, power-ups, bones, coins, and food) dropped over walls, fences, trees, rocks, water, lava, ditches, islands, stationary blockers, or sub-tile obstacle edges by flying/ghost monsters now automatically target and slide onto the nearest player-walkable tile toward the player.
- **God Wars Dungeon Faction Warfare**: Expanded God Wars Dungeon (and Castle Wars) multi-faction combat so rival armies spot each other from further away (`14` tiles), ranged and magic troops (`aviansie`, spiritual rangers/mages) fire projectiles at rival faction monsters as well as players, aggroed monsters still brawl with rival faction monsters blocking their path, and monsters slain by rival factions drop XP bones.
- **Armoury Refund Option**: Added a **Refund all** button to the Armoury screen to refund all coins spent on casket gear upgrades and reset Armoury upgrade tiers.
- **Co-Op & Server Security Hardening**: Enforced Host-authority and server-stamped slot verification across Co-Op WebSocket messages (`coop_pickup`, `lobby_update`, `game_over`, `coop_quest`, `coop_debug`), added peer combat stat and hex-color sanitization (`sanitizePeerStats`, `sanitizeHexColor`), added per-connection WebSocket frame rate limiting (`120 fps`) and non-blocking room-full handling in `serve.py`, and hardened `auto_sync_upstream.cjs` (`spawnSync` argument arrays and `--ignore-scripts`) and `deploy.yaml` secret environment binding.
- **Upstream-Compatible Repository Structure**: Normalized repository line endings via `.gitattributes`, aligned `package-lock.json` with upstream, separated `docs/CHANGELOG.md` from upstream `CHANGELOG.md`, modularized custom content, secret codes, and content array overrides into `src/game/content/custom/`, extracted custom simulation and save helpers into `src/game/core/custom/`, extracted custom client/worker helpers into `src/game/client/custom/` and `src/mapviewer/worker/customNpcIcon.ts`, separated hand-authored runtime scripts into `src/custom/` (with gated `debug-mode.js` and Vitest unit tests in `src/custom/multiplayer/multiplayer.test.ts`), added typed `Window` declarations in `src/game/types/globals.d.ts`, and extracted `LeaderboardScreen.tsx`, `CoopGameOverSection.tsx`, and `CustomSettingsControls.tsx` into standalone UI components.
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
