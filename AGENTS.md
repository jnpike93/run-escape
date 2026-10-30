# Run Escape - Multi-Agent Operating Instructions & Handoff Protocol

## 1. Mandatory Agent Workflow (Read & Write Protocol)
Every automated agent or contributor assistant (Antigravity, Jules, Claude Code, Cursor, Copilot) working in this repository MUST follow these steps:

1. **Pre-Flight Read**: Before modifying any files or resolving a merge, read:
   - [`docs/AGENT_NOTES.md`](./docs/AGENT_NOTES.md) for the latest cross-agent handoff log, active bundle hashes, and custom hook locations.
   - [`.jules/sentinel.md`](./.jules/sentinel.md) for historical security findings and invariants in [`serve.py`](./serve.py).
   - [`docs/MULTIPLAYER_ARCHITECTURE.md`](./docs/MULTIPLAYER_ARCHITECTURE.md) when modifying WebSocket relay or Co-Op simulation logic.
2. **Post-Task Handoff Note & Live Changelog Update**: Before finishing any task, commit, or pull request:
   - Update [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) to reflect all upstream or custom changes (`src/game/ui/changelog.ts` imports `docs/CHANGELOG.md?raw` at build time and `ChangelogPanel.tsx` fetches `docs/CHANGELOG.md` live at runtime).
   - Prepend a new entry under `## Chronological Agent Handoff Log` in [`docs/AGENT_NOTES.md`](./docs/AGENT_NOTES.md) using the template defined in that file.
3. **Source-First Build & Cache-Busting Synchronization**:
   - Edit the unminified TypeScript source under [`src/`](./src/) rather than editing compiled bundles in `assets/` directly.
   - Increment the `?v=X.Y` query string in [`index.html`](./index.html) (or pass `--version=X.Y` to [`scripts/sync_dist.cjs`](./scripts/sync_dist.cjs)) and run `npm run build` (`vite build && node scripts/sync_dist.cjs`), which compiles `src/` into `dist/` and automatically synchronizes `assets/index-*.js`, `assets/MapViewerApp-*.js`, `assets/RenderDataWorker-*.js`, `assets/module-*.js`, [`index.html`](./index.html), and [`assets/multiplayer.js`](./assets/multiplayer.js) with the active `?v=X.Y` cache-busting query string.

## 2. Guidelines for Fast Merges
- **Source-Based Upstream Merges (`upstream/main`)**: Pull upstream source changes from `https://github.com/Dynrothe/Run-Escape.git` (`git fetch upstream && git merge upstream/main`), resolve any TypeScript conflicts in `src/`, and run `npm test && npm run build`.
- **Parallel Subagent Chunking**: Whenever a task spans multiple files or domains, split it into small, parallel subagents with disjoint file ownership. Never emit a >20 KB file in a single `write_file` tool call; instead, write a compact (<10 KB) Node/Python transformation script or edit targeted regions with `edit_file`.
- **Verification**: Always run `npm test`, `python -m unittest test_serve.py`, and `node --check assets/multiplayer.js` before finalizing any merge or commit.
