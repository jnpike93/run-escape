// Run Escape - Multiplayer Co-Op Module (RFC 6455 WebSockets)
// Full 2-player networked co-op with class model baking, deterministic seeds,
// mutual player awareness (custom lobby names, overhead HP bars, nametags, party HUD, off-screen arrows),
// and automatic run termination on partner disconnect.

const ALL_CHARACTERS = [
    { id: 'dipper', name: 'Dipper (Corgi)', weapon: 'throwing_knives', defaultUnlocked: false, secretCode: true },
    { id: 'warrior', name: 'Warrior', weapon: 'scimitar', defaultUnlocked: true },
    { id: 'wizard', name: 'Wizard', weapon: 'fire_spells', defaultUnlocked: true },
    { id: 'ranger', name: 'Ranger', weapon: 'throwing_knives', defaultUnlocked: true },
    { id: 'monk', name: 'Monk', weapon: 'saradomin_strike', defaultUnlocked: false },
    { id: 'barbarian', name: 'Barbarian', weapon: 'two_handed_sword', defaultUnlocked: false },
    { id: 'ancient_mage', name: 'Ancient Mage', weapon: 'ice_burst', defaultUnlocked: false },
    { id: 'hunter', name: 'Hunter', weapon: 'shortbow', defaultUnlocked: false },
    { id: 'rogue', name: 'Rogue', weapon: 'throwing_knives', defaultUnlocked: false },
    { id: 'dragon_slayer', name: 'Dragon Slayer', weapon: 'scimitar', defaultUnlocked: false },
    { id: 'nomad', name: 'Nomad', weapon: 'throwing_axes', defaultUnlocked: false },
    { id: 'menaphite', name: 'Menaphite', weapon: 'smoke_burst', defaultUnlocked: false },
    { id: 'seer', name: 'Seer', weapon: 'elemental_runes', defaultUnlocked: false },
    { id: 'berserker', name: 'Berserker', weapon: 'two_handed_sword', defaultUnlocked: false },
    { id: 'obby_mauler', name: 'Obby Mauler', weapon: 'tzhaar_ket_om', defaultUnlocked: false },
    { id: 'pirate', name: 'Pirate', weapon: 'throwing_knives', defaultUnlocked: false },
    { id: 'pyromancer', name: 'Pyromancer', weapon: 'fire_spells', defaultUnlocked: false },
    { id: 'shayzien_soldier', name: 'Shayzien Soldier', weapon: 'scimitar', defaultUnlocked: false },
    { id: 'gladiator', name: 'Gladiator', weapon: 'dual_macuahuitl', defaultUnlocked: false },
    { id: 'javelineer', name: 'Javelineer', weapon: 'eclipse_atlatl', defaultUnlocked: false }
];

const ALLOWED_CHARACTERS = new Set(ALL_CHARACTERS.map(c => c.id));
const CHAR_WEAPONS = Object.fromEntries(ALL_CHARACTERS.map(c => [c.id, c.weapon]));
const DEFAULT_UNLOCKED_CHARACTERS = ALL_CHARACTERS.filter(c => c.defaultUnlocked).map(c => c.id);

const ALL_REGIONS = [
    { id: 'lumbridge', name: 'Lumbridge', bosses: 'Count Draynor & Wise Old Man', difficulty: '1.0x Base HP / 1.0x Dmg' },
    { id: 'barrows', name: 'Barrows', bosses: 'The Six Barrows Brothers (Dharok Final)', difficulty: '1.25x Base HP / 1.15x Dmg' },
    { id: 'wilderness', name: 'Wilderness', bosses: 'Crazy Archaeologist, Chaos Fanatic & King Black Dragon', difficulty: '1.5x Base HP / 1.3x Dmg' },
    { id: 'desert', name: 'Kharidian Desert', bosses: 'Fareed, Dessous, Damis & Kalphite Queen', difficulty: '1.75x Base HP / 1.45x Dmg' },
    { id: 'fremennik', name: 'Fremennik Province', bosses: 'Dagannoth Kings & Vorkath', difficulty: '2.0x Base HP / 1.6x Dmg' },
    { id: 'karamja', name: 'Karamja', bosses: 'Elvarg, Nezikchened, Ket-Zek & TzTok-Jad', difficulty: '2.25x Base HP / 1.75x Dmg' },
    { id: 'kourend', name: 'Kourend', bosses: 'Lizardman Shaman, Sarachnis, Skotizo & Alchemical Hydra', difficulty: '2.5x Base HP / 1.9x Dmg' },
    { id: 'varlamore', name: 'Varlamore', bosses: 'Manticore, Colossi & Sol Heredit', difficulty: '2.75x Base HP / 2.05x Dmg' }
];
const ALLOWED_REGIONS = new Set(ALL_REGIONS.map(r => r.id));

function sanitizeMapId(mapId, fallback = 'lumbridge') {
    if (!mapId || typeof mapId !== 'string') return fallback;
    const normalized = mapId.trim().toLowerCase();
    return ALLOWED_REGIONS.has(normalized) ? normalized : fallback;
}

function sanitizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().slice(0, 14).replace(/[^a-zA-Z0-9 ()_-]/g, '');
}

function sanitizeRoomId(room) {
    if (!room || typeof room !== 'string') return '';
    return room.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
}

