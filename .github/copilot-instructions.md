# GitHub Copilot & Automated PR Agent Instructions

All AI coding agents operating in this repository MUST follow these rules without exception:

1. **Pre-Flight Requirement**: Read `AGENTS.md`, `AGENT_NOTES.md`, and `.jules/sentinel.md` before proposing or applying changes.
2. **Source-First TypeScript Workflow & Cache Busting**:
   - Make all engine, map, enemy, and UI modifications in the unminified TypeScript source (`src/`) and build via `npm run build` (`vite build && node scripts/sync_dist.cjs`). Never directly regex-patch minified bundles in `assets/index-*.js`.
   - Preserve global hooks (`window.gameClient`, `window.multiplayer`, `window._osrsPrayer`, `window._drawOsrsPrayerOverlay`, `window._hideOsrsPrayerBar`) in `src/`.
   - When modifying client JS/CSS/WASM assets, synchronize `?v=X.Y` via `node scripts/sync_dist.cjs --version=X.Y` across `index.html` and `assets/` as documented in `AGENTS.md`.
3. **Mandatory Handoff Log & Changelog Update**:
   - Every agent change or PR MUST update `CHANGELOG.md` and prepend a new entry under `## 3. Chronological Agent Handoff Log` in `AGENT_NOTES.md` using the template in that file.
4. **Verification**:
   - Run `npm test`, `python -m unittest test_serve.py`, and `node --check assets/multiplayer.js` before completing work.
