# GitHub Copilot & Automated PR Agent Instructions

All AI coding agents operating in this repository MUST follow these rules without exception:

1. **Pre-Flight Requirement**: Read `AGENTS.md`, `AGENT_NOTES.md`, and `.jules/sentinel.md` before proposing or applying changes.
2. **Preserve Bundle Hooks & Cache Busting**:
   - Do not remove inline hooks (`window.gameClient`, `window.multiplayer`, `window._osrsPrayer`, `window._drawOsrsPrayerOverlay`, `window._hideOsrsPrayerBar`) in `assets/index-*.js`.
   - When modifying client JS/CSS/WASM assets, increment `?v=X.Y` across all 6 files listed in `AGENTS.md`.
3. **Mandatory Handoff Log Update**:
   - Every agent change or PR MUST prepend a new entry under `## 3. Chronological Agent Handoff Log` in `AGENT_NOTES.md` using the template in that file.
4. **Verification**:
   - Run `python -m unittest test_serve.py` and `node --check assets/multiplayer.js` before completing work.

