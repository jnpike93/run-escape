# Run Escape

Credit to https://jere.io/run-escape/ @Dynrothe on twitter

---

## Mandatory Instructions for All AI Coding Agents & Contributors

> **[!IMPORTANT] AGENT DIRECTIVE (Antigravity, Jules, Claude Code, GitHub Copilot, Cursor, Codex, Windsurf)**
> If you are an automated coding agent or AI assistant reading or modifying this repository, you MUST strictly follow the protocol in [`AGENTS.md`](./AGENTS.md):
> 1. **Read First**: Read [`AGENTS.md`](./AGENTS.md), [`AGENT_NOTES.md`](./AGENT_NOTES.md), and [`.jules/sentinel.md`](./.jules/sentinel.md) BEFORE making any edits or resolving merge conflicts.
> 2. **Synchronize Cache-Busting Versions**: Any modification to client bundles or [`assets/multiplayer.js`](./assets/multiplayer.js) requires bumping `?v=X.Y` across all 6 entry points listed in [`AGENTS.md`](./AGENTS.md).
> 3. **Leave a Handoff Note**: Before finishing your task, commit, or PR, you MUST prepend a structured entry under `## 3. Chronological Agent Handoff Log` in [`AGENT_NOTES.md`](./AGENT_NOTES.md) documenting every file changed, bundle/symbol impact, and invariants for the next agent.

## Cache version

The game uses the `osrs-241_2026-09-30` cache (OSRS revision 241, 30 September 2026).

## Development

Run `npm run build` to compile the TypeScript source (`src/`) via Vite and sync the built assets into `assets/` and `index.html`.
