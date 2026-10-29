// =====================================================================
// MUST BE REMOVED IF WE GO LIVE
// Debug mode (god mode) for testing, entered in Settings > Save & Codes > Secret code:
//   "debugmode" turns it on:  invulnerable (1,000,000 HP, max armor) and
//               holding Shift moves the player at 3x speed.
//   "bugmode"   turns it off and sets the player back to normal play.
// To remove: delete this file and its <script> tag in index.html.
// =====================================================================
(() => {
    const CODE_ON = 'debugmode';
    const CODE_OFF = 'bugmode';
    const SPEED_MULT = 3;
    const GOD_HP = 1000000;
    const GOD_ARMOR = 1000000000; // armor is flat damage reduction; hits always do at least 1

    let enabled = false;      // session only; reloading the page turns it off
    let shiftDown = false;
    let hookedClient = null;

    // Co-op: the host simulates every guest's HP, so a guest in debug mode tells the host,
    // and the host keeps that guest's character topped up too. Positions are sent by each
    // player's own game, so the 3x speed already shows correctly for everyone.
    const NET_TYPE = 'coop_debug';
    const RESEND_MS = 3000;
    let lastSent = 0;
    const godSlots = new Set();   // host only: guest slots currently in debug mode
    const mp = () => window.multiplayer;

    function inCoopRun() {
        const m = mp();
        return !!(m && m.gameStarted && m.remotePeers && m.remotePeers.size > 0);
    }

    function broadcastState(force) {
        const m = mp();
        if (!inCoopRun() || m.role !== 'guest') return;
        const now = performance.now();
        if (!force && (!enabled || now - lastSent < RESEND_MS)) return;
        lastSent = now;
        try { m.send({ type: NET_TYPE, on: enabled }); } catch (e) {}
    }

    function applyHostGodSlots() {
        const m = mp();
        if (!m || m.role !== 'host' || !m.remotePeers) return;
        for (const slot of godSlots) {
            const ent = m.remotePeers.get(slot)?.entity;
            if (!ent || ent.spectating || ent.hp <= 0) continue;
            if (ent.maxHp !== GOD_HP) ent.__debugOrigMaxHp = ent.maxHp;
            ent.maxHp = GOD_HP;
            ent.hp = GOD_HP;
        }
    }

    function setHostGodSlot(slot, on) {
        if (!slot) return;
        if (on) { godSlots.add(slot); applyHostGodSlots(); return; }
        godSlots.delete(slot);
        const ent = mp()?.remotePeers?.get(slot)?.entity;
        if (ent && ent.maxHp === GOD_HP) {
            const orig = ent.__debugOrigMaxHp || 25;
            ent.maxHp = orig;
            ent.hp = Math.min(ent.hp, orig);
        }
    }

    let hookedMp = null;
    function hookMultiplayer() {
        const m = mp();
        if (!m || m === hookedMp || typeof m.handleMessage !== 'function') return;
        hookedMp = m;
        const orig = m.handleMessage.bind(m);
        m.handleMessage = (msg) => {
            if (msg && msg.type === NET_TYPE) {
                if (m.role === 'host') setHostGodSlot(Number(msg.senderSlot) || 0, msg.on === true);
                return;
            }
            if (msg && msg.type === 'peer_left') godSlots.delete(Number(msg.slot || msg.senderSlot) || 0);
            return orig(msg);
        };
    }

    window.addEventListener('keydown', (e) => { if (e.key === 'Shift') shiftDown = true; });
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') shiftDown = false; });
    window.addEventListener('blur', () => { shiftDown = false; });

    // Apply god stats on top of whatever the game calculated.
    function applyGodStats(sim) {
        if (!sim?.player || !sim.stats) return;
        sim.stats.armor = GOD_ARMOR;
        sim.player.maxHp = GOD_HP;
        sim.player.hp = GOD_HP;
    }

    // Recalculate the player's real stats; the game rescales HP back to its normal maximum.
    function restoreStats(sim) {
        if (!sim?.player || typeof sim.updateStats !== 'function') return;
        sim.__debugOrigUpdateStats ? sim.__debugOrigUpdateStats() : sim.updateStats();
    }

    function setEnabled(client, on) {
        enabled = on;
        if (on) applyGodStats(client.sim);
        else restoreStats(client.sim);
        broadcastState(true);
        const message = on
            ? 'Debug mode ON: invulnerable, hold Shift for 3x move speed.'
            : 'Debug mode OFF: back to normal play.';
        try { client.sounds?.taskDone?.(); } catch (e) {}
        client.store?.toast?.(message);
        return { ok: true, message };
    }

    function hookClient(client) {
        hookedClient = client;
        const origRedeem = client.redeemCode.bind(client);
        client.redeemCode = (value) => {
            const code = String(value ?? '').trim().toLowerCase();
            if (code === CODE_ON) return setEnabled(client, true);
            if (code === CODE_OFF) return setEnabled(client, false);
            return origRedeem(value);
        };
    }

    function hookSim(sim) {
        if (!sim || sim.__debugModeHooked || typeof sim.stepPlayer !== 'function') return;
        sim.__debugModeHooked = true;

        // Gear, passives and buffs recalculate stats; re-apply god stats after each recalculation.
        if (typeof sim.updateStats === 'function') {
            const origUpdate = sim.updateStats.bind(sim);
            sim.__debugOrigUpdateStats = origUpdate;
            sim.updateStats = (...args) => {
                const r = origUpdate(...args);
                if (enabled) applyGodStats(sim);
                return r;
            };
        }

        const origStep = sim.stepPlayer.bind(sim);
        sim.stepPlayer = (mx, my) => {
            // Host: keep guests who are in debug mode topped up every simulation tick.
            if (godSlots.size) { try { applyHostGodSlots(); } catch (e) {} }
            if (!enabled || !sim.stats) return origStep(mx, my);
            // Keep HP topped up (poison and the 1-damage minimum still tick).
            if (sim.player && !sim.player.spectating) sim.player.hp = sim.player.maxHp = GOD_HP;
            if (!shiftDown) return origStep(mx, my);
            // Movement speed is base * (1 + stats.moveSpeed); scale it 3x for this step only.
            const base = sim.stats.moveSpeed || 0;
            sim.stats.moveSpeed = (1 + base) * SPEED_MULT - 1;
            try { return origStep(mx, my); } finally { sim.stats.moveSpeed = base; }
        };

        if (enabled) applyGodStats(sim);
    }

    function watch() {
        const client = window.gameClient;
        if (client && client !== hookedClient && typeof client.redeemCode === 'function') hookClient(client);
        if (client?.sim) hookSim(client.sim);
        hookMultiplayer();
        try {
            if (!inCoopRun()) godSlots.clear();
            broadcastState(false);
            applyHostGodSlots();
        } catch (e) {}
        requestAnimationFrame(watch);
    }
    requestAnimationFrame(watch);

    window.runEscapeDebug = { get enabled() { return enabled; } };
})();
