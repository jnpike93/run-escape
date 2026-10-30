// Run Escape - Multiplayer Lobby UI, Character Model Baking & Run Launch
import {
    ALL_CHARACTERS,
    ALLOWED_CHARACTERS,
    CHAR_WEAPONS,
    DEFAULT_UNLOCKED_CHARACTERS,
    ALL_REGIONS,
    getCoopDifficultyWeights,
    sanitizeMapId,
    sanitizeName,
    sanitizeRoomId,
    sanitizeCharacter,
    sanitizeSlot,
    escapeHtml
} from './mp-constants.js?v=8.6';

const sanitizePlayerName = (name, fallback = '') => sanitizeName(name) || fallback;

export const mpLobbyUiMethods = {
    loadSavedPlayerNames() {
        try {
            const raw = localStorage.getItem('run-escape-coop-player-names');
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            return {};
        }
    },

    savePlayerNameForSlot(slot, name) {
        if (!this.playerNamesBySlot) this.playerNamesBySlot = this.loadSavedPlayerNames();
        const s = sanitizeSlot(slot, 1);
        const cleaned = sanitizePlayerName(name, '');
        const isDefault = /^Player\s+[1-4]$/i.test(cleaned);
        if (cleaned && !isDefault) {
            this.playerNamesBySlot[s] = cleaned;
            if (s === this.localSlot) {
                try { localStorage.setItem('run-escape-coop-local-name', cleaned); } catch (e) {}
            }
        } else {
            delete this.playerNamesBySlot[s];
            if (s === this.localSlot) {
                try { localStorage.removeItem('run-escape-coop-local-name'); } catch (e) {}
            }
        }
        try {
            localStorage.setItem('run-escape-coop-player-names', JSON.stringify(this.playerNamesBySlot));
        } catch (e) {}
    },

    getRememberedPlayerName(slot) {
        if (!this.playerNamesBySlot) this.playerNamesBySlot = this.loadSavedPlayerNames();
        const s = sanitizeSlot(slot, 1);
        const bySlot = sanitizePlayerName(this.playerNamesBySlot[s], '');
        if (bySlot) return bySlot;
        if (s === this.localSlot) {
            try {
                const localSaved = sanitizePlayerName(localStorage.getItem('run-escape-coop-local-name') || '', '');
                if (localSaved) return localSaved;
            } catch (e) {}
        }
        return '';
    },

    syncLocalToLobbyPlayers() {
        this.lobbyPlayers.set(this.localSlot, {
            slot: this.localSlot,
            name: this.localName,
            character: this.localCharacter,
            ready: this.localReady,
            isHost: this.role === 'host' || this.role === null
        });
    }
,

    readLocalSaveUnlockedCharacters() {
        const unlocked = new Set(DEFAULT_UNLOCKED_CHARACTERS);
        try {
            const clientSave = window.gameClient?.save;
            if (clientSave && Array.isArray(clientSave.unlockedCharacters)) {
                for (const cid of clientSave.unlockedCharacters) {
                    if (typeof cid === 'string' && ALLOWED_CHARACTERS.has(cid)) {
                        unlocked.add(cid);
                    }
                }
            } else {
                const raw = window.localStorage.getItem('rune-survivors-save');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const unlockedCodes = Array.isArray(parsed?.unlockedCodes) ? parsed.unlockedCodes : [];
                    if (parsed && Array.isArray(parsed.unlockedCharacters)) {
                        for (const cid of parsed.unlockedCharacters) {
                            if (cid === 'dipper' && !unlockedCodes.includes('dipperthedog')) continue;
                            if (cid === 'elias' && !unlockedCodes.includes('barkelly')) continue;
                            if (typeof cid === 'string' && ALLOWED_CHARACTERS.has(cid)) {
                                unlocked.add(cid);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[Multiplayer] Failed reading local save unlocked characters:', err);
        }
        return ALL_CHARACTERS.filter(c => unlocked.has(c.id)).map(c => c.id);
    }
,

    getUnlockedCharacters() {
        if (this.role === 'host' || this.role === null) {
            this.hostUnlockedCharacters = this.readLocalSaveUnlockedCharacters();
        }
        if (!Array.isArray(this.hostUnlockedCharacters) || this.hostUnlockedCharacters.length === 0) {
            this.hostUnlockedCharacters = [...DEFAULT_UNLOCKED_CHARACTERS];
        }
        return this.hostUnlockedCharacters;
    }
,

    broadcastPartyRoster() {
        if (this.role !== 'host') return;
        const unlocked = this.getUnlockedCharacters();
        this.syncLocalToLobbyPlayers();
        const party = Array.from(this.lobbyPlayers.values())
            .sort((a, b) => a.slot - b.slot)
            .map(p => ({
                slot: p.slot,
                name: p.name,
                character: p.character,
                ready: Boolean(p.ready),
                isHost: p.slot === this.localSlot
            }));
        this.send({
            type: 'lobby_update',
            slot: this.localSlot,
            hostCharacter: this.localCharacter,
            mapId: this.selectedMapId,
            endless: Boolean(this.selectedEndless),
            difficultyMult: Number(this.difficultyMult) || 1.0,
            name: this.localName,
            ready: this.localReady,
            unlockedCharacters: unlocked,
            party
        });
    }
,

    sendLobbyUpdate() {
        const unlocked = this.getUnlockedCharacters();
        if (!unlocked.includes(this.localCharacter)) {
            this.localCharacter = unlocked[0] || 'warrior';
        }
        this.syncLocalToLobbyPlayers();
        if (this.role === 'host') {
            this.broadcastPartyRoster();
        } else {
            this.send({
                type: 'lobby_update',
                slot: this.localSlot,
                character: this.localCharacter,
                name: this.localName,
                ready: this.localReady
            });
        }
    }
,

    selectMap(mapId) {
        if (this.role !== 'host' && this.role !== null) return;
        this.selectedMapId = sanitizeMapId(mapId, 'lumbridge');
        this.sendLobbyUpdate();
        this.updateLobbyUI();
    }
,

    toggleEndless() {
        if (this.role !== 'host' && this.role !== null) return;
        this.selectedEndless = !this.selectedEndless;
        this.sendLobbyUpdate();
        this.updateLobbyUI();
    }
,

    setPlayerName(name) {
        this.localNameDraft = String(name ?? '').slice(0, 14).replace(/[^a-zA-Z0-9 ()_-]/g, '');
        const cleaned = sanitizeName(this.localNameDraft);
        this.localNameCustomized = Boolean(cleaned);
        this.localName = cleaned || `Player ${this.localSlot}`;
        this.savePlayerNameForSlot(this.localSlot, this.localName);
        this.localNameDraft = this.localName;
        this.syncLocalToLobbyPlayers();
        clearTimeout(this._nameUpdateTimer);
        this._nameUpdateTimer = setTimeout(() => {
            this.sendLobbyUpdate();
        }, 150);
    }
,

    selectCharacter(charId) {
        const unlocked = this.getUnlockedCharacters();
        const cleanChar = sanitizeCharacter(charId, unlocked[0] || 'warrior');
        if (!unlocked.includes(cleanChar)) {
            this.showToast('That class is locked on the Host save!');
            this.updateLobbyUI();
            return;
        }
        this.localCharacter = cleanChar;
        this.syncLocalToLobbyPlayers();
        const client = window.gameClient;
        if (client) {
            client.store?.set({ characterId: cleanChar });
            if (cleanChar !== 'dipper' && cleanChar !== 'elias' && client.getAppearance) {
                try {
                    client.assets?.setPlayerAppearance(client.getAppearance(cleanChar));
                } catch(e) {}
            }
        }
        this.sendLobbyUpdate();
        this.updateLobbyUI();
    }
,

    async waitForGameClient(timeoutMs = 40000) {
        const start = Date.now();
        while (!window.gameClient && (Date.now() - start) < timeoutMs) {
            await new Promise(r => setTimeout(r, 200));
        }
        return window.gameClient;
    }
,

    async ensureAllCharacterModels(client, extraChars = []) {
        if (!client || !client.assets || !client.assets.models) return;
        const charIds = new Set(['warrior', 'wizard', 'ranger', 'barbarian', 'monk', ...extraChars]);
        const required = Array.from(charIds)
            .filter(id => id && id !== 'dipper' && id !== 'elias' && ALLOWED_CHARACTERS.has(id))
            .map(id => `player_${id}`);
        const missing = required.filter(k => !client.assets.models.has(k));

        const CLASS_EQUIPMENT = {
            warrior: { 0: 1153, 4: 1115, 7: 1067, 3: 1321 },
            wizard: { 0: 1017, 4: 577, 7: 1011, 1: 1021, 3: 1389 },
            ranger: { 0: 1169, 4: 1129, 7: 1095, 9: 1063, 3: 864 },
            barbarian: { 0: 3751, 4: 3767, 7: 23246, 10: 3791, 3: 1307 },
            monk: { 4: 544, 7: 542, 2: 1718, 3: 1389 }
        };

        const seqIds = [
            808, 819, 824, 836,
            386, 390, 393, 401, 426, 711, 806, 811, 1167, 1378, 1658, 1979,
            2062, 2614, 2661, 4230, 5061, 7638, 7640, 7642, 7644, 7855, 8056, 9493
        ];
        this.playerSeqIds = seqIds;
        const bakes = [];

        if (!client.assets.models.has('corgi')) {
            bakes.push({
                kind: 'npc',
                key: 'corgi',
                npcId: 16370,
                seqIds: [6561, 6560]
            });
        }
        if (!client.assets.models.has('chihuahua')) {
            bakes.push({
                kind: 'npc',
                key: 'chihuahua',
                npcId: 16543,
                seqIds: [6561, 6560]
            });
        }

        for (const cid of missing) {
            const pureId = cid.replace('player_', '');
            let appearance = null;
            if (typeof client.getAppearance === 'function') {
                try {
                    appearance = client.getAppearance(pureId);
                } catch (err) {}
            }
            if (
                appearance &&
                Array.isArray(appearance.equipment) &&
                appearance.equipment[3] === -1 &&
                CLASS_EQUIPMENT[pureId] &&
                CLASS_EQUIPMENT[pureId][3] !== -1
            ) {
                appearance.equipment[3] = CLASS_EQUIPMENT[pureId][3];
            }
            if (!appearance) {
                const eqMap = CLASS_EQUIPMENT[pureId];
                if (!eqMap) continue;
                const equip = new Array(12).fill(-1);
                for (const [slot, objId] of Object.entries(eqMap)) {
                    equip[parseInt(slot)] = objId;
                }
                appearance = {
                    gender: 0,
                    colors: [0, 0, 0, 0, 0],
                    kits: [0, 10, 18, 26, 33, 36, 42],
                    equipment: equip
                };
            }
            bakes.push({
                kind: 'player',
                key: cid,
                appearance,
                seqIds
            });
        }

        if (bakes.length > 0) {
            console.log('[Multiplayer] Pre-baking player models:', bakes.map(b => b.key));
            try {
                const bakeRes = await client.assets.bake(bakes);
                if (bakeRes.loadedTextures?.length > 0) {
                    client.assets.renderer.updateTextureArray(bakeRes.loadedTextures);
                }
                const added = client.assets.actors.addBake(bakeRes);
                for (const [k, v] of added) {
                    client.assets.models.set(k, v);
                }
                console.log('[Multiplayer] Successfully registered models:', Array.from(added.keys()));
            } catch (err) {
                console.error('[Multiplayer] Error baking character models:', err);
            }
        }
    }
,

    async startRun() {
        if (this.role !== 'host') return;
        this.syncLocalToLobbyPlayers();
        if (this.lobbyPlayers.size < 2) {
            this.showToast('Need at least 2 players to start Co-Op!');
            return;
        }

        const selectedRegion = ALL_REGIONS.find(r => r.id === this.selectedMapId) || ALL_REGIONS[0];
        const startBtn = document.getElementById('coop-start-btn');
        if (startBtn) {
            startBtn.textContent = `Preparing ${selectedRegion.name}...`;
            startBtn.disabled = true;
        }

        const client = await this.waitForGameClient(40000);
        if (!client) {
            this.showToast('Game client not ready');
            if (startBtn) {
                startBtn.textContent = `Enter ${selectedRegion.name} (Start Co-Op)`;
                startBtn.disabled = false;
            }
            return;
        }

        const hostUnlocked = this.getUnlockedCharacters();
        const players = Array.from(this.lobbyPlayers.values())
            .sort((a, b) => a.slot - b.slot)
            .map(p => ({
                slot: p.slot,
                name: sanitizeName(p.name) || `Player ${p.slot}`,
                character: hostUnlocked.includes(p.character) ? p.character : (hostUnlocked[0] || 'warrior'),
                isHost: p.slot === this.localSlot
            }));

        const seed = Math.floor(Math.random() * 2147483647);
        const config = {
            seed,
            mapId: selectedRegion.id,
            endless: Boolean(this.selectedEndless),
            difficultyMult: Number(this.difficultyMult) || 1.0,
            partySize: players.length,
            players,
            unlockedItems: Array.isArray(client.save?.unlockedItems) ? [...client.save.unlockedItems] : [],
            upgrades: client.save?.upgrades ? { ...client.save.upgrades } : {},
            armoury: client.save?.armoury ? { ...client.save.armoury } : {}
        };

        this.send({
            type: 'game_start',
            config
        });
        this.gameStarted = true;
        this.gameConfig = config;
        await this.launchCoopRun(config);
    }
,

    async launchCoopRun(config) {
        if (this.modalEl) {
            const startBtn = this.modalEl.querySelector('#coop-start-btn');
            if (startBtn) {
                startBtn.textContent = 'Launching Co-Op...';
                startBtn.disabled = true;
            } else {
                const statusEl = this.modalEl.querySelector('#coop-guest-status');
                if (statusEl) statusEl.textContent = 'Launching Co-Op...';
            }
        }

        let client = window.gameClient;
        if (!client) {
            console.log('[Multiplayer] Waiting for gameClient...');
            this.showToast('Loading game assets...');
            client = await this.waitForGameClient(40000);
        }
        if (!client) {
            console.error('[Multiplayer] gameClient not ready after timeout');
            this.showToast('Failed to load game assets in time');
            return;
        }

        const modelWaitStart = Date.now();
        while (client.assets?.models?.size < 250 && (Date.now() - modelWaitStart) < 20000) {
            await new Promise(r => setTimeout(r, 250));
        }

        const players = Array.isArray(config.players) ? config.players : [];
        const myEntry = players.find(p => p.slot === this.localSlot) || players[0] || {
            slot: this.localSlot,
            name: this.localName,
            character: this.localCharacter
        };
        const localChar = config.mapId === 'falador' ? 'durial321' : (myEntry.character || 'warrior');
        this.localName = myEntry.name || this.localName;
        this.localNameDraft = this.localName;

        const allPartyChars = [...players.map(p => p.character), ...(config.mapId === 'falador' ? ['durial321'] : [])];
        await this.ensureAllCharacterModels(client, allPartyChars);

        console.log(`[Multiplayer] Launching ${players.length}-Player Co-Op Run: Local Slot ${this.localSlot} (${this.localName} - ${localChar})`);

        client.store.set({
            characterId: localChar,
            mapId: config.mapId || 'lumbridge'
        });

        if (localChar !== 'dipper' && localChar !== 'elias' && client.getAppearance) {
            try {
                await client.assets.setPlayerAppearance(client.getAppearance(localChar));
            } catch(e) {}
        }

        try {
            this.closeLobbyModal();
            await client.startRun(config.mapId, localChar, Boolean(config.endless));
            this.setupInGameHooks(localChar, players);
        } catch (err) {
            console.error('[Multiplayer] Error starting run:', err);
        }
    }
,

    showToast(text) {
        let toast = document.getElementById('coop-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'coop-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                zoom: var(--ui-scale, 1);
                background: rgba(30, 20, 10, 0.95);
                border: 2px solid #5a4a35;
                color: #ff981f;
                padding: 10px 24px;
                font-family: 'OSRS Bold', monospace;
                font-size: 16px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.8);
                pointer-events: none;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 3500);
    }
,

    openLobbyModal(roomId = null) {
        const urlRoom = sanitizeRoomId(new URLSearchParams(window.location.search).get('room'));
        const requestedRoom = sanitizeRoomId(roomId) || urlRoom;
        const targetRoom = requestedRoom || this.roomId || this.constructor.generateRoomId();
        if (
            this.ws &&
            (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) &&
            this.roomId === targetRoom
        ) {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.localReady = true;
                this.syncLocalToLobbyPlayers();
                this.sendLobbyUpdate();
            }
            this.renderLobbyModal();
            return;
        }
        this.connect(targetRoom);
        this.renderLobbyModal();
    }
,

    closeLobbyModal() {
        if (this.modalEl && this.modalEl.parentNode) {
            this.modalEl.parentNode.removeChild(this.modalEl);
            this.modalEl = null;
        }
    }
,

    renderLobbyModal() {
        this.closeLobbyModal();

        const modal = document.createElement('div');
        modal.id = 'coop-lobby-modal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            zoom: var(--ui-scale, 1);
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            user-select: none;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #2b231a;
            border: 3px solid #5a4a35;
            outline: 2px solid #111;
            padding: 20px 28px;
            width: min(680px, calc(94vw / var(--ui-scale, 1)));
            max-height: calc(92vh / var(--ui-scale, 1));
            overflow-y: auto;
            box-sizing: border-box;
            box-shadow: 0 8px 32px rgba(0,0,0,0.9);
            color: #ff981f;
            font-family: 'OSRS Bold', monospace;
            text-align: center;
        `;
        modal.appendChild(box);
        this.modalEl = modal;
        document.body.appendChild(modal);

        this.updateLobbyUI();
    }
,

    updateLobbyUI() {
        if (!this.modalEl) return;
        const box = this.modalEl.firstElementChild;
        if (!box) return;

        const nameInput = box.querySelector('#coop-local-name');
        const wasNameFocused = Boolean(nameInput && document.activeElement === nameInput);
        const prevNameVal = nameInput ? nameInput.value : (this.localNameDraft || this.localName);
        const prevSelStart = wasNameFocused ? nameInput.selectionStart : null;
        const prevSelEnd = wasNameFocused ? nameInput.selectionEnd : null;

        this.syncLocalToLobbyPlayers();
        const isHost = this.role === 'host' || this.role === null;
        const safeRoomId = escapeHtml(this.roomId || 'CONNECTING...');
        const safeInviteLink = escapeHtml(this.getInviteLink());
        const safeLocalName = escapeHtml(prevNameVal);

        const hostUnlocked = this.getUnlockedCharacters();
        const unlockedSet = new Set(hostUnlocked);
        if (!unlockedSet.has(this.localCharacter)) {
            this.localCharacter = hostUnlocked[0] || 'warrior';
            this.syncLocalToLobbyPlayers();
        }

        const unlockedChars = ALL_CHARACTERS.filter(c => unlockedSet.has(c.id));
        const lockedChars = ALL_CHARACTERS.filter(c => !unlockedSet.has(c.id) && !c.secretCode);
        const visibleTotal = ALL_CHARACTERS.filter(c => !c.secretCode || unlockedSet.has(c.id)).length;
        const charOptionsHtml = [
            ...unlockedChars.map(c => `<option value="${c.id}" ${this.localCharacter === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`),
            ...lockedChars.map(c => `<option value="${c.id}" disabled>🔒 ${escapeHtml(c.name)} (Locked on Host)</option>`)
        ].join('');

        const currentRegion = ALL_REGIONS.find(r => r.id === this.selectedMapId) || ALL_REGIONS[0];
        const regionOptionsHtml = ALL_REGIONS.map(r => (
            `<option value="${r.id}" ${currentRegion.id === r.id ? 'selected' : ''}>${escapeHtml(r.name)} (${escapeHtml(r.difficulty)})</option>`
        )).join('');

        const partyCount = Math.max(1, this.lobbyPlayers.size);
        const activeScaleParty = Math.max(2, Math.min(4, partyCount));
        const diffWeights = getCoopDifficultyWeights(activeScaleParty);
        const customDiff = Number(this.difficultyMult) || 1.0;
        const customModeLabel =
            customDiff === 2
                ? 'Extreme One Chunk Man (2x Diff · 1.5x Pts)'
                : customDiff === 3
                  ? 'Nightmare Man (3x Diff · 2.5x Pts)'
                  : `Diff: ${customDiff}x`;
        const hpScaleLabel = `${(diffWeights.hpMult * customDiff).toFixed(2)}x Mob / ${(diffWeights.bossHpMult * customDiff).toFixed(2)}x Boss HP`;
        const spawnScaleLabel = `${diffWeights.spawnMult}x Spawns (+${Math.round(diffWeights.heavyWeightBias * 100)}% Heavy Weight)`;
        const dmgScaleLabel = `${(diffWeights.dmgMult * customDiff).toFixed(2)}x Dmg`;
        const weights = diffWeights;
        const allGuestsReady = Array.from(this.lobbyPlayers.values())
            .filter(p => p.slot !== this.localSlot)
            .every(p => p.ready);

        // Render 4 player slots (2x2 grid)
        const slotsHtml = [1, 2, 3, 4].map(slotNum => {
            const p = this.lobbyPlayers.get(slotNum);
            const isLocal = slotNum === this.localSlot;
            const isSlotHost = p ? Boolean(p.isHost || slotNum === this.hostSlot) : (slotNum === 1 && isHost);
            const roleBadge = isSlotHost ? 'HOST' : 'GUEST';
            const borderColor = isLocal ? '#ff981f' : (p ? '#6b5842' : '#2d2319');

            if (isLocal) {
                return `
                    <div style="background: #1e1812; border: 2px solid ${borderColor}; padding: 10px 12px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #ff981f; margin-bottom: 4px;">
                            <span>PLAYER ${slotNum} (YOU)</span>
                            <span style="color: #ffff00;">${roleBadge}</span>
                        </div>
                        <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 2px;">Your Name:</label>
                        <input id="coop-local-name" type="text" maxlength="14" value="${safeLocalName}"
                            style="width: 100%; box-sizing: border-box; background: #0c0906; border: 1px solid #5a4a35; color: #ffff00; padding: 4px 8px; font-family: 'OSRS Bold', monospace; font-size: 13px; margin-bottom: 6px;" />
                        <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 2px;">Adventurer (Host Save):</label>
                        <select id="coop-local-char" style="width: 100%; background: #0c0906; border: 1px solid #5a4a35; color: #ff981f; padding: 5px; font-family: 'OSRS Small', monospace; font-size: 13px;">
                            ${charOptionsHtml}
                        </select>
                    </div>
                `;
            }

            if (p) {
                const safePName = escapeHtml(p.name || `Player ${slotNum}`);
                const charObj = ALL_CHARACTERS.find(c => c.id === p.character);
                const safePChar = escapeHtml((charObj ? charObj.name : (p.character || 'warrior')).toUpperCase());
                return `
                    <div style="background: #1e1812; border: 2px solid ${borderColor}; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-bottom: 4px;">
                                <span>PLAYER ${slotNum}</span>
                                <span style="color: ${isSlotHost ? '#ffff00' : '#40e0ff'};">${roleBadge}</span>
                            </div>
                            <div style="font-size: 16px; color: #ffff00; margin-bottom: 4px;">${safePName}</div>
                            <div style="font-size: 12px; color: #ff981f;">
                                Class: <strong>${safePChar}</strong>
                            </div>
                        </div>
                        <div style="font-size: 11px; color: ${p.ready || isSlotHost ? '#00ff00' : '#ffff00'}; margin-top: 8px;">
                            ${p.ready || isSlotHost ? '● Ready' : '⏳ Loading Assets...'}
                        </div>
                    </div>
                `;
            }

            return `
                <div style="background: #16110c; border: 2px dashed #3d3123; padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 98px;">
                    <div style="font-size: 11px; color: #665846; margin-bottom: 4px;">PLAYER ${slotNum} SLOT</div>
                    <div style="font-size: 12px; color: #776855; font-style: italic;">Open Slot (Share Link)</div>
                </div>
            `;
        }).join('');

        box.innerHTML = `
            <h2 style="margin: 0 0 6px; font-size: 24px; color: #ff981f; text-shadow: 2px 2px #000;">
                Online Co-Op Lobby (2-4 Players)
            </h2>
            <div style="font-size: 13px; color: #bbb; margin-bottom: 8px;">
                ${isHost ? 'Share the invite link with up to 3 friends (start anytime with 2 to 4 players).' : `Connected as Player ${this.localSlot} (Guest).`}
            </div>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-bottom: 12px; font-size: 11px;">
                <span style="background: #231a12; border: 1px solid #6b5842; color: #40e0ff; padding: 3px 8px; border-radius: 3px;">
                    👥 Party: ${partyCount}/4 (${weights.label})
                </span>
                <span style="background: #231a12; border: 1px solid #6b5842; color: #ff6040; padding: 3px 8px; border-radius: 3px;">
                    ⚔ ${hpScaleLabel} · ${dmgScaleLabel}
                </span>
                <span style="background: #231a12; border: 1px solid #6b5842; color: #ffa834; padding: 3px 8px; border-radius: 3px;">
                    🔥 ${spawnScaleLabel}
                </span>
                <span style="background: #231a12; border: 1px solid #6b5842; color: #ffff00; padding: 3px 8px; border-radius: 3px;">
                    ★ Classes: ${unlockedChars.length}/${visibleTotal}
                </span>
            </div>

            <!-- Room Code & Link Box -->
            <div style="background: #1a1510; border: 2px solid #3d3123; padding: 10px 12px; margin-bottom: 12px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 13px; color: #888;">ROOM CODE:</span>
                    <span style="font-size: 18px; color: #ffff00; letter-spacing: 2px;">${safeRoomId}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <input id="coop-link-input" type="text" readonly value="${safeInviteLink}" 
                        style="flex: 1; background: #0c0906; border: 1px solid #5a4a35; color: #fff; padding: 5px 10px; font-family: monospace; font-size: 12px;" />
                    <button id="coop-copy-btn" style="
                        background: #4a3c2c; border: 2px solid #6b5842; color: #ff981f; padding: 5px 14px; 
                        cursor: pointer; font-family: 'OSRS Bold', monospace; font-size: 12px; font-weight: bold;">
                        Copy Link
                    </button>
                </div>
            </div>

            <!-- Region / Map Selection Box -->
            <div style="background: #1e1812; border: 2px solid #5a4a35; padding: 10px 12px; margin-bottom: 12px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 12px; color: #ff981f; letter-spacing: 0.5px;">DESTINATION REGION:</span>
                    <span style="font-size: 11px; color: #ffff00;">${escapeHtml(currentRegion.difficulty)} (${hpScaleLabel} Co-Op HP)</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
                    ${isHost ? `
                        <select id="coop-map-select" style="flex: 1; background: #0c0906; border: 1px solid #5a4a35; color: #ffff00; padding: 5px 8px; font-family: 'OSRS Bold', monospace; font-size: 13px;">
                            ${regionOptionsHtml}
                        </select>
                        <button id="coop-endless-btn" style="
                            background: ${this.selectedEndless ? '#5c2d16' : '#2a2118'};
                            border: 2px solid ${this.selectedEndless ? '#ff981f' : '#5a4a35'};
                            color: ${this.selectedEndless ? '#ffff00' : '#b8a890'};
                            padding: 5px 10px; cursor: pointer; font-family: 'OSRS Bold', monospace; font-size: 12px; white-space: nowrap;">
                            Endless: ${this.selectedEndless ? 'ON' : 'OFF'}
                        </button>
                        <button id="coop-diff-mult-btn" style="
                            background: ${customDiff > 1 ? '#5c2d16' : '#2a2118'};
                            border: 2px solid ${customDiff > 1 ? '#ffd700' : '#5a4a35'};
                            color: ${customDiff > 1 ? '#ffd700' : '#b8a890'};
                            padding: 5px 10px; cursor: pointer; font-family: 'OSRS Bold', monospace; font-size: 12px; white-space: nowrap;">
                            ${customModeLabel}
                        </button>
                    ` : `
                        <div style="font-size: 15px; color: #ffff00;">
                            ${escapeHtml(currentRegion.name)}${this.selectedEndless ? ' <span style="color: #ff6040;">[ENDLESS]</span>' : ''} · <strong style="color:#ffd700;">${customModeLabel}</strong> <span style="font-size: 11px; color: #888;">(Selected by Host)</span>
                        </div>
                    `}
                </div>
                <div style="font-size: 11px; color: #b8a890;">
                    Bosses: <strong style="color: #ff981f;">${escapeHtml(currentRegion.bosses)}</strong>
                </div>
            </div>

            <!-- 4-Player 2x2 Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; text-align: left;">
                ${slotsHtml}
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: space-between; gap: 12px;">
                <button id="coop-close-btn" style="
                    flex: 1; background: #3d2f21; border: 2px solid #5a4a35; color: #aaa; padding: 9px;
                    cursor: pointer; font-family: 'OSRS Bold', monospace; font-size: 15px;">
                    Leave Lobby
                </button>
                ${isHost ? `
                    <button id="coop-start-btn" ${partyCount < 2 ? 'disabled' : ''} style="
                        flex: 2; background: ${partyCount >= 2 ? '#8a6414' : '#332719'}; 
                        border: 2px solid ${partyCount >= 2 ? '#d4af37' : '#443522'}; 
                        color: ${partyCount >= 2 ? '#fff' : '#665'}; padding: 9px;
                        cursor: ${partyCount >= 2 ? 'pointer' : 'not-allowed'}; 
                        font-family: 'OSRS Bold', monospace; font-size: 16px; text-shadow: 1px 1px #000;">
                        ${partyCount >= 2 ? (allGuestsReady ? `Enter ${escapeHtml(currentRegion.name)} (${partyCount}P Co-Op)` : `Start ${partyCount}P Co-Op (Guests Loading...)`) : 'Waiting for at least 1 more player...'}
                    </button>
                ` : `
                    <div id="coop-guest-status" style="flex: 2; padding: 9px; color: #ffff00; font-size: 14px; align-self: center;">
                        ${this.localReady ? `Ready (${partyCount}/4)! Waiting for Host to enter ${escapeHtml(currentRegion.name)}...` : 'Loading assets...'}
                    </div>
                `}
            </div>
        `;

        const copyBtn = box.querySelector('#coop-copy-btn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const input = box.querySelector('#coop-link-input');
                if (input) {
                    navigator.clipboard.writeText(input.value).then(() => {
                        copyBtn.textContent = 'Copied!';
                        copyBtn.style.color = '#ffff00';
                        this.showToast('Invite link copied to clipboard!');
                        setTimeout(() => {
                            copyBtn.textContent = 'Copy Link';
                            copyBtn.style.color = '#ff981f';
                        }, 2000);
                    });
                }
            };
        }

        const mapSelect = box.querySelector('#coop-map-select');
        if (mapSelect) {
            mapSelect.onchange = (e) => this.selectMap(e.target.value);
        }

        const endlessBtn = box.querySelector('#coop-endless-btn');
        if (endlessBtn) {
            endlessBtn.onclick = () => this.toggleEndless();
        }

        const diffMultBtn = box.querySelector('#coop-diff-mult-btn');
        if (diffMultBtn) {
            diffMultBtn.onclick = () => {
                if (this.role !== 'host' && this.role !== null) return;
                const steps = [1, 1.25, 1.5, 2, 3];
                const cur = Number(this.difficultyMult) || 1;
                const idx = steps.findIndex(v => Math.abs(v - cur) < 0.01);
                this.difficultyMult = steps[(idx + 1) % steps.length];
                this.sendLobbyUpdate();
                this.updateLobbyUI();
            };
        }

        const localNameInput = box.querySelector('#coop-local-name');
        if (localNameInput) {
            localNameInput.oninput = (e) => this.setPlayerName(e.target.value);
            if (wasNameFocused) {
                localNameInput.value = prevNameVal;
                localNameInput.focus();
                try {
                    if (prevSelStart !== null && prevSelEnd !== null) {
                        localNameInput.setSelectionRange(prevSelStart, prevSelEnd);
                    }
                } catch (err) {}
            }
        }

        const localCharSelect = box.querySelector('#coop-local-char');
        if (localCharSelect) {
            localCharSelect.onchange = (e) => this.selectCharacter(e.target.value);
        }

        const startBtn = box.querySelector('#coop-start-btn');
        if (startBtn && partyCount >= 2) {
            startBtn.onclick = () => this.startRun();
        }

        const closeBtn = box.querySelector('#coop-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                if (this.ws) this.ws.close();
                this.closeLobbyModal();
                window.history.replaceState({}, '', window.location.pathname);
            };
        }
    }
};
