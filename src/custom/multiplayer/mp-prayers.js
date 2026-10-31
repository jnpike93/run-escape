// Run Escape - OSRS Protection Prayers & Fight Caves Overlay

// ============================================================================
// OSRS Protection Prayer System for Fight Caves & TzTok-Jad (NPC ID 3127)
// ============================================================================
window._osrsPrayer = null; // 'magic' | 'ranged' | 'melee' | null

// Real OSRS prayer sprites from the game cache (rev 241): prayer book icons are sprites 127-129,
// overhead icons are sprite group 440 (frames 0 melee, 1 missiles, 2 magic).
export const OSRS_PRAYER_ICONS = {
    magic: { book: './assets/prayer/protect-magic.png', overhead: './assets/prayer/overhead-magic.png' },
    ranged: { book: './assets/prayer/protect-missiles.png', overhead: './assets/prayer/overhead-missiles.png' },
    melee: { book: './assets/prayer/protect-melee.png', overhead: './assets/prayer/overhead-melee.png' }
};
const _overheadPrayerImages = {};
for (const [type, icons] of Object.entries(OSRS_PRAYER_ICONS)) {
    const img = new Image();
    img.src = icons.overhead;
    _overheadPrayerImages[type] = img;
}

export function drawOverheadPrayerEmblem(ctx, x, y, scale, prayerType) {
    if (!prayerType) return;
    const img = _overheadPrayerImages[prayerType];
    if (!img || !img.complete || !img.naturalWidth) return;
    // The sprite is 25x25; draw it at a whole-number multiple so the pixel art stays crisp.
    const size = img.naturalWidth * Math.max(1, Math.round(scale * 1.1));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    ctx.restore();
}

export function setOsrsPrayer(type) {
    window._osrsPrayer = window._osrsPrayer === type ? null : type;
    const client = window.gameClient || window._client;
    if (client?.sim?.player) {
        client.sim.player.activePrayer = window._osrsPrayer;
    }
    updateOsrsPrayerBarUI();
}

let _prayerBarEl = null;
let _lastPrayerBarVisible = false;

function getPrayerBarEl() {
    if (!_prayerBarEl || !_prayerBarEl.isConnected) {
        _prayerBarEl = document.getElementById('osrs-prayer-bar');
    }
    return _prayerBarEl;
}

export function ensureOsrsPrayerBarUI() {
    let bar = getPrayerBarEl();
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'osrs-prayer-bar';
    bar.style.cssText = `
        position: fixed;
        bottom: 92px;
        left: 50%;
        transform: translateX(-50%);
        zoom: var(--ui-scale, 1);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        max-width: calc(100vw - 12px);
        box-sizing: border-box;
        display: none;
        align-items: center;
        gap: 8px;
        background: rgba(28, 22, 15, 0.94);
        border: 2px solid #5a4a35;
        outline: 2px solid #0e0b07;
        padding: 6px 12px;
        z-index: 950;
        user-select: none;
        -webkit-user-select: none;
        font-family: 'OSRS Bold', monospace;
        box-shadow: 0 4px 16px rgba(0,0,0,0.85);
    `;
    const prayers = [
        { id: 'magic', key: 'Q', label: 'Protect Magic' },
        { id: 'ranged', key: 'E', label: 'Protect Missiles' },
        { id: 'melee', key: 'R', label: 'Protect Melee' }
    ];
    bar.innerHTML = `
        <div style="font-size: 11px; color: #ff981f; margin-right: 4px; text-shadow: 1px 1px #000;">
            PRAYERS:
        </div>
        ${prayers.map(p => `
            <button class="osrs-prayer-btn" data-prayer="${p.id}" style="
                display: flex; align-items: center; gap: 6px;
                background: #1a140e; border: 2px solid #4a3c2c;
                color: #d4c4a8; padding: 3px 10px 3px 6px; cursor: pointer;
                font-family: 'OSRS Bold', monospace; font-size: 12px;
                border-radius: 3px; text-shadow: 1px 1px #000;
                touch-action: manipulation; -webkit-tap-highlight-color: transparent;
                user-select: none; -webkit-user-select: none;">
                <img src="${OSRS_PRAYER_ICONS[p.id].book}" width="30" height="30" alt="" draggable="false"
                    style="image-rendering: pixelated; display: block; pointer-events: none;">
                <span>[${p.key}] ${p.label}</span>
            </button>
        `).join('')}
    `;
    bar.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    bar.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: true });
    bar.querySelectorAll('button[data-prayer]').forEach(btn => {
        let lastTouchToggle = 0;
        btn.addEventListener('pointerdown', (ev) => {
            ev.stopPropagation();
        });
        btn.addEventListener('touchstart', (ev) => {
            ev.stopPropagation();
        }, { passive: true });
        btn.addEventListener('touchend', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            lastTouchToggle = performance.now();
            setOsrsPrayer(btn.getAttribute('data-prayer'));
            btn.blur();
        }, { passive: false });
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (performance.now() - lastTouchToggle < 400) return;
            setOsrsPrayer(btn.getAttribute('data-prayer'));
            btn.blur();
        });
    });
    document.body.appendChild(bar);
    _prayerBarEl = bar;
    _lastPrayerBarVisible = false;
    return bar;
}