function sanitizeCharacter(charId, fallback = 'warrior') {
    if (!charId || typeof charId !== 'string') return fallback;
    const normalized = charId.trim().toLowerCase();
    return ALLOWED_CHARACTERS.has(normalized) ? normalized : fallback;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export class MultiplayerManager {
    constructor() {
        this.roomId = null;
        this.role = null; // 'host' | 'guest'
        this.ws = null;
        this.peers = 1;
        this.peerConnected = false;
        
        this.localCharacter = 'warrior';
        this.remoteCharacter = 'wizard';
        this.localName = 'Player 1';
        this.remoteName = 'Player 2';
        this.localReady = false;
        this.remoteReady = false;
        this.selectedMapId = 'lumbridge';
        this.hostUnlockedCharacters = this.readLocalSaveUnlockedCharacters();
        
        this.gameStarted = false;
        this.gameConfig = null; // { seed, mapId, p1Char, p2Char, p1Name, p2Name, unlockedItems }
        
        this.remoteInput = { moveX: 0, moveY: 0, tick: 0 };
        this.remoteState = null;
        this.localPauseState = null;
        this.remotePauseState = null;
        this.remoteLoadout = { weapons: [], passives: [], gear: [], inventory: [null, null, null, null] };
        this.pendingIcons = new Set();
        this.lastPartyHudKey = '';
        this.nextChestExcludeId = undefined;
        
        this.modalEl = null;
        this.inGameHooked = false;
        this.clientMethodsHooked = false;

        // Clean disconnect on tab close/unload
        window.addEventListener('beforeunload', () => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.send({ type: 'peer_leaving' });
                    this.ws.close();
                } catch (e) {}
            }
        });
    }

    static generateRoomId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let id = 'OSRS-';
        for (let i = 0; i < 4; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    getInviteLink() {
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomId);
        return url.toString();
    }

    connect(roomId) {
        if (this.ws) {
            try { this.ws.close(); } catch(e) {}
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        const safeRoom = sanitizeRoomId(roomId) || MultiplayerManager.generateRoomId();
        this.roomId = safeRoom;
        this.role = null;
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${proto}//${window.location.host}/ws?room=${encodeURIComponent(safeRoom)}`;
        console.log('[Multiplayer] Connecting to:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[Multiplayer] WebSocket connected');
            this.heartbeatInterval = setInterval(() => {
                this.send({ type: 'ping' });
            }, 20000);
            this.checkLocalReady();
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (err) {
                console.error('[Multiplayer] Failed parsing message:', err, event.data);
            }
        };

        this.ws.onclose = () => {
            console.log('[Multiplayer] WebSocket closed');
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
            this.peerConnected = false;
            if (this.gameStarted) {
                this.endGameOnDisconnect('Connection to Co-Op server lost.');
            }
            this.updateLobbyUI();
        };

        this.ws.onerror = (err) => {
            console.error('[Multiplayer] WebSocket error:', err);
        };
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    async checkLocalReady() {
        const client = window.gameClient;
        if (client && client.assets && client.assets.models && client.assets.models.size >= 250) {
            this.localReady = true;
            this.sendLobbyUpdate();
            this.updateLobbyUI();
        } else {
            setTimeout(() => this.checkLocalReady(), 500);
        }
    }

    handleMessage(msg) {
        if (!msg || typeof msg !== 'object') return;
        switch (msg.type) {
            case 'pong':
                break;

            case 'welcome':
                if (this.role !== null) break;
                if (msg.role !== 'host' && msg.role !== 'guest') break;
                this.role = msg.role;
                this.peers = Number.isFinite(Number(msg.peers)) ? Math.max(1, Math.min(2, Math.round(Number(msg.peers)))) : 1;
                this.peerConnected = this.peers > 1;
                if (msg.room) {
                    const cleanRoom = sanitizeRoomId(msg.room);
                    if (cleanRoom) this.roomId = cleanRoom;
                }
                if (this.role === 'guest' && this.localName === 'Player 1') {
                    this.localName = 'Player 2';
                    this.remoteName = 'Player 1';
                }
                console.log(`[Multiplayer] Welcome: role=${this.role}, peers=${this.peers}`);
                this.sendLobbyUpdate();
                this.updateLobbyUI();
                break;

            case 'peer_joined':
                this.peerConnected = true;
                this.peers = 2;
                console.log('[Multiplayer] Peer joined');
                this.sendLobbyUpdate();
                this.showToast('Player 2 connected to lobby!');
                this.updateLobbyUI();
                break;

            case 'peer_leaving':
            case 'peer_left':
                console.log('[Multiplayer] Peer disconnected');
                this.peerConnected = false;
                this.peers = 1;
                this.remoteReady = false;
                if (this.gameStarted) {
                    this.endGameOnDisconnect('Co-Op Partner Disconnected - Game Over');
                } else {
                    if (msg.promotedToHost || this.role === 'guest') {
                        this.role = 'host';
                        if (this.localName === 'Player 2') {
                            this.localName = 'Player 1';
                        }
                        this.showToast('Host left lobby - promoted to Host');
                    } else {
                        this.showToast('Peer disconnected from lobby');
                    }
                    this.updateLobbyUI();
                }
                break;

            case 'lobby_update':
                const incomingLobbyName = sanitizeName(msg.name);
                if (this.role === 'host') {
                    const hostUnlocked = this.getUnlockedCharacters();
                    const candidate = sanitizeCharacter(msg.character, this.remoteCharacter);
                    this.remoteCharacter = hostUnlocked.includes(candidate) ? candidate : (hostUnlocked[0] || 'warrior');
                    if (incomingLobbyName) this.remoteName = incomingLobbyName;
                    this.remoteReady = !!msg.ready;
                } else {
                    if (Array.isArray(msg.unlockedCharacters)) {
                        const validUnlocked = msg.unlockedCharacters
                            .filter(c => typeof c === 'string' && ALLOWED_CHARACTERS.has(c.trim().toLowerCase()))
                            .map(c => c.trim().toLowerCase());
                        const merged = new Set([...DEFAULT_UNLOCKED_CHARACTERS, ...validUnlocked]);
                        this.hostUnlockedCharacters = ALL_CHARACTERS.filter(c => merged.has(c.id)).map(c => c.id);
                        if (!this.hostUnlockedCharacters.includes(this.localCharacter)) {
                            this.localCharacter = this.hostUnlockedCharacters[0] || 'warrior';
                            this.sendLobbyUpdate();
                        }
                    }
                    if (msg.mapId) {
                        this.selectedMapId = sanitizeMapId(msg.mapId, this.selectedMapId);
                    }
                    this.remoteCharacter = sanitizeCharacter(msg.hostCharacter || msg.character, this.remoteCharacter);
                    if (incomingLobbyName) this.remoteName = incomingLobbyName;
                    this.remoteReady = !!msg.ready;
                }
                this.updateLobbyUI();
                break;

            case 'game_start':
                if (this.role !== 'guest' || this.gameStarted) break;
                if (!msg.config || typeof msg.config !== 'object') break;
                this.gameStarted = true;
                this.gameConfig = {
                    seed: Number.isFinite(Number(msg.config.seed)) ? (Number(msg.config.seed) >>> 0) : 1,
                    mapId: sanitizeMapId(msg.config.mapId, 'lumbridge'),
                    p1Char: sanitizeCharacter(msg.config.p1Char, 'warrior'),
                    p2Char: sanitizeCharacter(msg.config.p2Char, 'wizard'),
                    p1Name: sanitizeName(msg.config.p1Name) || 'Player 1',
                    p2Name: sanitizeName(msg.config.p2Name) || 'Player 2',
                    unlockedItems: Array.isArray(msg.config.unlockedItems)
                        ? msg.config.unlockedItems.filter(id => typeof id === 'string').slice(0, 200)
                        : []
                };
                this.selectedMapId = this.gameConfig.mapId;
                if (this.gameConfig.p1Name) this.remoteName = this.gameConfig.p1Name;
                console.log('[Multiplayer] Game Starting with config:', this.gameConfig);
                this.closeLobbyModal();
                this.launchCoopRun(this.gameConfig);
                break;

            case 'input':
                if (this.role !== 'host') break;
                this.remoteInput = msg;
                if (msg.pauseState !== undefined) {
                    const allowedStates = new Set(['levelUp', 'chest', 'paused']);
                    const nextRemote = (typeof msg.pauseState === 'string' && allowedStates.has(msg.pauseState)) ? msg.pauseState : null;
                    if (nextRemote !== this.remotePauseState) {
                        this.remotePauseState = nextRemote;
                        if (window.gameClient) {
                            window.gameClient.accumulator = 0;
                            this.updatePauseOverlay(window.gameClient);
                        }
                    }
                }
                if (window.gameClient && window.gameClient.sim && window.gameClient.sim.player2) {
                    this.applyRemoteInput(window.gameClient.sim.player2, msg);
                }
                break;

            case 'sync_world':
                if (this.role === 'guest') {
                    this.applyWorldSync(msg);
                }
                break;

            case 'coop_pause': {
                const allowedStates = new Set(['levelUp', 'chest', 'paused']);
                const nextRemote = (typeof msg.state === 'string' && allowedStates.has(msg.state)) ? msg.state : null;
                this.remotePauseState = nextRemote;
                if (window.gameClient) {
                    window.gameClient.accumulator = 0;
                    if (msg.action === 'resume_both' && window.gameClient.paused) {
                        window.gameClient.paused = false;
                        window.gameClient.syncOverlay();
                        this.syncLocalPauseState(window.gameClient, true);
                    }
                    this.updatePauseOverlay(window.gameClient);
                }
                break;
            }

            case 'coop_pickup':
                this.applyCoopPickup(msg);
                break;

            case 'coop_loadout':
                this.applyRemoteLoadout(msg);
                break;

            case 'game_over':
                this.endGameOnDisconnect(typeof msg.reason === 'string' ? msg.reason.slice(0, 80) : 'Game Over');
                break;
        }
    }

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

    getUnlockedCharacters() {
        if (this.role === 'host' || this.role === null) {
            this.hostUnlockedCharacters = this.readLocalSaveUnlockedCharacters();
        }
        if (!Array.isArray(this.hostUnlockedCharacters) || this.hostUnlockedCharacters.length === 0) {
            this.hostUnlockedCharacters = [...DEFAULT_UNLOCKED_CHARACTERS];
        }
        return this.hostUnlockedCharacters;
    }

    sendLobbyUpdate() {
        const unlocked = this.getUnlockedCharacters();
        if (!unlocked.includes(this.localCharacter)) {
            this.localCharacter = unlocked[0] || 'warrior';
        }
        if (this.role === 'host') {
            this.send({
                type: 'lobby_update',
                hostCharacter: this.localCharacter,
                mapId: this.selectedMapId,
                name: this.localName,
                ready: this.localReady,
                unlockedCharacters: unlocked
            });
        } else {
            this.send({
                type: 'lobby_update',
                character: this.localCharacter,
                name: this.localName,
                ready: this.localReady
            });
        }
    }

    selectMap(mapId) {
        if (this.role !== 'host' && this.role !== null) return;
        this.selectedMapId = sanitizeMapId(mapId, 'lumbridge');
        this.sendLobbyUpdate();
        this.updateLobbyUI();
    }

    setPlayerName(name) {
        this.localName = sanitizeName(name) || (this.role === 'host' ? 'Player 1' : 'Player 2');
        this.sendLobbyUpdate();
    }

    selectCharacter(charId) {
        const unlocked = this.getUnlockedCharacters();
        const cleanChar = sanitizeCharacter(charId, unlocked[0] || 'warrior');
        if (!unlocked.includes(cleanChar)) {
            this.showToast('That class is locked on the Host save!');
            this.updateLobbyUI();
            return;
        }
        this.localCharacter = cleanChar;
        const client = window.gameClient;
        if (client) {
            client.store?.set({ characterId: cleanChar });
            if (cleanChar !== 'dipper' && client.getAppearance) {
                try {
                    client.assets?.setPlayerAppearance(client.getAppearance(cleanChar));
                } catch(e) {}
            }
        }
        this.sendLobbyUpdate();
        this.updateLobbyUI();
    }

    async waitForGameClient(timeoutMs = 40000) {
        const start = Date.now();
        while (!window.gameClient && (Date.now() - start) < timeoutMs) {
            await new Promise(r => setTimeout(r, 200));
        }
        return window.gameClient;
    }

    async ensureAllCharacterModels(client, extraChars = []) {
        if (!client || !client.assets || !client.assets.models) return;
        const charIds = new Set(['warrior', 'wizard', 'ranger', 'barbarian', 'monk', ...extraChars]);
        const required = Array.from(charIds)
            .filter(id => id && id !== 'dipper' && ALLOWED_CHARACTERS.has(id))
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
            386, 390, 401, 426, 711, 806, 811, 1167, 1378, 1658, 1979,
            2614, 2661, 4230, 5061, 7638, 7640, 7642, 7644, 7855, 8056, 9493
        ];
        this.playerSeqIds = seqIds;
        const bakes = [];

        // Ensure Corgi is baked
        if (!client.assets.models.has('corgi')) {
            bakes.push({
                kind: 'npc',
                key: 'corgi',
                npcId: 16370,
                seqIds: [6561, 6560]
            });
        }

        for (const cid of missing) {
            const pureId = cid.replace('player_', '');
            let appearance = null;
            if (client.getAppearance) {
                try {
                    appearance = client.getAppearance(pureId);
                } catch (err) {}
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

    async startRun() {
        if (this.role !== 'host') return;
        
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
        const p1Char = hostUnlocked.includes(this.localCharacter) ? this.localCharacter : (hostUnlocked[0] || 'warrior');
        const p2Char = hostUnlocked.includes(this.remoteCharacter) ? this.remoteCharacter : (hostUnlocked[0] || 'warrior');

        const seed = Math.floor(Math.random() * 2147483647);
        const config = {
            seed,
            mapId: selectedRegion.id,
            p1Char,
            p1Name: this.localName,
            p2Char,
            p2Name: this.remoteName,
            unlockedItems: Array.isArray(client.save?.unlockedItems) ? [...client.save.unlockedItems] : []
        };

        this.send({
            type: 'game_start',
            config
        });
        this.gameStarted = true;
        this.gameConfig = config;
        this.closeLobbyModal();
        await this.launchCoopRun(config);
    }

    async launchCoopRun(config) {
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

        // Wait until assets are fully baked to prevent missing monster models
        const modelWaitStart = Date.now();
        while (client.assets?.models?.size < 250 && (Date.now() - modelWaitStart) < 20000) {
            console.log('[Multiplayer] Waiting for models to finish baking... count:', client.assets?.models?.size);
            await new Promise(r => setTimeout(r, 250));
        }

        const isHost = this.role === 'host';
        const localChar = isHost ? config.p1Char : config.p2Char;
        const remoteChar = isHost ? config.p2Char : config.p1Char;

        // Bake all player character models (including any unlocked class selected by P1 or P2)
        await this.ensureAllCharacterModels(client, [localChar, remoteChar]);

        console.log(`[Multiplayer] Launching run: Local=${localChar} (${this.localName}), Remote=${remoteChar} (${this.remoteName})`);

        // Set local character and map in store
        client.store.set({
            characterId: localChar,
            mapId: config.mapId || 'lumbridge'
        });

        // Set player appearance before starting run
        if (localChar !== 'dipper' && client.getAppearance) {
            try {
                await client.assets.setPlayerAppearance(client.getAppearance(localChar));
            } catch(e) {}
        }

        try {
            await client.startRun();
            this.setupInGameHooks(localChar, remoteChar);
        } catch (err) {
            console.error('[Multiplayer] Error starting run:', err);
        }
    }

    setupInGameHooks(localChar, remoteChar) {
        const client = window.gameClient;
        if (!client || !client.sim) return;
        const sim = client.sim;
        const isHost = this.role === 'host';

        this.localPauseState = null;
        this.remotePauseState = null;
        this.lastPartyHudKey = '';
        this.remoteLoadout = { weapons: [], passives: [], gear: [], inventory: [null, null, null, null] };
        this.removePauseOverlay();

        // Sync Host's unlocked items into Guest's simulation so casket & level-up pools match Host's save state
        if (!isHost && Array.isArray(this.gameConfig?.unlockedItems) && sim.unlockedItems instanceof Set) {
            for (const itemId of this.gameConfig.unlockedItems) {
                sim.unlockedItems.add(itemId);
            }
        }

        // Ensure every casket roll and reroll uses fresh independent random entropy per player
        const mixRandomSeed = () => {
            const arr = new Uint32Array(1);
            if (window.crypto && window.crypto.getRandomValues) {
                window.crypto.getRandomValues(arr);
            } else {
                arr[0] = (Math.random() * 0x100000000) >>> 0;
            }
            if (sim.rng) {
                sim.rng.state = ((sim.rng.state ^ arr[0]) >>> 0) || 1;
            }
        };

        if (sim.openCasket) {
            const origOpenCasket = sim.openCasket.bind(sim);
            sim.openCasket = (tier) => {
                mixRandomSeed();
                return origOpenCasket(tier);
            };
        }

        if (sim.rollChestItem) {
            const origRollChestItem = sim.rollChestItem.bind(sim);
            sim.rollChestItem = (tier, excludeId) => {
                mixRandomSeed();
                return origRollChestItem(tier, excludeId || this.nextChestExcludeId);
            };
        }

        // Prevent window blur from auto-pausing during Co-Op; explicit Esc/P, Level-Up, and Chests pause both players
        if (client.input) {
            client.input.onBlur = () => {
                client.accumulator = 0;
            };
        }

        const p1 = sim.player;
        p1.characterId = localChar;

        const spawnX = Number.isFinite(sim.map?.spawn?.x) ? sim.map.spawn.x : 3222.5;
        const spawnY = Number.isFinite(sim.map?.spawn?.y) ? sim.map.spawn.y : 3218.5;

        // Position players side-by-side at the selected region's spawn coordinates
        if (isHost) {
            p1.x = spawnX - 0.5;
            p1.y = spawnY;
            p1.prevX = spawnX - 0.5;
            p1.prevY = spawnY;
            sim.player2 = {
                x: spawnX + 1.0,
                y: spawnY,
                prevX: spawnX + 1.0,
                prevY: spawnY,
                radius: p1.radius,
                facingX: 0,
                facingY: -1,
                yaw: 0,
                moving: false,
                hp: 25,
                maxHp: 25,
                deathTick: -1,
                attackSeq: -1,
                attackStart: 0,
                moveStart: 0,
                flash: 0,
                frozen: 0,
                invulnerable: 0,
                characterId: remoteChar
            };
        } else {
            p1.x = spawnX + 1.0;
            p1.y = spawnY;
            p1.prevX = spawnX + 1.0;
            p1.prevY = spawnY;
            sim.player2 = {
                x: spawnX - 0.5,
                y: spawnY,
                prevX: spawnX - 0.5,
                prevY: spawnY,
                radius: p1.radius,
                facingX: 0,
                facingY: -1,
                yaw: 0,
                moving: false,
                hp: 25,
                maxHp: 25,
                deathTick: -1,
                attackSeq: -1,
                attackStart: 0,
                moveStart: 0,
                flash: 0,
                frozen: 0,
                invulnerable: 0,
                characterId: remoteChar
            };
        }

        if (isHost) {
            // Co-Op Difficulty Scaling: 2x Monster HP on all spawned enemies (normal, elite, and bosses)
            const origSpawnEnemy = sim.spawnEnemy.bind(sim);
            sim.spawnEnemy = (def, kind, pos, bossHp) => {
                const enemy = origSpawnEnemy(def, kind, pos, bossHp);
                if (enemy && !enemy._coopHpScaled) {
                    enemy._coopHpScaled = true;
                    enemy.hp = Math.max(1, Math.round(enemy.hp * 2));
                    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * 2));
                }
                return enemy;
            };
            for (const enemy of sim.enemies) {
                if (enemy && !enemy._coopHpScaled) {
                    enemy._coopHpScaled = true;
                    enemy.hp = Math.max(1, Math.round(enemy.hp * 2));
                    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * 2));
                }
            }

            // Spawn initial wave enemies around the region's spawn point on Host so both players immediately engage monsters
            if (client.getEnemyDef && sim.enemies.length < 5) {
                try {
                    const firstWaveEnemyId = sim.map?.waves?.[0]?.enemies?.[0]?.id || 'goblin';
                    const starterDef = client.getEnemyDef(firstWaveEnemyId) || client.getEnemyDef('goblin');
                    const initialSpawns = [
                        { x: spawnX + 3.0, y: spawnY },
                        { x: spawnX - 2.5, y: spawnY },
                        { x: spawnX, y: spawnY + 3.5 },
                        { x: spawnX, y: spawnY - 3.5 },
                        { x: spawnX + 3.5, y: spawnY + 2.5 }
                    ];
                    for (const pos of initialSpawns) {
                        const walkable = sim.grid && !sim.grid.isSolid(Math.floor(pos.x), Math.floor(pos.y));
                        sim.spawnEnemy(starterDef, 'normal', walkable ? pos : undefined);
                    }
                    console.log(`[Multiplayer] Initial ${firstWaveEnemyId} enemies spawned on Host in ${sim.map?.name || 'region'} (2x Co-Op HP).`);
                } catch (e) {
                    console.warn('[Multiplayer] Initial spawn note:', e);
                }
            }

            // Hook sim.collect on Host so XP, coins, AND caskets collected by Player 1 are shared with Player 2
            const origCollect = sim.collect.bind(sim);
            sim._origCollect = origCollect;
            sim.collect = (pickup) => {
                const kind = pickup.kind;
                const val = pickup.value;
                const tier = pickup.tier || 'medium';
                origCollect(pickup);
                if (this.peerConnected) {
                    if ((kind === 'bones' || kind === 'big_bones' || kind === 'coins') && val > 0) {
                        this.send({
                            type: 'coop_pickup',
                            kind: kind,
                            value: val
                        });
                    } else if (kind === 'casket') {
                        const latestChest = sim.chests && sim.chests.length > 0 ? sim.chests[sim.chests.length - 1] : null;
                        this.remotePauseState = 'chest';
                        this.send({
                            type: 'coop_pickup',
                            kind: 'casket',
                            tier: tier,
                            excludeItemId: latestChest?.itemId || undefined
                        });
                    }
                }
                if (sim.state !== 'playing') {
                    this.syncLocalPauseState(client, true);
                }
            };

            // Hook sim.stepEnemies on Host to target whichever player is closest
            const origStepEnemies = sim.stepEnemies.bind(sim);
            sim.stepEnemies = () => {
                if (!sim.player2 || sim.player2.hp <= 0) {
                    origStepEnemies();
                    return;
                }
                const p1 = sim.player;
                const p2 = sim.player2;
                const allEnemies = sim.enemies;

                const enemiesP1 = [];
                const enemiesP2 = [];
                for (let i = 0; i < allEnemies.length; i++) {
                    const enemy = allEnemies[i];
                    if (enemy.dead) {
                        enemiesP1.push(enemy);
                        continue;
                    }
                    const d1 = Math.hypot(p1.x - enemy.x, p1.y - enemy.y);
                    const d2 = Math.hypot(p2.x - enemy.x, p2.y - enemy.y);
                    if (d2 < d1) {
                        enemiesP2.push(enemy);
                    } else {
                        enemiesP1.push(enemy);
                    }
                }

                // Step enemies targeting Player 1
                sim.enemies = enemiesP1;
                sim.player = p1;
                origStepEnemies();

                // Step enemies targeting Player 2
                sim.enemies = enemiesP2;
                sim.player = p2;
                origStepEnemies();

                // Restore full enemy list and player reference
                sim.enemies = allEnemies;
                sim.player = p1;
            };
        } else {
            // Guest disables autonomous wave spawner, enemy stepping, and local pickup resolution (Host is authoritative)
            sim.stepDirector = () => {};
            sim.stepEnemies = () => {};
            sim.stepPickups = () => {};
            sim.dropPickup = () => {};
            sim.dropCasket = () => {};
            sim.dropCasketOfTier = () => {};
            sim.rollPowerUp = () => {};
            sim.enemies = [];
            console.log('[Multiplayer] Guest initialized in client sync mode.');
        }

        // Arm Player 2 with their class starting weapon
        const p2WeaponId = CHAR_WEAPONS[remoteChar] || 'throwing_knives';
        try {
            sim.addWeapon(p2WeaponId);
            sim.player2Weapons = [sim.weapons.pop()];
            console.log(`[Multiplayer] Player 2 armed with ${p2WeaponId}`);
        } catch (err) {
            console.error('[Multiplayer] Failed adding Player 2 weapon:', err);
        }

        // Hook sim.stepOrbit so Player 2's orbiting weapons orbit around Player 2
        if (sim.stepOrbit) {
            const origStepOrbit = sim.stepOrbit.bind(sim);
            sim.stepOrbit = (proj, orbit) => {
                if (orbit && orbit.owner && sim.player2) {
                    const savedPlayer = sim.player;
                    sim.player = sim.player2;
                    try {
                        origStepOrbit(proj, orbit);
                    } finally {
                        sim.player = savedPlayer;
                    }
                } else {
                    origStepOrbit(proj, orbit);
                }
            };
        }

        // Hook sim.stepWeapons to fire Player 2's weapons
        const origStepWeapons = sim.stepWeapons.bind(sim);
        sim.stepWeapons = () => {
            // Fast-path: only allocate filter arrays when orbit projectiles are active
            const hasP2Orbits = sim.projectiles.some(p => p.orbit && p.owner === 'p2');
            let p2Orbits = null;
            if (hasP2Orbits) {
                p2Orbits = sim.projectiles.filter(p => p.orbit && p.owner === 'p2');
                sim.projectiles = sim.projectiles.filter(p => !(p.orbit && p.owner === 'p2'));
            }
            origStepWeapons();
            if (p2Orbits && p2Orbits.length > 0) {
                sim.projectiles.push(...p2Orbits);
            }

            if (sim.player2 && sim.player2Weapons) {
                const origPlayer = sim.player;
                const hasP1Orbits = sim.projectiles.some(p => p.orbit && p.owner !== 'p2');
                let p1Orbits = null;
                if (hasP1Orbits) {
                    p1Orbits = sim.projectiles.filter(p => p.orbit && p.owner !== 'p2');
                    sim.projectiles = sim.projectiles.filter(p => !(p.orbit && p.owner !== 'p2'));
                }
                sim.player = sim.player2;
                try {
                    for (const t of sim.player2Weapons) {
                        if (t.cooldown > 0) {
                            t.cooldown--;
                            continue;
                        }
                        const e = sim.getEffectiveLevel(t);
                        const n = sim.takeSpecial ? sim.takeSpecial(t, e) : undefined;
                        const s = sim.fireWeapon(t.def, e, n);
                        t.cooldown = s ? sim.cooldownTicks(e.cooldown) : 10;
                        if (s) {
                            sim.events.push({
                                type: "weapon",
                                weaponId: t.def.id,
                                sound: n?.sound ?? e.sound ?? t.def.sound,
                                x: sim.player2.x,
                                y: sim.player2.y
                            });
                            if (!sim.player2.moving) {
                                sim.player2.attackSeq = n?.playerSeq ?? t.def.playerSeq;
                                sim.player2.attackStart = sim.tick;
                            }
                        }
                    }
                    for (const p of sim.projectiles) {
                        if (p.orbit && !p.owner) {
                            p.owner = 'p2';
                            p.orbit.owner = sim.player2;
                        }
                    }
                } finally {
                    sim.player = origPlayer;
                    if (p1Orbits && p1Orbits.length > 0) {
                        sim.projectiles.push(...p1Orbits);
                    }
                }
            }
        };

        // Hook sim.step to transmit local state, sync world, and step Player 2
        const origStep = sim.step.bind(sim);
        sim.step = (moveX, moveY) => {
            origStep(moveX, moveY);

            // Step Player 2
            if (sim.player2) {
                this.stepPlayer2(sim, sim.player2);
                if (isHost && sim.state === 'playing') {
                    this.stepPlayer2Pickups(sim, sim.player2);
                }
            }

            // Detect immediate transition into chest or levelUp on this exact tick
            if (sim.state !== 'playing') {
                this.syncLocalPauseState(client, true);
            }

            // Re-broadcast initial loadout shortly after run start so partner HUD is always populated
            if (sim.tick === 10) {
                this.sendLoadoutSync(client, false);
            }

            // Network transmission
            if (this.peerConnected) {
                if (isHost) {
                    // Check if either player died
                    if (!sim.runOver && (sim.player.hp <= 0 || (sim.player2 && sim.player2.hp <= 0))) {
                        this.send({ type: 'game_over', reason: 'A hero has fallen in battle!' });
                        this.endGameOnDisconnect('A hero has fallen - Game Over');
                        return;
                    }

                    // Host broadcasts authoritative world state; dead enemies are transmitted for 2 ticks so Guest triggers death anim without 45-tick bandwidth bloat
                    const enemyData = [];
                    for (let i = 0; i < sim.enemies.length; i++) {
                        const e = sim.enemies[i];
                        if (!e.dead || (sim.tick - e.deathTick <= 2)) {
                            enemyData.push([
                                e.uid,
                                e.def.id,
                                Math.round(e.x * 100) / 100,
                                Math.round(e.y * 100) / 100,
                                e.hp,
                                e.maxHp,
                                e.yaw,
                                e.dead ? 1 : 0,
                                e.anim,
                                e.animStart,
                                e.flash || 0,
                                e.scale || 1,
                                e.elite ? 1 : (e.boss ? 2 : 0)
                            ]);
                        }
                    }

                    const pickupData = [];
                    for (let i = 0; i < sim.pickups.length; i++) {
                        const p = sim.pickups[i];
                        if (p.value >= 0) {
                            pickupData.push([
                                p.uid,
                                p.kind,
                                Math.round(p.x * 100) / 100,
                                Math.round(p.y * 100) / 100,
                                p.value,
                                p.tier || '',
                                p.powerUp || ''
                            ]);
                        }
                    }

                    this.send({
                        type: 'sync_world',
                        tick: sim.tick,
                        kills: sim.kills,
                        pauseState: this.getLocalPauseState(client),
                        x: Math.round(sim.player.x * 100) / 100,
                        y: Math.round(sim.player.y * 100) / 100,
                        yaw: sim.player.yaw & 2047,
                        facingX: Math.round((sim.player.facingX || 0) * 1000) / 1000,
                        facingY: Math.round((sim.player.facingY ?? -1) * 1000) / 1000,
                        moving: Boolean(sim.player.moving),
                        moveStart: sim.player.moveStart || 0,
                        attackSeq: sim.player.attackSeq ?? -1,
                        attackStart: sim.player.attackStart || 0,
                        p1Hp: sim.player.hp,
                        p1MaxHp: sim.player.maxHp,
                        p2Hp: sim.player2 ? sim.player2.hp : 25,
                        p2MaxHp: sim.player2 ? sim.player2.maxHp : 25,
                        enemies: enemyData,
                        pickups: pickupData
                    });
                } else {
                    // Guest checks local death
                    if (!sim.runOver && sim.player.hp <= 0) {
                        this.send({ type: 'game_over', reason: 'Player 2 has fallen in battle!' });
                        this.endGameOnDisconnect('You have died - Game Over');
                        return;
                    }

                    // Guest transmits input, local position, orientation, and pause state
                    this.send({
                        type: 'input',
                        tick: sim.tick,
                        pauseState: this.getLocalPauseState(client),
                        moveX: moveX,
                        moveY: moveY,
                        x: Math.round(sim.player.x * 100) / 100,
                        y: Math.round(sim.player.y * 100) / 100,
                        yaw: sim.player.yaw & 2047,
                        facingX: Math.round((sim.player.facingX || 0) * 1000) / 1000,
                        facingY: Math.round((sim.player.facingY ?? -1) * 1000) / 1000,
                        moving: Boolean(sim.player.moving),
                        moveStart: sim.player.moveStart || 0,
                        attackSeq: sim.player.attackSeq ?? -1,
                        attackStart: sim.player.attackStart || 0
                    });
                }
            }
        };

        // Hook client-level lifecycle and modal methods once
        if (!this.clientMethodsHooked) {
            const origClientUpdate = client.update.bind(client);
            client.update = (dt, camera) => {
                if (this.gameStarted && client.sim) {
                    this.syncLocalPauseState(client);
                    const localState = this.getLocalPauseState(client);
                    if (this.remotePauseState !== null && localState === null && client.sim.state === 'playing' && !client.sim.runOver) {
                        client.accumulator = 0;
                        client.sim.state = 'coopWait';
                        try {
                            origClientUpdate(dt, camera);
                        } finally {
                            if (client.sim && client.sim.state === 'coopWait') {
                                client.sim.state = 'playing';
                            }
                        }
                        this.updatePauseOverlay(client);
                        return;
                    }
                }
                origClientUpdate(dt, camera);
                if (this.gameStarted && client.sim) {
                    this.syncLocalPauseState(client);
                }
            };

            const origChoose = client.choose.bind(client);
            client.choose = (idx) => {
                const prevHp = client.sim?.player?.hp ?? 0;
                origChoose(idx);
                if (this.gameStarted && client.sim) {
                    this.sendLoadoutSync(client, client.sim.player.hp > prevHp);
                    this.syncLocalPauseState(client, true);
                }
            };

            const origResolveChest = client.resolveChest.bind(client);
            client.resolveChest = (action) => {
                const prevHp = client.sim?.player?.hp ?? 0;
                origResolveChest(action);
                if (this.gameStarted && client.sim) {
                    this.sendLoadoutSync(client, client.sim.player.hp > prevHp);
                    this.syncLocalPauseState(client, true);
                }
            };

            const origUseItem = client.useItem.bind(client);
            client.useItem = (slot) => {
                const prevHp = client.sim?.player?.hp ?? 0;
                origUseItem(slot);
                if (this.gameStarted && client.sim) {
                    this.sendLoadoutSync(client, client.sim.player.hp > prevHp);
                    this.syncLocalPauseState(client, true);
                }
            };

            const origPause = client.pause.bind(client);
            client.pause = () => {
                origPause();
                if (this.gameStarted && client.sim) {
                    this.syncLocalPauseState(client, true);
                }
            };

            const origResume = client.resume.bind(client);
            client.resume = () => {
                origResume();
                if (this.gameStarted && client.sim) {
                    this.syncLocalPauseState(client, true);
                }
            };

            const origSyncOverlay = client.syncOverlay.bind(client);
            client.syncOverlay = () => {
                origSyncOverlay();
                if (this.gameStarted && client.sim) {
                    this.syncLocalPauseState(client);
                }
            };

            this.clientMethodsHooked = true;
        }

        // Send initial loadout sync from both Host and Guest
        this.sendLoadoutSync(client, true);

        // Hook view.submitActors to render both characters with authentic models and colors
        if (client.view && !this.inGameHooked) {
            const origSubmitActors = client.view.submitActors.bind(client.view);
            client.view.submitActors = (actors, s, alpha) => {
                origSubmitActors(actors, s, alpha);

                // Render Player 2
                if (s.player2) {
                    const p2 = s.player2;
                    const isCorgi = p2.characterId === 'dipper';
                    let model;
                    if (isCorgi) {
                        model = client.assets.get('corgi');
                    } else if (p2.hasDynamicModel && client.assets.get('player2_dynamic')) {
                        model = client.assets.get('player2_dynamic');
                    } else {
                        model = client.assets.get('player_' + p2.characterId) || client.assets.getPlayer();
                    }

                    if (model && model.anims && model.anims.length > 0) {
                        let anim;
                        let frame = 0;
                        if (isCorgi) {
                            anim = p2.moving ? 
                                (model.getAnim(6560) || model.anims[0]) : 
                                (model.getAnim(6561) || model.anims[0]);
                            frame = anim ? anim.getFrame(Math.max(0, s.tick - p2.moveStart)) : 0;
                        } else {
                            const attackAnim = p2.attackSeq !== -1 ? model.getAnim(p2.attackSeq) : null;
                            const isAttacking = Boolean(
                                attackAnim &&
                                attackAnim.seqId === p2.attackSeq &&
                                !p2.moving &&
                                (s.tick - p2.attackStart) >= 0 &&
                                (s.tick - p2.attackStart) < (attackAnim.totalTicks || 15)
                            );
                            if (isAttacking) {
                                anim = attackAnim;
                                frame = anim.getFrame(Math.max(0, s.tick - p2.attackStart), false);
                            } else if (p2.moving) {
                                anim = model.getAnim(824) || model.getAnim(819) || model.anims[0];
                                frame = anim ? anim.getFrame(Math.max(0, s.tick - p2.moveStart)) : 0;
                            } else {
                                anim = model.getAnim(808) || model.anims[0];
                                frame = anim ? anim.getFrame(Math.max(0, s.tick - p2.moveStart)) : 0;
                            }
                        }

                        const px = p2.prevX + (p2.x - p2.prevX) * alpha;
                        const py = p2.prevY + (p2.y - p2.prevY) * alpha;
                        const height = (s.grid ? s.grid.getHeight(px, py) / 128 : 0) - (isCorgi ? 0.22 : 0);

                        // Renders with full vibrant colors: scale 3.0 for Corgi so it is chunky, proud, and clearly visible
                        actors.draw(model, anim, frame, px, height, py, p2.yaw & 2047, {
                            scale: isCorgi ? 3.0 : 1.0,
                            flash: (p2.flash > 0) ? 0.4 : 0,
                            tint: isCorgi ? 16777215 : (p2.tint || 16777215)
                        });
                    }
                }
            };

            // Hook client.view.drawOverlay for mutual player awareness
            // Overhead HP bar, custom nametag, off-screen pointer, and party HUD
            const origDrawOverlay = client.view.drawOverlay.bind(client.view);
            const p2Screen = { x: 0, y: 0, visible: false };
            const p1Screen = { x: 0, y: 0, visible: false };

            client.view.drawOverlay = (overlayRenderer, s, alpha) => {
                origDrawOverlay(overlayRenderer, s, alpha);

                if (overlayRenderer && overlayRenderer.ctx) {
                    const ctx = overlayRenderer.ctx;
                    const w = overlayRenderer.width;
                    const h = overlayRenderer.height;
                    const scale = Math.max(h / 900, 0.75);

                    // 1. Draw Player 1 (Local Player) Name Tag above their overhead HP bar
                    if (s.player && s.player.deathTick === -1) {
                        const p1 = s.player;
                        const px1 = p1.prevX + (p1.x - p1.prevX) * alpha;
                        const py1 = p1.prevY + (p1.y - p1.prevY) * alpha;
                        const isCorgi1 = p1.characterId === 'dipper';
                        const modelH1 = isCorgi1 ? 95 : 200;
                        const groundH1 = s.grid ? s.grid.getHeight(px1, py1) / 128 : 0;
                        const worldH1 = groundH1 - (modelH1 / 128) - (15 / 128);

                        overlayRenderer.project(px1, worldH1, py1, p1Screen);
                        if (p1Screen.visible && p1Screen.y > 20) {
                            ctx.save();
                            ctx.font = `bold ${Math.round(12 * scale)}px "OSRS Bold", monospace, sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = '#000000';
                            const localDisplayName = this.localName.toUpperCase();
                            ctx.strokeText(localDisplayName, p1Screen.x, p1Screen.y - 6);
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(localDisplayName, p1Screen.x, p1Screen.y - 6);
                            ctx.restore();
                        }
                    }

                    // 2. Draw Player 2 (Remote Partner)
                    if (s.player2) {
                        const p2 = s.player2;
                        const px = p2.prevX + (p2.x - p2.prevX) * alpha;
                        const py = p2.prevY + (p2.y - p2.prevY) * alpha;
                        const isCorgi = p2.characterId === 'dipper';
                        const modelHeight = isCorgi ? 95 : 200;
                        const groundHeight = s.grid ? s.grid.getHeight(px, py) / 128 : 0;
                        const worldHeight = groundHeight - (modelHeight / 128) - (15 / 128);

                        overlayRenderer.project(px, worldHeight, py, p2Screen);

                        const displayName = this.remoteName.toUpperCase();
                        const classSub = isCorgi ? 'CORGI' : (p2.characterId || 'WARRIOR').toUpperCase();

                        // Check if Player 2 is visible on screen
                        const margin = 50;
                        const onScreen = p2Screen.visible && p2Screen.x >= margin && p2Screen.x <= w - margin && p2Screen.y >= margin && p2Screen.y <= h - margin;

                        if (onScreen) {
                            const barW = Math.round(34 * scale);
                            const barH = Math.round(6 * scale);
                            const barX = Math.round(p2Screen.x - barW / 2);
                            const barY = Math.round(p2Screen.y - barH * 0.6);

                            const hpRatio = Math.max(0, Math.min(1, p2.hp / (p2.maxHp || 25)));
                            const greenW = Math.floor(barW * hpRatio);

                            // Overhead Health Bar
                            ctx.fillStyle = '#000000';
                            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
                            ctx.fillStyle = '#00ff00';
                            ctx.fillRect(barX, barY, greenW, barH);
                            ctx.fillStyle = '#ff0000';
                            ctx.fillRect(barX + greenW, barY, barW - greenW, barH);

                            // Overhead Name Tag with custom player name
                            ctx.save();
                            ctx.font = `bold ${Math.round(13 * scale)}px "OSRS Bold", monospace, sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = '#000000';
                            const partnerTag = displayName.includes(classSub) ? displayName : `${displayName} (${classSub})`;
                            ctx.strokeText(partnerTag, p2Screen.x, barY - 4);
                            ctx.fillStyle = '#ffff00';
                            ctx.fillText(partnerTag, p2Screen.x, barY - 4);
                            ctx.restore();
                        } else {
                            // Off-screen indicator arrow pointing toward partner
                            const centerX = w / 2;
                            const centerY = h / 2;
                            let targetX = p2Screen.x;
                            let targetY = p2Screen.y;
                            if (!p2Screen.visible) {
                                targetX = centerX - (p2Screen.x - centerX);
                                targetY = centerY - (p2Screen.y - centerY);
                            }

                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const angle = Math.atan2(dy, dx);

                            const pad = 40;
                            const edgeX = Math.min(Math.max(centerX + Math.cos(angle) * (w / 2 - pad), pad), w - pad);
                            const edgeY = Math.min(Math.max(centerY + Math.sin(angle) * (h / 2 - pad), pad), h - pad);

                            const p1 = s.player;
                            const distMeters = Math.round(Math.hypot(p1.x - p2.x, p1.y - p2.y));

                            ctx.save();
                            ctx.translate(edgeX, edgeY);
                            ctx.rotate(angle);

                            // Golden chevron arrow
                            ctx.fillStyle = '#ff981f';
                            ctx.beginPath();
                            ctx.moveTo(12, 0);
                            ctx.lineTo(-8, -8);
                            ctx.lineTo(-4, 0);
                            ctx.lineTo(-8, 8);
                            ctx.closePath();
                            ctx.fill();
                            ctx.lineWidth = 2;
                            ctx.strokeStyle = '#000';
                            ctx.stroke();

                            ctx.restore();

                            // Distance and name label
                            ctx.save();
                            ctx.font = `bold 12px "OSRS Small", monospace`;
                            ctx.textAlign = 'center';
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = '#000';
                            ctx.strokeText(`${displayName} (${distMeters}m)`, edgeX, edgeY + 20);
                            ctx.fillStyle = '#ffff00';
                            ctx.fillText(`${displayName} (${distMeters}m)`, edgeX, edgeY + 20);
                            ctx.restore();
                        }

                        // Update persistent Party HUD widget (located at bottom left to avoid item infographs)
                        this.updatePartyHUD(p2);
                    }
                }
            };

            // Hook CameraRig to dynamically frame both players
            if (client.cameraRig) {
                const origApply = client.cameraRig.apply.bind(client.cameraRig);
                client.cameraRig.apply = (camera, px, py, pz) => {
                    if (client.sim && client.sim.player2) {
                        const p1 = client.sim.player;
                        const p2 = client.sim.player2;
                        const midX = (p1.x + p2.x) / 2;
                        const midZ = (p1.y + p2.y) / 2;
                        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                        client.cameraRig.distance = Math.min(Math.max(18 + dist * 0.45, 16), 34);
                        origApply(camera, midX, py, midZ);
                    } else {
                        origApply(camera, px, py, pz);
                    }
                };
            }

            // Hook client.quitRun to cleanly notify peer
            const origQuitRun = client.quitRun?.bind(client);
            if (origQuitRun) {
                client.quitRun = () => {
                    if (this.gameStarted) {
                        this.send({ type: 'peer_leaving' });
                        this.gameStarted = false;
                        this.localPauseState = null;
                        this.remotePauseState = null;
                        this.removePauseOverlay();
                        const hud = document.getElementById('coop-party-hud');
                        if (hud) hud.remove();
                    }
                    origQuitRun();
                };
            }

            this.inGameHooked = true;
        }

        this.showToast(`Co-Op Run Active! Teammate: ${this.remoteName.toUpperCase()} (${remoteChar.toUpperCase()})`);
    }

    getLocalPauseState(client) {
        if (!client || !client.sim || client.sim.runOver) return null;
        if (client.sim.state === 'chest') return 'chest';
        if (client.sim.state === 'levelUp') return 'levelUp';
        if (client.paused) return 'paused';
        return null;
    }

    syncLocalPauseState(client, force = false) {
        const nextState = this.getLocalPauseState(client);
        if (nextState !== this.localPauseState || force) {
            this.localPauseState = nextState;
            if (this.peerConnected) {
                this.send({
                    type: 'coop_pause',
                    state: nextState,
                    playerName: this.localName
                });
            }
        }
        this.updatePauseOverlay(client);
    }

    removePauseOverlay() {
        const el = document.getElementById('coop-pause-overlay');
        if (el) el.remove();
    }

    updatePauseOverlay(client) {
        if (!this.gameStarted || !client || !client.sim || client.sim.runOver) {
            this.removePauseOverlay();
            return;
        }
        const localState = this.getLocalPauseState(client);
        // If local player has their own Chest / Level-Up / Pause modal open, let them interact with it directly
        if (localState !== null || this.remotePauseState === null) {
            this.removePauseOverlay();
            return;
        }

        let el = document.getElementById('coop-pause-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'coop-pause-overlay';
            el.style.cssText = `
                position: fixed;
                inset: 0;
                z-index: 9500;
                zoom: var(--ui-scale, 1);
                background: rgba(0, 0, 0, 0.58);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: auto;
                user-select: none;
            `;
            document.body.appendChild(el);
        }

        const partnerName = escapeHtml(this.remoteName.toUpperCase());
        let titleText = 'CO-OP PAUSED';
        let bodyText = `Waiting for ${partnerName}...`;
        let showResumeBtn = false;

        if (this.remotePauseState === 'chest') {
            titleText = 'TREASURE CASKET';
            bodyText = `${partnerName} is opening a treasure casket...`;
        } else if (this.remotePauseState === 'levelUp') {
            titleText = 'LEVEL UP!';
            bodyText = `${partnerName} is choosing a level-up reward...`;
        } else if (this.remotePauseState === 'paused') {
            titleText = 'GAME PAUSED';
            bodyText = `${partnerName} paused the game.`;
            showResumeBtn = true;
        }

        const stateKey = `${this.remotePauseState}:${partnerName}`;
        if (el.dataset.stateKey !== stateKey) {
            el.dataset.stateKey = stateKey;
            el.innerHTML = `
                <div class="ui-panel rs-border rs-background" style="
                    padding: 24px 36px;
                    text-align: center;
                    max-width: 440px;
                    font-family: 'OSRS Bold', monospace;
                    color: #ff981f;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.85);
                ">
                    <h2 style="margin: 0 0 10px 0; font-size: 24px; color: #ffff00; text-shadow: 2px 2px #000;">${titleText}</h2>
                    <p style="margin: 0 0 ${showResumeBtn ? '18px' : '4px'} 0; font-size: 16px; color: #ffffff; text-shadow: 1px 1px #000;">${bodyText}</p>
                    <p style="margin: 0; font-size: 12px; color: #b8a890;">Simulation paused for both players to stay in sync</p>
                    ${showResumeBtn ? `
                        <div style="margin-top: 16px;">
                            <button id="coop-remote-resume-btn" class="ui-button ui-button-go" style="padding: 8px 24px; cursor: pointer;">Resume Co-Op</button>
                        </div>
                    ` : ''}
                </div>
            `;
            const resumeBtn = el.querySelector('#coop-remote-resume-btn');
            if (resumeBtn) {
                resumeBtn.addEventListener('click', () => {
                    this.remotePauseState = null;
                    this.removePauseOverlay();
                    this.send({ type: 'coop_pause', state: null, action: 'resume_both' });
                });
            }
        }
    }

    sendLoadoutSync(client, healed = false) {
        if (!client || !client.sim || !this.peerConnected) return;
        const sim = client.sim;
        try {
            client.updateHud?.(true);
        } catch (err) {}
        const hud = client.store?.getSnapshot()?.hud;

        const weapons = (sim.weapons || []).map((w, idx) => {
            const hw = hud?.weapons?.[idx];
            const lvlDef = w.def?.levels?.[(w.level || 1) - 1];
            return {
                id: w.def?.id || 'scimitar',
                name: String(hw?.name || lvlDef?.name || w.def?.name || 'Weapon').slice(0, 48),
                level: Number(w.level) || 1,
                maxLevel: Number(w.def?.levels?.length) || 8,
                bonus: Number(w.bonus) || 0,
                iconObjId: Number(hw?.iconObjId ?? lvlDef?.objId ?? w.def?.iconObjId) || 0,
                rarityColor: String(hw?.rarityColor || '#ff981f').slice(0, 16)
            };
        });

        const passives = (hud?.passives || []).slice(0, 8).map(p => ({
            id: String(p.id || '').slice(0, 40),
            name: String(p.name || p.id || 'Passive').slice(0, 48),
            level: Number(p.level) || 1,
            maxLevel: Number(p.maxLevel) || 5,
            iconObjId: Number(p.iconObjId) || 0,
            rarityColor: String(p.rarityColor || '#ff981f').slice(0, 16)
        }));

        const gear = (hud?.gear || []).slice(0, 8).map(g => ({
            slot: String(g.slot || '').slice(0, 24),
            slotName: String(g.name || 'Slot').slice(0, 24),
            item: g.item ? {
                id: String(g.item.id || '').slice(0, 40),
                name: String(g.item.name || 'Gear').slice(0, 48),
                iconObjId: Number(g.item.objId) || 0,
                rarityColor: String(g.item.rarity?.color || '#ff981f').slice(0, 16)
            } : null
        }));

        const inventory = (hud?.inventory || [null, null, null, null]).slice(0, 4).map(slot => {
            if (!slot || !slot.item) return null;
            return {
                id: String(slot.item.id || '').slice(0, 40),
                name: String(slot.item.name || 'Item').slice(0, 48),
                iconObjId: Number(slot.item.objId) || 0,
                count: Math.max(1, Math.round(Number(slot.count) || 1)),
                rarityColor: String(slot.item.rarity?.color || '#ff981f').slice(0, 16)
            };
        });

        let appearance = null;
        if (client.getSimAppearance && sim.characterId !== 'dipper') {
            try {
                appearance = client.getSimAppearance(sim);
            } catch (err) {
                console.warn('[Multiplayer] Failed getting local appearance:', err);
            }
        }
        this.send({
            type: 'coop_loadout',
            weapons,
            passives,
            gear,
            inventory,
            appearance,
            hp: Math.round(sim.player.hp),
            maxHp: Math.round(sim.player.maxHp),
            healed: Boolean(healed)
        });
    }

    async bakePlayer2Appearance(client, appearance) {
        if (!client || !client.assets || !appearance || !Array.isArray(appearance.equipment)) return;
        const equipKey = appearance.equipment.join(',');
        if (this.lastP2EquipKey === equipKey && client.assets.models.has('player2_dynamic')) {
            if (client.sim?.player2) client.sim.player2.hasDynamicModel = true;
            return;
        }
        this.lastP2EquipKey = equipKey;
        const seqIds = this.playerSeqIds || [
            808, 819, 824, 836,
            386, 390, 401, 426, 711, 806, 811, 1167, 1378, 1658, 1979,
            2614, 2661, 4230, 5061, 7638, 7640, 7642, 7644, 7855, 8056, 9493
        ];
        try {
            const bakeRes = await client.assets.bake([{
                kind: 'player',
                key: 'player2_dynamic',
                appearance: {
                    gender: appearance.gender === 1 ? 1 : 0,
                    colors: Array.isArray(appearance.colors) ? appearance.colors.slice(0, 5).map(n => Number(n) || 0) : [0, 0, 0, 0, 0],
                    kits: Array.isArray(appearance.kits) ? appearance.kits.slice(0, 7).map(n => Number(n) || 0) : [0, 10, 18, 26, 33, 36, 42],
                    equipment: appearance.equipment.slice(0, 12).map(n => Number.isFinite(Number(n)) ? Math.round(Number(n)) : -1)
                },
                seqIds
            }]);
            if (bakeRes.loadedTextures?.length > 0) {
                client.assets.renderer.updateTextureArray(bakeRes.loadedTextures);
            }
            const added = client.assets.actors.addBake(bakeRes);
            for (const [k, v] of added) {
                client.assets.models.set(k, v);
            }
            if (client.sim?.player2) {
                client.sim.player2.hasDynamicModel = true;
            }
        } catch (err) {
            console.warn('[Multiplayer] Failed baking dynamic Player 2 model:', err);
        }
    }

    applyRemoteLoadout(msg) {
        const client = window.gameClient;
        if (!client || !client.sim || !client.sim.player2 || !msg || typeof msg !== 'object') return;
        const sim = client.sim;
        const p2 = sim.player2;

        if (Number.isFinite(Number(msg.maxHp))) {
            const newMaxHp = Math.max(1, Math.min(1000, Math.round(Number(msg.maxHp))));
            if (newMaxHp > p2.maxHp) {
                p2.hp = Math.min(newMaxHp, p2.hp + (newMaxHp - p2.maxHp));
            }
            p2.maxHp = newMaxHp;
        }
        if (msg.healed && Number.isFinite(Number(msg.hp))) {
            p2.hp = Math.max(p2.hp, Math.min(p2.maxHp, Math.round(Number(msg.hp))));
        }

        if (Array.isArray(msg.weapons) && msg.weapons.length > 0 && msg.weapons.length <= 8) {
            const savedWeapons = sim.weapons;
            const built = [];
            try {
                for (const w of msg.weapons) {
                    if (!w || typeof w.id !== 'string') continue;
                    const cleanId = w.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
                    sim.weapons = [];
                    sim.addWeapon(cleanId, Number.isFinite(Number(w.bonus)) ? Number(w.bonus) : 0);
                    if (sim.weapons.length > 0) {
                        const inst = sim.weapons[0];
                        const maxLvl = inst.def?.levels?.length || 8;
                        inst.level = Math.max(1, Math.min(maxLvl, Math.round(Number(w.level) || 1)));
                        inst.cooldown = Math.min(inst.cooldown || 10, 10);
                        built.push(inst);
                    }
                }
            } catch (err) {
                console.warn('[Multiplayer] Error syncing Player 2 weapons:', err);
            } finally {
                sim.weapons = savedWeapons;
            }
            if (built.length > 0) {
                sim.player2Weapons = built;
            }

            this.remoteLoadout.weapons = msg.weapons.slice(0, 6).map(w => ({
                id: String(w.id || ''),
                name: String(w.name || w.id || 'Weapon'),
                level: Math.max(1, Math.round(Number(w.level) || 1)),
                maxLevel: Math.max(1, Math.round(Number(w.maxLevel) || 8)),
                iconObjId: Number(w.iconObjId) || 0,
                rarityColor: String(w.rarityColor || '#ff981f')
            }));
        }

        if (Array.isArray(msg.passives)) {
            this.remoteLoadout.passives = msg.passives.slice(0, 6).map(p => ({
                id: String(p?.id || ''),
                name: String(p?.name || p?.id || 'Passive'),
                level: Math.max(1, Math.round(Number(p?.level) || 1)),
                maxLevel: Math.max(1, Math.round(Number(p?.maxLevel) || 5)),
                iconObjId: Number(p?.iconObjId) || 0,
                rarityColor: String(p?.rarityColor || '#ff981f')
            }));
        }

        if (Array.isArray(msg.gear)) {
            this.remoteLoadout.gear = msg.gear.slice(0, 8).map(g => ({
                slot: String(g?.slot || ''),
                slotName: String(g?.slotName || 'Slot'),
                item: g?.item ? {
                    id: String(g.item.id || ''),
                    name: String(g.item.name || 'Gear'),
                    iconObjId: Number(g.item.iconObjId) || 0,
                    rarityColor: String(g.item.rarityColor || '#ff981f')
                } : null
            }));
        }

        if (Array.isArray(msg.inventory)) {
            this.remoteLoadout.inventory = [0, 1, 2, 3].map(idx => {
                const slot = msg.inventory[idx];
                if (!slot || typeof slot !== 'object') return null;
                return {
                    id: String(slot.id || ''),
                    name: String(slot.name || 'Item'),
                    iconObjId: Number(slot.iconObjId) || 0,
                    count: Math.max(1, Math.round(Number(slot.count) || 1)),
                    rarityColor: String(slot.rarityColor || '#ff981f')
                };
            });
        }

        this.loadoutVersion = (this.loadoutVersion || 0) + 1;
        this.lastPartyHudKey = '';

        if (msg.appearance && p2.characterId !== 'dipper') {
            this.bakePlayer2Appearance(client, msg.appearance);
        }
    }

    applyCoopPickup(msg) {
        const client = window.gameClient;
        if (!client || !client.sim || !msg || typeof msg !== 'object') return;
        const sim = client.sim;
        const kind = msg.kind;
        const val = Number.isFinite(Number(msg.value)) ? Number(msg.value) : 0;

        if (kind === 'bones' || kind === 'big_bones') {
            if (val <= 0) return;
            sim.xp += val * (1 + (sim.stats?.growth || 0));
            client.sounds?.onEvents(sim, [{ type: 'pickup', kind, value: val }]);
            sim.checkLevelUp();
            if (sim.state !== 'playing') {
                client.accumulator = 0;
                client.syncOverlay();
                this.syncLocalPauseState(client, true);
            }
            client.updateHud(true);
        } else if (kind === 'coins') {
            if (val <= 0) return;
            sim.coins += Math.round(val * (1 + (sim.stats?.greed || 0)));
            client.sounds?.onEvents(sim, [{ type: 'pickup', kind: 'coins', value: val }]);
            client.updateHud(false);
        } else if (kind === 'food') {
            if (val <= 0) return;
            sim.heal(val);
            client.sounds?.onEvents(sim, [{ type: 'pickup', kind: 'food', value: val }]);
            client.updateHud(true);
        } else if (kind === 'casket') {
            const allowedTiers = new Set(['beginner', 'easy', 'medium', 'hard', 'elite', 'master']);
            const tier = (typeof msg.tier === 'string' && allowedTiers.has(msg.tier)) ? msg.tier : 'medium';
            this.nextChestExcludeId = (typeof msg.excludeItemId === 'string' && msg.excludeItemId) ? msg.excludeItemId : undefined;
            try {
                sim.openCasket(tier);
            } finally {
                this.nextChestExcludeId = undefined;
            }
            client.accumulator = 0;
            client.handleEvents(sim, sim.takeEvents());
            client.syncOverlay();
            client.updateHud(true);
            this.syncLocalPauseState(client, true);
        } else if (kind === 'powerUp') {
            if (typeof msg.message === 'string' && msg.message) {
                client.store?.toast(msg.message.slice(0, 80));
            }
        }
    }

    getIconUrl(objId) {
        const id = Math.round(Number(objId) || 0);
        if (id <= 0) return null;
        const cache = window.gameClient?.iconCache;
        if (!cache) return null;
        const existing = cache.get(id, 1);
        if (existing) return existing;
        if (!this.pendingIcons.has(id)) {
            this.pendingIcons.add(id);
            cache.request(id, 1, () => {
                this.pendingIcons.delete(id);
                this.loadoutVersion = (this.loadoutVersion || 0) + 1;
                this.lastPartyHudKey = '';
            });
        }
        return null;
    }

    // Partner HUD widget on the bottom-right showing Partner HP, Weapons, Passives, Worn Gear, and Inventory (1-4)
    updatePartyHUD(p2) {
        let hud = document.getElementById('coop-party-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'coop-party-hud';
            hud.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 99;
                zoom: var(--ui-scale, 1);
                background: rgba(22, 17, 12, 0.94);
                border: 2px solid #5a4a35;
                outline: 1px solid #120e0a;
                padding: 8px 12px;
                border-radius: 4px;
                color: #ff981f;
                font-family: 'OSRS Bold', monospace;
                box-shadow: 0 4px 16px rgba(0,0,0,0.8);
                display: flex;
                flex-direction: column;
                gap: 4px;
                pointer-events: auto;
                min-width: 192px;
                user-select: none;
            `;
            document.body.appendChild(hud);
        }

        const hp = Math.max(0, Math.round(Number(p2.hp) || 0));
        const maxHp = Math.max(1, Math.round(Number(p2.maxHp) || 25));
        const fastKey = `${p2.characterId}:${this.remoteName}:${hp}:${maxHp}:${this.loadoutVersion || 0}`;
        if (this.lastPartyHudFastKey === fastKey) return;
        this.lastPartyHudFastKey = fastKey;

        const isCorgi = p2.characterId === 'dipper';
        const charName = escapeHtml(isCorgi ? 'CORGI' : (p2.characterId || 'WARRIOR').replace(/_/g, ' ').toUpperCase());
        const displayName = escapeHtml(this.remoteName.toUpperCase());
        const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
        const hpPercent = Math.round(hpRatio * 100);
        const barColor = hpRatio > 0.5 ? '#00ff00' : (hpRatio > 0.25 ? '#ffff00' : '#ff0000');

        const loadout = this.remoteLoadout || { weapons: [], passives: [], gear: [], inventory: [null, null, null, null] };

        // Fallback to sim.player2Weapons if remoteLoadout.weapons has not arrived yet
        const simP2Weapons = (window.gameClient?.sim?.player2Weapons || []).map(w => {
            const lvlDef = w.def?.levels?.[(w.level || 1) - 1];
            return {
                id: w.def?.id || 'weapon',
                name: lvlDef?.name || w.def?.name || 'Weapon',
                level: w.level || 1,
                maxLevel: w.def?.levels?.length || 8,
                iconObjId: lvlDef?.objId ?? w.def?.iconObjId ?? 0,
                rarityColor: '#ff981f'
            };
        });
        const weapons = loadout.weapons.length > 0 ? loadout.weapons : simP2Weapons;
        const passives = loadout.passives || [];
        const gear = loadout.gear || [];
        const inventory = loadout.inventory || [null, null, null, null];

        // Resolve icon URLs and build state key so we only update innerHTML when state or icons change
        const weaponUrls = [0, 1, 2, 3].map(i => weapons[i] ? (this.getIconUrl(weapons[i].iconObjId) || '') : '');
        const passiveUrls = [0, 1, 2, 3].map(i => passives[i] ? (this.getIconUrl(passives[i].iconObjId) || '') : '');
        const gearUrls = gear.map(g => g?.item ? (this.getIconUrl(g.item.iconObjId) || '') : '');
        const invUrls = [0, 1, 2, 3].map(i => inventory[i] ? (this.getIconUrl(inventory[i].iconObjId) || '') : '');

        const stateKey = JSON.stringify({
            displayName,
            charName,
            hp,
            maxHp,
            w: weapons.map((x, i) => [x.id, x.level, Boolean(weaponUrls[i])]),
            p: passives.map((x, i) => [x.id, x.level, Boolean(passiveUrls[i])]),
            g: gear.map((x, i) => [x.slot, x.item?.id || '', Boolean(gearUrls[i])]),
            inv: inventory.map((x, i) => x ? [x.id, x.count, Boolean(invUrls[i])] : null)
        });

        if (this.lastPartyHudKey === stateKey) return;
        this.lastPartyHudKey = stateKey;

        const renderMiniSlot = (entry, iconUrl, size = 28, badgeText = '', emptyLabel = '') => {
            const border = entry ? escapeHtml(entry.rarityColor || '#8a7558') : '#3d3123';
            const title = entry ? escapeHtml(`${entry.name}${badgeText ? ` (${badgeText})` : ''}`) : escapeHtml(emptyLabel);
            return `
                <div title="${title}" style="
                    position: relative;
                    width: ${size}px;
                    height: ${size}px;
                    background: #14100b;
                    border: 1px solid ${border};
                    border-radius: 3px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                ">
                    ${iconUrl ? `<img src="${iconUrl}" width="${size - 4}" height="${size - 4}" style="image-rendering: pixelated; pointer-events: none;" alt="" />` : (
                        entry ? `<span style="font-size: 9px; color: #ff981f; text-align: center; line-height: 1;">${escapeHtml(entry.name.slice(0, 3).toUpperCase())}</span>` : (
                            emptyLabel ? `<span style="font-size: 9px; color: #554736;">${escapeHtml(emptyLabel[0])}</span>` : ''
                        )
                    )}
                    ${badgeText ? `
                        <span style="
                            position: absolute;
                            bottom: 0px;
                            right: 2px;
                            font-size: 9px;
                            color: #ffff00;
                            text-shadow: 1px 1px 0 #000, -1px -1px 0 #000;
                            line-height: 1;
                        ">${escapeHtml(badgeText)}</span>
                    ` : ''}
                </div>
            `;
        };

        const weaponsRow = [0, 1, 2, 3].map(i => {
            const w = weapons[i];
            const lvl = w ? (w.level >= w.maxLevel ? 'max' : String(w.level)) : '';
            return renderMiniSlot(w, weaponUrls[i], 30, lvl, 'Weapon slot');
        }).join('');

        const passivesRow = [0, 1, 2, 3].map(i => {
            const p = passives[i];
            const lvl = p ? (p.level >= p.maxLevel ? 'max' : String(p.level)) : '';
            return renderMiniSlot(p, passiveUrls[i], 26, lvl, 'Passive slot');
        }).join('');

        const defaultGearSlots = [
            { slot: 'head', slotName: 'Head', item: null },
            { slot: 'cape', slotName: 'Cape', item: null },
            { slot: 'amulet', slotName: 'Neck', item: null },
            { slot: 'body', slotName: 'Body', item: null },
            { slot: 'legs', slotName: 'Legs', item: null },
            { slot: 'hands', slotName: 'Hands', item: null }
        ];
        const gearList = gear.length > 0 ? gear.slice(0, 6) : defaultGearSlots;
        const gearRow = gearList.map((g, i) => {
            return renderMiniSlot(g.item, gearUrls[i] || '', 26, '', g.slotName || 'Gear');
        }).join('');

        const invRow = [0, 1, 2, 3].map(i => {
            const item = inventory[i];
            const countBadge = item && item.count > 1 ? String(item.count) : '';
            return renderMiniSlot(item, invUrls[i], 30, countBadge, `${i + 1}`);
        }).join('');

        hud.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
                <span style="color: #ff981f; letter-spacing: 1px;">CO-OP PARTNER</span>
                <span style="color: #00ff00; font-size: 9px;">● ONLINE</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
                <span style="font-size: 13px; color: #ffffff; text-shadow: 1px 1px #000;">${displayName}</span>
                <span style="font-size: 10px; color: #ff981f;">${charName}</span>
            </div>
            <div style="background: #2b0000; border: 1px solid #4a3c2c; height: 9px; border-radius: 2px; overflow: hidden;">
                <div style="background: ${barColor}; width: ${hpPercent}%; height: 100%; transition: width 0.15s ease-out;"></div>
            </div>
            <div style="font-size: 10px; color: #bbb; text-align: right; margin-bottom: 2px;">${hp} / ${maxHp} HP</div>

            <div style="border-top: 1px solid #3d3123; padding-top: 4px; display: flex; flex-direction: column; gap: 3px;">
                <div style="font-size: 9px; color: #b8a890; letter-spacing: 0.5px;">WEAPONS &amp; PASSIVES</div>
                <div style="display: flex; gap: 3px;">${weaponsRow}</div>
                <div style="display: flex; gap: 3px;">${passivesRow}</div>
            </div>

            <div style="border-top: 1px solid #3d3123; padding-top: 4px; display: flex; flex-direction: column; gap: 3px;">
                <div style="font-size: 9px; color: #b8a890; letter-spacing: 0.5px;">WORN GEAR &amp; INVENTORY</div>
                <div style="display: flex; gap: 3px;">${gearRow}</div>
                <div style="display: flex; gap: 3px;">${invRow}</div>
            </div>
        `;
    }

    endGameOnDisconnect(reason) {
        if (!this.gameStarted) return;
        this.gameStarted = false;
        this.localPauseState = null;
        this.remotePauseState = null;
        this.removePauseOverlay();
        this.showToast(reason);

        const hud = document.getElementById('coop-party-hud');
        if (hud) hud.remove();

        const client = window.gameClient;
        if (client && client.sim) {
            try {
                client.sounds?.playerDied();
                client.sim.endRun('dead');
                client.finishRun();
                client.store.set({
                    overlay: 'dead',
                    choices: [],
                    chest: undefined
                });
                client.updateHud(true);
            } catch (err) {
                console.error('[Multiplayer] Error ending run on disconnect:', err);
            }
        }
    }

    stepPlayer2Pickups(sim, p2) {
        if (!sim.pickups || sim.pickups.length === 0) return;
        const client = window.gameClient;
        const magnet = 2.5 * (1 + (sim.stats?.magnet || 0));
        for (const pickup of sim.pickups) {
            if (pickup.value < 0) continue;
            const dx = p2.x - pickup.x;
            const dy = p2.y - pickup.y;
            const dist = Math.hypot(dx, dy);
            const magnetic = pickup.kind !== 'casket' && pickup.kind !== 'powerUp';
            if (!pickup.attracted && !pickup.attractedP2 && magnetic && dist < magnet) {
                pickup.attractedP2 = true;
                pickup.speedP2 = 0.05;
            }
            if (pickup.attractedP2 && dist > 0.001) {
                pickup.speedP2 = Math.min((pickup.speedP2 || 0.05) + 0.02, 0.6);
                const step = Math.min(pickup.speedP2, dist);
                pickup.x += (dx / dist) * step;
                pickup.y += (dy / dist) * step;
            }
            if (dist < 0.6) {
                const origVal = pickup.value;
                pickup.value = -1;
                if (pickup.kind === 'bones' || pickup.kind === 'big_bones' || pickup.kind === 'coins') {
                    // Shared XP and coins: apply on Host (which also broadcasts coop_pickup to Guest)
                    pickup.value = origVal;
                    sim.collect(pickup);
                    pickup.value = -1;
                    sim.checkLevelUp();
                    if (sim.state !== 'playing' && client) {
                        client.accumulator = 0;
                        client.syncOverlay();
                        this.syncLocalPauseState(client, true);
                    }
                } else if (pickup.kind === 'food') {
                    p2.hp = Math.min(p2.maxHp, p2.hp + origVal);
                    this.send({
                        type: 'coop_pickup',
                        kind: 'food',
                        value: origVal
                    });
                } else if (pickup.kind === 'casket') {
                    // Casket collected by Player 2 prompts BOTH Host and Guest with independent, unique item rolls
                    const tier = pickup.tier || 'medium';
                    sim.openCasket(tier);
                    const latestChest = sim.chests && sim.chests.length > 0 ? sim.chests[sim.chests.length - 1] : null;
                    this.remotePauseState = 'chest';
                    this.send({
                        type: 'coop_pickup',
                        kind: 'casket',
                        tier: tier,
                        excludeItemId: latestChest?.itemId || undefined
                    });
                    if (client) {
                        client.accumulator = 0;
                        this.syncLocalPauseState(client, true);
                    }
                } else if (pickup.kind === 'powerUp') {
                    const savedPlayer = sim.player;
                    sim.player = p2;
                    try {
                        if (sim._origCollect) {
                            sim._origCollect({ ...pickup, value: origVal });
                        } else {
                            sim.collect({ ...pickup, value: origVal });
                        }
                    } finally {
                        sim.player = savedPlayer;
                    }
                    this.send({
                        type: 'coop_pickup',
                        kind: 'powerUp',
                        message: `${this.remoteName} activated a power-up!`
                    });
                }
            }
        }
        sim.pickups = sim.pickups.filter(p => p.value >= 0);
    }

    applyWorldSync(msg) {
        const client = window.gameClient;
        if (!client || !client.sim) return;
        const sim = client.sim;

        // 0. Synchronize simulation clock, kills, and remote pause state
        if (Number.isFinite(Number(msg.tick)) && msg.tick >= 0) {
            sim.tick = Math.round(Number(msg.tick));
        }
        if (Number.isFinite(Number(msg.kills)) && msg.kills >= 0) {
            sim.kills = Math.round(Number(msg.kills));
        }
        if (msg.pauseState !== undefined) {
            const allowedStates = new Set(['levelUp', 'chest', 'paused']);
            const nextRemote = (typeof msg.pauseState === 'string' && allowedStates.has(msg.pauseState)) ? msg.pauseState : null;
            if (nextRemote !== this.remotePauseState) {
                this.remotePauseState = nextRemote;
                client.accumulator = 0;
                this.updatePauseOverlay(client);
            }
        }

        // 1. Synchronize player states (Host -> Guest)
        if (sim.player2) {
            if (Number.isFinite(msg.x) && Number.isFinite(msg.y)) {
                const targetX = Math.max(0, Math.min(16384, msg.x));
                const targetY = Math.max(0, Math.min(16384, msg.y));
                sim.player2.targetX = targetX;
                sim.player2.targetY = targetY;
                if (Math.hypot(targetX - sim.player2.x, targetY - sim.player2.y) > 4.0) {
                    sim.player2.prevX = targetX;
                    sim.player2.prevY = targetY;
                    sim.player2.x = targetX;
                    sim.player2.y = targetY;
                }
            }
            if (Number.isFinite(msg.yaw)) {
                sim.player2.yaw = Math.round(msg.yaw) & 2047;
            }
            if (Number.isFinite(msg.facingX) && Number.isFinite(msg.facingY)) {
                sim.player2.facingX = msg.facingX;
                sim.player2.facingY = msg.facingY;
            }
            if (typeof msg.moving === 'boolean') {
                if (msg.moving !== sim.player2.moving) {
                    sim.player2.moveStart = Number.isFinite(msg.moveStart) ? msg.moveStart : sim.tick;
                }
                sim.player2.moving = msg.moving;
            }
            if (Number.isFinite(msg.attackSeq) && msg.attackSeq !== -1) {
                sim.player2.attackSeq = msg.attackSeq;
                if (Number.isFinite(msg.attackStart)) {
                    sim.player2.attackStart = msg.attackStart;
                }
            }
            if (Number.isFinite(Number(msg.p1Hp))) {
                sim.player2.hp = Math.max(0, Number(msg.p1Hp));
                if (Number.isFinite(Number(msg.p1MaxHp))) {
                    sim.player2.maxHp = Math.max(1, Math.round(Number(msg.p1MaxHp)));
                }
            }
        }

        if (sim.player) {
            if (Number.isFinite(Number(msg.p2Hp))) {
                sim.player.hp = Math.max(0, Number(msg.p2Hp));
                if (Number.isFinite(Number(msg.p2MaxHp))) {
                    sim.player.maxHp = Math.max(1, Math.round(Number(msg.p2MaxHp)));
                }
                if (sim.player.hp <= 0 && !sim.runOver) {
                    this.endGameOnDisconnect('You have died - Game Over');
                }
            }
        }

        // 2. Synchronize monsters
        if (msg.enemies && Array.isArray(msg.enemies)) {
            const existingMap = new Map();
            for (let i = 0; i < sim.enemies.length; i++) {
                existingMap.set(sim.enemies[i].uid, sim.enemies[i]);
            }

            const hostUids = new Set();
            for (let i = 0; i < msg.enemies.length; i++) {
                const item = msg.enemies[i];
                const [
                    uid, defId, x, y, hp, maxHp, yaw, dead, anim, animStart, flash, scale, kindFlag
                ] = item;
                hostUids.add(uid);

                let enemy = existingMap.get(uid);
                if (enemy) {
                    // Update positions with smooth interpolation support
                    enemy.prevX = enemy.x;
                    enemy.prevY = enemy.y;
                    enemy.x = x;
                    enemy.y = y;
                    enemy.hp = hp;
                    enemy.maxHp = maxHp;
                    enemy.yaw = yaw;
                    if (dead && !enemy.dead) {
                        enemy.deathTick = sim.tick;
                    }
                    enemy.dead = !!dead;
                    enemy.anim = anim;
                    enemy.animStart = animStart;
                    enemy.flash = flash;
                    enemy.scale = scale;
                } else {
                    const def = client.getEnemyDef ? client.getEnemyDef(defId) : null;
                    if (def) {
                        const kind = kindFlag === 1 ? 'elite' : (kindFlag === 2 ? 'boss' : 'normal');
                        try {
                            enemy = sim.spawnEnemy(def, kind, { x, y });
                            if (enemy) {
                                enemy.uid = uid;
                                enemy.x = x;
                                enemy.y = y;
                                enemy.prevX = x;
                                enemy.prevY = y;
                                enemy.hp = hp;
                                enemy.maxHp = maxHp;
                                enemy.yaw = yaw;
                                enemy.dead = !!dead;
                                if (enemy.dead) {
                                    enemy.deathTick = sim.tick;
                                }
                                enemy.anim = anim;
                                enemy.animStart = animStart;
                                enemy.flash = flash;
                                enemy.scale = scale;
                            }
                        } catch (err) {
                            console.warn('[Multiplayer] Failed spawning synced enemy:', defId, err);
                        }
                    }
                }
            }

            // Cull removed enemies while allowing dead enemies to finish their 45-tick death animation locally
            sim.enemies = sim.enemies.filter(e => hostUids.has(e.uid) || (e.dead && (sim.tick - (e.deathTick || 0) < 45)));

            // Rebuild spatial hash so guest weapons and radar target the synced enemies
            if (sim.rebuildEnemyHash) {
                sim.rebuildEnemyHash();
            }
        }

        // 3. Synchronize pickups
        if (msg.pickups && Array.isArray(msg.pickups)) {
            const pickupMap = new Map();
            for (let i = 0; i < sim.pickups.length; i++) {
                pickupMap.set(sim.pickups[i].uid, sim.pickups[i]);
            }

            const hostPickupUids = new Set();
            for (let i = 0; i < msg.pickups.length; i++) {
                const [uid, kind, px, py, val, tier, powerUp] = msg.pickups[i];
                hostPickupUids.add(uid);
                let p = pickupMap.get(uid);
                if (p) {
                    p.prevX = p.x;
                    p.prevY = p.y;
                    p.x = px;
                    p.y = py;
                    p.value = val;
                    if (tier) p.tier = tier;
                    if (powerUp) p.powerUp = powerUp;
                } else {
                    sim.pickups.push({
                        uid: uid,
                        kind: kind,
                        x: px,
                        y: py,
                        prevX: px,
                        prevY: py,
                        value: val,
                        tier: tier || undefined,
                        powerUp: powerUp || undefined,
                        attracted: false,
                        speed: 0,
                        spawnTick: sim.tick
                    });
                }
            }

            sim.pickups = sim.pickups.filter(p => hostPickupUids.has(p.uid));
        }
    }

    applyRemoteInput(p2, msg) {
        if (!msg || typeof msg !== 'object') return;
        const moveX = Number.isFinite(msg.moveX) ? Math.max(-1, Math.min(1, msg.moveX)) : 0;
        const moveY = Number.isFinite(msg.moveY) ? Math.max(-1, Math.min(1, msg.moveY)) : 0;
        this.remoteInput = { moveX, moveY, tick: Number.isFinite(msg.tick) ? msg.tick : 0 };

        if (Number.isFinite(msg.x) && Number.isFinite(msg.y)) {
            const targetX = Math.max(0, Math.min(16384, msg.x));
            const targetY = Math.max(0, Math.min(16384, msg.y));
            const dx = targetX - p2.x;
            const dy = targetY - p2.y;
            const dist = Math.hypot(dx, dy);
            const maxStep = 6.0;
            if (dist <= maxStep) {
                p2.targetX = targetX;
                p2.targetY = targetY;
            } else if (dist > 0) {
                p2.targetX = p2.x + (dx / dist) * maxStep;
                p2.targetY = p2.y + (dy / dist) * maxStep;
            }
        }

        if (Number.isFinite(msg.facingX) && Number.isFinite(msg.facingY)) {
            p2.facingX = Math.max(-1, Math.min(1, msg.facingX));
            p2.facingY = Math.max(-1, Math.min(1, msg.facingY));
        } else if (moveX !== 0 || moveY !== 0) {
            const len = Math.hypot(moveX, moveY);
            p2.facingX = moveX / len;
            p2.facingY = moveY / len;
        }

        if (Number.isFinite(msg.yaw)) {
            p2.yaw = Math.round(msg.yaw) & 2047;
        } else if (moveX !== 0 || moveY !== 0) {
            // Exact OSRS Qi(dx, dy) yaw formula
            p2.yaw = Math.round(Math.atan2(-moveX, -moveY) / (2 * Math.PI) * 2048) & 2047;
        }

        const moving = typeof msg.moving === 'boolean' ? msg.moving : (moveX !== 0 || moveY !== 0);
        if (moving !== p2.moving) {
            p2.moveStart = Number.isFinite(msg.moveStart) ? msg.moveStart : (window.gameClient?.sim?.tick || 0);
        }
        p2.moving = moving;

        if (Number.isFinite(msg.attackSeq) && msg.attackSeq !== -1) {
            p2.attackSeq = msg.attackSeq;
            if (Number.isFinite(msg.attackStart)) {
                p2.attackStart = msg.attackStart;
            }
        }
    }

    stepPlayer2(sim, p2) {
        if (p2.flash > 0) p2.flash--;
        if (p2.invulnerable > 0) p2.invulnerable--;

        // Advance previous position once per simulation tick for smooth frame interpolation
        p2.prevX = p2.x;
        p2.prevY = p2.y;
        if (Number.isFinite(p2.targetX) && Number.isFinite(p2.targetY)) {
            p2.x = p2.targetX;
            p2.y = p2.targetY;
        }

        if (this.role === 'host') {
            const input = this.remoteInput;
            const moveX = input.moveX || 0;
            const moveY = input.moveY || 0;
            if (moveX !== 0 || moveY !== 0) {
                const len = Math.hypot(moveX, moveY);
                p2.facingX = moveX / len;
                p2.facingY = moveY / len;
                p2.yaw = Math.round(Math.atan2(-moveX, -moveY) / (2 * Math.PI) * 2048) & 2047;
            }
        }
    }

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

    openLobbyModal(roomId = null) {
        const cleanRoom = sanitizeRoomId(roomId) || MultiplayerManager.generateRoomId();
        this.connect(cleanRoom);
        this.renderLobbyModal();
    }

    closeLobbyModal() {
        if (this.modalEl && this.modalEl.parentNode) {
            this.modalEl.parentNode.removeChild(this.modalEl);
            this.modalEl = null;
        }
    }

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
            padding: 24px 32px;
            width: min(640px, calc(92vw / var(--ui-scale, 1)));
            max-height: calc(90vh / var(--ui-scale, 1));
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

    updateLobbyUI() {
        if (!this.modalEl) return;
        const box = this.modalEl.firstElementChild;
        if (!box) return;

        const isHost = this.role === 'host' || this.role === null;
        const safeRoomId = escapeHtml(this.roomId || 'CONNECTING...');
        const safeInviteLink = escapeHtml(this.getInviteLink());
        const safeLocalName = escapeHtml(this.localName);
        const safeRemoteName = escapeHtml(this.remoteName);
        const safeRemoteCharGuestView = escapeHtml((sanitizeCharacter(this.remoteCharacter, 'wizard')).replace(/_/g, ' ').toUpperCase());
        const safeRemoteCharHostView = escapeHtml((sanitizeCharacter(this.remoteCharacter, 'warrior')).replace(/_/g, ' ').toUpperCase());

        const hostUnlocked = this.getUnlockedCharacters();
        const unlockedSet = new Set(hostUnlocked);
        if (!unlockedSet.has(this.localCharacter)) {
            this.localCharacter = hostUnlocked[0] || 'warrior';
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

        box.innerHTML = `
            <h2 style="margin: 0 0 8px; font-size: 26px; color: #ff981f; text-shadow: 2px 2px #000;">
                Online Co-Op Lobby
            </h2>
            <div style="font-size: 14px; color: #bbb; margin-bottom: 10px;">
                ${isHost ? 'Share the generated link below with Player 2 to join your run.' : 'Connected as Player 2 (Guest).'}
            </div>
            <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 14px; font-size: 11px;">
                <span style="background: #231a12; border: 1px solid #6b5842; color: #ff6040; padding: 3px 10px; border-radius: 3px;">
                    ⚔ Co-Op Difficulty: 2x Monster HP
                </span>
                <span style="background: #231a12; border: 1px solid #6b5842; color: #ffff00; padding: 3px 10px; border-radius: 3px;">
                    ★ Host Save Classes: ${unlockedChars.length}/${visibleTotal} Unlocked
                </span>
            </div>

            <!-- Room Code & Link Box -->
            <div style="background: #1a1510; border: 2px solid #3d3123; padding: 12px; margin-bottom: 14px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 14px; color: #888;">ROOM CODE:</span>
                    <span style="font-size: 20px; color: #ffff00; letter-spacing: 2px;">${safeRoomId}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <input id="coop-link-input" type="text" readonly value="${safeInviteLink}" 
                        style="flex: 1; background: #0c0906; border: 1px solid #5a4a35; color: #fff; padding: 6px 10px; font-family: monospace; font-size: 13px;" />
                    <button id="coop-copy-btn" style="
                        background: #4a3c2c; border: 2px solid #6b5842; color: #ff981f; padding: 6px 14px; 
                        cursor: pointer; font-family: 'OSRS Bold', monospace; font-size: 13px; font-weight: bold;">
                        Copy Link
                    </button>
                </div>
            </div>

            <!-- Region / Map Selection Box -->
            <div style="background: #1e1812; border: 2px solid #5a4a35; padding: 12px 14px; margin-bottom: 16px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 12px; color: #ff981f; letter-spacing: 0.5px;">DESTINATION REGION:</span>
                    <span style="font-size: 11px; color: #ffff00;">${escapeHtml(currentRegion.difficulty)} (x2 Co-Op HP)</span>
                </div>
                ${isHost ? `
                    <select id="coop-map-select" style="width: 100%; background: #0c0906; border: 1px solid #5a4a35; color: #ffff00; padding: 6px 8px; font-family: 'OSRS Bold', monospace; font-size: 14px; margin-bottom: 6px;">
                        ${regionOptionsHtml}
                    </select>
                ` : `
                    <div style="font-size: 16px; color: #ffff00; margin-bottom: 4px;">${escapeHtml(currentRegion.name)} <span style="font-size: 11px; color: #888;">(Selected by Host)</span></div>
                `}
                <div style="font-size: 11px; color: #b8a890;">
                    Bosses: <strong style="color: #ff981f;">${escapeHtml(currentRegion.bosses)}</strong>
                </div>
            </div>

            <!-- Players Cards with Custom Name Fields -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; text-align: left;">
                <!-- Player 1 Card -->
                <div style="background: #1e1812; border: 2px solid ${isHost ? '#ff981f' : '#3d3123'}; padding: 14px;">
                    <div style="font-size: 12px; color: #888; margin-bottom: 4px;">PLAYER 1 (HOST)</div>
                    ${isHost ? `
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 2px;">Your Name:</label>
                        <input id="coop-p1-name" type="text" maxlength="14" value="${safeLocalName}"
                            style="width: 100%; box-sizing: border-box; background: #0c0906; border: 1px solid #5a4a35; color: #ffff00; padding: 5px 8px; font-family: 'OSRS Bold', monospace; font-size: 14px; margin-bottom: 8px;" />
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 2px;">Character (Host Save):</label>
                        <select id="coop-p1-char" style="width: 100%; background: #0c0906; border: 1px solid #5a4a35; color: #ff981f; padding: 6px; font-family: 'OSRS Small', monospace;">
                            ${charOptionsHtml}
                        </select>
                    ` : `
                        <div style="font-size: 18px; color: #ffff00; margin-bottom: 4px;">${safeRemoteName}</div>
                        <div style="font-size: 13px; color: #ff981f;">
                            Class: <strong>${safeRemoteCharGuestView}</strong>
                        </div>
                    `}
                </div>

                <!-- Player 2 Card -->
                <div style="background: #1e1812; border: 2px solid ${!isHost ? '#ff981f' : '#3d3123'}; padding: 14px;">
                    <div style="font-size: 12px; color: #888; margin-bottom: 4px;">PLAYER 2 (GUEST)</div>
                    ${!isHost ? `
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 2px;">Your Name:</label>
                        <input id="coop-p2-name" type="text" maxlength="14" value="${safeLocalName}"
                            style="width: 100%; box-sizing: border-box; background: #0c0906; border: 1px solid #5a4a35; color: #ffff00; padding: 5px 8px; font-family: 'OSRS Bold', monospace; font-size: 14px; margin-bottom: 8px;" />
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 2px;">Character (Host Save):</label>
                        <select id="coop-p2-char" style="width: 100%; background: #0c0906; border: 1px solid #5a4a35; color: #ff981f; padding: 6px; font-family: 'OSRS Small', monospace;">
                            ${charOptionsHtml}
                        </select>
                    ` : (this.peerConnected ? `
                        <div style="font-size: 18px; color: #ffff00; margin-bottom: 4px;">${safeRemoteName}</div>
                        <div style="font-size: 13px; color: #ff981f;">
                            Class: <strong>${safeRemoteCharHostView}</strong>
                            <div style="font-size: 11px; color: ${this.remoteReady ? '#00ff00' : '#ffff00'}; margin-top: 4px;">
                                ${this.remoteReady ? '● Assets Ready' : '⏳ Baking Assets...'}
                            </div>
                        </div>
                    ` : `
                        <div style="font-size: 13px; color: #888; font-style: italic; margin-top: 12px;">
                            Waiting for Player 2 to join...
                        </div>
                    `)}
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: space-between; gap: 16px;">
                <button id="coop-close-btn" style="
                    flex: 1; background: #3d2f21; border: 2px solid #5a4a35; color: #aaa; padding: 10px;
                    cursor: pointer; font-family: 'OSRS Bold', monospace; font-size: 16px;">
                    Leave Lobby
                </button>
                ${isHost ? `
                    <button id="coop-start-btn" ${!this.peerConnected ? 'disabled' : ''} style="
                        flex: 2; background: ${this.peerConnected ? '#8a6414' : '#332719'}; 
                        border: 2px solid ${this.peerConnected ? '#d4af37' : '#443522'}; 
                        color: ${this.peerConnected ? '#fff' : '#665'}; padding: 10px;
                        cursor: ${this.peerConnected ? 'pointer' : 'not-allowed'}; 
                        font-family: 'OSRS Bold', monospace; font-size: 18px; text-shadow: 1px 1px #000;">
                        ${this.peerConnected ? (this.remoteReady ? `Enter ${escapeHtml(currentRegion.name)} (Start Co-Op)` : 'Player 2 Loading Assets...') : 'Waiting for Player 2...'}
                    </button>
                ` : `
                    <div style="flex: 2; padding: 10px; color: #ffff00; font-size: 15px; align-self: center;">
                        ${this.localReady ? `Assets Ready! Waiting for Host to enter ${escapeHtml(currentRegion.name)}...` : 'Loading assets...'}
                    </div>
                `}
            </div>
        `;

        // Attach event listeners
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

        const p1NameInput = box.querySelector('#coop-p1-name');
        if (p1NameInput) {
            p1NameInput.oninput = (e) => this.setPlayerName(e.target.value);
        }

        const p2NameInput = box.querySelector('#coop-p2-name');
        if (p2NameInput) {
            p2NameInput.oninput = (e) => this.setPlayerName(e.target.value);
        }

        const p1Select = box.querySelector('#coop-p1-char');
        if (p1Select) {
            p1Select.onchange = (e) => this.selectCharacter(e.target.value);
        }

        const p2Select = box.querySelector('#coop-p2-char');
        if (p2Select) {
            p2Select.onchange = (e) => this.selectCharacter(e.target.value);
        }

        const startBtn = box.querySelector('#coop-start-btn');
        if (startBtn && this.peerConnected) {
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
}

// Global singleton instance
export const multiplayer = new MultiplayerManager();
window.multiplayer = multiplayer;

// Automatically open lobby if ?room= is in URL
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const room = sanitizeRoomId(params.get('room'));
    if (room) {
        console.log('[Multiplayer] Auto-joining room from URL query:', room);
        setTimeout(() => {
            multiplayer.openLobbyModal(room);
        }, 1500);
    }
});
