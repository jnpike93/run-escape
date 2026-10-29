# Run Escape - Multi-Agent Operating Instructions & Handoff Protocol

## 1. Mandatory Agent Workflow (Read & Write Protocol)
Every automated agent or contributor assistant (Antigravity, Jules, Claude Code, Cursor, Copilot) working in this repository MUST follow these steps:

1. **Pre-Flight Read**: Before modifying any files or resolving a merge, read:
   - [`AGENT_NOTES.md`](./AGENT_NOTES.md) for the latest cross-agent handoff log, active bundle hashes, and custom hook locations.
   - [`.jules/sentinel.md`](./.jules/sentinel.md) for historical security findings and invariants in [`serve.py`](./serve.py).
   - [`MULTIPLAYER_ARCHITECTURE.md`](./MULTIPLAYER_ARCHITECTURE.md) when modifying WebSocket relay or Co-Op simulation logic.
2. **Post-Task Handoff Note**: Before finishing a task, commit, or pull request, prepend a new entry under `## Chronological Agent Handoff Log` in [`AGENT_NOTES.md`](./AGENT_NOTES.md) using the template defined in that file.
3. **Cache-Busting Synchronization**: Whenever [`assets/index-XWbnxuVz.js`](./assets/index-XWbnxuVz.js), [`assets/multiplayer.js`](./assets/multiplayer.js), or worker/module bundles are modified, increment the `?v=X.Y` query string across ALL 6 entry points in lockstep:
   - [`index.html`](./index.html) (`index-*.js`, `multiplayer.js`, `index-*.css`)
   - [`assets/index-XWbnxuVz.js`](./assets/index-XWbnxuVz.js) (`RenderDataWorker-*.js?v=X.Y`, `MapViewerApp-*.js?v=X.Y`, and `module-C9loB8SI.js?v=X.Y`)
   - [`assets/MapViewerApp-DKojfbH1.js`](./assets/MapViewerApp-DKojfbH1.js) (`index-*.js?v=X.Y`)
   - [`assets/RenderDataWorker-CRRhTJTb.js`](./assets/RenderDataWorker-CRRhTJTb.js) (`module-Cg9b2g3N.js?v=X.Y`)
   - [`assets/module-Cg9b2g3N.js`](./assets/module-Cg9b2g3N.js) (`RenderDataWorker-CRRhTJTb.js?v=X.Y`)
   - [`assets/module-C9loB8SI.js`](./assets/module-C9loB8SI.js) (`index-XWbnxuVz.js?v=X.Y`)

## 2. Guidelines for Fast Merges
- **Minimize Inline Bundle Edits**: Keep custom gameplay, HUD, and Co-Op logic inside [`assets/multiplayer.js`](./assets/multiplayer.js) via runtime method wrapping (`sim.step`, `sim.spawnEnemy`, `sim.stepEnemies`, `sim.collect`) rather than editing minified bundle code directly whenever possible.
- **Preserve Bundle Hook Anchors**: If an inline edit in [`assets/index-XWbnxuVz.js`](./assets/index-XWbnxuVz.js) is required, document the surrounding invariant anchor string in [`AGENT_NOTES.md`](./AGENT_NOTES.md) so future agents can locate the equivalent position after an upstream bundle rebuild.
- **Parallel Subagent Chunking**: Whenever a task spans multiple files or domains, split it into small, parallel subagents with disjoint file ownership. Never emit a >20 KB patch script in a single `write_file` tool call; instead, write a compact (<10 KB) Node/Python transformation script that updates existing patch scripts programmatically.
- **Verification**: Always run `python -m unittest test_serve.py` and `node --check assets/multiplayer.js` before finalizing any merge or commit.
