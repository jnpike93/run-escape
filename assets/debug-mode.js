// =====================================================================
// MUST BE REMOVED IF WE GO LIVE
// Debug mode for testing. Enter a code in Settings > Save & Codes > Secret code:
//   "debugmode" turns it on (invulnerable, 1,000,000 HP, max armor, Shift sprints)
//   "bugmode"   turns it off and puts the player back to normal play.
// While it's on, press "\" in a run to open the debug panel: game speed, sliders for
// every player stat, plus attack speed, base damage, sprint speed and invulnerability.
// To remove: delete this file, its <script> tag in index.html, and "coop_debug"
// from both allowlists in serve.py.
// =====================================================================
(() => {
    const CODE_ON = 'debugmode';
    const CODE_OFF = 'bugmode';
    const PANEL_KEY = 'Backslash';
    const STORE_KEY = 'runEscapeDebugPanel';
    const NET_TYPE = 'coop_debug';
    const RESEND_MS = 3000;
    const NORMAL = 'Normal';

    // ------------------------------------------------------------------ slider definitions
    // kind: how the value is applied after the game calculates its own stats.
    //   'mult'  - multiplier handled by a hook (move speed, sprint, attack speed)
    //   'add'   - added to sim.stats[stat] (value / div, so percentages become fractions)
    //   'maxhp' - overrides the player's max HP (index 0 = the game's own value)
    //   'flat'  - flat damage added to every hit the player deals
    //   'game'  - game speed: scales how much time the game loop gets each frame
    // Every slider snaps to a notch: either evenly spaced (min/max/step) or a list of values.
    const range = (min, max, step) => { const v = []; for (let x = min; x <= max + 1e-9; x += step) v.push(Math.round(x * 100) / 100); return v; };
    const SLIDERS = [
        { group: 'Game' },
        { id: 'gameSpeed', label: 'Game speed', kind: 'game', normal: 1, values: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10], fmt: v => v === 1 ? `${NORMAL} (1x)` : `${v}x` },
        { group: 'Survival' },
        { id: 'maxHp', label: 'Max HP', kind: 'maxhp', values: [0, 50, 100, 250, 500, 1000, 5000, 10000, 100000, 1000000], fmt: v => v === 0 ? NORMAL : v.toLocaleString() },
        { id: 'armor', label: 'Armour (flat damage reduction)', kind: 'add', stat: 'armor', div: 1, values: [0, 1, 2, 3, 5, 10, 25, 50, 100, 1000, 1000000000], fmt: v => v >= 1e9 ? 'Max' : String(v) },
        { id: 'regen', label: 'HP regen (per minute)', kind: 'add', stat: 'regen', div: 1, values: [0, 5, 10, 25, 50, 100, 250, 500, 1000], fmt: v => String(v) },
        { id: 'thorns', label: 'Thorns (damage back)', kind: 'add', stat: 'thorns', div: 1, values: [0, 5, 10, 25, 50, 100, 250, 500], fmt: v => String(v) },
        { id: 'healChance', label: 'Heal chance', kind: 'add', stat: 'healChance', div: 100, values: range(0, 100, 5), fmt: v => `+${v}%` },
        { group: 'Movement' },
        { id: 'moveMult', label: 'Move speed', kind: 'mult', values: range(1, 10, 0.5), fmt: v => `${v}x` },
        { id: 'sprintMult', label: 'Shift sprint (on top)', kind: 'mult', values: range(1, 10, 0.5), fmt: v => `${v}x` },
        { id: 'magnet', label: 'Pickup range', kind: 'add', stat: 'magnet', div: 100, values: range(0, 1000, 50), fmt: v => `+${v}%` },
        { group: 'Offence' },
        { id: 'attackMult', label: 'Attack speed', kind: 'mult', values: range(1, 10, 0.5), fmt: v => `${v}x` },
        { id: 'flatDamage', label: 'Base damage (added to every hit)', kind: 'flat', values: [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 10000], fmt: v => `+${v.toLocaleString()}` },
        { id: 'might', label: 'Damage', kind: 'add', stat: 'might', div: 100, values: range(0, 1000, 25), fmt: v => `+${v}%` },
        { id: 'area', label: 'Range / attack size', kind: 'add', stat: 'area', div: 100, values: range(0, 500, 25), fmt: v => `+${v}%` },
        { id: 'speed', label: 'Projectile speed', kind: 'add', stat: 'speed', div: 100, values: range(0, 500, 25), fmt: v => `+${v}%` },
        { id: 'amount', label: 'Extra projectiles', kind: 'add', stat: 'amount', div: 1, values: range(0, 10, 1), fmt: v => `+${v}` },
        { id: 'duration', label: 'Effect duration', kind: 'add', stat: 'duration', div: 100, values: range(0, 500, 25), fmt: v => `+${v}%` },
        { group: 'Loot & growth' },
        { id: 'luck', label: 'Luck', kind: 'add', stat: 'luck', div: 100, values: range(0, 500, 25), fmt: v => `+${v}%` },
        { id: 'growth', label: 'XP gain', kind: 'add', stat: 'growth', div: 100, values: range(0, 1000, 50), fmt: v => `+${v}%` },
        { id: 'greed', label: 'Coin gain', kind: 'add', stat: 'greed', div: 100, values: range(0, 1000, 50), fmt: v => `+${v}%` },
    ];
    const DEFS = SLIDERS.filter(d => d.id);
    const neutralOf = d => d.normal ?? d.values[0];
    const NEUTRAL = Object.fromEntries(DEFS.map(d => [d.id, neutralOf(d)]));
    // What "debugmode" gives you straight away (the old god mode).
    const GOD_PRESET = { ...NEUTRAL, maxHp: 1000000, armor: 1000000000, sprintMult: 3 };

    let enabled = false;          // session only; reloading the page turns it off
    let invulnerable = true;      // keep HP topped up every tick
    let settings = loadSettings();
    let shiftDown = false;
    let hookedClient = null;
    let lastSent = 0;
    const godSlots = new Map();   // host only: guest slot -> { hp, invuln }
    const mp = () => window.multiplayer;

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
            if (saved && typeof saved === 'object') {
                if (typeof saved.invulnerable === 'boolean') invulnerable = saved.invulnerable;
                const out = { ...GOD_PRESET };
                for (const d of DEFS) if (d.values.includes(saved.values?.[d.id])) out[d.id] = saved.values[d.id];
                return out;
            }
        } catch (e) {}
        return { ...GOD_PRESET };
    }
    function saveSettings() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify({ invulnerable, values: settings })); } catch (e) {}
    }

    window.addEventListener('keydown', (e) => { if (e.key === 'Shift') shiftDown = true; });
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') shiftDown = false; });
    window.addEventListener('blur', () => { shiftDown = false; });

    // ------------------------------------------------------------------ applying stats

    function applyStats(sim) {
        if (!enabled || !sim?.player || !sim.stats) return;
        for (const d of DEFS) {
            if (d.kind === 'add') sim.stats[d.stat] = (sim.stats[d.stat] || 0) + settings[d.id] / d.div;
        }
        const p = sim.player;
        const hpTarget = settings.maxHp;
        if (hpTarget > 0 && p.maxHp !== hpTarget) {
            const gained = hpTarget - p.maxHp;
            p.maxHp = hpTarget;
            p.hp = Math.max(1, Math.min(hpTarget, p.hp + Math.max(0, gained)));
        }
        if (invulnerable && !p.spectating && p.hp > 0) p.hp = p.maxHp;
    }

    // Recalculate stats so slider changes (and turning it off) take effect immediately.
    function refreshStats(sim) {
        if (!sim?.player || typeof sim.updateStats !== 'function') return;
        try { sim.updateStats(); } catch (e) {}
        if (!enabled && sim.player.hp > sim.player.maxHp) sim.player.hp = sim.player.maxHp;
        try { hookedClient?.updateHud?.(true); } catch (e) {}
    }

    function setEnabled(client, on) {
        enabled = on;
        if (on) settings = loadSettings();
        refreshStats(client.sim);
        if (!on) closePanel();
        broadcastState(true);
        const message = on
            ? 'Debug mode ON: press \\ in a run for the debug panel.'
            : 'Debug mode OFF: back to normal play.';
        try { client.sounds?.taskDone?.(); } catch (e) {}
        client.store?.toast?.(message);
        return { ok: true, message };
    }

    // Game speed: the loop runs 50 ticks a second and takes at most 200 ms per frame. Give it more
    // (or less) time before each frame. In co-op the host runs the world for everyone, so a guest's
    // game speed is ignored.
    const FRAME_CAP_MS = 200, EXTRA_CAP_MS = 1000;
    function isCoopGuest() { const m = mp(); return !!(m && m.gameStarted && m.role === 'guest'); }
    function hookGameSpeed(client) {
        if (typeof client.update !== 'function' || client.__debugSpeedHooked) return;
        client.__debugSpeedHooked = true;
        const origUpdate = client.update.bind(client);
        client.update = (dt, ...rest) => {
            const sim = client.sim, speed = settings.gameSpeed;
            if (enabled && speed !== 1 && sim && !client.paused && sim.state === 'playing' && !isCoopGuest() && Number.isFinite(dt)) {
                const extra = Math.min(dt, FRAME_CAP_MS) * (speed - 1);
                client.accumulator = (client.accumulator || 0) + Math.max(-FRAME_CAP_MS, Math.min(EXTRA_CAP_MS, extra));
            }
            return origUpdate(dt, ...rest);
        };
    }

    function hookClient(client) {
        hookedClient = client;
        hookGameSpeed(client);
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

        // Gear, passives and buffs recalculate stats; layer the slider values on top every time.
        if (typeof sim.updateStats === 'function') {
            const origUpdate = sim.updateStats.bind(sim);
            sim.updateStats = (...args) => {
                const p = sim.player, hp0 = p?.hp, max0 = p?.maxHp;
                const r = origUpdate(...args);
                applyStats(sim);
                // With a custom max HP, a recalculation shouldn't change the player's current HP.
                if (enabled && p && settings.maxHp > 0 && p.maxHp === max0) p.hp = Math.min(hp0, p.maxHp);
                return r;
            };
        }

        // Attack speed: the game caps its own cooldown stat at 60% and 5 ticks, so scale the result directly.
        if (typeof sim.cooldownTicks === 'function') {
            const origCooldown = sim.cooldownTicks.bind(sim);
            sim.cooldownTicks = (t) => {
                const ticks = origCooldown(t);
                return enabled && settings.attackMult > 1 ? Math.max(1, Math.round(ticks / settings.attackMult)) : ticks;
            };
        }

        // Base damage: a flat amount added to every hit the player deals.
        if (typeof sim.damageEnemy === 'function') {
            const origDamage = sim.damageEnemy.bind(sim);
            sim.damageEnemy = (enemy, amount, ...rest) => origDamage(enemy, enabled && settings.flatDamage > 0 && amount > 0 ? amount + settings.flatDamage : amount, ...rest);
        }

        const origStep = sim.stepPlayer.bind(sim);
        sim.stepPlayer = (mx, my) => {
            // Host: keep guests who are in debug mode topped up every simulation tick.
            if (godSlots.size) { try { applyHostGodSlots(); } catch (e) {} }
            if (!enabled || !sim.stats) return origStep(mx, my);
            const p = sim.player;
            if (invulnerable && p && !p.spectating && p.hp > 0) p.hp = p.maxHp;
            const mult = settings.moveMult * (shiftDown ? settings.sprintMult : 1);
            if (mult === 1) return origStep(mx, my);
            // Movement speed is base * (1 + stats.moveSpeed); scale it for this step only.
            const base = sim.stats.moveSpeed || 0;
            sim.stats.moveSpeed = (1 + base) * mult - 1;
            try { return origStep(mx, my); } finally { sim.stats.moveSpeed = base; }
        };

        refreshStats(sim);
    }

    // ------------------------------------------------------------------ co-op
    // The host simulates every guest's HP, so a guest tells the host its chosen max HP and
    // whether it's invulnerable. Position (and so speed) comes from each player's own game.
    // Damage, attack speed and range for a guest's attacks are worked out by the host, so
    // those sliders only change the host's own attacks.

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
        const p = hookedClient?.sim?.player;
        const payload = { type: NET_TYPE, on: enabled, invuln: enabled && invulnerable, hp: enabled ? Math.round(p?.maxHp || settings.maxHp || 0) : 0 };
        try { m.send(payload); } catch (e) {}
    }

    function applyHostGodSlots() {
        const m = mp();
        if (!m || m.role !== 'host' || !m.remotePeers) return;
        for (const [slot, st] of godSlots) {
            const ent = m.remotePeers.get(slot)?.entity;
            if (!ent || ent.spectating || ent.hp <= 0) continue;
            if (!ent.__debugOrigMaxHp || (ent.maxHp !== st.hp && ent.maxHp <= 1000)) ent.__debugOrigMaxHp = ent.maxHp;
            if (st.hp > 0 && ent.maxHp !== st.hp) { ent.maxHp = st.hp; ent.hp = Math.min(ent.hp, st.hp); }
            if (st.invuln) ent.hp = ent.maxHp;
        }
    }

    function setHostGodSlot(slot, msg) {
        if (!slot) return;
        if (msg.on === true) {
            godSlots.set(slot, { hp: Math.max(0, Math.min(1000000, Number(msg.hp) || 0)), invuln: msg.invuln === true });
            applyHostGodSlots();
            return;
        }
        godSlots.delete(slot);
        const ent = mp()?.remotePeers?.get(slot)?.entity;
        if (ent && ent.__debugOrigMaxHp && ent.maxHp !== ent.__debugOrigMaxHp) {
            ent.maxHp = ent.__debugOrigMaxHp;
            ent.hp = Math.min(ent.hp, ent.maxHp);
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
                if (m.role === 'host') setHostGodSlot(Number(msg.senderSlot) || 0, msg);
                return;
            }
            if (msg && msg.type === 'peer_left') godSlots.delete(Number(msg.slot || msg.senderSlot) || 0);
            return orig(msg);
        };
    }

    // ------------------------------------------------------------------ the panel

    const PANEL_ID = 'debug-stat-panel';

    function injectStyle() {
        if (document.getElementById(PANEL_ID + '-style')) return;
        const style = document.createElement('style');
        style.id = PANEL_ID + '-style';
        style.textContent = `
            #${PANEL_ID} { box-sizing: border-box; position: fixed; top: 8px; left: 12px; z-index: 960; width: 330px; max-height: calc((100vh - 16px) / var(--ui-scale, 1));
                overflow-y: auto; zoom: var(--ui-scale, 1); background: rgba(28, 22, 15, 0.95); border: 2px solid #5a4a35;
                outline: 2px solid #0e0b07; box-shadow: 0 4px 16px rgba(0,0,0,0.85); padding: 8px 12px 10px;
                font-family: 'OSRS Small', 'OSRS Bold', sans-serif; color: #d4c4a8; user-select: none; }
            #${PANEL_ID} h2 { margin: 0 0 2px; font-family: 'OSRS Bold', sans-serif; font-size: 16px; font-weight: normal; color: #ff981f; text-shadow: 1px 1px #000; }
            #${PANEL_ID} .dp-hint { font-size: 12px; color: #9a8a70; margin-bottom: 6px; }
            #${PANEL_ID} h3 { margin: 10px 0 4px; font-family: 'OSRS Bold', sans-serif; font-size: 13px; font-weight: normal; color: #ff981f; border-bottom: 1px solid #4a3c2c; }
            #${PANEL_ID} .dp-row { margin: 6px 0 8px; }
            #${PANEL_ID} .dp-top { display: flex; justify-content: space-between; font-size: 13px; text-shadow: 1px 1px #000; }
            #${PANEL_ID} .dp-val { color: #ffff00; }
            #${PANEL_ID} .dp-val.dp-normal { color: #9a8a70; }
            #${PANEL_ID} input[type=range] { width: 100%; margin: 3px 0 0; accent-color: #ff981f; cursor: pointer; }
            #${PANEL_ID} .dp-notches { position: relative; height: 5px; margin: 0 7px; }
            #${PANEL_ID} .dp-notches span { position: absolute; top: 0; width: 1px; height: 5px; background: #6b5a40; }
            #${PANEL_ID} .dp-check { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 6px 0; cursor: pointer; }
            #${PANEL_ID} .dp-buttons { display: flex; gap: 6px; margin-top: 10px; }
            #${PANEL_ID} button { flex: 1; background: #1a140e; border: 2px solid #4a3c2c; color: #d4c4a8; padding: 4px 6px; cursor: pointer;
                font-family: 'OSRS Bold', sans-serif; font-size: 12px; text-shadow: 1px 1px #000; }
            #${PANEL_ID} button:hover { border-color: #ff981f; color: #ffff00; }
        `;
        document.head.appendChild(style);
    }

    function buildPanel() {
        injectStyle();
        const el = document.createElement('div');
        el.id = PANEL_ID;
        const rows = SLIDERS.map(d => {
            if (d.group) return `<h3>${d.group}</h3>`;
            const n = d.values.length - 1;
            const notches = d.values.map((_, i) => `<span style="left:${(i / n) * 100}%"></span>`).join('');
            return `<div class="dp-row" data-id="${d.id}">
                <div class="dp-top"><span>${d.label}</span><span class="dp-val"></span></div>
                <input type="range" min="0" max="${n}" step="1" value="0" aria-label="${d.label}">
                <div class="dp-notches">${notches}</div>
            </div>`;
        }).join('');
        el.innerHTML = `
            <h2>Debug panel</h2>
            <div class="dp-hint">\\ to close. Changes apply right away.</div>
            <label class="dp-check"><input type="checkbox" class="dp-invuln"> Invulnerable (HP stays full)</label>
            ${rows}
            <div class="dp-buttons">
                <button class="dp-god">God mode preset</button>
                <button class="dp-normal">All normal</button>
            </div>`;
        document.body.appendChild(el);

        el.addEventListener('input', (e) => {
            const row = e.target.closest('.dp-row');
            if (row) {
                const d = DEFS.find(x => x.id === row.dataset.id);
                settings[d.id] = d.values[Number(e.target.value)];
            } else if (e.target.classList.contains('dp-invuln')) {
                invulnerable = e.target.checked;
            }
            saveSettings(); syncPanel(); refreshStats(hookedClient?.sim); broadcastState(true);
        });
        el.querySelector('.dp-god').addEventListener('click', () => { settings = { ...GOD_PRESET }; invulnerable = true; saveSettings(); syncPanel(); refreshStats(hookedClient?.sim); broadcastState(true); });
        el.querySelector('.dp-normal').addEventListener('click', () => { settings = { ...NEUTRAL }; invulnerable = false; saveSettings(); syncPanel(); refreshStats(hookedClient?.sim); broadcastState(true); });
        // Keep keys pressed on the panel (arrows on a slider, Space on a button) away from the game.
        el.addEventListener('keydown', (e) => { if (e.code !== PANEL_KEY) e.stopPropagation(); });
        return el;
    }

    function syncPanel() {
        const el = document.getElementById(PANEL_ID);
        if (!el) return;
        el.querySelector('.dp-invuln').checked = invulnerable;
        for (const row of el.querySelectorAll('.dp-row')) {
            const d = DEFS.find(x => x.id === row.dataset.id);
            const v = settings[d.id];
            row.querySelector('input').value = String(Math.max(0, d.values.indexOf(v)));
            const label = row.querySelector('.dp-val');
            label.textContent = d.fmt(v);
            label.classList.toggle('dp-normal', v === neutralOf(d));
        }
    }

    function openPanel() { const el = document.getElementById(PANEL_ID) || buildPanel(); el.style.display = 'block'; syncPanel(); }
    function closePanel() { const el = document.getElementById(PANEL_ID); if (el) el.style.display = 'none'; }
    function panelOpen() { const el = document.getElementById(PANEL_ID); return !!el && el.style.display !== 'none'; }

    window.addEventListener('keydown', (e) => {
        if (e.code !== PANEL_KEY || e.repeat) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox' || t.tagName === 'TEXTAREA')) return;
        if (!enabled) return;
        if (!panelOpen() && !hookedClient?.sim) { hookedClient?.store?.toast?.('Start a run to use the debug panel.'); return; }
        e.preventDefault();
        if (panelOpen()) closePanel(); else openPanel();
    }, true);

    // ------------------------------------------------------------------ main loop

    function watch() {
        const client = window.gameClient;
        if (client && client !== hookedClient && typeof client.redeemCode === 'function') hookClient(client);
        if (client?.sim) hookSim(client.sim);
        else if (panelOpen()) closePanel();
        hookMultiplayer();
        try {
            if (!inCoopRun()) godSlots.clear();
            broadcastState(false);
            applyHostGodSlots();
        } catch (e) {}
        requestAnimationFrame(watch);
    }
    requestAnimationFrame(watch);

    window.runEscapeDebug = {
        get enabled() { return enabled; },
        get settings() { return { ...settings, invulnerable }; },
        open: () => enabled && openPanel(),
        close: closePanel
    };
})();