export function updateOsrsPrayerBarUI() {
    const bar = getPrayerBarEl();
    if (!bar) return;
    bar.querySelectorAll('button[data-prayer]').forEach(btn => {
        const pId = btn.getAttribute('data-prayer');
        const active = window._osrsPrayer === pId;
        btn.style.background = active ? 'rgba(218, 185, 95, 0.28)' : '#1a140e';
        btn.style.borderColor = active ? '#ffff00' : '#4a3c2c';
        btn.style.color = active ? '#ffff00' : '#d4c4a8';
        btn.style.boxShadow = active ? '0 0 10px rgba(255, 215, 60, 0.55) inset' : 'none';
    });
}

const _isDebugAllowed = () => {
    const hostname = window.location?.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    try {
        const raw = localStorage.getItem('run-escape:save');
        if (raw) {
            const p = JSON.parse(raw);
            if (Array.isArray(p?.unlockedCodes) && p.unlockedCodes.includes('l33th4x0r')) return true;
        }
    } catch (_) {}
    return !!(window.gameClient?.save?.unlockedCodes?.includes?.('l33th4x0r'));
};

let _cheatKeyBuffer = '';
if (_isDebugAllowed()) {
    window.l33th4x0r = function() {
        const client = window.gameClient || window._client;
        if (client && typeof client.redeemCode === 'function') {
            const res = client.redeemCode('l33th4x0r');
            const mp = _mpInstance || window.multiplayer;
            if (mp) {
                mp.hostUnlockedCharacters = mp.readLocalSaveUnlockedCharacters();
                mp.updateLobbyUI?.();
            }
            return res;
        }
        return false;
    };
}

let _mpInstance = null;
let _prayerKeydownInitialized = false;

