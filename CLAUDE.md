# Mandatory Agent Instructions (Claude Code / AI Assistants)

Before reading, modifying, or merging any code in this repository, you MUST read and obey:
1. [`AGENTS.md`](./AGENTS.md) - Mandatory operating protocol, TypeScript source-first build workflow (`src/` + `npm run build` via `scripts/sync_dist.cjs`), cache-busting synchronization, and verification commands.
2. [`docs/AGENT_NOTES.md`](./docs/AGENT_NOTES.md) - Active bundle hash registry, TypeScript engine hook map, and cross-agent handoff log.
3. [`.jules/sentinel.md`](./.jules/sentinel.md) - Security invariants for `serve.py`.

**Mandatory Post-Task Requirement**:
1. Run `npm test`, `python -m unittest test_serve.py`, and `node --check assets/multiplayer.js` to verify all changes.
2. Update [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) (compiled into the bundle via `npm run build`) and prepend a handoff entry to [`docs/AGENT_NOTES.md`](./docs/AGENT_NOTES.md) before completing any task, commit, or pull request so subsequent contributor agents know exactly what changed.
