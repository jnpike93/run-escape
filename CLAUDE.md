# Mandatory Agent Instructions (Claude Code / AI Assistants)

Before reading, modifying, or merging any code in this repository, you MUST read and obey:
1. [`AGENTS.md`](./AGENTS.md) - Mandatory operating protocol, upstream-friendly modular architecture (`src/game/content/custom/`, `src/game/core/custom/`, `src/game/client/custom/`, `src/custom/`, standalone `src/game/ui/` components, `src/game/types/globals.d.ts`, untouched root `CHANGELOG.md` / `package-lock.json`), TypeScript source-first build workflow (`npm run build` via `scripts/sync_dist.cjs`), and verification commands.
2. [`docs/AGENT_NOTES.md`](./docs/AGENT_NOTES.md) - Active bundle hash registry, TypeScript engine hook map, and cross-agent handoff log.
3. [`.jules/sentinel.md`](./.jules/sentinel.md) - Security invariants for `server/serve.py`.

**Mandatory Post-Task Requirement**:
1. Run `npx tsc --noEmit`, `npm test`, `python -m unittest server/test_serve.py`, and `node --check src/custom/multiplayer.js` to verify all changes.
2. Update [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) (never edit root `CHANGELOG.md`), run `npm run build` so `docs/CHANGELOG.md` and `src/custom/` are synced into `assets/`, and prepend a handoff entry to [`docs/AGENT_NOTES.md`](./docs/AGENT_NOTES.md) before completing any task, commit, or pull request.