export function initOsrsPrayers(multiplayer = null) {
    if (multiplayer) _mpInstance = multiplayer;
    if (_prayerKeydownInitialized) return;
    _prayerKeydownInitialized = true;
    window.addEventListener('keydown', (ev) => {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'SELECT')) return;
    const client = window.gameClient || window._client;

    // Secret cheat command "l33th4x0r" typed anywhere
    if (typeof ev.key === 'string' && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        _cheatKeyBuffer = (_cheatKeyBuffer + ev.key.toLowerCase()).slice(-9);
        if (_cheatKeyBuffer === 'l33th4x0r') {
            _cheatKeyBuffer = '';
            window.l33th4x0r();
            return;
        }
    }

    const sim = client?.sim;
    if (!sim || sim.state !== 'playing') return;

    // Spectator camera target switching via [TAB] or [ / ]
    const mp = _mpInstance || window.multiplayer;
    if (mp?.gameStarted && (sim.player?.spectating || sim.player?.hp <= 0)) {
        if (ev.code === 'Tab' || ev.code === 'BracketRight') {
            ev.preventDefault();
            const next = mp.cycleSpectateTarget(1);
            if (next) mp.showToast(`Spectating P${next.slot}: ${next.name}`);
        } else if (ev.code === 'BracketLeft') {
            ev.preventDefault();
            const prev = mp.cycleSpectateTarget(-1);
            if (prev) mp.showToast(`Spectating P${prev.slot}: ${prev.name}`);
        }
        return;
    }

    const hasBossCandidate = Boolean(sim.shownBoss) || sim.map?.id === 'fight_caves' || sim.map?.id === 'inferno';
    const isFightCavesOrJad = sim.map?.id === 'fight_caves' || (hasBossCandidate && sim.enemies?.some(e => !e.dead && (e.def?.id === 'tztok_jad' || e.def?.id === 'tzkal_zuk')));
    if (!isFightCavesOrJad) return;
    if (ev.code === 'KeyQ') {
        ev.preventDefault();
        setOsrsPrayer('magic');
    } else if (ev.code === 'KeyE') {
        ev.preventDefault();
        setOsrsPrayer('ranged');
    } else if (ev.code === 'KeyR') {
        ev.preventDefault();
        setOsrsPrayer('melee');
    }
    });
}

initOsrsPrayers();

window._hideOsrsPrayerBar = function() {
    window._osrsPrayer = null;
    const client = window.gameClient || window._client;
    if (client?.sim?.player) {
        client.sim.player.activePrayer = null;
    }
    const bar = getPrayerBarEl();
    if (bar && (_lastPrayerBarVisible || bar.style.display !== 'none')) {
        bar.style.display = 'none';
        _lastPrayerBarVisible = false;
    }
};

