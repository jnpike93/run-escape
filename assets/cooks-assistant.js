// Cook's Assistant quest for Run Escape (Lumbridge).
// No dialogue: walk up to the Cook and press Space to start the quest or hand in ingredients.
// In co-op the quest is shared by the whole party: anyone can start it, every player sees and can
// pick up the three ingredients, anyone can hand them in, and every player gets the reward.
// Relies on window.__runEscapeItems (exposed by index-*.js) to register the quest items.
(() => {
    'use strict';
    if (window.__runEscapeCooksAssistantLoaded) return;
    window.__runEscapeCooksAssistantLoaded = true;

    const QUEST_ID = 'cooks_assistant';
    const QUEST_NAME = "Cook's Assistant";
    const MAP_ID = 'lumbridge';
    const NET_TYPE = 'coop_quest';
    const TICKS_PER_SECOND = 50;

    const JINGLE_URL = './assets/quest-complete.ogg';
    const REWARD_TIER = 'elite';
    const REWARD_LEVELS = 3;
    const REWARD_COINS = 500;

    // The game's own Antique lamp (a utility item that grants one level of XP when rubbed).
    const LAMP_ID = 'antique_lamp';

    const COOK = {
        npcId: 4626,
        name: 'Cook',
        x: 3210.5,
        y: 3216.5,
        cryAnim: 860,
        idleAnim: 808,
        talkRange: 2.4,
        solidRadius: 0.45,
        modelKey: 'quest:cook'
    };

    const ITEMS = [
        { id: 'quest_bucket_of_milk', name: 'Bucket of milk', short: 'bucket of milk', objId: 1927, x: 3253.5, y: 3274.5 },
        { id: 'quest_egg', name: 'Egg', short: 'egg', objId: 1944, x: 3185.5, y: 3278.5 },
        { id: 'quest_pot_of_flour', name: 'Pot of flour', short: 'pot of flour', objId: 1933, x: 3166.5, y: 3302.5 }
    ];
    const ITEM_BY_ID = new Map(ITEMS.map(it => [it.id, it]));

    let client = null;
    let sim = null;
    // quest: { run, stage: 0 | 1 | 2, items: { [itemId]: { status: 'ground' | 'held' | 'delivered', holder } }, rewarded }
    let quest = null;
    let modelsRequested = false;
    let lastFullWarning = 0;
    let pendingNet = []; // quest messages that arrived before this client's run started

    // ------------------------------------------------------------------ helpers

    function yawTowards(dx, dy) {
        return Math.round(Math.atan2(-dx, -dy) / (2 * Math.PI) * 2048) & 2047;
    }

    function toast(text, ms) {
        try { client?.store?.toast(text, ms); } catch (e) {}
    }

    function mp() {
        const m = window.multiplayer;
        return m && m.gameStarted ? m : null;
    }

    function localSlot() {
        return mp()?.localSlot || 1;
    }

    function runId() {
        const seed = mp()?.gameConfig?.seed;
        return seed !== undefined && seed !== null ? String(seed) : 'solo';
    }

    function playerName(slot) {
        if (slot === localSlot()) return 'You';
        const m = mp();
        const peer = m?.remotePeers?.get?.(slot);
        return peer?.name || m?.lobbyPlayers?.get?.(slot)?.name || `Player ${slot}`;
    }

    function overlayIsNone() {
        try { return client.store.getSnapshot().overlay === 'none'; } catch (e) { return false; }
    }

    function heldItems() {
        if (!sim || !quest) return [];
        return ITEMS.filter(it => sim.inventory.some(slot => slot && slot.itemId === it.id));
    }

    function deliveredCount() {
        return quest ? ITEMS.filter(it => quest.items[it.id].status === 'delivered').length : 0;
    }

    function distToCook() {
        const p = sim?.player;
        return p ? Math.hypot(p.x - COOK.x, p.y - COOK.y) : Infinity;
    }

    function removeFromInventory(itemId) {
        if (!sim) return false;
        const i = sim.inventory.findIndex(slot => slot && slot.itemId === itemId);
        if (i === -1) return false;
        sim.inventory[i] = null;
        return true;
    }

    function refreshHud() {
        try { client.updateHud(true); } catch (e) {}
        try { mp()?.sendLoadoutSync?.(client, false); } catch (e) {}
    }

    // ------------------------------------------------------------------ items + models

    function registerItems() {
        const reg = window.__runEscapeItems;
        if (!reg || typeof reg.set !== 'function') return false;
        for (const it of ITEMS) {
            if (reg.has(it.id)) continue;
            reg.set(it.id, {
                kind: 'quest',
                id: it.id,
                name: it.name,
                objId: it.objId,
                rarity: 'common',
                description: `Quest item. Hand it to the Lumbridge Cook.`
            });
        }
        return true;
    }

    async function ensureModels() {
        if (modelsRequested || !client?.assets?.bake) return;
        modelsRequested = true;
        const bakes = [];
        if (!client.assets.models.has(COOK.modelKey)) {
            bakes.push({ kind: 'npc', key: COOK.modelKey, npcId: COOK.npcId, seqIds: [COOK.cryAnim, COOK.idleAnim] });
        }
        for (const it of ITEMS) {
            const key = 'quest:obj:' + it.objId;
            if (!client.assets.models.has(key)) bakes.push({ kind: 'obj', key, objId: it.objId, count: 1 });
        }
        if (bakes.length === 0) return;
        try {
            const res = await client.assets.bake(bakes);
            if (res.loadedTextures?.size > 0 || res.loadedTextures?.length > 0) {
                client.assets.renderer.updateTextureArray(res.loadedTextures);
            }
            const added = client.assets.actors.addBake(res);
            for (const [k, v] of added) client.assets.models.set(k, v);
            console.log('[Quest] Loaded models:', Array.from(added.keys()));
        } catch (err) {
            modelsRequested = false;
            console.error('[Quest] Failed to load quest models', err);
        }
    }

    // ------------------------------------------------------------------ per-run setup

    function onNewSim(s) {
        sim = s;
        quest = null;
        document.getElementById(SCROLL_ID)?.remove(); // a scroll left over from the previous run
        if (!s || s.map?.id !== MAP_ID) return;
        if (!registerItems()) {
            console.warn('[Quest] Item registry not exposed; Cook\'s Assistant disabled.');
            return;
        }
        quest = { run: runId(), stage: 0, items: {}, rewarded: false };
        for (const it of ITEMS) quest.items[it.id] = { status: 'ground', holder: null };
        ensureModels();

        if (!s.__questHooked) {
            s.__questHooked = true;
            const origStepPlayer = s.stepPlayer.bind(s);
            s.stepPlayer = (mx, my) => {
                origStepPlayer(mx, my);
                if (sim === s && quest) pushOutOfCook(s.player);
            };
        }

        // Apply anything the party sent before this client's run had started.
        const queued = pendingNet.filter(m => m.run === quest.run);
        pendingNet = [];
        for (const m of queued) applyEvent(m, false);
    }

    function pushOutOfCook(p) {
        const dx = p.x - COOK.x, dy = p.y - COOK.y;
        const d = Math.hypot(dx, dy);
        const minD = COOK.solidRadius + (p.radius || 0.35);
        if (d < minD && d > 1e-4) {
            p.x = COOK.x + dx / d * minD;
            p.y = COOK.y + dy / d * minD;
        }
    }

    // ------------------------------------------------------------------ quest events (local + network)
    // Every change is an event applied identically on each client. Local actions are applied and broadcast;
    // remote events are applied when they arrive. Conflicts (two players grabbing the same item at once)
    // resolve the same way everywhere: the lower player slot keeps the item.

    function send(ev, extra) {
        const m = mp();
        if (!m || !quest) return;
        try { m.send({ type: NET_TYPE, quest: QUEST_ID, run: quest.run, ev, ...extra }); } catch (e) {}
    }

    function doLocal(ev, extra) {
        const msg = { quest: QUEST_ID, run: quest.run, ev, slot: localSlot(), ...extra };
        applyEvent(msg, true);
        send(ev, { slot: msg.slot, ...extra });
    }

    function applyEvent(msg, isLocal) {
        if (!quest || msg.quest !== QUEST_ID || msg.run !== quest.run) return;
        const me = localSlot();
        const slot = Number(msg.slot) || 0;
        const it = ITEM_BY_ID.get(msg.item);

        switch (msg.ev) {
            case 'start': {
                if (quest.stage !== 0) return;
                quest.stage = 1;
                toast(`${QUEST_NAME} quest started.`, 5000);
                cookSay(COOK_START_LINE);
                break;
            }
            case 'pickup': {
                if (!it || quest.stage !== 1) return;
                const st = quest.items[it.id];
                if (st.status === 'delivered') {
                    if (isLocal) removeFromInventory(it.id);
                    return;
                }
                if (st.status === 'held' && st.holder !== slot) {
                    const winner = Math.min(st.holder, slot);
                    if (st.holder === me && winner !== me) {
                        removeFromInventory(it.id);
                        refreshHud();
                        toast(`${playerName(slot)} grabbed the ${it.short} first.`);
                    }
                    st.holder = winner;
                    return;
                }
                st.status = 'held';
                st.holder = slot;
                if (isLocal) toast(`You pick up the ${it.short}.`);
                else toast(`${playerName(slot)} picked up the ${it.short}.`);
                break;
            }
            case 'deliver': {
                if (!it || quest.stage !== 1) return;
                const st = quest.items[it.id];
                if (st.status === 'delivered') return;
                if (st.holder === me && slot !== me) removeFromInventory(it.id);
                st.status = 'delivered';
                st.holder = null;
                const n = deliveredCount();
                if (n < ITEMS.length) {
                    toast(`${isLocal ? 'You hand' : `${playerName(slot)} hands`} the ${it.short} to the Cook. (${n}/${ITEMS.length})`);
                }
                break;
            }
            case 'release': {
                // Item returned to the ground (its holder left the party).
                if (!it) return;
                const st = quest.items[it.id];
                if (st.status === 'held' && st.holder === slot) {
                    st.status = 'ground';
                    st.holder = null;
                }
                break;
            }
            default:
                return;
        }

        if (quest.stage === 1 && deliveredCount() === ITEMS.length) completeQuest();
    }

    function completeQuest() {
        quest.stage = 2;
        toast(`${QUEST_NAME} quest completed.`, 6000);
        giveRewards();
        showQuestScroll();
    }

    // ------------------------------------------------------------------ quest complete scroll

    const SCROLL_ID = 'quest-complete-scroll';
    const CAKE_OBJ = 1891;
    const REWARD_LINES = ['1 Quest Point', `${REWARD_COINS} Coins`, 'Antique lamp', `${REWARD_LEVELS} levels`, 'Elite casket'];

    function injectScrollStyle() {
        if (document.getElementById(SCROLL_ID + '-style')) return;
        const style = document.createElement('style');
        style.id = SCROLL_ID + '-style';
        style.textContent = `
            #${SCROLL_ID} { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
                background: rgba(0,0,0,0.35); pointer-events: auto; }
            #${SCROLL_ID} .qc-scroll { position: relative; width: min(500px, calc(100vw - 32px)); padding: 26px 34px 22px;
                background: linear-gradient(180deg, #d8c59a 0%, #cbb383 55%, #bea472 100%);
                border: 3px solid #5c4320; border-radius: 4px;
                box-shadow: inset 0 0 0 2px #e9dcb8, inset 0 0 24px rgba(92,67,32,0.45), 0 6px 18px rgba(0,0,0,0.6);
                font-family: "OSRS Bold", "RuneScape Bold", sans-serif; color: #000; text-align: center; }
            #${SCROLL_ID} .qc-scroll::before, #${SCROLL_ID} .qc-scroll::after { content: ''; position: absolute; left: -10px; right: -10px; height: 14px;
                background: linear-gradient(180deg, #8a6a3a, #b8955c 45%, #6d5028); border: 2px solid #3f2d14; border-radius: 7px; }
            #${SCROLL_ID} .qc-scroll::before { top: -10px; }
            #${SCROLL_ID} .qc-scroll::after { bottom: -10px; }
            #${SCROLL_ID} h2 { margin: 0 0 4px; font-size: 22px; font-weight: normal; color: #7a1a00; }
            #${SCROLL_ID} .qc-title { margin: 0 0 14px; font-size: 18px; color: #000; }
            #${SCROLL_ID} .qc-body { display: flex; gap: 20px; align-items: center; justify-content: center; text-align: left; }
            #${SCROLL_ID} .qc-left { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 120px; font-size: 15px; }
            #${SCROLL_ID} .qc-icon { width: 72px; height: 64px; image-rendering: pixelated; }
            #${SCROLL_ID} .qc-right h3 { margin: 0 0 6px; font-size: 16px; font-weight: normal; color: #7a1a00; }
            #${SCROLL_ID} .qc-right ul { margin: 0; padding: 0; list-style: none; font-size: 15px; line-height: 20px; }
            #${SCROLL_ID} .qc-close { position: absolute; top: 6px; right: 8px; width: 22px; height: 22px; padding: 0; cursor: pointer;
                background: #5c4320; color: #ff981f; border: 1px solid #2e2010; font-family: inherit; font-size: 14px; line-height: 18px; }
            #${SCROLL_ID} .qc-hint { margin-top: 14px; font-size: 13px; color: #4a3518; }
        `;
        document.head.appendChild(style);
    }

    function showQuestScroll() {
        if (!quest || document.getElementById(SCROLL_ID)) return;
        injectScrollStyle();
        // Freeze the run without showing the pause menu; the casket waits until the scroll closes.
        quest.scrollOpen = true;
        quest.casketAt = Infinity;
        if (client) client.paused = true;

        const root = document.createElement('div');
        root.id = SCROLL_ID;
        root.innerHTML = `
            <div class="qc-scroll" role="dialog" aria-label="Quest complete">
                <button class="qc-close" aria-label="Close">X</button>
                <h2>Congratulations!</h2>
                <p class="qc-title">You have completed ${QUEST_NAME}!</p>
                <div class="qc-body">
                    <div class="qc-left">
                        <img class="qc-icon" alt="" />
                        <div>Quest Points: 1</div>
                    </div>
                    <div class="qc-right">
                        <h3>You are awarded:</h3>
                        <ul>${REWARD_LINES.map(l => `<li>${l}</li>`).join('')}</ul>
                    </div>
                </div>
                <div class="qc-hint">Press Space or click to continue</div>
            </div>`;
        document.body.appendChild(root);
        playJingle(); // the quest complete jingle starts as the scroll appears

        const img = root.querySelector('.qc-icon');
        const icons = window.__runEscapeIcons;
        const setIcon = (url) => { if (url) img.src = url; else img.style.visibility = 'hidden'; };
        try {
            const cached = icons?.get?.(CAKE_OBJ, 1);
            if (cached) setIcon(cached);
            else if (icons?.request) icons.request(CAKE_OBJ, 1, setIcon);
            else setIcon(null);
        } catch (e) { setIcon(null); }

        let opened = performance.now();
        const close = (force) => {
            if (!force && performance.now() - opened < 400) return; // don't let the hand-in key press close it instantly
            if (!document.getElementById(SCROLL_ID)) return;
            window.removeEventListener('keydown', onKey, true);
            root.remove();
            if (client?.resume) client.resume(); else if (client) client.paused = false;
            if (quest) {
                quest.scrollOpen = false;
                quest.casketAt = performance.now();
                // Open the casket right away so it comes before the level-up picks.
                if (quest.casketPending && sim?.state === 'playing') {
                    quest.casketPending = false;
                    try { openRewardCasket(); } catch (e) {}
                }
            }
        };
        const onKey = (e) => {
            if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        };
        window.addEventListener('keydown', onKey, true);
        root.addEventListener('click', () => close());
        quest.closeScroll = () => close(true);
    }

    // OSRS "Quest complete" jingle. Uses the game's volume/mute settings and ducks the area music while it plays.
    function playJingle() {
        try {
            const settings = client?.audio?.settings || { volume: 1, muted: false };
            if (settings.muted) return;
            const audio = new Audio(JINGLE_URL);
            audio.volume = Math.max(0, Math.min(1, settings.volume ?? 1));
            const music = client?.audio?.music?.element;
            const prevVolume = music ? music.volume : null;
            if (music) music.volume = prevVolume * 0.2;
            const restore = () => { if (music && prevVolume !== null) music.volume = prevVolume; };
            audio.addEventListener('ended', restore);
            audio.addEventListener('error', restore);
            audio.play().catch(restore);
        } catch (e) {}
    }

    function openRewardCasket() {
        sim.openCasket(REWARD_TIER);
        client.handleEvents(sim, sim.takeEvents());
        client.syncOverlay();
    }

    function giveRewards() {
        if (!sim || quest.rewarded) return;
        quest.rewarded = true;
        try {
            sim.coins += REWARD_COINS;
            const gotLamp = sim.stash(LAMP_ID);
            toast(gotLamp
                ? `You receive ${REWARD_COINS} coins and an Antique lamp.`
                : `You receive ${REWARD_COINS} coins. You have no room for the Antique lamp.`, 5000);
            // Level-ups queue behind the casket and follow once it's resolved.
            sim.xp = Math.max(sim.xp, sim.xpForLevel(sim.level + REWARD_LEVELS));
            // The casket opens once the quest complete scroll is closed.
            quest.casketPending = true;
            quest.casketAt = quest.scrollOpen ? Infinity : performance.now() + 2500;
            refreshHud();
        } catch (e) {
            console.error('[Quest] Failed to give rewards', e);
        }
    }

    function onNetMessage(msg) {
        if (!msg || msg.quest !== QUEST_ID) return;
        if (!quest || msg.run !== quest.run) {
            pendingNet.push(msg);
            if (pendingNet.length > 50) pendingNet.shift();
            return;
        }
        applyEvent(msg, false);
    }

    function onPeerLeft(msg) {
        if (!quest) return;
        const slot = Number(msg.slot || msg.senderSlot) || 0;
        if (!slot) return;
        for (const it of ITEMS) {
            const st = quest.items[it.id];
            if (st.status === 'held' && st.holder === slot) {
                applyEvent({ quest: QUEST_ID, run: quest.run, ev: 'release', item: it.id, slot }, false);
                toast(`The ${it.short} dropped back where it was found.`);
            }
        }
    }

    function hookMultiplayer() {
        const m = window.multiplayer;
        if (!m || m.__questHooked || typeof m.handleMessage !== 'function') return;
        m.__questHooked = true;
        const orig = m.handleMessage.bind(m);
        m.handleMessage = (msg) => {
            if (msg && msg.type === NET_TYPE) { onNetMessage(msg); return; }
            if (msg && msg.type === 'peer_left') { try { onPeerLeft(msg); } catch (e) {} }
            orig(msg);
        };
    }

    // ------------------------------------------------------------------ per-frame logic

    function tickQuest() {
        // In co-op a partner can press "Resume Co-Op" while our scroll is open; close it so it doesn't sit over a running game.
        if (quest?.scrollOpen && client && !client.paused) quest.closeScroll?.();
        if (!quest || !sim || sim.state !== 'playing' || client.paused) return;
        if (quest.casketPending) {
            if (performance.now() < (quest.casketAt || 0)) return;
            quest.casketPending = false;
            try { openRewardCasket(); } catch (e) {}
            return;
        }
        if (quest.stage !== 1) return;
        const p = sim.player;
        for (const it of ITEMS) {
            if (quest.items[it.id].status !== 'ground') continue;
            if (Math.hypot(p.x - it.x, p.y - it.y) > 0.75) continue;
            if (sim.canStash(it.id)) {
                sim.stash(it.id);
                doLocal('pickup', { item: it.id });
                refreshHud();
            } else if (performance.now() - lastFullWarning > 3000) {
                lastFullWarning = performance.now();
                toast("You don't have enough inventory space.");
            }
        }
    }

    function onSpace() {
        if (quest.stage === 0) {
            doLocal('start', {});
            return true;
        }
        if (quest.stage === 1) {
            const held = heldItems();
            if (held.length === 0) return false;
            for (const it of held) {
                removeFromInventory(it.id);
                doLocal('deliver', { item: it.id });
            }
            refreshHud();
            return true;
        }
        return false;
    }

    function promptText() {
        if (!quest) return null;
        if (quest.stage === 0) return [['Press ', '#ffffff'], ['Space', '#ffff00'], [' to start ', '#ffffff'], [QUEST_NAME, '#ff9040']];
        if (quest.stage === 1) {
            if (heldItems().length > 0) return [['Press ', '#ffffff'], ['Space', '#ffff00'], [' to hand in items', '#ffffff']];
            return [[`${QUEST_NAME}: `, '#ff9040'], [`${deliveredCount()}/${ITEMS.length} ingredients delivered`, '#ffffff']];
        }
        return null;
    }

    // ------------------------------------------------------------------ rendering hooks

    function drawActors(actors, s) {
        if (!quest || s !== sim) return;
        const view = client.view;
        const ground = (x, y) => view.ground ? view.ground(s, x, y) : (s.grid ? s.grid.getHeight(x, y) / 128 : 0);
        const clock = Math.floor(performance.now() / (1000 / TICKS_PER_SECOND));

        const cook = client.assets.get(COOK.modelKey);
        if (cook && cook.anims?.length) {
            const anim = quest.stage === 2
                ? (cook.getAnim(COOK.idleAnim) || cook.anims[0])
                : (cook.getAnim(COOK.cryAnim) || cook.getAnim(COOK.idleAnim) || cook.anims[0]);
            const frame = anim ? anim.getFrame(clock) : 0;
            const p = s.player;
            const near = Math.hypot(p.x - COOK.x, p.y - COOK.y) < 8;
            const yaw = near ? yawTowards(p.x - COOK.x, p.y - COOK.y) : 0;
            actors.draw(cook, anim, frame, COOK.x, ground(COOK.x, COOK.y), COOK.y, yaw, { scale: 1 });
        }

        if (quest.stage === 1) {
            for (const it of ITEMS) {
                if (quest.items[it.id].status !== 'ground') continue;
                const m = client.assets.get('quest:obj:' + it.objId);
                if (!m || !m.anims?.length) continue;
                actors.draw(m, m.anims[0], 0, it.x, ground(it.x, it.y), it.y, 256, { scale: 1 });
            }
        }
    }

    const scratch = { x: 0, y: 0, visible: false };

    function overlayMetrics(overlayRenderer, ctx) {
        const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
        const dpr = (overlayRenderer.width && ctx.canvas.clientWidth) ? overlayRenderer.width / ctx.canvas.clientWidth : (window.devicePixelRatio || 1);
        return { scale, dpr };
    }

    // OSRS-style overhead chat: yellow text with a black shadow above the speaker's head.
    const COOK_START_LINE = 'Get me some Milk, Flour, and an Egg!';
    const OVERHEAD_TEXT_MS = 5000;
    const OVERHEAD_YELLOW = '#ffff00';

    function cookSay(text) {
        if (quest) quest.speech = { text, until: performance.now() + OVERHEAD_TEXT_MS };
    }

    function drawLabel(ctx, parts, cx, y, size, dpr) {
        ctx.font = `${size}px "OSRS Bold", sans-serif`;
        // The game leaves its own alignment on this canvas; reset it so words don't stack on one point.
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.letterSpacing = '0px';
        // Lay out word by word with an explicit gap (the pixel font's space glyph is very narrow).
        const gap = Math.max(Math.round(size * 0.35), ctx.measureText(' ').width);
        const words = [];
        for (const [text, color] of parts) {
            for (const w of text.split(' ')) if (w) words.push({ w, color, width: ctx.measureText(w).width });
        }
        const total = words.reduce((sum, wd) => sum + wd.width, 0) + gap * Math.max(0, words.length - 1);
        let x = Math.round(cx - total / 2);
        const shadow = Math.max(1, Math.round(dpr));
        for (const wd of words) {
            ctx.fillStyle = '#000000';
            ctx.fillText(wd.w, x + shadow, y + shadow);
            ctx.fillStyle = wd.color;
            ctx.fillText(wd.w, x, y);
            x += wd.width + gap;
        }
    }

    function drawOverlay(overlayRenderer, s) {
        if (!quest || s !== sim) return;
        const ctx = overlayRenderer?.ctx;
        if (!ctx) return;
        const { scale, dpr } = overlayMetrics(overlayRenderer, ctx);
        ctx.save();

        const size = Math.round(16 * scale * dpr);
        const g = s.grid ? s.grid.getHeight(COOK.x, COOK.y) / 128 : 0;
        overlayRenderer.project(COOK.x, g - 240 / 128, COOK.y, scratch);
        const headX = scratch.x, headY = Math.round(scratch.y), headVisible = scratch.visible;

        // Overhead chat sits right above the Cook's head.
        const speech = quest.speech;
        const speaking = !!speech && performance.now() < speech.until;
        if (speech && !speaking) quest.speech = null;
        if (speaking && headVisible && s.state === 'playing' && overlayIsNone()) {
            drawLabel(ctx, [[speech.text, OVERHEAD_YELLOW]], headX, headY, size, dpr);
        }

        // Prompt above the Cook (moved up a line while he's talking).
        if (headVisible && s.state === 'playing' && !client.paused && overlayIsNone() && distToCook() <= COOK.talkRange) {
            const parts = promptText();
            if (parts) drawLabel(ctx, parts, headX, speaking ? headY - Math.round(size * 1.35) : headY, size, dpr);
        }
        ctx.restore();
    }

    function drawMinimap(canvas, s, alpha) {
        if (!quest || s !== sim || !canvas) return;
        const size = canvas.width;
        if (!size || !canvas.clientWidth) return;
        const ctx = canvas.getContext('2d');
        const a = size / canvas.clientWidth;
        const half = size / 2;
        const scale = 3 * a;
        const p = s.player;
        const px = p.prevX + (p.x - p.prevX) * alpha;
        const py = p.prevY + (p.y - p.prevY) * alpha;
        const toX = x => half + (x - px) * scale;
        const toY = y => half - (y - py) * scale;
        const clamp = (x, y, pad) => {
            const dx = x - half, dy = y - half, r = Math.hypot(dx, dy), max = half - pad;
            return r <= max ? [x, y] : [half + dx / r * max, half + dy / r * max];
        };
        const dot = Math.max(2, Math.round(scale));
        const border = Math.max(1, Math.round(a));

        if (quest.stage === 1) {
            const sz = Math.round(dot * 1.5);
            for (const it of ITEMS) {
                if (quest.items[it.id].status !== 'ground') continue;
                const [x, y] = clamp(toX(it.x), toY(it.y), sz + border * 2);
                const rx = Math.round(x - sz / 2), ry = Math.round(y - sz / 2);
                ctx.fillStyle = '#000000';
                ctx.fillRect(rx - border, ry - border, sz + border * 2, sz + border * 2);
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(rx, ry, sz, sz);
            }
        }

        if (quest.stage !== 2) {
            const r = Math.round(dot * 1.9);
            const [x, y] = clamp(toX(COOK.x), toY(COOK.y), r + border * 2);
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, r + border, 0, Math.PI * 2);
            ctx.fillStyle = '#000000';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = '#1f62c8';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(r * 1.5)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(quest.stage === 1 && heldItems().length > 0 ? '?' : '!', x, y + Math.round(r * 0.1));
            ctx.restore();
        }
    }

    function installClientHooks(c) {
        if (c.__questHooked) return;
        c.__questHooked = true;

        const origSubmit = c.view.submitActors.bind(c.view);
        c.view.submitActors = (actors, s, alpha) => {
            origSubmit(actors, s, alpha);
            try { drawActors(actors, s, alpha); } catch (e) { console.error('[Quest] draw error', e); }
        };

        const origOverlay = c.view.drawOverlay.bind(c.view);
        c.view.drawOverlay = (overlayRenderer, s, alpha) => {
            origOverlay(overlayRenderer, s, alpha);
            try { drawOverlay(overlayRenderer, s, alpha); } catch (e) { console.error('[Quest] overlay error', e); }
        };

        const origMinimap = c.minimap.draw.bind(c.minimap);
        c.minimap.draw = (canvas, s, alpha) => {
            origMinimap(canvas, s, alpha);
            try { drawMinimap(canvas, s, alpha); } catch (e) { console.error('[Quest] minimap error', e); }
        };
    }

    // ------------------------------------------------------------------ input

    function onKeyDown(e) {
        if (e.code !== 'Space' || e.repeat) return;
        if (!client || !sim || !quest || client.paused) return;
        if (sim.state !== 'playing' || !overlayIsNone()) return;
        if (distToCook() > COOK.talkRange) return;
        if (onSpace()) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }

    // ------------------------------------------------------------------ main loop

    function watch() {
        const c = window.gameClient;
        if (c && c !== client) {
            client = c;
            modelsRequested = false;
            try { installClientHooks(c); } catch (e) { console.error('[Quest] Failed to hook client', e); }
        }
        hookMultiplayer();
        if (client && client.sim !== sim) onNewSim(client.sim);
        else if (quest && sim && quest.run !== runId()) onNewSim(sim);
        try { tickQuest(); } catch (e) { console.error('[Quest] tick error', e); }
        requestAnimationFrame(watch);
    }

    window.addEventListener('keydown', onKeyDown, true);
    requestAnimationFrame(watch);

    // Small debugging/test surface.
    window.cooksAssistant = {
        get stage() { return quest ? quest.stage : null; },
        get items() { return quest ? JSON.parse(JSON.stringify(quest.items)) : null; },
        get run() { return quest ? quest.run : null; },
        get speech() { return quest ? quest.speech : null; },
        defs: ITEMS,
        cook: COOK,
        press: () => onSpace()
    };
})();
