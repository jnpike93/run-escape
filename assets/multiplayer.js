// Run Escape - Multiplayer Co-Op Module (RFC 6455 WebSockets)
// Supports 2 to 4 players with Host-authoritative simulation, class model baking,
// jitter-free velocity extrapolation + soft correction, dynamic party HP scaling,
// mutual player awareness (custom lobby names, overhead HP bars, nametags, multi-partner HUD, off-screen arrows),
// and synchronized pause/casket barriers.

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
const SLOT_DEFAULT_CHARS = { 1: 'warrior', 2: 'wizard', 3: 'ranger', 4: 'warrior' };

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

const SPAWN_OFFSETS = {
    1: { dx: -0.75, dy: -0.5 },
    2: { dx: 0.75, dy: -0.5 },
    3: { dx: -0.75, dy: 0.75 },
    4: { dx: 0.75, dy: 0.75 }
};

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

function sanitizeSlot(slot, fallback = 1) {
    const n = Math.round(Number(slot));
    return (Number.isFinite(n) && n >= 1 && n <= 4) ? n : fallback;
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
        this.localSlot = 1; // 1..4
        this.hostSlot = 1;
        this.ws = null;
        this.peers = 1;
        this.peerConnected = false;

        this.localCharacter = 'warrior';
        this.localName = 'Player 1';
        this.localNameCustomized = false;
        this.localReady = false;
        this.selectedMapId = 'lumbridge';
        this.selectedEndless = false;
        this.hostUnlockedCharacters = this.readLocalSaveUnlockedCharacters();

        // Map<slot (1..4), { slot, name, character, ready, isHost }>
        this.lobbyPlayers = new Map();
        // Map<slot (1..4), RemotePeerData> for active in-game peers (excluding localSlot)
        this.remotePeers = new Map();

        this.gameStarted = false;
        this.gameConfig = null; // { seed, mapId, partySize, players: [{slot, name, character, isHost}], unlockedItems }

        this.localPauseState = null;
        this.pendingIcons = new Set();
        this.lastPartyHudKey = '';
        this.lastPartyHudFastKey = '';
        this.loadoutVersion = 0;
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

    syncLocalToLobbyPlayers() {
        this.lobbyPlayers.set(this.localSlot, {
            slot: this.localSlot,
            name: this.localName,
            character: this.localCharacter,
            ready: this.localReady,
            isHost: this.role === 'host' || this.role === null
        });
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
        this.lobbyPlayers.clear();
        this.syncLocalToLobbyPlayers();

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
            this.syncLocalToLobbyPlayers();
            this.sendLobbyUpdate();
            this.updateLobbyUI();
        } else {
            setTimeout(() => this.checkLocalReady(), 500);
        }
    }

    reconcileActiveSlots(activeSlots) {
        if (!Array.isArray(activeSlots)) return;
        const validSet = new Set(activeSlots.map(s => sanitizeSlot(s, 0)).filter(s => s >= 1 && s <= 4));
        validSet.add(this.localSlot);
        for (const s of Array.from(this.lobbyPlayers.keys())) {
            if (!validSet.has(s)) {
                this.lobbyPlayers.delete(s);
            }
        }
        for (const s of validSet) {
            if (!this.lobbyPlayers.has(s)) {
                this.lobbyPlayers.set(s, {
                    slot: s,
                    name: `Player ${s}`,
                    character: SLOT_DEFAULT_CHARS[s] || 'warrior',
                    ready: false,
                    isHost: s === this.hostSlot
                });
            }
        }
        this.peers = this.lobbyPlayers.size;
        this.peerConnected = this.peers >= 2;
    }

    handleMessage(msg) {
        if (!msg || typeof msg !== 'object') return;
        switch (msg.type) {
            case 'pong':
                break;

            case 'error':
                if (typeof msg.message === 'string') {
                    this.showToast(msg.message.slice(0, 80));
                }
                break;

            case 'welcome': {
                if (this.role !== null) break;
                if (msg.role !== 'host' && msg.role !== 'guest') break;
                this.role = msg.role;
                this.localSlot = sanitizeSlot(msg.slot, msg.role === 'host' ? 1 : 2);
                this.hostSlot = sanitizeSlot(msg.hostSlot, 1);
                this.peers = Number.isFinite(Number(msg.peers)) ? Math.max(1, Math.min(4, Math.round(Number(msg.peers)))) : 1;
                this.peerConnected = this.peers >= 2;
                if (msg.room) {
                    const cleanRoom = sanitizeRoomId(msg.room);
                    if (cleanRoom) this.roomId = cleanRoom;
                }
                if (!this.localNameCustomized) {
                    this.localName = `Player ${this.localSlot}`;
                }
                this.lobbyPlayers.clear();
                this.syncLocalToLobbyPlayers();
                if (Array.isArray(msg.activeSlots)) {
                    this.reconcileActiveSlots(msg.activeSlots);
                }
                console.log(`[Multiplayer] Welcome: role=${this.role}, slot=${this.localSlot}, peers=${this.peers}`);
                this.sendLobbyUpdate();
                this.updateLobbyUI();
                break;
            }

            case 'peer_joined': {
                const joinedSlot = sanitizeSlot(msg.slot, 2);
                if (msg.hostSlot) this.hostSlot = sanitizeSlot(msg.hostSlot, this.hostSlot);
                if (!this.lobbyPlayers.has(joinedSlot)) {
                    this.lobbyPlayers.set(joinedSlot, {
                        slot: joinedSlot,
                        name: `Player ${joinedSlot}`,
                        character: SLOT_DEFAULT_CHARS[joinedSlot] || 'warrior',
                        ready: false,
                        isHost: joinedSlot === this.hostSlot
                    });
                }
                if (Array.isArray(msg.activeSlots)) {
                    this.reconcileActiveSlots(msg.activeSlots);
                } else {
                    this.peers = Math.max(2, this.lobbyPlayers.size);
                    this.peerConnected = this.peers >= 2;
                }
                console.log(`[Multiplayer] Player ${joinedSlot} joined lobby (peers=${this.peers})`);
                this.sendLobbyUpdate();
                this.showToast(`Player ${joinedSlot} connected to lobby! (${this.peers}/4)`);
                this.updateLobbyUI();
                break;
            }

            case 'peer_leaving':
            case 'peer_left': {
                const leftSlot = sanitizeSlot(msg.slot || msg.senderSlot, 0);
                console.log(`[Multiplayer] Peer slot ${leftSlot} disconnected`);
                if (leftSlot && leftSlot !== this.localSlot) {
                    this.lobbyPlayers.delete(leftSlot);
                }
                if (Array.isArray(msg.activeSlots)) {
                    this.reconcileActiveSlots(msg.activeSlots);
                } else {
                    this.peers = Math.max(1, this.lobbyPlayers.size);
                    this.peerConnected = this.peers >= 2;
                }

                if (this.gameStarted) {
                    const departingPeer = this.remotePeers.get(leftSlot);
                    const departingName = departingPeer?.name || `Player ${leftSlot || 'Partner'}`;
                    if (msg.role === 'host' || leftSlot === this.hostSlot || this.remotePeers.size <= 1) {
                        this.endGameOnDisconnect(`${departingName} Disconnected - Game Over`);
                    } else {
                        // In 3-4 player co-op, if one Guest drops, remove their entity and let the remaining party continue!
                        this.remotePeers.delete(leftSlot);
                        const sim = window.gameClient?.sim;
                        if (sim && Array.isArray(sim.remotePlayers)) {
                            sim.remotePlayers = sim.remotePlayers.filter(rp => rp.slot !== leftSlot);
                            sim.player2 = sim.remotePlayers[0] || null;
                        }
                        this.loadoutVersion++;
                        this.lastPartyHudKey = '';
                        if (window.gameClient) {
                            this.updatePauseOverlay(window.gameClient);
                        }
                        this.showToast(`${departingName} disconnected (${this.remotePeers.size + 1} players remaining)`);
                    }
                } else {
                    if (msg.newHostSlot) {
                        this.hostSlot = sanitizeSlot(msg.newHostSlot, 1);
                    }
                    if (msg.promotedToHost && this.localSlot === this.hostSlot) {
                        this.role = 'host';
                        this.showToast('Host left lobby - you are now the Host!');
                    } else if (leftSlot) {
                        this.showToast(`Player ${leftSlot} left the lobby`);
                    }
                    for (const [s, p] of this.lobbyPlayers.entries()) {
                        p.isHost = (s === this.hostSlot);
                    }
                    this.syncLocalToLobbyPlayers();
                    this.sendLobbyUpdate();
                    this.updateLobbyUI();
                }
                break;
            }

            case 'lobby_update': {
                const senderSlot = sanitizeSlot(msg.senderSlot || msg.slot, this.role === 'host' ? 2 : 1);
                const incomingName = sanitizeName(msg.name) || `Player ${senderSlot}`;
                const hostUnlocked = this.getUnlockedCharacters();

                if (this.role === 'host') {
                    if (senderSlot !== this.localSlot) {
                        const prev = this.lobbyPlayers.get(senderSlot);
                        const candidate = sanitizeCharacter(msg.character, prev?.character || SLOT_DEFAULT_CHARS[senderSlot] || 'warrior');
                        const validChar = hostUnlocked.includes(candidate) ? candidate : (hostUnlocked[0] || 'warrior');
                        this.lobbyPlayers.set(senderSlot, {
                            slot: senderSlot,
                            name: incomingName,
                            character: validChar,
                            ready: Boolean(msg.ready),
                            isHost: false
                        });
                        this.peers = this.lobbyPlayers.size;
                        this.peerConnected = this.peers >= 2;
                        // Re-broadcast full party roster so all Guests see every other Guest's name/class/ready state
                        this.broadcastPartyRoster();
                    }
                } else {
                    if (Array.isArray(msg.unlockedCharacters)) {
                        const validUnlocked = msg.unlockedCharacters
                            .filter(c => typeof c === 'string' && ALLOWED_CHARACTERS.has(c.trim().toLowerCase()))
                            .map(c => c.trim().toLowerCase());
                        const merged = new Set([...DEFAULT_UNLOCKED_CHARACTERS, ...validUnlocked]);
                        this.hostUnlockedCharacters = ALL_CHARACTERS.filter(c => merged.has(c.id)).map(c => c.id);
                        if (!this.hostUnlockedCharacters.includes(this.localCharacter)) {
                            this.localCharacter = this.hostUnlockedCharacters[0] || 'warrior';
                            this.syncLocalToLobbyPlayers();
                            this.sendLobbyUpdate();
                        }
                    }
                    if (msg.mapId) {
                        this.selectedMapId = sanitizeMapId(msg.mapId, this.selectedMapId);
                    }
                    if (typeof msg.endless === 'boolean') {
                        this.selectedEndless = msg.endless;
                    }
                    if (Array.isArray(msg.party)) {
                        const nextSlots = new Set([this.localSlot]);
                        for (const p of msg.party) {
                            if (!p || typeof p !== 'object') continue;
                            const s = sanitizeSlot(p.slot, 0);
                            if (s < 1 || s > 4) continue;
                            nextSlots.add(s);
                            if (p.isHost) this.hostSlot = s;
                            if (s === this.localSlot) continue;
                            this.lobbyPlayers.set(s, {
                                slot: s,
                                name: sanitizeName(p.name) || `Player ${s}`,
                                character: sanitizeCharacter(p.character, SLOT_DEFAULT_CHARS[s] || 'warrior'),
                                ready: Boolean(p.ready),
                                isHost: Boolean(p.isHost)
                            });
                        }
                        for (const s of Array.from(this.lobbyPlayers.keys())) {
                            if (!nextSlots.has(s)) this.lobbyPlayers.delete(s);
                        }
                    } else if (senderSlot !== this.localSlot) {
                        this.lobbyPlayers.set(senderSlot, {
                            slot: senderSlot,
                            name: incomingName,
                            character: sanitizeCharacter(msg.hostCharacter || msg.character, SLOT_DEFAULT_CHARS[senderSlot] || 'warrior'),
                            ready: Boolean(msg.ready),
                            isHost: senderSlot === this.hostSlot
                        });
                    }
                    this.syncLocalToLobbyPlayers();
                    this.peers = this.lobbyPlayers.size;
                    this.peerConnected = this.peers >= 2;
                }
                this.updateLobbyUI();
                break;
            }

            case 'game_start': {
                if (this.role !== 'guest' || this.gameStarted) break;
                if (!msg.config || typeof msg.config !== 'object') break;
                this.gameStarted = true;
                const rawPlayers = Array.isArray(msg.config.players) ? msg.config.players : [];
                const sanitizedPlayers = rawPlayers
                    .filter(p => p && typeof p === 'object')
                    .slice(0, 4)
                    .map((p, idx) => {
                        const s = sanitizeSlot(p.slot, idx + 1);
                        return {
                            slot: s,
                            name: sanitizeName(p.name) || `Player ${s}`,
                            character: sanitizeCharacter(p.character, SLOT_DEFAULT_CHARS[s] || 'warrior'),
                            isHost: Boolean(p.isHost)
                        };
                    });

                this.gameConfig = {
                    seed: Number.isFinite(Number(msg.config.seed)) ? (Number(msg.config.seed) >>> 0) : 1,
                    mapId: sanitizeMapId(msg.config.mapId, 'lumbridge'),
                    endless: Boolean(msg.config.endless),
                    partySize: Math.max(2, Math.min(4, sanitizedPlayers.length || 2)),
                    players: sanitizedPlayers,
                    unlockedItems: Array.isArray(msg.config.unlockedItems)
                        ? msg.config.unlockedItems.filter(id => typeof id === 'string').slice(0, 200)
                        : []
                };
                this.selectedMapId = this.gameConfig.mapId;
                this.selectedEndless = this.gameConfig.endless;
                console.log('[Multiplayer] Game Starting with 2-4P config:', this.gameConfig);
                this.closeLobbyModal();
                this.launchCoopRun(this.gameConfig);
                break;
            }

            case 'input': {
                if (this.role !== 'host') break;
                const senderSlot = sanitizeSlot(msg.senderSlot || msg.slot, 2);
                const peer = this.remotePeers.get(senderSlot);
                if (!peer) break;

                if (msg.pauseState !== undefined) {
                    const allowedStates = new Set(['levelUp', 'chest', 'paused']);
                    const nextRemote = (typeof msg.pauseState === 'string' && allowedStates.has(msg.pauseState)) ? msg.pauseState : null;
                    if (nextRemote !== peer.pauseState) {
                        peer.pauseState = nextRemote;
                        if (window.gameClient) {
                            window.gameClient.accumulator = 0;
                            this.updatePauseOverlay(window.gameClient);
                        }
                    }
                }
                if (peer.entity) {
                    this.applyRemoteInput(peer, msg);
                }
                break;
            }

            case 'sync_world':
                if (this.role === 'guest') {
                    this.applyWorldSync(msg);
                }
                break;

            case 'coop_pause': {
                const senderSlot = sanitizeSlot(msg.senderSlot || msg.slot, 0);
                const allowedStates = new Set(['levelUp', 'chest', 'paused']);
                const nextRemote = (typeof msg.state === 'string' && allowedStates.has(msg.state)) ? msg.state : null;

                if (msg.action === 'resume_both') {
                    for (const peer of this.remotePeers.values()) {
                        peer.pauseState = null;
                    }
                    if (window.gameClient) {
                        window.gameClient.accumulator = 0;
                        if (window.gameClient.paused) {
                            window.gameClient.paused = false;
                            window.gameClient.syncOverlay();
                            this.syncLocalPauseState(window.gameClient, true);
                        }
                        this.updatePauseOverlay(window.gameClient);
                    }
                    break;
                }

                const peer = this.remotePeers.get(senderSlot);
                if (peer) {
                    peer.pauseState = nextRemote;
                }
                if (window.gameClient) {
                    window.gameClient.accumulator = 0;
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
            name: this.localName,
            ready: this.localReady,
            unlockedCharacters: unlocked,
            party
        });
    }

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

    selectMap(mapId) {
        if (this.role !== 'host' && this.role !== null) return;
        this.selectedMapId = sanitizeMapId(mapId, 'lumbridge');
        this.sendLobbyUpdate();
        this.updateLobbyUI();
    }

    toggleEndless() {
        if (this.role !== 'host' && this.role !== null) return;
        this.selectedEndless = !this.selectedEndless;
        this.sendLobbyUpdate();
        this.updateLobbyUI();
    }

    setPlayerName(name) {
        const cleaned = sanitizeName(name);
        this.localNameCustomized = Boolean(cleaned);
        this.localName = cleaned || `Player ${this.localSlot}`;
        this.syncLocalToLobbyPlayers();
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
        this.syncLocalToLobbyPlayers();
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
            partySize: players.length,
            players,
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

        const modelWaitStart = Date.now();
        while (client.assets?.models?.size < 250 && (Date.now() - modelWaitStart) < 20000) {
            await new Promise(r => setTimeout(r, 250));
        }

        const players = Array.isArray(config.players) ? config.players : [];
        const localEntry = players.find(p => p.slot === this.localSlot) || players[0] || {
            slot: this.localSlot,
            name: this.localName,
            character: this.localCharacter
        };
        const localChar = localEntry.character || 'warrior';
        this.localName = localEntry.name || this.localName;

        const allPartyChars = players.map(p => p.character);
        await this.ensureAllCharacterModels(client, allPartyChars);

        console.log(`[Multiplayer] Launching ${players.length}-Player Co-Op Run: Local Slot ${this.localSlot} (${this.localName} - ${localChar})`);

        client.store.set({
            characterId: localChar,
            mapId: config.mapId || 'lumbridge'
        });

        if (localChar !== 'dipper' && client.getAppearance) {
            try {
                await client.assets.setPlayerAppearance(client.getAppearance(localChar));
            } catch(e) {}
        }

        try {
            await client.startRun();
            this.setupInGameHooks(localChar, players);
        } catch (err) {
            console.error('[Multiplayer] Error starting run:', err);
        }
    }

    setupInGameHooks(localChar, partyPlayers) {
        const client = window.gameClient;
        if (!client || !client.sim) return;
        const sim = client.sim;
        const isHost = this.role === 'host';

        this.localPauseState = null;
        this.lastPartyHudKey = '';
        this.lastPartyHudFastKey = '';
        this.loadoutVersion = 0;
        this.remotePeers.clear();
        this.removePauseOverlay();

        // Sync Host's unlocked items into Guest's simulation
        if (!isHost && Array.isArray(this.gameConfig?.unlockedItems) && sim.unlockedItems instanceof Set) {
            for (const itemId of this.gameConfig.unlockedItems) {
                sim.unlockedItems.add(itemId);
            }
        }

        // Independent random entropy for casket rolls and rerolls
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

        if (client.input) {
            client.input.onBlur = () => {
                client.accumulator = 0;
            };
        }

        const p1 = sim.player;
        p1.characterId = localChar;
        p1.slot = this.localSlot;

        const spawnX = Number.isFinite(sim.map?.spawn?.x) ? sim.map.spawn.x : 3222.5;
        const spawnY = Number.isFinite(sim.map?.spawn?.y) ? sim.map.spawn.y : 3218.5;

        const localOffset = SPAWN_OFFSETS[this.localSlot] || { dx: 0, dy: 0 };
        p1.x = spawnX + localOffset.dx;
        p1.y = spawnY + localOffset.dy;
        p1.prevX = p1.x;
        p1.prevY = p1.y;

        sim.remotePlayers = [];
        for (const pInfo of partyPlayers) {
            if (!pInfo || pInfo.slot === this.localSlot) continue;
            const slot = sanitizeSlot(pInfo.slot, 2);
            const offset = SPAWN_OFFSETS[slot] || { dx: 1.0, dy: 0 };
            const sx = spawnX + offset.dx;
            const sy = spawnY + offset.dy;
            const charId = sanitizeCharacter(pInfo.character, 'warrior');

            const entity = {
                slot,
                x: sx,
                y: sy,
                prevX: sx,
                prevY: sy,
                netX: sx,
                netY: sy,
                vx: 0,
                vy: 0,
                moveX: 0,
                moveY: 0,
                moveSpeed: 0,
                lastPacketTime: performance.now(),
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
                characterId: charId,
                hasDynamicModel: false
            };

            // Build starting weapon for this remote peer
            const weaponId = CHAR_WEAPONS[charId] || 'throwing_knives';
            let peerWeapons = [];
            const savedWeapons = sim.weapons;
            try {
                sim.weapons = [];
                sim.addWeapon(weaponId);
                if (sim.weapons.length > 0) {
                    peerWeapons = [sim.weapons[0]];
                }
            } catch (err) {
                console.error(`[Multiplayer] Failed adding weapon for slot ${slot}:`, err);
            } finally {
                sim.weapons = savedWeapons;
            }

            const peerObj = {
                slot,
                name: sanitizeName(pInfo.name) || `Player ${slot}`,
                characterId: charId,
                isHost: Boolean(pInfo.isHost),
                entity,
                weapons: peerWeapons,
                loadout: { weapons: [], passives: [], gear: [], inventory: [null, null, null, null] },
                pauseState: null,
                lastEquipKey: ''
            };
            this.remotePeers.set(slot, peerObj);
            sim.remotePlayers.push(entity);
        }

        // Maintain sim.player2 alias for compatibility
        sim.player2 = sim.remotePlayers[0] || null;

        const partySize = Math.max(2, Math.min(4, this.remotePeers.size + 1));
        // Dynamic Monster HP Scaling: 2P = 2.0x, 3P = 2.75x, 4P = 3.5x
        const hpMultiplier = 1 + (partySize - 1) * 0.85;
        const effectiveMult = partySize === 2 ? 2.0 : hpMultiplier;

        if (isHost) {
            const origSpawnEnemy = sim.spawnEnemy.bind(sim);
            sim.spawnEnemy = (def, kind, pos, bossHp) => {
                const enemy = origSpawnEnemy(def, kind, pos, bossHp);
                if (enemy && !enemy._coopHpScaled) {
                    enemy._coopHpScaled = true;
                    enemy.hp = Math.max(1, Math.round(enemy.hp * effectiveMult));
                    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * effectiveMult));
                }
                return enemy;
            };
            for (const enemy of sim.enemies) {
                if (enemy && !enemy._coopHpScaled) {
                    enemy._coopHpScaled = true;
                    enemy.hp = Math.max(1, Math.round(enemy.hp * effectiveMult));
                    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * effectiveMult));
                }
            }

            // Spawn initial wave enemies around the region's spawn point on Host
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
                } catch (e) {
                    console.warn('[Multiplayer] Initial spawn note:', e);
                }
            }

            // Hook sim.collect on Host so XP, coins, AND caskets collected by Host are shared with all Guests
            const origCollect = sim.collect.bind(sim);
            sim._origCollect = origCollect;
            sim.collect = (pickup) => {
                const kind = pickup.kind;
                const val = pickup.value;
                const tier = pickup.tier || 'medium';
                origCollect(pickup);
                if (this.remotePeers.size > 0) {
                    if ((kind === 'bones' || kind === 'big_bones' || kind === 'coins') && val > 0) {
                        this.send({
                            type: 'coop_pickup',
                            kind: kind,
                            value: val
                        });
                    } else if (kind === 'casket') {
                        const latestChest = sim.chests && sim.chests.length > 0 ? sim.chests[sim.chests.length - 1] : null;
                        for (const peer of this.remotePeers.values()) {
                            peer.pauseState = 'chest';
                        }
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

            // Hook sim.stepEnemies on Host to partition monsters across all living players (P1..P4) by closest distance
            const origStepEnemies = sim.stepEnemies.bind(sim);
            sim.stepEnemies = () => {
                const activeTargets = [
                    { slot: this.localSlot, entity: sim.player, bucket: [] }
                ];
                for (const peer of this.remotePeers.values()) {
                    if (peer.entity && peer.entity.hp > 0) {
                        activeTargets.push({ slot: peer.slot, entity: peer.entity, bucket: [] });
                    }
                }
                if (activeTargets.length <= 1) {
                    origStepEnemies();
                    return;
                }

                const allEnemies = sim.enemies;
                for (let i = 0; i < allEnemies.length; i++) {
                    const enemy = allEnemies[i];
                    if (enemy.dead) {
                        activeTargets[0].bucket.push(enemy);
                        continue;
                    }
                    let bestIdx = 0;
                    let bestDist = Math.hypot(activeTargets[0].entity.x - enemy.x, activeTargets[0].entity.y - enemy.y);
                    for (let j = 1; j < activeTargets.length; j++) {
                        const d = Math.hypot(activeTargets[j].entity.x - enemy.x, activeTargets[j].entity.y - enemy.y);
                        if (d < bestDist) {
                            bestDist = d;
                            bestIdx = j;
                        }
                    }
                    activeTargets[bestIdx].bucket.push(enemy);
                }

                const savedPlayer = sim.player;
                try {
                    for (const t of activeTargets) {
                        if (t.bucket.length === 0) continue;
                        sim.enemies = t.bucket;
                        sim.player = t.entity;
                        origStepEnemies();
                    }
                } finally {
                    sim.enemies = allEnemies;
                    sim.player = savedPlayer;
                }
            };
        } else {
            // Guest disables autonomous wave spawner and local pickup resolution; steps enemy/pickup velocity interpolation at 30Hz
            sim.stepDirector = () => {};
            sim.stepEnemies = () => {
                for (let i = 0; i < sim.enemies.length; i++) {
                    const e = sim.enemies[i];
                    e.prevX = e.x;
                    e.prevY = e.y;
                    e.vx = 0;
                    e.vy = 0;
                    if (!e.dead && Number.isFinite(e.netX) && Number.isFinite(e.netY)) {
                        const predX = e.x + (e.netVx || 0);
                        const predY = e.y + (e.netVy || 0);
                        const errX = e.netX - predX;
                        const errY = e.netY - predY;
                        const errDist = Math.hypot(errX, errY);
                        if (errDist > 3.5) {
                            e.x = e.netX;
                            e.y = e.netY;
                            e.prevX = e.netX;
                            e.prevY = e.netY;
                        } else {
                            e.x = predX + errX * 0.45;
                            e.y = predY + errY * 0.45;
                        }
                        e.netVx = (e.netVx || 0) * 0.85;
                        e.netVy = (e.netVy || 0) * 0.85;
                    }
                    if (e.flash > 0) e.flash--;
                }
                for (let i = 0; i < sim.pickups.length; i++) {
                    const p = sim.pickups[i];
                    p.prevX = p.x;
                    p.prevY = p.y;
                    if (Number.isFinite(p.targetX) && Number.isFinite(p.targetY)) {
                        p.x = p.x + (p.targetX - p.x) * 0.55;
                        p.y = p.y + (p.targetY - p.y) * 0.55;
                    }
                }
            };
            sim.killEnemy = () => {};
            sim.stepPickups = () => {};
            sim.dropPickup = () => {};
            sim.dropCasket = () => {};
            sim.dropCasketOfTier = () => {};
            sim.rollPowerUp = () => {};
            sim.enemies = [];
            console.log('[Multiplayer] Guest initialized in 2-4P client sync mode.');
        }

        // Hook sim.stepOrbit so each remote player's orbiting weapons orbit around that remote player
        if (sim.stepOrbit) {
            const origStepOrbit = sim.stepOrbit.bind(sim);
            sim.stepOrbit = (proj, orbit) => {
                if (orbit && orbit.owner) {
                    const savedPlayer = sim.player;
                    sim.player = orbit.owner;
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

        // Hook sim.stepWeapons to fire all remote players' weapons
        const origStepWeapons = sim.stepWeapons.bind(sim);
        sim.stepWeapons = () => {
            const hasRemoteOrbits = sim.projectiles.some(p => p.orbit && p.ownerSlot && p.ownerSlot !== this.localSlot);
            let remoteOrbits = null;
            if (hasRemoteOrbits) {
                remoteOrbits = sim.projectiles.filter(p => p.orbit && p.ownerSlot && p.ownerSlot !== this.localSlot);
                sim.projectiles = sim.projectiles.filter(p => !(p.orbit && p.ownerSlot && p.ownerSlot !== this.localSlot));
            }
            origStepWeapons();
            for (const p of sim.projectiles) {
                if (p.orbit && !p.ownerSlot) {
                    p.ownerSlot = this.localSlot;
                    p.orbit.owner = sim.player;
                }
            }
            if (remoteOrbits && remoteOrbits.length > 0) {
                sim.projectiles.push(...remoteOrbits);
            }

            if (this.remotePeers.size > 0) {
                const origPlayer = sim.player;
                for (const peer of this.remotePeers.values()) {
                    const rEntity = peer.entity;
                    const rWeapons = peer.weapons;
                    if (!rEntity || rEntity.hp <= 0 || !rWeapons || rWeapons.length === 0) continue;

                    const hasOtherOrbits = sim.projectiles.some(p => p.orbit && p.ownerSlot !== peer.slot);
                    let otherOrbits = null;
                    if (hasOtherOrbits) {
                        otherOrbits = sim.projectiles.filter(p => p.orbit && p.ownerSlot !== peer.slot);
                        sim.projectiles = sim.projectiles.filter(p => !(p.orbit && p.ownerSlot !== peer.slot));
                    }

                    sim.player = rEntity;
                    try {
                        for (const t of rWeapons) {
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
                                    x: rEntity.x,
                                    y: rEntity.y
                                });
                                if (!rEntity.moving) {
                                    rEntity.attackSeq = n?.playerSeq ?? t.def.playerSeq;
                                    rEntity.attackStart = sim.tick;
                                }
                            }
                        }
                        for (const p of sim.projectiles) {
                            if (p.orbit && !p.ownerSlot) {
                                p.ownerSlot = peer.slot;
                                p.orbit.owner = rEntity;
                            }
                        }
                    } finally {
                        sim.player = origPlayer;
                        if (otherOrbits && otherOrbits.length > 0) {
                            sim.projectiles.push(...otherOrbits);
                        }
                    }
                }
            }
        };

        // Hook sim.step to step remote peers, handle pickups, and broadcast state
        const origStep = sim.step.bind(sim);
        sim.step = (moveX, moveY) => {
            if (sim.state === 'playing' && !sim.runOver) {
                for (const peer of this.remotePeers.values()) {
                    if (peer.entity) {
                        this.stepRemotePlayer(sim, peer);
                    }
                }
            }

            origStep(moveX, moveY);

            if (isHost && sim.state === 'playing' && !sim.runOver) {
                for (const peer of this.remotePeers.values()) {
                    if (peer.entity && peer.entity.hp > 0) {
                        this.stepRemotePlayerPickups(sim, peer);
                    }
                }
            }

            if (sim.state !== 'playing') {
                this.syncLocalPauseState(client, true);
            }

            if (sim.tick === 10) {
                this.sendLoadoutSync(client, false);
            }

            if (this.remotePeers.size > 0) {
                if (isHost) {
                    let deadHeroName = null;
                    if (sim.player.hp <= 0) {
                        deadHeroName = this.localName;
                    } else {
                        for (const peer of this.remotePeers.values()) {
                            if (peer.entity && peer.entity.hp <= 0) {
                                deadHeroName = peer.name;
                                break;
                            }
                        }
                    }
                    if (!sim.runOver && deadHeroName) {
                        this.send({ type: 'game_over', reason: `${deadHeroName} has fallen in battle!` });
                        this.endGameOnDisconnect(`${deadHeroName} has fallen - Game Over`);
                        return;
                    }

                    const enemyData = [];
                    for (let i = 0; i < sim.enemies.length; i++) {
                        const e = sim.enemies[i];
                        if (!e.dead || (sim.tick - e.deathTick <= 6)) {
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

                    const playersSnapshot = [{
                        slot: this.localSlot,
                        x: Math.round(sim.player.x * 100) / 100,
                        y: Math.round(sim.player.y * 100) / 100,
                        vx: Math.round((sim.player.x - sim.player.prevX) * 1000) / 1000,
                        vy: Math.round((sim.player.y - sim.player.prevY) * 1000) / 1000,
                        yaw: sim.player.yaw & 2047,
                        facingX: Math.round((sim.player.facingX || 0) * 1000) / 1000,
                        facingY: Math.round((sim.player.facingY ?? -1) * 1000) / 1000,
                        moving: Boolean(sim.player.moving),
                        moveStart: sim.player.moveStart || 0,
                        attackSeq: sim.player.attackSeq ?? -1,
                        attackStart: sim.player.attackStart || 0,
                        hp: sim.player.hp,
                        maxHp: sim.player.maxHp,
                        pauseState: this.getLocalPauseState(client)
                    }];

                    for (const peer of this.remotePeers.values()) {
                        const re = peer.entity;
                        if (!re) continue;
                        playersSnapshot.push({
                            slot: peer.slot,
                            x: Math.round(re.x * 100) / 100,
                            y: Math.round(re.y * 100) / 100,
                            vx: Math.round((re.x - re.prevX) * 1000) / 1000,
                            vy: Math.round((re.y - re.prevY) * 1000) / 1000,
                            yaw: re.yaw & 2047,
                            facingX: Math.round((re.facingX || 0) * 1000) / 1000,
                            facingY: Math.round((re.facingY ?? -1) * 1000) / 1000,
                            moving: Boolean(re.moving),
                            moveStart: re.moveStart || 0,
                            attackSeq: re.attackSeq ?? -1,
                            attackStart: re.attackStart || 0,
                            hp: re.hp,
                            maxHp: re.maxHp,
                            pauseState: peer.pauseState
                        });
                    }

                    this.send({
                        type: 'sync_world',
                        tick: sim.tick,
                        round: sim.round || 1,
                        roundStartTick: sim.roundStartTick || 0,
                        kills: sim.kills,
                        pauseState: this.getLocalPauseState(client),
                        players: playersSnapshot,
                        enemies: enemyData,
                        pickups: pickupData
                    });
                } else {
                    if (!sim.runOver && sim.player.hp <= 0) {
                        this.send({ type: 'game_over', reason: `${this.localName} has fallen in battle!` });
                        this.endGameOnDisconnect('You have died - Game Over');
                        return;
                    }

                    this.send({
                        type: 'input',
                        slot: this.localSlot,
                        tick: sim.tick,
                        pauseState: this.getLocalPauseState(client),
                        moveX: moveX,
                        moveY: moveY,
                        x: Math.round(sim.player.x * 100) / 100,
                        y: Math.round(sim.player.y * 100) / 100,
                        vx: Math.round((sim.player.x - sim.player.prevX) * 1000) / 1000,
                        vy: Math.round((sim.player.y - sim.player.prevY) * 1000) / 1000,
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
                    if (this.hasAnyRemotePause() && localState === null && client.sim.state === 'playing' && !client.sim.runOver) {
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

        this.sendLoadoutSync(client, true);

        // Hook view.submitActors to render all remote players (up to 3 teammates)
        if (client.view && !this.inGameHooked) {
            const origSubmitActors = client.view.submitActors.bind(client.view);
            client.view.submitActors = (actors, s, alpha) => {
                origSubmitActors(actors, s, alpha);

                if (!this.gameStarted || this.remotePeers.size === 0) return;

                for (const peer of this.remotePeers.values()) {
                    const p2 = peer.entity;
                    if (!p2) continue;
                    const isCorgi = p2.characterId === 'dipper';
                    const dynKey = `player_dynamic_${peer.slot}`;
                    let model;
                    if (isCorgi) {
                        model = client.assets.get('corgi');
                    } else if (p2.hasDynamicModel && client.assets.get(dynKey)) {
                        model = client.assets.get(dynKey);
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

                        actors.draw(model, anim, frame, px, height, py, p2.yaw & 2047, {
                            scale: isCorgi ? 3.0 : 1.0,
                            flash: (p2.flash > 0) ? 0.4 : 0,
                            tint: isCorgi ? 16777215 : (p2.tint || 16777215)
                        });
                    }
                }
            };

            // Hook client.view.drawOverlay for overhead HP bars, custom nametags, off-screen pointers, and party HUD
            const origDrawOverlay = client.view.drawOverlay.bind(client.view);
            const peerScreen = { x: 0, y: 0, visible: false };
            const p1Screen = { x: 0, y: 0, visible: false };
            const SLOT_COLORS = { 1: '#ffff00', 2: '#40e0ff', 3: '#50ff50', 4: '#ff90ff' };

            client.view.drawOverlay = (overlayRenderer, s, alpha) => {
                origDrawOverlay(overlayRenderer, s, alpha);

                if (!this.gameStarted || this.remotePeers.size === 0) return;

                if (overlayRenderer && overlayRenderer.ctx) {
                    const ctx = overlayRenderer.ctx;
                    const w = overlayRenderer.width;
                    const h = overlayRenderer.height;
                    const scale = Math.max(h / 900, 0.75);

                    // 1. Draw Local Player Name Tag
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

                    // 2. Draw all Remote Teammates
                    for (const peer of this.remotePeers.values()) {
                        const p2 = peer.entity;
                        if (!p2) continue;
                        const px = p2.prevX + (p2.x - p2.prevX) * alpha;
                        const py = p2.prevY + (p2.y - p2.prevY) * alpha;
                        const isCorgi = p2.characterId === 'dipper';
                        const modelHeight = isCorgi ? 95 : 200;
                        const groundHeight = s.grid ? s.grid.getHeight(px, py) / 128 : 0;
                        const worldHeight = groundHeight - (modelHeight / 128) - (15 / 128);

                        overlayRenderer.project(px, worldHeight, py, peerScreen);

                        const displayName = (peer.name || `Player ${peer.slot}`).toUpperCase();
                        const classSub = isCorgi ? 'CORGI' : (p2.characterId || 'WARRIOR').toUpperCase();
                        const tagColor = SLOT_COLORS[peer.slot] || '#ffff00';

                        const margin = 50;
                        const onScreen = peerScreen.visible && peerScreen.x >= margin && peerScreen.x <= w - margin && peerScreen.y >= margin && peerScreen.y <= h - margin;

                        if (onScreen) {
                            const barW = Math.round(34 * scale);
                            const barH = Math.round(6 * scale);
                            const barX = Math.round(peerScreen.x - barW / 2);
                            const barY = Math.round(peerScreen.y - barH * 0.6);

                            const hpRatio = Math.max(0, Math.min(1, p2.hp / (p2.maxHp || 25)));
                            const greenW = Math.floor(barW * hpRatio);

                            ctx.fillStyle = '#000000';
                            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
                            ctx.fillStyle = '#00ff00';
                            ctx.fillRect(barX, barY, greenW, barH);
                            ctx.fillStyle = '#ff0000';
                            ctx.fillRect(barX + greenW, barY, barW - greenW, barH);

                            ctx.save();
                            ctx.font = `bold ${Math.round(13 * scale)}px "OSRS Bold", monospace, sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = '#000000';
                            const partnerTag = displayName.includes(classSub) ? displayName : `${displayName} (${classSub})`;
                            ctx.strokeText(partnerTag, peerScreen.x, barY - 4);
                            ctx.fillStyle = tagColor;
                            ctx.fillText(partnerTag, peerScreen.x, barY - 4);
                            ctx.restore();
                        } else {
                            const centerX = w / 2;
                            const centerY = h / 2;
                            let targetX = peerScreen.x;
                            let targetY = peerScreen.y;
                            if (!peerScreen.visible) {
                                targetX = centerX - (peerScreen.x - centerX);
                                targetY = centerY - (peerScreen.y - centerY);
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

                            ctx.fillStyle = tagColor;
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

                            ctx.save();
                            ctx.font = `bold 12px "OSRS Small", monospace`;
                            ctx.textAlign = 'center';
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = '#000';
                            ctx.strokeText(`${displayName} (${distMeters}m)`, edgeX, edgeY + 20);
                            ctx.fillStyle = tagColor;
                            ctx.fillText(`${displayName} (${distMeters}m)`, edgeX, edgeY + 20);
                            ctx.restore();
                        }
                    }

                    // Update persistent Party HUD widget on bottom-right
                    this.updatePartyHUD();
                }
            };

            // Lock CameraRig directly to local player (px, py, pz) to eliminate remote-latency camera shake!
            if (client.cameraRig) {
                const origApply = client.cameraRig.apply.bind(client.cameraRig);
                client.cameraRig.apply = (camera, px, py, pz) => {
                    origApply(camera, px, py, pz);
                };
            }

            const origQuitRun = client.quitRun?.bind(client);
            if (origQuitRun) {
                client.quitRun = () => {
                    if (this.gameStarted) {
                        this.send({ type: 'peer_leaving' });
                        this.gameStarted = false;
                        this.localPauseState = null;
                        this.remotePeers.clear();
                        this.removePauseOverlay();
                        const hud = document.getElementById('coop-party-hud');
                        if (hud) hud.remove();
                    }
                    origQuitRun();
                };
            }

            this.inGameHooked = true;
        }

        const partnerNames = Array.from(this.remotePeers.values()).map(p => p.name.toUpperCase()).join(', ');
        this.showToast(`Co-Op Active (${partySize}P)! Party: ${partnerNames}`);
    }

    hasAnyRemotePause() {
        for (const peer of this.remotePeers.values()) {
            if (peer.pauseState !== null) return true;
        }
        return false;
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
            if (this.remotePeers.size > 0) {
                this.send({
                    type: 'coop_pause',
                    slot: this.localSlot,
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
        const pausedPeers = Array.from(this.remotePeers.values()).filter(p => p.pauseState !== null);
        if (localState !== null || pausedPeers.length === 0) {
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

        const names = pausedPeers.map(p => escapeHtml(p.name.toUpperCase())).join(', ');
        const primaryState = pausedPeers[0].pauseState;
        let titleText = 'CO-OP PAUSED';
        let bodyText = `Waiting for ${names}...`;
        let showResumeBtn = false;

        if (primaryState === 'chest') {
            titleText = 'TREASURE CASKET';
            bodyText = `${names} ${pausedPeers.length > 1 ? 'are' : 'is'} opening a treasure casket...`;
        } else if (primaryState === 'levelUp') {
            titleText = 'LEVEL UP!';
            bodyText = `${names} ${pausedPeers.length > 1 ? 'are' : 'is'} choosing a level-up reward...`;
        } else if (primaryState === 'paused') {
            titleText = 'GAME PAUSED';
            bodyText = `${names} paused the game.`;
            showResumeBtn = true;
        }

        const stateKey = pausedPeers.map(p => `${p.slot}:${p.pauseState}:${p.name}`).join('|');
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
                    <p style="margin: 0; font-size: 12px; color: #b8a890;">Simulation paused for all players to stay in sync</p>
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
                    for (const peer of this.remotePeers.values()) {
                        peer.pauseState = null;
                    }
                    this.removePauseOverlay();
                    this.send({ type: 'coop_pause', slot: this.localSlot, state: null, action: 'resume_both' });
                });
            }
        }
    }

    sendLoadoutSync(client, healed = false) {
        if (!client || !client.sim || this.remotePeers.size === 0) return;
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
            slot: this.localSlot,
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

    async bakeRemotePeerAppearance(client, peer, appearance) {
        if (!client || !client.assets || !peer || !appearance || !Array.isArray(appearance.equipment)) return;
        const equipKey = appearance.equipment.join(',');
        const dynKey = `player_dynamic_${peer.slot}`;
        if (peer.lastEquipKey === equipKey && client.assets.models.has(dynKey)) {
            if (peer.entity) peer.entity.hasDynamicModel = true;
            return;
        }
        peer.lastEquipKey = equipKey;
        const seqIds = this.playerSeqIds || [
            808, 819, 824, 836,
            386, 390, 401, 426, 711, 806, 811, 1167, 1378, 1658, 1979,
            2614, 2661, 4230, 5061, 7638, 7640, 7642, 7644, 7855, 8056, 9493
        ];
        try {
            const bakeRes = await client.assets.bake([{
                kind: 'player',
                key: dynKey,
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
            if (peer.entity) {
                peer.entity.hasDynamicModel = true;
            }
        } catch (err) {
            console.warn(`[Multiplayer] Failed baking dynamic model for slot ${peer.slot}:`, err);
        }
    }

    applyRemoteLoadout(msg) {
        const client = window.gameClient;
        if (!client || !client.sim || !msg || typeof msg !== 'object') return;
        const sim = client.sim;
        const senderSlot = sanitizeSlot(msg.senderSlot || msg.slot, 0);
        const peer = this.remotePeers.get(senderSlot);
        if (!peer || !peer.entity) return;
        const p2 = peer.entity;

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
                        inst.level = Math.max(1, Math.min(99, Math.round(Number(w.level) || 1)));
                        inst.cooldown = Math.min(inst.cooldown || 10, 10);
                        built.push(inst);
                    }
                }
            } catch (err) {
                console.warn(`[Multiplayer] Error syncing slot ${senderSlot} weapons:`, err);
            } finally {
                sim.weapons = savedWeapons;
            }
            if (built.length > 0) {
                peer.weapons = built;
            }

            peer.loadout.weapons = msg.weapons.slice(0, 6).map(w => ({
                id: String(w.id || ''),
                name: String(w.name || w.id || 'Weapon'),
                level: Math.max(1, Math.round(Number(w.level) || 1)),
                maxLevel: Math.max(1, Math.round(Number(w.maxLevel) || 8)),
                iconObjId: Number(w.iconObjId) || 0,
                rarityColor: String(w.rarityColor || '#ff981f')
            }));
        }

        if (Array.isArray(msg.passives)) {
            peer.loadout.passives = msg.passives.slice(0, 6).map(p => ({
                id: String(p?.id || ''),
                name: String(p?.name || p?.id || 'Passive'),
                level: Math.max(1, Math.round(Number(p?.level) || 1)),
                maxLevel: Math.max(1, Math.round(Number(p?.maxLevel) || 5)),
                iconObjId: Number(p?.iconObjId) || 0,
                rarityColor: String(p?.rarityColor || '#ff981f')
            }));
        }

        if (Array.isArray(msg.gear)) {
            peer.loadout.gear = msg.gear.slice(0, 8).map(g => ({
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
            peer.loadout.inventory = [0, 1, 2, 3].map(idx => {
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
            this.bakeRemotePeerAppearance(client, peer, msg.appearance);
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
            if (msg.targetSlot && sanitizeSlot(msg.targetSlot, 0) !== this.localSlot) return;
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

    // Multi-Partner HUD widget on the bottom-right showing 1 to 3 teammates' HP, Weapons, Passives, Gear, and Inventory
    updatePartyHUD() {
        const peersList = Array.from(this.remotePeers.values()).sort((a, b) => a.slot - b.slot);
        let hud = document.getElementById('coop-party-hud');
        if (peersList.length === 0) {
            if (hud) hud.remove();
            return;
        }
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'coop-party-hud';
            hud.style.cssText = `
                position: fixed;
                bottom: 18px;
                right: 18px;
                z-index: 99;
                zoom: var(--ui-scale, 1);
                display: flex;
                flex-direction: column;
                gap: 6px;
                pointer-events: auto;
                max-height: calc(72vh / var(--ui-scale, 1));
                overflow-y: auto;
                user-select: none;
            `;
            document.body.appendChild(hud);
        }

        const fastKeyParts = [`v:${this.loadoutVersion || 0}`];
        for (const peer of peersList) {
            const hp = Math.max(0, Math.round(Number(peer.entity?.hp) || 0));
            const maxHp = Math.max(1, Math.round(Number(peer.entity?.maxHp) || 25));
            fastKeyParts.push(`${peer.slot}:${peer.name}:${peer.characterId}:${hp}:${maxHp}`);
        }
        const fastKey = fastKeyParts.join('|');
        if (this.lastPartyHudFastKey === fastKey) return;
        this.lastPartyHudFastKey = fastKey;

        const isCompact = peersList.length > 1;
        const slotSize = isCompact ? 22 : 28;
        const smallSlotSize = isCompact ? 20 : 25;

        const renderMiniSlot = (entry, iconUrl, size = 26, badgeText = '', emptyLabel = '') => {
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
                        entry ? `<span style="font-size: 8px; color: #ff981f; text-align: center; line-height: 1;">${escapeHtml(entry.name.slice(0, 3).toUpperCase())}</span>` : (
                            emptyLabel ? `<span style="font-size: 8px; color: #554736;">${escapeHtml(emptyLabel[0])}</span>` : ''
                        )
                    )}
                    ${badgeText ? `
                        <span style="
                            position: absolute;
                            bottom: 0px;
                            right: 1px;
                            font-size: 8px;
                            color: #ffff00;
                            text-shadow: 1px 1px 0 #000, -1px -1px 0 #000;
                            line-height: 1;
                        ">${escapeHtml(badgeText)}</span>
                    ` : ''}
                </div>
            `;
        };

        const cardsHtml = peersList.map(peer => {
            const p2 = peer.entity || { hp: 25, maxHp: 25, characterId: peer.characterId };
            const hp = Math.max(0, Math.round(Number(p2.hp) || 0));
            const maxHp = Math.max(1, Math.round(Number(p2.maxHp) || 25));
            const isCorgi = p2.characterId === 'dipper';
            const charName = escapeHtml(isCorgi ? 'CORGI' : (p2.characterId || 'WARRIOR').replace(/_/g, ' ').toUpperCase());
            const displayName = escapeHtml((peer.name || `Player ${peer.slot}`).toUpperCase());
            const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
            const hpPercent = Math.round(hpRatio * 100);
            const barColor = hpRatio > 0.5 ? '#00ff00' : (hpRatio > 0.25 ? '#ffff00' : '#ff0000');

            const loadout = peer.loadout || { weapons: [], passives: [], gear: [], inventory: [null, null, null, null] };
            const fallbackWeapons = (peer.weapons || []).map(w => {
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
            const weapons = loadout.weapons.length > 0 ? loadout.weapons : fallbackWeapons;
            const passives = loadout.passives || [];
            const gear = loadout.gear || [];
            const inventory = loadout.inventory || [null, null, null, null];

            const weaponUrls = [0, 1, 2, 3].map(i => weapons[i] ? (this.getIconUrl(weapons[i].iconObjId) || '') : '');
            const passiveUrls = [0, 1, 2, 3].map(i => passives[i] ? (this.getIconUrl(passives[i].iconObjId) || '') : '');
            const gearUrls = gear.map(g => g?.item ? (this.getIconUrl(g.item.iconObjId) || '') : '');
            const invUrls = [0, 1, 2, 3].map(i => inventory[i] ? (this.getIconUrl(inventory[i].iconObjId) || '') : '');

            const weaponsRow = [0, 1, 2, 3].map(i => {
                const w = weapons[i];
                const lvl = w ? (w.level >= w.maxLevel ? 'max' : String(w.level)) : '';
                return renderMiniSlot(w, weaponUrls[i], slotSize, lvl, 'Weapon');
            }).join('');

            const passivesRow = [0, 1, 2, 3].map(i => {
                const p = passives[i];
                const lvl = p ? (p.level >= p.maxLevel ? 'max' : String(p.level)) : '';
                return renderMiniSlot(p, passiveUrls[i], smallSlotSize, lvl, 'Passive');
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
            const gearRow = gearList.map((g, i) => (
                renderMiniSlot(g.item, gearUrls[i] || '', smallSlotSize, '', g.slotName || 'Gear')
            )).join('');

            const invRow = [0, 1, 2, 3].map(i => {
                const item = inventory[i];
                const countBadge = item && item.count > 1 ? String(item.count) : '';
                return renderMiniSlot(item, invUrls[i], smallSlotSize, countBadge, `${i + 1}`);
            }).join('');

            return `
                <div style="
                    background: rgba(22, 17, 12, 0.94);
                    border: 2px solid #5a4a35;
                    outline: 1px solid #120e0a;
                    padding: ${isCompact ? '6px 10px' : '8px 12px'};
                    border-radius: 4px;
                    color: #ff981f;
                    font-family: 'OSRS Bold', monospace;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.8);
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    min-width: ${isCompact ? '176px' : '192px'};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 6px;">
                        <span style="font-size: 12px; color: #ffffff; text-shadow: 1px 1px #000;">P${peer.slot}: ${displayName}</span>
                        <span style="font-size: 9px; color: #ff981f;">${charName}</span>
                    </div>
                    <div style="background: #2b0000; border: 1px solid #4a3c2c; height: 8px; border-radius: 2px; overflow: hidden;">
                        <div style="background: ${barColor}; width: ${hpPercent}%; height: 100%; transition: width 0.15s ease-out;"></div>
                    </div>
                    <div style="font-size: 9px; color: #bbb; text-align: right;">${hp} / ${maxHp} HP</div>
                    <div style="border-top: 1px solid #3d3123; padding-top: 3px; display: flex; flex-direction: column; gap: 2px;">
                        <div style="display: flex; gap: 2px;">${weaponsRow}</div>
                        <div style="display: flex; gap: 2px;">${passivesRow}</div>
                        <div style="display: flex; gap: 2px;">${gearRow}</div>
                        <div style="display: flex; gap: 2px;">${invRow}</div>
                    </div>
                </div>
            `;
        }).join('');

        hud.innerHTML = cardsHtml;
    }

    endGameOnDisconnect(reason) {
        if (!this.gameStarted) return;
        this.gameStarted = false;
        this.localPauseState = null;
        this.remotePeers.clear();
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

    stepRemotePlayerPickups(sim, peer) {
        if (!sim.pickups || sim.pickups.length === 0 || !peer || !peer.entity) return;
        const p2 = peer.entity;
        const client = window.gameClient;
        const magnet = 2.5 * (1 + (sim.stats?.magnet || 0));
        const attractKey = `attracted_s${peer.slot}`;
        const speedKey = `speed_s${peer.slot}`;

        for (const pickup of sim.pickups) {
            if (pickup.value < 0) continue;
            const dx = p2.x - pickup.x;
            const dy = p2.y - pickup.y;
            const dist = Math.hypot(dx, dy);
            const magnetic = pickup.kind !== 'casket' && pickup.kind !== 'powerUp';
            if (!pickup.attracted && !pickup[attractKey] && magnetic && dist < magnet) {
                pickup[attractKey] = true;
                pickup[speedKey] = 0.05;
            }
            if (pickup[attractKey] && dist > 0.001) {
                pickup[speedKey] = Math.min((pickup[speedKey] || 0.05) + 0.02, 0.6);
                const step = Math.min(pickup[speedKey], dist);
                pickup.x += (dx / dist) * step;
                pickup.y += (dy / dist) * step;
            }
            if (dist < 0.6) {
                const origVal = pickup.value;
                pickup.value = -1;
                if (pickup.kind === 'bones' || pickup.kind === 'big_bones' || pickup.kind === 'coins') {
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
                        targetSlot: peer.slot,
                        value: origVal
                    });
                } else if (pickup.kind === 'casket') {
                    const tier = pickup.tier || 'medium';
                    sim.openCasket(tier);
                    const latestChest = sim.chests && sim.chests.length > 0 ? sim.chests[sim.chests.length - 1] : null;
                    for (const rp of this.remotePeers.values()) {
                        rp.pauseState = 'chest';
                    }
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
                        message: `${peer.name} activated a power-up!`
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
        const now = performance.now();

        if (Number.isFinite(Number(msg.tick)) && msg.tick >= 0) {
            const hostTick = Math.round(Number(msg.tick));
            if (Math.abs(hostTick - sim.tick) > 3) {
                sim.tick = hostTick;
            }
        }
        if (Number.isFinite(Number(msg.kills)) && msg.kills >= 0) {
            sim.kills = Math.round(Number(msg.kills));
        }
        if (Number.isFinite(Number(msg.round)) && msg.round >= 1) {
            const hostRound = Math.round(Number(msg.round));
            if (hostRound > (sim.round || 1)) {
                sim.round = hostRound;
                sim.roundStartTick = Number.isFinite(Number(msg.roundStartTick)) ? Math.round(Number(msg.roundStartTick)) : sim.tick;
                if (Array.isArray(sim.events)) {
                    sim.events.push({ type: 'roundStarted', round: sim.round });
                }
                if (client.handleEvents && sim.takeEvents) {
                    client.handleEvents(sim, sim.takeEvents());
                }
            }
        }

        // 1. Synchronize all players in the party (2 to 4 players)
        if (Array.isArray(msg.players)) {
            const allowedStates = new Set(['levelUp', 'chest', 'paused']);
            let pauseChanged = false;

            for (const pState of msg.players) {
                if (!pState || typeof pState !== 'object') continue;
                const slot = sanitizeSlot(pState.slot, 0);
                if (slot === this.localSlot) {
                    if (sim.player && Number.isFinite(Number(pState.hp))) {
                        sim.player.hp = Math.max(0, Number(pState.hp));
                        if (Number.isFinite(Number(pState.maxHp))) {
                            sim.player.maxHp = Math.max(1, Math.round(Number(pState.maxHp)));
                        }
                        if (sim.player.hp <= 0 && !sim.runOver) {
                            this.endGameOnDisconnect('You have died - Game Over');
                        }
                    }
                    continue;
                }

                const peer = this.remotePeers.get(slot);
                if (!peer || !peer.entity) continue;
                const re = peer.entity;

                if (pState.pauseState !== undefined) {
                    const nextRemote = (typeof pState.pauseState === 'string' && allowedStates.has(pState.pauseState)) ? pState.pauseState : null;
                    if (nextRemote !== peer.pauseState) {
                        peer.pauseState = nextRemote;
                        pauseChanged = true;
                    }
                }

                if (Number.isFinite(pState.x) && Number.isFinite(pState.y)) {
                    const nx = Math.max(0, Math.min(16384, pState.x));
                    const ny = Math.max(0, Math.min(16384, pState.y));
                    if (Number.isFinite(pState.vx) && Number.isFinite(pState.vy)) {
                        re.vx = Math.max(-1.5, Math.min(1.5, pState.vx));
                        re.vy = Math.max(-1.5, Math.min(1.5, pState.vy));
                    } else if (Number.isFinite(re.netX) && Number.isFinite(re.netY)) {
                        re.vx = Math.max(-1.5, Math.min(1.5, nx - re.netX));
                        re.vy = Math.max(-1.5, Math.min(1.5, ny - re.netY));
                    }
                    re.netX = nx;
                    re.netY = ny;
                    re.lastPacketTime = now;
                }
                if (Number.isFinite(pState.yaw)) {
                    re.yaw = Math.round(pState.yaw) & 2047;
                }
                if (Number.isFinite(pState.facingX) && Number.isFinite(pState.facingY)) {
                    re.facingX = pState.facingX;
                    re.facingY = pState.facingY;
                }
                if (typeof pState.moving === 'boolean') {
                    if (pState.moving !== re.moving) {
                        re.moveStart = Number.isFinite(pState.moveStart) ? pState.moveStart : sim.tick;
                    }
                    re.moving = pState.moving;
                }
                if (Number.isFinite(pState.attackSeq) && pState.attackSeq !== -1) {
                    re.attackSeq = pState.attackSeq;
                    if (Number.isFinite(pState.attackStart)) {
                        re.attackStart = pState.attackStart;
                    }
                }
                if (Number.isFinite(Number(pState.hp))) {
                    re.hp = Math.max(0, Number(pState.hp));
                    if (Number.isFinite(Number(pState.maxHp))) {
                        re.maxHp = Math.max(1, Math.round(Number(pState.maxHp)));
                    }
                }
            }

            if (pauseChanged) {
                client.accumulator = 0;
                this.updatePauseOverlay(client);
            }
        }

        // 2. Synchronize monsters with velocity extrapolation + soft correction
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
                    if (Number.isFinite(enemy.netX) && Number.isFinite(enemy.netY)) {
                        enemy.netVx = Math.max(-1.2, Math.min(1.2, x - enemy.netX));
                        enemy.netVy = Math.max(-1.2, Math.min(1.2, y - enemy.netY));
                    }
                    enemy.netX = x;
                    enemy.netY = y;
                    enemy.hp = hp;
                    enemy.maxHp = maxHp;
                    enemy.yaw = yaw;
                    if (dead && !enemy.dead) {
                        enemy.dead = true;
                        enemy.deathTick = sim.tick;
                    }
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
                                enemy.netX = x;
                                enemy.netY = y;
                                enemy.netVx = 0;
                                enemy.netVy = 0;
                                enemy.vx = 0;
                                enemy.vy = 0;
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

            for (let i = 0; i < sim.enemies.length; i++) {
                const e = sim.enemies[i];
                if (!hostUids.has(e.uid) && !e.dead) {
                    e.dead = true;
                    e.hp = 0;
                    e.deathTick = sim.tick;
                    e.anim = 'death';
                    e.animStart = sim.tick;
                }
            }
            sim.enemies = sim.enemies.filter(e => hostUids.has(e.uid) || (e.dead && (sim.tick - (e.deathTick || 0) < 45)));

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
                    p.targetX = px;
                    p.targetY = py;
                    if (Math.hypot(px - p.x, py - p.y) > 4.0) {
                        p.prevX = px;
                        p.prevY = py;
                        p.x = px;
                        p.y = py;
                    }
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
                        targetX: px,
                        targetY: py,
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

    applyRemoteInput(peer, msg) {
        if (!peer || !peer.entity || !msg || typeof msg !== 'object') return;
        const p2 = peer.entity;
        const moveX = Number.isFinite(msg.moveX) ? Math.max(-1, Math.min(1, msg.moveX)) : 0;
        const moveY = Number.isFinite(msg.moveY) ? Math.max(-1, Math.min(1, msg.moveY)) : 0;
        p2.moveX = moveX;
        p2.moveY = moveY;
        p2.lastPacketTime = performance.now();

        if (Number.isFinite(msg.x) && Number.isFinite(msg.y)) {
            const nx = Math.max(0, Math.min(16384, msg.x));
            const ny = Math.max(0, Math.min(16384, msg.y));
            if (Number.isFinite(msg.vx) && Number.isFinite(msg.vy)) {
                p2.vx = Math.max(-1.5, Math.min(1.5, msg.vx));
                p2.vy = Math.max(-1.5, Math.min(1.5, msg.vy));
            } else if (Number.isFinite(p2.netX) && Number.isFinite(p2.netY)) {
                p2.vx = Math.max(-1.5, Math.min(1.5, nx - p2.netX));
                p2.vy = Math.max(-1.5, Math.min(1.5, ny - p2.netY));
            }
            p2.netX = nx;
            p2.netY = ny;
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

    // Dead-reckoning velocity extrapolation + soft exponential position blending at 30Hz
    // Eliminates freeze-then-jump jitter when a player has Wi-Fi packet jitter or latency spikes
    stepRemotePlayer(sim, peer) {
        const p2 = peer.entity;
        if (!p2) return;
        if (p2.flash > 0) p2.flash--;
        if (p2.invulnerable > 0) p2.invulnerable--;

        p2.prevX = p2.x;
        p2.prevY = p2.y;

        const ageMs = performance.now() - (p2.lastPacketTime || 0);
        // Continue extrapolating along velocity vector for up to 160ms (~5 ticks) during packet jitter
        const extrapFactor = ageMs < 160 ? 1.0 : Math.max(0, 1.0 - (ageMs - 160) / 200);
        const predX = p2.x + (p2.vx || 0) * extrapFactor;
        const predY = p2.y + (p2.vy || 0) * extrapFactor;

        if (Number.isFinite(p2.netX) && Number.isFinite(p2.netY)) {
            const errX = p2.netX - predX;
            const errY = p2.netY - predY;
            const errDist = Math.hypot(errX, errY);
            if (errDist > 4.0) {
                p2.x = p2.netX;
                p2.y = p2.netY;
                p2.prevX = p2.netX;
                p2.prevY = p2.netY;
            } else {
                p2.x = predX + errX * 0.42;
                p2.y = predY + errY * 0.42;
            }
        } else {
            p2.x = predX;
            p2.y = predY;
        }

        // Decay velocity slightly so if a player stops moving and a packet drops, they decelerate smoothly
        if (!p2.moving) {
            p2.vx = (p2.vx || 0) * 0.5;
            p2.vy = (p2.vy || 0) * 0.5;
        } else {
            p2.vx = (p2.vx || 0) * 0.92;
            p2.vy = (p2.vy || 0) * 0.92;
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

    updateLobbyUI() {
        if (!this.modalEl) return;
        const box = this.modalEl.firstElementChild;
        if (!box) return;

        this.syncLocalToLobbyPlayers();
        const isHost = this.role === 'host' || this.role === null;
        const safeRoomId = escapeHtml(this.roomId || 'CONNECTING...');
        const safeInviteLink = escapeHtml(this.getInviteLink());
        const safeLocalName = escapeHtml(this.localName);

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
        const hpScaleLabel = partyCount <= 2 ? '2.0x' : (partyCount === 3 ? '2.7x' : '3.55x');
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
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 12px; font-size: 11px;">
                <span style="background: #231a12; border: 1px solid #6b5842; color: #40e0ff; padding: 3px 10px; border-radius: 3px;">
                    👥 Party: ${partyCount}/4 Players Connected
                </span>
                <span style="background: #231a12; border: 1px solid #6b5842; color: #ff6040; padding: 3px 10px; border-radius: 3px;">
                    ⚔ Co-Op Scaling: ${hpScaleLabel} Monster HP
                </span>
                <span style="background: #231a12; border: 1px solid #6b5842; color: #ffff00; padding: 3px 10px; border-radius: 3px;">
                    ★ Host Classes: ${unlockedChars.length}/${visibleTotal} Unlocked
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
                    ` : `
                        <div style="font-size: 15px; color: #ffff00;">
                            ${escapeHtml(currentRegion.name)}${this.selectedEndless ? ' <span style="color: #ff6040;">[ENDLESS]</span>' : ''} <span style="font-size: 11px; color: #888;">(Selected by Host)</span>
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
                    <div style="flex: 2; padding: 9px; color: #ffff00; font-size: 14px; align-self: center;">
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

        const localNameInput = box.querySelector('#coop-local-name');
        if (localNameInput) {
            localNameInput.oninput = (e) => this.setPlayerName(e.target.value);
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