window._drawOsrsPrayerOverlay = function(viewport, sim, alpha, ctx, scale, playerScreenPos) {
    const client = window.gameClient || window._client;
    const snap = client?.store?.getSnapshot?.();
    const activeOverlay = snap?.overlay;
    const playerDeadOrSpectating = !sim || !sim.player || sim.player.hp <= 0 || sim.player.spectating || sim.player.deathTick !== -1 || sim.state === 'dead' || sim.state === 'victory' || sim.runOver || (snap?.screen && snap.screen !== 'run');
    if (playerDeadOrSpectating) {
        window._hideOsrsPrayerBar();
        return;
    }
    // A level-up, casket or pause screen only hides the bar. Prayers stay on (as in OSRS), so closing
    // a menu mid-fight doesn't leave the player unprotected for Jad's next attack.
    if (activeOverlay && activeOverlay !== 'none') {
        const openBar = getPrayerBarEl();
        if (openBar && _lastPrayerBarVisible) {
            openBar.style.display = 'none';
            _lastPrayerBarVisible = false;
        }
        return;
    }
    const hasBossCandidate = Boolean(sim.shownBoss) || sim.map?.id === 'fight_caves' || sim.map?.id === 'inferno';
    const isFightCavesOrJad = sim.map?.id === 'fight_caves' || (hasBossCandidate && sim.enemies?.some(e => !e.dead && (e.def?.id === 'tztok_jad' || e.def?.id === 'tzkal_zuk')));
    if (!isFightCavesOrJad) {
        // On guests the boss can drop out of the synced enemy list for a moment. Hide the bar right away,
        // but only switch prayers off once the boss has really been gone for a few seconds.
        const hiddenBar = getPrayerBarEl();
        if (hiddenBar && _lastPrayerBarVisible) {
            hiddenBar.style.display = 'none';
            _lastPrayerBarVisible = false;
        }
        if (window._osrsPrayer && performance.now() - (window._osrsBossLastSeen || 0) > 3000) window._hideOsrsPrayerBar();
        return;
    }
    window._osrsBossLastSeen = performance.now();
    const bar = ensureOsrsPrayerBarUI();
    if (!_lastPrayerBarVisible) {
        bar.style.display = 'flex';
        _lastPrayerBarVisible = true;
        updateOsrsPrayerBarUI();
    }

    // Keep sim.player.activePrayer synced with window._osrsPrayer
    if (sim.player) {
        sim.player.activePrayer = window._osrsPrayer;
    }

    // 1. Draw active overhead protection prayer emblem above the player's head
    if (window._osrsPrayer && playerScreenPos?.visible) {
        drawOverheadPrayerEmblem(ctx, playerScreenPos.x, playerScreenPos.y - Math.round(22 * scale), scale, window._osrsPrayer);
    }

    // 2. If TzTok-Jad (NPC 3127) or TzKal-Zuk (NPC 7706) is winding up an attack, draw a clear attack-style telegraph banner above the boss
    for (const enemy of sim.enemies) {
        if (enemy.dead || (enemy.def?.id !== 'tztok_jad' && enemy.def?.id !== 'tzkal_zuk')) continue;
        const windup = enemy.bossState?.windup;
        if (!windup || !windup.attack) continue;
        const atkName = windup.attack.name;
        if (atkName === 'Call healers') continue;

        const reqPrayer = atkName === 'Magic' ? 'magic' : ((atkName === 'Stomp' || atkName === 'Slam') ? 'melee' : 'ranged');
        const keyHint = reqPrayer === 'magic' ? 'Q' : (reqPrayer === 'ranged' ? 'E' : 'R');
        const styleLabel = reqPrayer.toUpperCase();
        const bossLabel = enemy.def?.id === 'tzkal_zuk' ? 'ZUK' : 'JAD';
        const isProtected = window._osrsPrayer === reqPrayer;
        const progress = Math.min(1, Math.max(0, (sim.tick + alpha - windup.startTick) / Math.max(1, windup.landTick - windup.startTick)));

        const ex = enemy.prevX + (enemy.x - enemy.prevX) * alpha;
        const ey = enemy.prevY + (enemy.y - enemy.prevY) * alpha;
        const groundY = client?.view ? client.view.ground(sim, ex, ey) : 0;
        const screen = viewport.project(ex, groundY - 2.3, ey, { x: 0, y: 0, visible: false });
        // Jad's ranged and magic attacks reach further than the camera shows. If he's off-screen,
        // pin the warning to the top of the screen (under the boss health bar) instead of hiding it.
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const onScreen = screen.visible && screen.x >= 0 && screen.x <= cw && screen.y >= 40 * scale && screen.y <= ch;
        if (!onScreen) {
            screen.x = cw / 2;
            screen.y = Math.round(175 * scale);
        }

        ctx.save();
        const fontPx = Math.max(13, Math.round(15 * scale));
        ctx.font = `${fontPx}px "OSRS Bold", monospace`;
        ctx.textAlign = 'center';
        const calloutText = isProtected
            ? `${bossLabel} ${styleLabel} - PROTECTED (${keyHint})`
            : `⚠ ${bossLabel} ${styleLabel}! PRAY [${keyHint}] OR DIE!`;
        const textW = Math.max(160, ctx.measureText(calloutText).width + 20);
        const boxX = screen.x - textW / 2;
        const boxY = screen.y - 34 * scale;
        const boxH = 26 * scale;

        ctx.fillStyle = isProtected ? 'rgba(12, 55, 22, 0.92)' : 'rgba(95, 12, 12, 0.94)';
        ctx.fillRect(boxX, boxY, textW, boxH);
        ctx.strokeStyle = isProtected ? '#28e040' : '#ff4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, textW, boxH);

        // Progress bar inside bottom of banner
        ctx.fillStyle = isProtected ? '#28e040' : '#ffcc00';
        ctx.fillRect(boxX + 2, boxY + boxH - 4, (textW - 4) * (1 - progress), 3);

        ctx.fillStyle = '#000000';
        ctx.fillText(calloutText, screen.x + 1, boxY + boxH * 0.65 + 1);
        ctx.fillStyle = isProtected ? '#56ff6e' : '#ffff00';
        ctx.fillText(calloutText, screen.x, boxY + boxH * 0.65);
        ctx.restore();
    }
};

// Automatically open lobby if ?room= is in URL
