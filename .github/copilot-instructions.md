# GitHub Copilot & Automated PR Agent Instructions

All AI coding agents operating in this repository MUST follow these rules without exception:

1. **Pre-Flight Requirement**: Read `AGENTS.md`, `docs/AGENT_NOTES.md`, and `.jules/sentinel.md` before proposing or applying changes.
2. **Upstream-Friendly Modularization**:
   - Add custom characters, maps, enemies, secret codes, and in-place content overrides in `src/game/content/custom/` (`customCharacters.ts`, `customMaps.ts`, `customEnemies.ts`, `secretCodes.ts`, `customOverrides.ts`) and spread/delegate them via single lines in upstream files.
   - Add custom simulation and save logic in `src/game/core/custom/` (`pickupRecovery.ts`, `customSimHooks.ts`, `customSave.ts`) and custom client/worker helpers in `src/game/client/custom/dogActors.ts` and `src/mapviewer/worker/customNpcIcon.ts`.
   - Add custom UI screens/modals/controls as standalone components in `src/game/ui/` (`LeaderboardScreen.tsx`, `CoopGameOverSection.tsx`, `CustomSettingsControls.tsx`) to keep `GameUi.tsx` diffs minimal.
   - Edit hand-authored runtime scripts (`multiplayer.js`, `multiplayer/mp-*.js`, `cooks-assistant.js`, `tile-coords.js`, `debug-mode.js`) in `src/custom/`; `npm run build` copies `src/custom/` into `assets/` via `scripts/sync_dist.cjs`.
   - Declare global `window.*` bridges in `src/game/types/globals.d.ts`.
   - Leave root `CHANGELOG.md`, `docs/DEVELOPMENT.md`, and `package-lock.json` untouched so `upstream/main` fast-forwards cleanly; write custom changelog entries only in `docs/CHANGELOG.md`. Maintain LF (`\n`) line endings per `.gitattributes`.
3. **Source-First TypeScript Workflow & Cache Busting**:
   - Make all engine, map, enemy, and UI modifications in `src/` and build via `npm run build` (`vite build && node scripts/sync_dist.cjs`). Never directly regex-patch minified bundles in `assets/index-*.js`.
   - Preserve global hooks (`window.gameClient`, `window.multiplayer`, `window._osrsPrayer`, `window._drawOsrsPrayerOverlay`, `window._hideOsrsPrayerBar`) in `src/`.
4. **Mandatory Handoff Log & Changelog Update**:
   - Every agent change or PR MUST update `docs/CHANGELOG.md`, run `npm run build`, and prepend a new entry under `## 3. Chronological Agent Handoff Log` in `docs/AGENT_NOTES.md` using the template in that file.
5. **Verification**:
   - Run `npx tsc --noEmit`, `npm test`, `python -m unittest server/test_serve.py`, and `node --check src/custom/multiplayer.js` before completing work.
