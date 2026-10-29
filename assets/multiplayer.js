// Run Escape - Multiplayer Co-Op Module (RFC 6455 WebSockets)
// AGENT DIRECTIVE: Before modifying this file, read ../AGENTS.md and ../AGENT_NOTES.md.
// After completing changes, run `node --check assets/multiplayer.js`, bump `?v=X.Y` across all 6 entry points in ../AGENTS.md, and prepend a handoff entry to ../AGENT_NOTES.md.
// Supports 2 to 4 players with Host-authoritative simulation, class model baking,
// jitter-free velocity extrapolation + soft correction, dynamic party HP scaling,
// mutual player awareness (custom lobby names, overhead HP bars, nametags, multi-partner HUD, off-screen arrows),
// and synchronized pause/casket barriers.

const ALL_CHARACTERS = [
    { id: 'dipper', name: 'Dipper (Corgi)', weapon: 'throwing_knives', defaultUnlocked: false, secretCode: true },
    { id: 'elias', name: 'Elias (Chihuahua)', weapon: 'scimitar', defaultUnlocked: false, secretCode: true },
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
    { id: 'javelineer', name: 'Javelineer', weapon: 'eclipse_atlatl', defaultUnlocked: false },
    { id: 'scammer', name: 'Scammer', weapon: 'throwing_knives', defaultUnlocked: false },
    { id: 'f2p_pker', name: 'F2P PKer', weapon: 'two_handed_sword', defaultUnlocked: false },
    { id: 'durial321', name: 'Durial321', weapon: 'abyssal_whip', defaultUnlocked: false },
    { id: 'lms_sweat', name: 'LMS Sweat', weapon: 'ice_burst', defaultUnlocked: false }
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
    { id: 'varlamore', name: 'Varlamore', bosses: 'Manticore, Colossi & Sol Heredit', difficulty: '2.75x Base HP / 2.05x Dmg' },
    { id: 'fight_caves', name: 'Fight Caves (Jad & Zuk)', bosses: 'TzTok-Jad (6:00) & TzKal-Zuk (12:00 - Prayer Switch Required!)', difficulty: 'One-Shot Unless Praying (Q/E/R)' },
    { id: 'grand_exchange', name: 'Grand Exchange (Fun)', bosses: 'The Doubler, Lure Master, Bot Farmer & Melodox', difficulty: 'Endless Fun Map (1.0x Base)' },
    { id: 'east_varrock', name: 'East Varrock Ditch (Fun)', bosses: 'Clan Leader, Rune 2h Pure & Wildy Mage', difficulty: 'Endless Fun Map (1.0x Base)' },
    { id: 'falador', name: 'Falador Massacre (Fun)', bosses: 'Player Moderator, Cursed You & Mod Murdoch', difficulty: 'Endless Fun Map (All Durial321)' },
    { id: 'last_man_standing', name: 'Last Man Standing (Fun)', bosses: 'AGS Specer, Claws Specer & Dharok Risker', difficulty: 'Endless Fun Map (1.0x Base)' }
];
const ALLOWED_REGIONS = new Set(ALL_REGIONS.map(r => r.id));

const SPAWN_OFFSETS = {
    1: { dx: -0.75, dy: -0.5 },
    2: { dx: 0.75, dy: -0.5 },
    3: { dx: -0.75, dy: 0.75 },
    4: { dx: 0.75, dy: 0.75 }
};

const COOP_DIFFICULTY_WEIGHTS = {
    1: { label: '1P Preview (2P Active on Start)', hpMult: 1.85, bossHpMult: 2.25, dmgMult: 1.10, spawnMult: 1.25, heavyWeightBias: 0.25, ringMult: 1.25, xpMult: 0.85 },
    2: { label: '2P Duo', hpMult: 1.85, bossHpMult: 2.25, dmgMult: 1.10, spawnMult: 1.25, heavyWeightBias: 0.25, ringMult: 1.25, xpMult: 0.85 },
    3: { label: '3P Trio', hpMult: 2.55, bossHpMult: 3.25, dmgMult: 1.22, spawnMult: 1.50, heavyWeightBias: 0.50, ringMult: 1.50, xpMult: 0.72 },
    4: { label: '4P Quad', hpMult: 3.30, bossHpMult: 4.25, dmgMult: 1.35, spawnMult: 1.75, heavyWeightBias: 0.80, ringMult: 1.75, xpMult: 0.62 }
};

function getCoopDifficultyWeights(partyCount) {
    const clamped = Math.max(1, Math.min(4, Math.round(Number(partyCount) || 2)));
    return COOP_DIFFICULTY_WEIGHTS[clamped] || COOP_DIFFICULTY_WEIGHTS[2];
}

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
        this._sortedRemotePeers = null;

        this.gameStarted = false;
        this.gameConfig = null; // { seed, mapId, partySize, players: [{slot, name, character, isHost}], unlockedItems }

        this.localPauseState = null;
        this.spectateSlot = null;
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

    getSortedRemotePeers() {
        if (!this._sortedRemotePeers) {
            this._sortedRemotePeers = Array.from(this.remotePeers.values()).sort((a, b) => a.slot - b.slot);
        }
        return this._sortedRemotePeers;
    }

    invalidateSortedRemotePeers() {
        this._sortedRemotePeers = null;
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
        for (const s of this.lobbyPlayers.keys()) {
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
                        this.invalidateSortedRemotePeers();
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
                this.endGameOnDisconnect(typeof msg.reason === 'string' ? msg.reason.slice(0, 80) : 'Game Over', msg.leaderboard);
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
        this.localNameDraft = String(name ?? '').slice(0, 14).replace(/[^a-zA-Z0-9 ()_-]/g, '');
        const cleaned = sanitizeName(this.localNameDraft);
        this.localNameCustomized = Boolean(cleaned);
        this.localName = cleaned || `Player ${this.localSlot}`;
        this.syncLocalToLobbyPlayers();
        clearTimeout(this._nameUpdateTimer);
        this._nameUpdateTimer = setTimeout(() => {
            this.sendLobbyUpdate();
        }, 150);
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
            if (cleanChar !== 'dipper' && cleanChar !== 'elias' && client.getAppearance) {
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
        const localChar = config.mapId === 'falador' ? 'durial321' : (localEntry.character || 'warrior');
        this.localName = localEntry.name || this.localName;

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
        this.spectateSlot = null;
        this.lastPartyHudKey = '';
        this.lastPartyHudFastKey = '';
        this.loadoutVersion = 0;
        this._gameOverSent = false;
        this._victorySent = false;
        this._seenEffectUids = new Set();
        this.damageStats = new Map();
        this.lastLeaderboard = null;
        this.remotePeers.clear();
        this.invalidateSortedRemotePeers();
        this.removePauseOverlay();

        const initStat = (slot, name, characterId) => {
            const charObj = ALL_CHARACTERS.find(c => c.id === characterId);
            this.damageStats.set(slot, {
                slot,
                name: sanitizeName(name) || `Player ${slot}`,
                characterId,
                charName: charObj ? charObj.name : String(characterId || 'Warrior'),
                damage: 0,
                kills: 0
            });
        };
        initStat(this.localSlot, this.localName, localChar);
        for (const pInfo of partyPlayers) {
            if (!pInfo) continue;
            const s = sanitizeSlot(pInfo.slot, 2);
            const cId = sim.map?.fun?.character || sanitizeCharacter(pInfo.character, 'warrior');
            initStat(s, pInfo.name, cId);
        }

        if (sim.endRun) {
            const origEndRun = sim.endRun.bind(sim);
            sim.endRun = (state) => {
                const lb = this.buildLeaderboard();
                const res = origEndRun(state);
                if (isHost && state === 'victory' && !this._victorySent && this.remotePeers.size > 0) {
                    this._victorySent = true;
                    this.send({
                        type: 'coop_pickup',
                        kind: 'victory',
                        kills: sim.kills,
                        tick: sim.tick,
                        leaderboard: lb
                    });
                }
                return res;
            };
        }

        // Hook sim.playerDied so that dying while any teammate is still alive enters Spectator Mode instead of ending the lobby
        const localPlayerRef = sim.player;
        if (sim.playerDied) {
            const origPlayerDied = sim.playerDied.bind(sim);
            sim.playerDied = () => {
                // Case A: Host's stepEnemies swapped sim.player to a remote peer.entity when that peer took lethal damage
                if (sim.player !== localPlayerRef) {
                    const p = sim.player;
                    p.hp = 0;
                    p.spectating = true;
                    p.activePrayer = null;
                    p.moving = false;
                    p.moveX = 0;
                    p.moveY = 0;
                    if (p.deathTick === -1) {
                        p.deathTick = sim.tick;
                        sim.events.push({ type: 'playerDied' });
                    }
                    return;
                }
                // Case B: Local player took lethal damage
                if (sim.revivesLeft > 0) {
                    origPlayerDied();
                    return;
                }
                let anyPeerAlive = false;
                for (const peer of this.remotePeers.values()) {
                    if (peer.entity && peer.entity.hp > 0 && !peer.entity.spectating) {
                        anyPeerAlive = true;
                        break;
                    }
                }
                if (anyPeerAlive) {
                    this.enterSpectatorMode(client, sim);
                    return;
                }
                origPlayerDied();
            };
        }

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
            const charId = sim.map?.fun?.character || sanitizeCharacter(pInfo.character, 'warrior');

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
            this.invalidateSortedRemotePeers();
            sim.remotePlayers.push(entity);
        }

        // Maintain sim.player2 alias for compatibility
        sim.player2 = sim.remotePlayers[0] || null;

        const getActiveWeights = () => {
            const activePartySize = Math.max(2, Math.min(4, this.remotePeers.size + 1));
            return getCoopDifficultyWeights(activePartySize);
        };

        if (isHost) {
            // 1. Scale wave density, spawn rate, and enemy tier weights based on 2-4 player party size
            if (sim.currentWave) {
                const origCurrentWave = sim.currentWave.bind(sim);
                sim.currentWave = () => {
                    const baseWave = origCurrentWave();
                    if (!baseWave) return baseWave;
                    const w = getActiveWeights();
                    let minBaseHp = Infinity;
                    let maxBaseHp = 0;
                    const defs = baseWave.enemies.map(e => {
                        const d = client.getEnemyDef ? client.getEnemyDef(e.id) : null;
                        const hp = d?.hp || 10;
                        if (hp < minBaseHp) minBaseHp = hp;
                        if (hp > maxBaseHp) maxBaseHp = hp;
                        return { entry: e, hp };
                    });
                    const hpSpan = Math.max(1, maxBaseHp - minBaseHp);
                    const weightedEnemies = defs.map(({ entry, hp }, idx) => {
                        const toughnessRatio = maxBaseHp > minBaseHp
                            ? (hp - minBaseHp) / hpSpan
                            : (defs.length > 1 ? idx / (defs.length - 1) : 0);
                        const adjustedWeight = Math.max(
                            0.1,
                            Math.round(entry.weight * (1 + toughnessRatio * w.heavyWeightBias) * 100) / 100
                        );
                        return { ...entry, weight: adjustedWeight };
                    });
                    return {
                        ...baseWave,
                        minAlive: Math.round(baseWave.minAlive * w.spawnMult),
                        maxAlive: Math.round(baseWave.maxAlive * w.spawnMult),
                        spawnRate: baseWave.spawnRate * w.spawnMult,
                        enemies: weightedEnemies
                    };
                };
            }

            // 2. Scale ring ambush count and target a random living party member
            if (sim.spawnRing) {
                const origSpawnRing = sim.spawnRing.bind(sim);
                sim.spawnRing = (def, count) => {
                    const w = getActiveWeights();
                    const scaledCount = Math.max(1, Math.round((count || 12) * w.ringMult));
                    const livingTargets = [];
                    if (sim.player && sim.player.hp > 0 && !sim.player.spectating) {
                        livingTargets.push(sim.player);
                    }
                    for (const peer of this.remotePeers.values()) {
                        if (peer.entity && peer.entity.hp > 0 && !peer.entity.spectating) {
                            livingTargets.push(peer.entity);
                        }
                    }
                    const chosenTarget = livingTargets[Math.floor(Math.random() * livingTargets.length)] || sim.player;
                    const savedPlayer = sim.player;
                    sim.player = chosenTarget;
                    try {
                        return origSpawnRing(def, scaledCount);
                    } finally {
                        sim.player = savedPlayer;
                    }
                };
            }

            // 3. Scale Monster HP, Boss/Elite HP, Monster Damage, and XP weight per party size
            const scaleEnemyForCoop = (enemy, kind) => {
                if (!enemy || enemy._coopHpScaled) return;
                enemy._coopHpScaled = true;
                const w = getActiveWeights();
                const isBossOrElite = kind === 'boss' || kind === 'finalBoss' || kind === 'elite' || enemy.boss || enemy.elite;
                const hpMult = isBossOrElite ? w.bossHpMult : w.hpMult;
                enemy.hp = Math.max(1, Math.round(enemy.hp * hpMult));
                enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hpMult));
                if (Number.isFinite(enemy.damage)) {
                    enemy.damage = Math.max(1, Math.round(enemy.damage * w.dmgMult));
                }
                if (Number.isFinite(enemy.xp)) {
                    enemy.xp = Math.max(1, Math.round(enemy.xp * w.xpMult));
                }
            };

            const origSpawnEnemy = sim.spawnEnemy.bind(sim);
            sim.spawnEnemy = (def, kind, pos, bossHp) => {
                const enemy = origSpawnEnemy(def, kind, pos, bossHp);
                scaleEnemyForCoop(enemy, kind);
                return enemy;
            };
            for (const enemy of sim.enemies) {
                scaleEnemyForCoop(enemy, enemy?.boss ? 'boss' : (enemy?.elite ? 'elite' : 'normal'));
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
                            if (peer.entity && peer.entity.hp > 0 && !peer.entity.spectating) {
                                peer.pauseState = 'chest';
                            }
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

            // Track which player (slot) is currently dealing damage so monster AI prioritizes the last attacker first and damage/kill stats are recorded per player
            this._activeAttackerSlot = null;
            if (sim.placeCannon) {
                const origPlaceCannon = sim.placeCannon.bind(sim);
                sim.placeCannon = (cfg) => {
                    const prevLen = sim.turrets.length;
                    const res = origPlaceCannon(cfg);
                    if (sim.turrets.length > prevLen) {
                        const t = sim.turrets[sim.turrets.length - 1];
                        t.ownerSlot = this._activeAttackerSlot || sim.player?.slot || this.localSlot;
                    }
                    return res;
                };
                sim.placeTurret = sim.placeCannon;
            }
            if (sim.stepTurrets) {
                const origStepTurrets = sim.stepTurrets.bind(sim);
                sim.stepTurrets = () => {
                    const prevSlot = this._activeAttackerSlot;
                    const beforeProjLen = sim.projectiles.length;
                    try {
                        origStepTurrets();
                        if (sim.projectiles.length > beforeProjLen) {
                            const fallbackOwner = sim.turrets[0]?.ownerSlot || this.localSlot;
                            for (let i = beforeProjLen; i < sim.projectiles.length; i++) {
                                const p = sim.projectiles[i];
                                if (!p.ownerSlot) {
                                    let bestSlot = fallbackOwner;
                                    let bestDist = Infinity;
                                    for (const t of sim.turrets) {
                                        const d = Math.hypot(t.x - p.x, t.y - p.y);
                                        if (d < bestDist) {
                                            bestDist = d;
                                            bestSlot = t.ownerSlot || this.localSlot;
                                        }
                                    }
                                    p.ownerSlot = bestSlot;
                                }
                            }
                        }
                    } finally {
                        this._activeAttackerSlot = prevSlot;
                    }
                };
            }
            if (sim.stepThralls) {
                const origStepThralls = sim.stepThralls.bind(sim);
                sim.stepThralls = () => {
                    const prevSlot = this._activeAttackerSlot;
                    const beforeProjLen = sim.projectiles.length;
                    try {
                        origStepThralls();
                        if (sim.projectiles.length > beforeProjLen) {
                            for (let i = beforeProjLen; i < sim.projectiles.length; i++) {
                                const p = sim.projectiles[i];
                                if (!p.ownerSlot) {
                                    let bestSlot = this.localSlot;
                                    let bestDist = Infinity;
                                    for (const th of sim.thralls) {
                                        const d = Math.hypot(th.x - p.x, th.y - p.y);
                                        if (d < bestDist) {
                                            bestDist = d;
                                            bestSlot = th.ownerSlot || th.owner?.slot || this.localSlot;
                                        }
                                    }
                                    p.ownerSlot = bestSlot;
                                }
                            }
                        }
                    } finally {
                        this._activeAttackerSlot = prevSlot;
                    }
                };
            }
            if (sim.damageEnemy) {
                const origDamageEnemy = sim.damageEnemy.bind(sim);
                sim.damageEnemy = (enemy, amount, knockback, srcX, srcY, mightScale, isDot) => {
                    let attackerSlot = this._activeAttackerSlot || (enemy && enemy.lastAttackerSlot) || this.localSlot;
                    if (enemy && !enemy.dead && !isDot) {
                        if (this._activeAttackerSlot) {
                            attackerSlot = this._activeAttackerSlot;
                            enemy.lastAttackerSlot = attackerSlot;
                            enemy.lastAttackedTick = sim.tick;
                            enemy.lastDotAttackerSlot = attackerSlot;
                        } else if (Number.isFinite(srcX) && Number.isFinite(srcY)) {
                            let bestSlot = this.localSlot;
                            let bestDist = (sim.player && sim.player.hp > 0 && !sim.player.spectating)
                                ? Math.hypot(sim.player.x - srcX, sim.player.y - srcY)
                                : Infinity;
                            for (const peer of this.remotePeers.values()) {
                                if (peer.entity && peer.entity.hp > 0 && !peer.entity.spectating) {
                                    const d = Math.hypot(peer.entity.x - srcX, peer.entity.y - srcY);
                                    if (d < bestDist) {
                                        bestDist = d;
                                        bestSlot = peer.slot;
                                    }
                                }
                            }
                            attackerSlot = bestSlot;
                            enemy.lastAttackerSlot = bestSlot;
                            enemy.lastAttackedTick = sim.tick;
                            enemy.lastDotAttackerSlot = bestSlot;
                        }
                    } else if (isDot && enemy && enemy.lastDotAttackerSlot) {
                        attackerSlot = enemy.lastDotAttackerSlot;
                    }
                    const prevHp = enemy && !enemy.dead ? Math.max(0, enemy.hp) : 0;
                    const wasDead = Boolean(!enemy || enemy.dead);
                    const res = origDamageEnemy(enemy, amount, knockback, srcX, srcY, mightScale, isDot);
                    if (enemy && !wasDead) {
                        const afterHp = enemy.dead ? 0 : Math.max(0, enemy.hp);
                        const dealt = Math.max(0, prevHp - afterHp);
                        const stat = this.damageStats?.get(attackerSlot) || this.damageStats?.get(this.localSlot);
                        if (stat) {
                            stat.damage += dealt;
                            if (enemy.dead) stat.kills += 1;
                        }
                    }
                    return res;
                };
            }

            if (sim.projectileHit) {
                const origProjectileHit = sim.projectileHit.bind(sim);
                sim.projectileHit = (proj, enemy) => {
                    const prevSlot = this._activeAttackerSlot;
                    this._activeAttackerSlot = (proj && proj.ownerSlot) ? proj.ownerSlot : this.localSlot;
                    try {
                        return origProjectileHit(proj, enemy);
                    } finally {
                        this._activeAttackerSlot = prevSlot;
                    }
                };
            }

            // Helper: collect all living players with their dedicated BFS FlowFields
            const getLivingPlayerTargets = () => {
                const targets = [];
                if (sim.player && sim.player.hp > 0 && sim.player.deathTick === -1 && !sim.player.spectating) {
                    targets.push({
                        slot: this.localSlot,
                        entity: sim.player,
                        flowField: sim.flowField,
                        bucket: []
                    });
                }
                for (const peer of this.remotePeers.values()) {
                    if (peer.entity && peer.entity.hp > 0 && peer.entity.deathTick === -1 && !peer.entity.spectating) {
                        if (!peer.flowField && sim.flowField && sim.flowField.constructor) {
                            peer.flowField = new sim.flowField.constructor(sim.flowField.size);
                        }
                        targets.push({
                            slot: peer.slot,
                            entity: peer.entity,
                            flowField: peer.flowField || sim.flowField,
                            bucket: []
                        });
                    }
                }
                if (targets.length === 0) {
                    targets.push({
                        slot: this.localSlot,
                        entity: sim.player,
                        flowField: sim.flowField,
                        bucket: []
                    });
                }
                return targets;
            };

            // Multi-player safe monster spawning: spawn around a random living player while enforcing minimum safe distance from ALL living players
            if (sim.findSpawnPoint) {
                const origFindSpawnPoint = sim.findSpawnPoint.bind(sim);
                sim.findSpawnPoint = (def, minRange, maxRange, dir) => {
                    const living = getLivingPlayerTargets();
                    if (living.length <= 1) {
                        return origFindSpawnPoint(def, minRange, maxRange, dir);
                    }
                    const savedPlayer = sim.player;
                    const savedFlowField = sim.flowField;
                    try {
                        for (let attempt = 0; attempt < 28; attempt++) {
                            const anchor = living[sim.rng.int(living.length)];
                            sim.player = anchor.entity;
                            sim.flowField = anchor.flowField;
                            if (anchor.slot !== this.localSlot && sim.updateFlowField) {
                                sim.updateFlowField();
                            }
                            const pt = origFindSpawnPoint(def, minRange, maxRange, attempt < 4 ? dir : undefined);
                            if (!pt) continue;
                            // Reject candidate spawn points that land too close to ANY living player in the party
                            const minSafeDist = attempt < 20 ? Math.max(12, minRange * 0.85) : 10.5;
                            let safeForAll = true;
                            for (let k = 0; k < living.length; k++) {
                                const pl = living[k].entity;
                                if (Math.hypot(pt.x - pl.x, pt.y - pl.y) < minSafeDist) {
                                    safeForAll = false;
                                    break;
                                }
                            }
                            if (safeForAll) {
                                return pt;
                            }
                        }
                        return undefined;
                    } finally {
                        sim.player = savedPlayer;
                        sim.flowField = savedFlowField;
                    }
                };
            }

            // Multi-player safe relocation: only relocate an enemy if it is far (> 34 tiles) from EVERY living player
            if (sim.relocate) {
                const origRelocate = sim.relocate.bind(sim);
                sim.relocate = (enemy) => {
                    if (!enemy) return;
                    const living = getLivingPlayerTargets();
                    for (let i = 0; i < living.length; i++) {
                        const pl = living[i].entity;
                        if (Math.hypot(pl.x - enemy.x, pl.y - enemy.y) <= 34) {
                            // Another living player is still within range; drop stale attacker lock instead of teleporting in midair
                            enemy.lastAttackerSlot = null;
                            return;
                        }
                    }
                    origRelocate(enemy);
                };
            }

            // Hook sim.stepEnemies on Host:
            // 1. Priority 1: Target the last player who attacked the monster (if that player is alive)
            // 2. Priority 2: Target the closest living player
            // 3. Give each player their own BFS FlowField so monsters pathfind around walls toward every player
            const origStepEnemies = sim.stepEnemies.bind(sim);
            sim.stepEnemies = () => {
                const activeTargets = getLivingPlayerTargets();
                if (activeTargets.length <= 1 && activeTargets[0].slot === this.localSlot) {
                    origStepEnemies();
                    return;
                }

                const slotToTargetIdx = new Map();
                for (let j = 0; j < activeTargets.length; j++) {
                    slotToTargetIdx.set(activeTargets[j].slot, j);
                }

                const allEnemies = sim.enemies;
                for (let i = 0; i < allEnemies.length; i++) {
                    const enemy = allEnemies[i];
                    if (enemy.dead) {
                        activeTargets[0].bucket.push(enemy);
                        continue;
                    }
                    let chosenIdx = -1;
                    if (enemy.lastAttackerSlot && slotToTargetIdx.has(enemy.lastAttackerSlot)) {
                        const attackerIdx = slotToTargetIdx.get(enemy.lastAttackerSlot);
                        const attackerEntity = activeTargets[attackerIdx].entity;
                        if (Math.hypot(attackerEntity.x - enemy.x, attackerEntity.y - enemy.y) <= 34) {
                            chosenIdx = attackerIdx;
                        } else {
                            enemy.lastAttackerSlot = null;
                        }
                    }
                    if (chosenIdx === -1) {
                        chosenIdx = 0;
                        let bestDist = Math.hypot(activeTargets[0].entity.x - enemy.x, activeTargets[0].entity.y - enemy.y);
                        for (let j = 1; j < activeTargets.length; j++) {
                            const d = Math.hypot(activeTargets[j].entity.x - enemy.x, activeTargets[j].entity.y - enemy.y);
                            if (d < bestDist) {
                                bestDist = d;
                                chosenIdx = j;
                            }
                        }
                    }
                    activeTargets[chosenIdx].bucket.push(enemy);
                }

                const savedPlayer = sim.player;
                const savedFlowField = sim.flowField;
                try {
                    for (const t of activeTargets) {
                        if (t.bucket.length === 0) continue;
                        const initialLen = t.bucket.length;
                        sim.enemies = t.bucket;
                        sim.player = t.entity;
                        sim.flowField = t.flowField || savedFlowField;
                        if (t.slot !== this.localSlot && sim.updateFlowField) {
                            sim.updateFlowField();
                        }
                        origStepEnemies();
                        if (t.bucket.length > initialLen) {
                            for (let k = initialLen; k < t.bucket.length; k++) {
                                allEnemies.push(t.bucket[k]);
                            }
                        }
                    }
                } finally {
                    sim.flowField = savedFlowField;
                    sim.enemies = allEnemies;
                    sim.player = savedPlayer;
                }
            };

            // Hook sim.stepEnemyProjectiles on Host so enemy projectiles home toward and collide with ALL living players (not a dead/spectating Host)
            if (sim.stepEnemyProjectiles) {
                sim.stepEnemyProjectiles = () => {
                    const living = getLivingPlayerTargets();
                    const savedPlayer = sim.player;
                    try {
                        for (const e of sim.enemyProjectiles) {
                            e.prevX = e.x;
                            e.prevY = e.y;
                            e.life--;
                            let targetEntity = living[0]?.entity || savedPlayer;
                            let bestD = Math.hypot(targetEntity.x - e.x, targetEntity.y - e.y);
                            for (let k = 1; k < living.length; k++) {
                                const d = Math.hypot(living[k].entity.x - e.x, living[k].entity.y - e.y);
                                if (d < bestD) {
                                    bestD = d;
                                    targetEntity = living[k].entity;
                                }
                            }
                            const n = targetEntity.x - e.x;
                            const s = targetEntity.y - e.y;
                            if (e.homing > 0) {
                                const r = Math.atan2(e.vy, e.vx);
                                let l = Math.atan2(s, n) - r;
                                l = Math.atan2(Math.sin(l), Math.cos(l));
                                const h = r + Math.max(-e.homing, Math.min(e.homing, l));
                                e.vx = Math.cos(h) * e.speed;
                                e.vy = Math.sin(h) * e.speed;
                                e.yaw = Math.round(Math.atan2(-e.vx, -e.vy) * 1024 / Math.PI) & 2047;
                            }
                            e.x += e.vx;
                            e.y += e.vy;
                            const a = e.radius + targetEntity.radius;
                            if (e.life > 0 && Math.hypot(targetEntity.x - e.x, targetEntity.y - e.y) <= a) {
                                e.life = 0;
                                if (e.crowd && targetEntity.invulnerable > 0) continue;
                                sim.player = targetEntity;
                                const r = sim.enemies.find(l => l.uid === e.enemyUid);
                                if (sim.bossHit(e.enemyId, r, e.attack, e.damage), sim.runOver) return;
                            }
                        }
                    } finally {
                        sim.player = savedPlayer;
                    }
                };
            }
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
            if (sim.damageEnemy) {
                const origGuestDamageEnemy = sim.damageEnemy.bind(sim);
                sim.damageEnemy = (enemy, amount, knockback, srcX, srcY, mightScale, isDot) => {
                    const evLen = sim.events.length;
                    const res = origGuestDamageEnemy(enemy, amount, knockback, srcX, srcY, mightScale, isDot);
                    // Suppress local duplicate damage hitsplats on Guest; Host streams authoritative damage events in sync_world.visEvents
                    if (sim.events.length > evLen) {
                        sim.events.length = evLen;
                    }
                    return res;
                };
            }
            sim.stepEnemyProjectiles = () => {
                for (let i = 0; i < sim.enemyProjectiles.length; i++) {
                    const ep = sim.enemyProjectiles[i];
                    ep.prevX = ep.x;
                    ep.prevY = ep.y;
                    ep.x += ep.vx || 0;
                    ep.y += ep.vy || 0;
                    ep.life--;
                }
            };
            sim.enemies = [];
            console.log('[Multiplayer] Guest initialized in 2-4P client sync mode.');
        }

        // Hook sim.stepOrbit so each remote player's orbiting weapons orbit around that remote player
        if (sim.stepOrbit) {
            const origStepOrbit = sim.stepOrbit.bind(sim);
            sim.stepOrbit = (proj, orbit) => {
                const prevSlot = this._activeAttackerSlot;
                this._activeAttackerSlot = (proj && proj.ownerSlot) ? proj.ownerSlot : this.localSlot;
                if (orbit && orbit.owner) {
                    const savedPlayer = sim.player;
                    sim.player = orbit.owner;
                    try {
                        origStepOrbit(proj, orbit);
                    } finally {
                        sim.player = savedPlayer;
                        this._activeAttackerSlot = prevSlot;
                    }
                } else {
                    try {
                        origStepOrbit(proj, orbit);
                    } finally {
                        this._activeAttackerSlot = prevSlot;
                    }
                }
            };
        }

        // Hook sim.stepWeapons to fire all remote players' weapons
        const origStepWeapons = sim.stepWeapons.bind(sim);
        sim.stepWeapons = () => {
            const localAlive = sim.player && sim.player.hp > 0 && !sim.player.spectating;
            if (!localAlive) {
                sim.projectiles = sim.projectiles.filter(p => !(p.orbit && (!p.ownerSlot || p.ownerSlot === this.localSlot)));
            } else {
                const hasRemoteOrbits = sim.projectiles.some(p => p.orbit && p.ownerSlot && p.ownerSlot !== this.localSlot);
                let remoteOrbits = null;
                if (hasRemoteOrbits) {
                    remoteOrbits = sim.projectiles.filter(p => p.orbit && p.ownerSlot && p.ownerSlot !== this.localSlot);
                    sim.projectiles = sim.projectiles.filter(p => !(p.orbit && p.ownerSlot && p.ownerSlot !== this.localSlot));
                }
                this._activeAttackerSlot = this.localSlot;
                try {
                    origStepWeapons();
                } finally {
                    this._activeAttackerSlot = null;
                }
                for (const p of sim.projectiles) {
                    if (!p.ownerSlot) {
                        p.ownerSlot = this.localSlot;
                        if (p.orbit) p.orbit.owner = sim.player;
                    }
                }
                if (remoteOrbits && remoteOrbits.length > 0) {
                    sim.projectiles.push(...remoteOrbits);
                }
            }

            if (this.remotePeers.size > 0) {
                const origPlayer = sim.player;
                for (const peer of this.remotePeers.values()) {
                    const rEntity = peer.entity;
                    const rWeapons = peer.weapons;
                    if (!rEntity || rEntity.hp <= 0 || rEntity.spectating || !rWeapons || rWeapons.length === 0) {
                        sim.projectiles = sim.projectiles.filter(p => !(p.orbit && p.ownerSlot === peer.slot));
                        continue;
                    }

                    const hasOtherOrbits = sim.projectiles.some(p => p.orbit && p.ownerSlot !== peer.slot);
                    let otherOrbits = null;
                    if (hasOtherOrbits) {
                        otherOrbits = sim.projectiles.filter(p => p.orbit && p.ownerSlot !== peer.slot);
                        sim.projectiles = sim.projectiles.filter(p => !(p.orbit && p.ownerSlot !== peer.slot));
                    }

                    sim.player = rEntity;
                    this._activeAttackerSlot = peer.slot;
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
                            if (!p.ownerSlot) {
                                p.ownerSlot = peer.slot;
                                if (p.orbit) p.orbit.owner = rEntity;
                            }
                        }
                    } finally {
                        this._activeAttackerSlot = null;
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
                    if (sim.state === 'victory' && !this._victorySent) {
                        this._victorySent = true;
                        const lb = this.buildLeaderboard();
                        this.send({
                            type: 'coop_pickup',
                            kind: 'victory',
                            kills: sim.kills,
                            tick: sim.tick,
                            leaderboard: lb
                        });
                        return;
                    }

                    const hostAlive = sim.player && sim.player.hp > 0 && !sim.player.spectating && sim.state !== 'dead';
                    let anyPeerAlive = false;
                    for (const peer of this.remotePeers.values()) {
                        if (peer.entity) {
                            if (peer.entity.hp > 0 && !peer.entity.spectating) {
                                anyPeerAlive = true;
                            } else if (!peer._deathAnnounced) {
                                peer._deathAnnounced = true;
                                peer.entity.spectating = true;
                                peer.entity.activePrayer = null;
                                peer.pauseState = null;
                                if (peer.entity.deathTick === -1) {
                                    peer.entity.deathTick = sim.tick;
                                }
                                this.showToast(`${peer.name} has fallen! Spectating surviving party...`);
                            }
                        }
                    }

                    if (!hostAlive && anyPeerAlive && !sim.player.spectating) {
                        this.enterSpectatorMode(client, sim);
                    }

                    if (!this._gameOverSent && !hostAlive && !anyPeerAlive) {
                        this._gameOverSent = true;
                        const lb = this.buildLeaderboard();
                        this.send({ type: 'game_over', reason: 'All party members have fallen in battle!', leaderboard: lb });
                        this.endGameOnDisconnect('All party members have fallen - Game Over', lb);
                        return;
                    }

                    const enemyData = [];
                    for (let i = 0; i < sim.enemies.length; i++) {
                        const e = sim.enemies[i];
                        if (!e.dead || (sim.tick - e.deathTick <= 6)) {
                            const wu = e.bossState?.windup;
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
                                e.elite ? 1 : (e.boss ? 2 : 0),
                                e.variant || 0,
                                e.attackSeq ?? e.def.attackSeq ?? -1,
                                wu && wu.attack ? [
                                    wu.attack.name, wu.startTick, wu.landTick,
                                    Math.round((wu.targets?.[0]?.x ?? wu.targetX ?? 0) * 100) / 100,
                                    Math.round((wu.targets?.[0]?.y ?? wu.targetY ?? 0) * 100) / 100,
                                    wu.dir ?? 0,
                                    // Blast attacks (Jad's Rockfall) need their target circles on guests too
                                    Array.isArray(wu.targets) ? wu.targets.slice(0, 8).map(t => [Math.round(t.x * 100) / 100, Math.round(t.y * 100) / 100]) : []
                                ] : null
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

                    const turretData = [];
                    if (Array.isArray(sim.turrets)) {
                        for (let i = 0; i < sim.turrets.length; i++) {
                            const t = sim.turrets[i];
                            if (sim.tick < t.endTick) {
                                turretData.push([
                                    t.uid,
                                    Math.round(t.x * 100) / 100,
                                    Math.round(t.y * 100) / 100,
                                    t.yaw & 2047,
                                    t.startTick,
                                    t.endTick,
                                    Math.round((t.range || 8) * 100) / 100,
                                    t.amount || 1,
                                    t.interval || 18
                                ]);
                            }
                        }
                    }

                    const thrallData = [];
                    if (Array.isArray(sim.thralls)) {
                        for (let i = 0; i < sim.thralls.length; i++) {
                            const th = sim.thralls[i];
                            if (sim.tick < th.endTick && th.def) {
                                thrallData.push([
                                    th.uid,
                                    th.def.id,
                                    th.ownerSlot || th.owner?.slot || this.localSlot,
                                    Math.round(th.x * 100) / 100,
                                    Math.round(th.y * 100) / 100,
                                    th.yaw & 2047,
                                    th.moving ? 1 : 0,
                                    th.attackStart ?? -1,
                                    th.startTick,
                                    th.endTick
                                ]);
                            }
                        }
                    }

                    const enemyProjData = [];
                    if (Array.isArray(sim.enemyProjectiles)) {
                        for (let i = 0; i < sim.enemyProjectiles.length; i++) {
                            const ep = sim.enemyProjectiles[i];
                            if (ep.life > 0 && ep.attack?.spotAnim !== undefined) {
                                enemyProjData.push([
                                    ep.uid,
                                    ep.attack.spotAnim,
                                    Math.round(ep.x * 100) / 100,
                                    Math.round(ep.y * 100) / 100,
                                    Math.round((ep.vx || 0) * 1000) / 1000,
                                    Math.round((ep.vy || 0) * 1000) / 1000,
                                    ep.yaw & 2047,
                                    ep.startTick,
                                    ep.life
                                ]);
                            }
                        }
                    }

                    const effectData = [];
                    if (Array.isArray(sim.effects)) {
                        for (let i = 0; i < sim.effects.length; i++) {
                            const ef = sim.effects[i];
                            if (ef.startTick >= sim.tick - 1 && sim.tick < ef.endTick) {
                                effectData.push([
                                    ef.uid,
                                    ef.spotAnim,
                                    Math.round(ef.x * 100) / 100,
                                    Math.round(ef.y * 100) / 100,
                                    ef.height || 0,
                                    Math.max(5, ef.endTick - ef.startTick),
                                    ef.enemyUid || 0
                                ]);
                            }
                        }
                    }

                    const visEvents = [];
                    if (Array.isArray(sim.events)) {
                        for (let i = 0; i < sim.events.length; i++) {
                            const ev = sim.events[i];
                            if (!ev) continue;
                            if (
                                ev.type === 'damage' ||
                                ev.type === 'playerHit' ||
                                ev.type === 'playerPoisoned' ||
                                ev.type === 'bossSwing' ||
                                ev.type === 'bossShout' ||
                                ev.type === 'bossAttack' ||
                                ev.type === 'blast' ||
                                ev.type === 'aura' ||
                                ev.type === 'cannonSetup' ||
                                ev.type === 'cannonFire' ||
                                ev.type === 'powerUp' ||
                                ev.type === 'bossSpawned' ||
                                ev.type === 'bossRose' ||
                                ev.type === 'bossEnraged'
                            ) {
                                visEvents.push(ev);
                            }
                        }
                    }

                    const localStat = this.damageStats?.get(this.localSlot);
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
                        activePrayer: sim.player.activePrayer || window._osrsPrayer || null,
                        pauseState: this.getLocalPauseState(client),
                        dmg: Math.round(localStat?.damage || 0),
                        kills: Math.round(localStat?.kills || 0)
                    }];

                    for (const peer of this.remotePeers.values()) {
                        const re = peer.entity;
                        if (!re) continue;
                        const pStat = this.damageStats?.get(peer.slot);
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
                            activePrayer: re.activePrayer || null,
                            pauseState: peer.pauseState,
                            dmg: Math.round(pStat?.damage || 0),
                            kills: Math.round(pStat?.kills || 0)
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
                        pickups: pickupData,
                        turrets: turretData.length > 0 ? turretData : undefined,
                        thralls: thrallData.length > 0 ? thrallData : undefined,
                        enemyProjs: enemyProjData.length > 0 ? enemyProjData : undefined,
                        effects: effectData.length > 0 ? effectData : undefined,
                        visEvents: visEvents.length > 0 ? visEvents : undefined
                    });
                } else {
                    const localAlive = sim.player && sim.player.hp > 0 && !sim.player.spectating && sim.state !== 'dead';
                    let anyPeerAlive = false;
                    for (const peer of this.remotePeers.values()) {
                        if (peer.entity && peer.entity.hp > 0 && !peer.entity.spectating) {
                            anyPeerAlive = true;
                            break;
                        }
                    }

                    if (!localAlive) {
                        if (anyPeerAlive) {
                            if (!sim.player.spectating) {
                                this.enterSpectatorMode(client, sim);
                            }
                        } else if (!this._gameOverSent) {
                            this._gameOverSent = true;
                            this.send({ type: 'game_over', reason: 'All party members have fallen in battle!' });
                            this.endGameOnDisconnect('All party members have fallen - Game Over');
                            return;
                        }
                    }

                    const isSpectating = Boolean(sim.player.spectating || sim.player.hp <= 0);
                    this.send({
                        type: 'input',
                        slot: this.localSlot,
                        tick: sim.tick,
                        dead: isSpectating,
                        pauseState: isSpectating ? null : this.getLocalPauseState(client),
                        moveX: isSpectating ? 0 : moveX,
                        moveY: isSpectating ? 0 : moveY,
                        x: Math.round(sim.player.x * 100) / 100,
                        y: Math.round(sim.player.y * 100) / 100,
                        vx: isSpectating ? 0 : Math.round((sim.player.x - sim.player.prevX) * 1000) / 1000,
                        vy: isSpectating ? 0 : Math.round((sim.player.y - sim.player.prevY) * 1000) / 1000,
                        yaw: sim.player.yaw & 2047,
                        facingX: Math.round((sim.player.facingX || 0) * 1000) / 1000,
                        facingY: Math.round((sim.player.facingY ?? -1) * 1000) / 1000,
                        moving: isSpectating ? false : Boolean(sim.player.moving),
                        moveStart: sim.player.moveStart || 0,
                        attackSeq: isSpectating ? -1 : (sim.player.attackSeq ?? -1),
                        attackStart: sim.player.attackStart || 0,
                        activePrayer: isSpectating ? null : (sim.player.activePrayer || window._osrsPrayer || null)
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
                    const isDeadPeer = p2.hp <= 0 || p2.spectating;
                    if (isDeadPeer && p2.deathTick >= 0 && (s.tick - p2.deathTick) >= 35) {
                        continue;
                    }
                    const isCorgi = p2.characterId === 'dipper';
                    const isChih = p2.characterId === 'elias';
                    const isDog = isCorgi || isChih;
                    const dynKey = `player_dynamic_${peer.slot}`;
                    let model;
                    if (isCorgi) {
                        model = client.assets.get('corgi');
                    } else if (isChih) {
                        model = client.assets.get('chihuahua');
                    } else if (p2.hasDynamicModel && client.assets.get(dynKey)) {
                        model = client.assets.get(dynKey);
                    } else {
                        model = client.assets.get('player_' + p2.characterId) || client.assets.getPlayer();
                    }

                    if (model && model.anims && model.anims.length > 0) {
                        let anim;
                        let frame = 0;
                        if (isDeadPeer && !isDog) {
                            anim = model.getAnim(836) || model.anims[0];
                            frame = anim ? anim.getFrame(Math.max(0, s.tick - (p2.deathTick >= 0 ? p2.deathTick : s.tick)), false) : 0;
                        } else if (isDog) {
                            anim = p2.moving ?
                                (model.getAnim(6560) || model.anims[0]) :
                                (model.getAnim(6561) || model.anims[0]);
                            frame = anim ? anim.getFrame(Math.max(0, s.tick - p2.moveStart)) : 0;
                        } else {
                            const attackAnim = p2.attackSeq !== -1 ? model.getAnim(p2.attackSeq) : null;
                            const isAttacking = Boolean(
                                attackAnim &&
                                attackAnim.seqId === p2.attackSeq &&
                                (!p2.moving || (s.tick - p2.attackStart) < 12) &&
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
                        const height = (s.grid ? s.grid.getHeight(px, py) / 128 : 0) - (isDog ? 0.22 : 0);

                        actors.draw(model, anim, frame, px, height, py, p2.yaw & 2047, {
                            scale: isDog ? 3.0 : 1.0,
                            flash: (p2.flash > 0) ? 0.4 : 0,
                            tint: isDog ? 16777215 : (p2.tint || 16777215)
                        });
                    }
                }
            };

            // Hook client.view.drawOverlay for overhead HP bars, custom nametags, off-screen pointers, spectator banner, and party HUD
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
                    const isLocalSpectating = Boolean(s.player && (s.player.spectating || s.player.hp <= 0));
                    const spectatedPeer = isLocalSpectating ? this.getSpectatedPeer() : null;

                    // 1. Draw Local Player Name Tag (only while alive)
                    if (s.player && s.player.deathTick === -1 && !isLocalSpectating) {
                        const p1 = s.player;
                        const px1 = p1.prevX + (p1.x - p1.prevX) * alpha;
                        const py1 = p1.prevY + (p1.y - p1.prevY) * alpha;
                        const isDog1 = p1.characterId === 'dipper' || p1.characterId === 'elias';
                        const modelH1 = isDog1 ? 95 : 200;
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

                    // 2. Draw all Living Remote Teammates
                    const refEntity = (isLocalSpectating && spectatedPeer?.entity) ? spectatedPeer.entity : s.player;
                    for (const peer of this.remotePeers.values()) {
                        const p2 = peer.entity;
                        if (!p2 || p2.hp <= 0 || p2.spectating) continue;
                        const px = p2.prevX + (p2.x - p2.prevX) * alpha;
                        const py = p2.prevY + (p2.y - p2.prevY) * alpha;
                        const isCorgi = p2.characterId === 'dipper';
                        const isChih = p2.characterId === 'elias';
                        const isDog = isCorgi || isChih;
                        const modelHeight = isDog ? 95 : 200;
                        const groundHeight = s.grid ? s.grid.getHeight(px, py) / 128 : 0;
                        const worldHeight = groundHeight - (modelHeight / 128) - (15 / 128);

                        overlayRenderer.project(px, worldHeight, py, peerScreen);

                        const displayName = (peer.name || `Player ${peer.slot}`).toUpperCase();
                        const classSub = isCorgi ? 'CORGI' : (isChih ? 'CHIHUAHUA' : (p2.characterId || 'WARRIOR').toUpperCase());
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
                            if (p2.activePrayer) {
                                drawOverheadPrayerEmblem(ctx, peerScreen.x, barY - Math.round(28 * scale), scale, p2.activePrayer);
                            }
                        } else if (refEntity) {
                            const centerX = w / 2;
                            const centerY = h / 2;
                            const p1x = refEntity.prevX + (refEntity.x - refEntity.prevX) * alpha;
                            const p1y = refEntity.prevY + (refEntity.y - refEntity.prevY) * alpha;
                            const worldDx = px - p1x;
                            const worldDy = py - p1y;
                            const worldDist = Math.hypot(worldDx, worldDy) || 1;
                            const p1Ground = s.grid ? s.grid.getHeight(p1x, p1y) / 128 : 0;
                            const p1Scr = { x: centerX, y: centerY, visible: true };
                            const stepScr = { x: centerX, y: centerY, visible: true };
                            overlayRenderer.project(p1x, p1Ground, p1y, p1Scr);
                            overlayRenderer.project(
                                p1x + (worldDx / worldDist) * 2.0,
                                p1Ground,
                                p1y + (worldDy / worldDist) * 2.0,
                                stepScr
                            );

                            const dx = stepScr.x - p1Scr.x;
                            const dy = stepScr.y - p1Scr.y;
                            const angle = Math.atan2(dy, dx);

                            const pad = 40;
                            const edgeX = Math.min(Math.max(centerX + Math.cos(angle) * (w / 2 - pad), pad), w - pad);
                            const edgeY = Math.min(Math.max(centerY + Math.sin(angle) * (h / 2 - pad), pad), h - pad);

                            const distMeters = Math.round(worldDist);

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

                    // 3. Draw Spectator Mode Banner when local player has died and is spectating a teammate
                    if (isLocalSpectating && spectatedPeer && spectatedPeer.entity) {
                        const sp = spectatedPeer.entity;
                        const spName = (spectatedPeer.name || `Player ${spectatedPeer.slot}`).toUpperCase();
                        const spHp = Math.max(0, Math.round(sp.hp || 0));
                        const spMaxHp = Math.max(1, Math.round(sp.maxHp || 25));
                        const bannerW = Math.round(390 * scale);
                        const bannerH = Math.round(54 * scale);
                        const bannerX = Math.round((w - bannerW) / 2);
                        const bannerY = Math.round(74 * scale);

                        ctx.save();
                        ctx.fillStyle = 'rgba(20, 15, 10, 0.92)';
                        ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
                        ctx.strokeStyle = '#5a4a35';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);

                        ctx.textAlign = 'center';
                        ctx.font = `bold ${Math.round(15 * scale)}px "OSRS Bold", monospace, sans-serif`;
                        ctx.fillStyle = '#ff4444';
                        ctx.fillText(`YOU HAVE FALLEN - SPECTATING P${spectatedPeer.slot}: ${spName}`, w / 2, bannerY + Math.round(22 * scale));

                        ctx.font = `${Math.round(12 * scale)}px "OSRS Small", monospace, sans-serif`;
                        ctx.fillStyle = '#ff981f';
                        ctx.fillText(`Teammate HP: ${spHp}/${spMaxHp}   •   [TAB] or Click Party Card to Switch`, w / 2, bannerY + Math.round(42 * scale));
                        ctx.restore();
                    }

                    // Update persistent Party HUD widget on bottom-right
                    this.updatePartyHUD();
                }
            };

            // Lock CameraRig directly to local player (or spectated teammate when dead)
            if (client.cameraRig) {
                const origApply = client.cameraRig.apply.bind(client.cameraRig);
                client.cameraRig.apply = (camera, px, py, pz) => {
                    if (this.gameStarted && client.sim && client.sim.player && (client.sim.player.spectating || client.sim.player.hp <= 0)) {
                        const targetPeer = this.getSpectatedPeer();
                        if (targetPeer && targetPeer.entity) {
                            const te = targetPeer.entity;
                            const tx = te.x;
                            const tz = te.y;
                            const ty = client.view ? client.view.ground(client.sim, tx, tz) : py;
                            origApply(camera, tx, ty, tz);
                            return;
                        }
                    }
                    origApply(camera, px, py, pz);
                };
            }

            const origQuitRun = client.quitRun?.bind(client);
            if (origQuitRun) {
                client.quitRun = () => {
                    window._hideOsrsPrayerBar?.();
                    if (this.gameStarted) {
                        this.send({ type: 'peer_leaving' });
                        this.gameStarted = false;
                        this.localPauseState = null;
                        this.spectateSlot = null;
                        this.remotePeers.clear();
                        this.invalidateSortedRemotePeers();
                        this.removePauseOverlay();
                        const hud = document.getElementById('coop-party-hud');
                        if (hud) hud.remove();
                    }
                    origQuitRun();
                };
            }

            this.inGameHooked = true;
        }

        const activePartyCount = Math.max(2, Math.min(4, this.remotePeers.size + 1));
        const partnerNames = Array.from(this.remotePeers.values()).map(p => p.name.toUpperCase()).join(', ');
        this.showToast(`Co-Op Active (${activePartyCount}P)! Party: ${partnerNames}`);
    }

    getSpectatedPeer() {
        let bestPeer = null;
        for (const p of this.remotePeers.values()) {
            if (p.entity && p.entity.hp > 0 && !p.entity.spectating) {
                if (this.spectateSlot !== null && p.slot === this.spectateSlot) {
                    return p;
                }
                if (!bestPeer || p.slot < bestPeer.slot) {
                    bestPeer = p;
                }
            }
        }
        if (bestPeer) {
            this.spectateSlot = bestPeer.slot;
        }
        return bestPeer;
    }

    cycleSpectateTarget(dir = 1) {
        const peersList = this.getSortedRemotePeers();
        const livingPeers = [];
        for (let i = 0; i < peersList.length; i++) {
            const p = peersList[i];
            if (p.entity && p.entity.hp > 0 && !p.entity.spectating) {
                livingPeers.push(p);
            }
        }
        if (livingPeers.length === 0) return null;
        const currentIdx = livingPeers.findIndex(p => p.slot === this.spectateSlot);
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + dir + livingPeers.length) % livingPeers.length;
        this.spectateSlot = livingPeers[nextIdx].slot;
        this.lastPartyHudFastKey = '';
        return livingPeers[nextIdx];
    }

    enterSpectatorMode(client, sim) {
        if (!sim || !sim.player) return;
        const p = sim.player;
        const wasAlreadySpectating = Boolean(p.spectating);
        p.hp = 0;
        p.spectating = true;
        p.activePrayer = null;
        p.moving = false;
        p.moveX = 0;
        p.moveY = 0;
        if (p.deathTick === -1) {
            p.deathTick = sim.tick;
        }
        window._hideOsrsPrayerBar?.();
        sim.runOver = false;
        if (sim.state === 'dead' || sim.state === 'levelUp' || sim.state === 'chest') {
            sim.state = 'playing';
        }
        const target = this.getSpectatedPeer();
        if (!wasAlreadySpectating) {
            client?.sounds?.playerDied?.();
            const targetName = target ? target.name : 'teammate';
            this.showToast(`You have fallen! Spectating ${targetName} ([TAB] to switch)`);
        }
        if (client) {
            client.syncOverlay?.();
            client.updateHud?.(true);
            this.syncLocalPauseState(client, true);
        }
        this.lastPartyHudFastKey = '';
    }

    hasAnyRemotePause() {
        for (const peer of this.remotePeers.values()) {
            if (peer.pauseState !== null) return true;
        }
        return false;
    }

    getLocalPauseState(client) {
        if (!client || !client.sim || client.sim.runOver) return null;
        if (client.paused) return 'paused';
        if (client.sim.player?.spectating || client.sim.player?.hp <= 0) return null;
        if (client.sim.state === 'chest') return 'chest';
        if (client.sim.state === 'levelUp') return 'levelUp';
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
        if (localState !== null) {
            this.removePauseOverlay();
            return;
        }
        const pausedPeers = [];
        for (const p of this.remotePeers.values()) {
            if (p.pauseState !== null) {
                pausedPeers.push(p);
            }
        }
        if (pausedPeers.length === 0) {
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
            const maxLen = w.def?.levels?.length || 1;
            const lvlDef = w.def?.levels?.[Math.min(w.level || 1, maxLen) - 1];
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
        if (client.getSimAppearance && sim.characterId !== 'dipper' && sim.characterId !== 'elias') {
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

        if (msg.appearance && p2.characterId !== 'dipper' && p2.characterId !== 'elias') {
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
            if (sim.player?.spectating || sim.player?.hp <= 0) return;
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
        } else if (kind === 'victory') {
            if (this._victorySent) return;
            this._victorySent = true;
            window._hideOsrsPrayerBar?.();
            if (Number.isFinite(Number(msg.kills)) && msg.kills >= 0) {
                sim.kills = Math.round(Number(msg.kills));
            }
            for (const e of sim.enemies) {
                if (e.boss && e.def?.id && !sim.bossesKilled?.includes(e.def.id)) {
                    sim.bossesKilled?.push(e.def.id);
                }
            }
            this.buildLeaderboard(msg.leaderboard);
            this.removePauseOverlay();
            const hud = document.getElementById('coop-party-hud');
            if (hud) hud.remove();
            this.gameStarted = false;
            this.spectateSlot = null;
            sim.endRun('victory');
            client.finishRun();
            client.syncOverlay();
            client.updateHud(true);
        }
    }

    buildLeaderboard(overrideStats = null) {
        if (Array.isArray(overrideStats) && overrideStats.length > 0 && this.damageStats) {
            for (const st of overrideStats) {
                if (!st || typeof st !== 'object') continue;
                const s = sanitizeSlot(st.slot, 0);
                const entry = this.damageStats.get(s);
                if (entry) {
                    if (Number.isFinite(Number(st.damage))) entry.damage = Math.max(entry.damage, Math.round(Number(st.damage)));
                    if (Number.isFinite(Number(st.kills))) entry.kills = Math.max(entry.kills, Math.round(Number(st.kills)));
                }
            }
        }
        if (!this.damageStats || this.damageStats.size === 0) return [];
        const list = Array.from(this.damageStats.values()).map(e => ({
            slot: e.slot,
            name: e.name,
            characterId: e.characterId,
            charName: e.charName,
            damage: Math.max(0, Math.round(e.damage || 0)),
            kills: Math.max(0, Math.round(e.kills || 0)),
            isLocal: e.slot === this.localSlot
        }));
        list.sort((a, b) => (b.damage - a.damage) || (b.kills - a.kills) || (a.slot - b.slot));
        const totalDmg = list.reduce((sum, r) => sum + r.damage, 0);
        for (const r of list) {
            r.pct = totalDmg > 0 ? Math.round((r.damage / totalDmg) * 1000) / 10 : 0;
        }
        this.lastLeaderboard = list;
        return list;
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
        if (this.remotePeers.size === 0) {
            const hud = document.getElementById('coop-party-hud');
            if (hud) hud.remove();
            return;
        }

        const peersList = this.getSortedRemotePeers();
        const client = window.gameClient;
        const isLocalSpectating = Boolean(client?.sim?.player && (client.sim.player.spectating || client.sim.player.hp <= 0));
        const activeSpectatePeer = isLocalSpectating ? this.getSpectatedPeer() : null;

        let fastKey = 'v:' + (this.loadoutVersion || 0) + '|sp:' + (isLocalSpectating ? (activeSpectatePeer?.slot || 0) : -1);
        for (let i = 0; i < peersList.length; i++) {
            const peer = peersList[i];
            const hp = Math.max(0, Math.round(Number(peer.entity?.hp) || 0));
            const maxHp = Math.max(1, Math.round(Number(peer.entity?.maxHp) || 25));
            fastKey += '|' + peer.slot + ':' + peer.name + ':' + peer.characterId + ':' + hp + ':' + maxHp + ':' + (peer.entity?.spectating ? 1 : 0);
        }
        if (this.lastPartyHudFastKey === fastKey) return;
        this.lastPartyHudFastKey = fastKey;

        let hud = document.getElementById('coop-party-hud');
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
            const isChih = p2.characterId === 'elias';
            const charName = escapeHtml(isCorgi ? 'CORGI' : (isChih ? 'CHIHUAHUA' : (p2.characterId || 'WARRIOR').replace(/_/g, ' ').toUpperCase()));
            const displayName = escapeHtml((peer.name || `Player ${peer.slot}`).toUpperCase());
            const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
            const hpPercent = Math.round(hpRatio * 100);
            const barColor = hpRatio > 0.5 ? '#00ff00' : (hpRatio > 0.25 ? '#ffff00' : '#ff0000');

            const loadout = peer.loadout || { weapons: [], passives: [], gear: [], inventory: [null, null, null, null] };
            const fallbackWeapons = (peer.weapons || []).map(w => {
                const maxLen = w.def?.levels?.length || 1;
                const lvlDef = w.def?.levels?.[Math.min(w.level || 1, maxLen) - 1];
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
                const lvl = w ? (w.level > w.maxLevel ? `+${w.level - w.maxLevel}` : (w.level === w.maxLevel ? 'max' : String(w.level))) : '';
                return renderMiniSlot(w, weaponUrls[i], slotSize, lvl, 'Weapon');
            }).join('');

            const passivesRow = [0, 1, 2, 3].map(i => {
                const p = passives[i];
                const lvl = p ? (p.level > p.maxLevel ? `+${p.level - p.maxLevel}` : (p.level === p.maxLevel ? 'max' : String(p.level))) : '';
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

            const isDeadPeer = hp <= 0 || Boolean(p2.spectating);
            const isSpectated = Boolean(isLocalSpectating && !isDeadPeer && activeSpectatePeer?.slot === peer.slot);
            const cardBorder = isSpectated ? '#ffff00' : (isDeadPeer ? '#6e2222' : '#5a4a35');
            const statusText = isDeadPeer ? 'DEAD' : `${hp} / ${maxHp} HP`;
            const statusColor = isDeadPeer ? '#ff4444' : '#bbb';

            return `
                <div data-peer-slot="${peer.slot}" style="
                    background: rgba(22, 17, 12, 0.94);
                    border: 2px solid ${cardBorder};
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
                    opacity: ${isDeadPeer ? '0.68' : '1'};
                    cursor: ${isLocalSpectating && !isDeadPeer ? 'pointer' : 'default'};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 6px;">
                        <span style="font-size: 12px; color: ${isSpectated ? '#ffff00' : '#ffffff'}; text-shadow: 1px 1px #000;">P${peer.slot}: ${displayName}${isSpectated ? ' [SPECTATING]' : ''}</span>
                        <span style="font-size: 9px; color: #ff981f;">${charName}</span>
                    </div>
                    <div style="background: #2b0000; border: 1px solid #4a3c2c; height: 8px; border-radius: 2px; overflow: hidden;">
                        <div style="background: ${barColor}; width: ${hpPercent}%; height: 100%; transition: width 0.15s ease-out;"></div>
                    </div>
                    <div style="font-size: 9px; color: ${statusColor}; text-align: right;">${statusText}</div>
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
        hud.querySelectorAll('[data-peer-slot]').forEach(card => {
            card.addEventListener('click', () => {
                const slot = Number(card.getAttribute('data-peer-slot'));
                const peer = this.remotePeers.get(slot);
                if (peer && peer.entity && peer.entity.hp > 0 && !peer.entity.spectating) {
                    this.spectateSlot = slot;
                    this.lastPartyHudFastKey = '';
                    this.updatePartyHUD();
                }
            });
        });
    }

    endGameOnDisconnect(reason, leaderboard = null) {
        if (!this.gameStarted) {
            if (leaderboard) {
                this.buildLeaderboard(leaderboard);
                const client = window.gameClient;
                if (client?.store) {
                    const snap = client.store.getSnapshot?.() || {};
                    client.store.set({ ...snap });
                }
            }
            return;
        }
        this.buildLeaderboard(leaderboard);
        this.gameStarted = false;
        this.localPauseState = null;
        this.spectateSlot = null;
        this.remotePeers.clear();
        this.invalidateSortedRemotePeers();
        this.removePauseOverlay();
        window._hideOsrsPrayerBar?.();
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

    isCoopSessionActive() {
        return Boolean(
            (this.ws && this.ws.readyState === WebSocket.OPEN && this.roomId) ||
            (Array.isArray(this.lastLeaderboard) && this.lastLeaderboard.length > 0)
        );
    }

    returnToLobby() {
        this.lastLeaderboard = null;
        this.gameStarted = false;
        this._gameOverSent = false;
        this._victorySent = false;
        this.localPauseState = null;
        this.spectateSlot = null;
        this.remotePeers.clear();
        this.removePauseOverlay();
        window._hideOsrsPrayerBar?.();
        const hud = document.getElementById('coop-party-hud');
        if (hud) hud.remove();

        const client = window.gameClient;
        if (client) {
            try {
                client.leaveRun();
            } catch (err) {
                console.warn('[Multiplayer] Error leaving run for lobby:', err);
            }
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.roomId) {
            this.localReady = true;
            this.syncLocalToLobbyPlayers();
            this.sendLobbyUpdate();
            this.renderLobbyModal();
        } else {
            this.openLobbyModal(this.roomId || null);
        }
    }

    leaveCoopToTitle() {
        this.lastLeaderboard = null;
        this.gameStarted = false;
        this._gameOverSent = false;
        this._victorySent = false;
        this.localPauseState = null;
        this.spectateSlot = null;
        this.remotePeers.clear();
        this.removePauseOverlay();
        window._hideOsrsPrayerBar?.();
        const hud = document.getElementById('coop-party-hud');
        if (hud) hud.remove();
        this.closeLobbyModal();

        const client = window.gameClient;
        if (client) {
            try {
                client.leaveRun();
            } catch (err) {
                console.warn('[Multiplayer] Error leaving run to title:', err);
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
                pickup.pileUid = 0;
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
                    let latestChest = null;
                    if (!sim.player.spectating && sim.player.hp > 0) {
                        sim.openCasket(tier);
                        latestChest = sim.chests && sim.chests.length > 0 ? sim.chests[sim.chests.length - 1] : null;
                    }
                    for (const rp of this.remotePeers.values()) {
                        if (rp.entity && rp.entity.hp > 0 && !rp.entity.spectating) {
                            rp.pauseState = 'chest';
                        }
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
                    const savedSlot = this._activeAttackerSlot;
                    sim.player = p2;
                    this._activeAttackerSlot = peer.slot;
                    try {
                        if (sim._origCollect) {
                            sim._origCollect({ ...pickup, value: origVal });
                        } else {
                            sim.collect({ ...pickup, value: origVal });
                        }
                    } finally {
                        this._activeAttackerSlot = savedSlot;
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
            let localPlayerSnapshot = null;

            for (const pState of msg.players) {
                if (!pState || typeof pState !== 'object') continue;
                const slot = sanitizeSlot(pState.slot, 0);
                const dStat = this.damageStats?.get(slot);
                if (dStat) {
                    if (Number.isFinite(Number(pState.dmg))) dStat.damage = Math.max(0, Math.round(Number(pState.dmg)));
                    if (Number.isFinite(Number(pState.kills))) dStat.kills = Math.max(0, Math.round(Number(pState.kills)));
                }
                if (slot === this.localSlot) {
                    localPlayerSnapshot = pState;
                    continue;
                }

                const peer = this.remotePeers.get(slot);
                if (!peer || !peer.entity) continue;
                const re = peer.entity;

                if (Number.isFinite(Number(pState.hp))) {
                    re.hp = Math.max(0, Number(pState.hp));
                    if (Number.isFinite(Number(pState.maxHp))) {
                        re.maxHp = Math.max(1, Math.round(Number(pState.maxHp)));
                    }
                }
                if (re.hp <= 0) {
                    re.spectating = true;
                    re.activePrayer = null;
                    re.moving = false;
                    re.vx = 0;
                    re.vy = 0;
                    if (re.deathTick === -1) {
                        re.deathTick = sim.tick;
                    }
                    if (peer.pauseState !== null) {
                        peer.pauseState = null;
                        pauseChanged = true;
                    }
                    if (!peer._deathAnnounced) {
                        peer._deathAnnounced = true;
                        this.showToast(`${peer.name} has fallen!`);
                    }
                    continue;
                }

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
                re.activePrayer = (pState.activePrayer === 'magic' || pState.activePrayer === 'ranged' || pState.activePrayer === 'melee') ? pState.activePrayer : null;
            }

            if (localPlayerSnapshot && sim.player && Number.isFinite(Number(localPlayerSnapshot.hp))) {
                if (sim.player.spectating) {
                    sim.player.hp = 0;
                } else {
                    sim.player.hp = Math.max(0, Number(localPlayerSnapshot.hp));
                }
                if (Number.isFinite(Number(localPlayerSnapshot.maxHp))) {
                    sim.player.maxHp = Math.max(1, Math.round(Number(localPlayerSnapshot.maxHp)));
                }
                if (sim.player.hp <= 0 && !sim.runOver) {
                    let anyPeerAlive = false;
                    for (const peer of this.remotePeers.values()) {
                        if (peer.entity && peer.entity.hp > 0 && !peer.entity.spectating) {
                            anyPeerAlive = true;
                            break;
                        }
                    }
                    if (anyPeerAlive) {
                        if (!sim.player.spectating) {
                            this.enterSpectatorMode(client, sim);
                        }
                    } else {
                        this.endGameOnDisconnect('All party members have fallen - Game Over');
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
                    uid, defId, x, y, hp, maxHp, yaw, dead, anim, animStart, flash, scale, kindFlag, variant, attackSeq, windupData
                ] = item;
                hostUids.add(uid);

                const applyBossWindup = (targetEnemy, wuArr) => {
                    if (!targetEnemy || !targetEnemy.bossState || !targetEnemy.def?.boss?.attacks) return;
                    if (Array.isArray(wuArr) && wuArr.length >= 3) {
                        const [atkName, startTick, landTick, targetX, targetY, dir, targetList] = wuArr;
                        const atk = targetEnemy.def.boss.attacks.find(a => a.name === atkName) || targetEnemy.def.boss.attacks[0];
                        if (atk) {
                            let targets = Array.isArray(targetList)
                                ? targetList.filter(t => Array.isArray(t) && Number.isFinite(t[0]) && Number.isFinite(t[1])).map(t => ({ x: t[0], y: t[1] }))
                                : [];
                            if (targets.length === 0 && atk.kind === 'blast') targets = [{ x: Number(targetX) || targetEnemy.x, y: Number(targetY) || targetEnemy.y }];
                            targetEnemy.bossState.windup = {
                                attack: atk,
                                targets,
                                startTick: Number(startTick) || sim.tick,
                                landTick: Number(landTick) || (sim.tick + 30),
                                targetX: Number(targetX) || targetEnemy.x,
                                targetY: Number(targetY) || targetEnemy.y,
                                dir: Number(dir) || 0
                            };
                        }
                    } else {
                        targetEnemy.bossState.windup = undefined;
                    }
                };

                let enemy = existingMap.get(uid);
                if (enemy) {
                    if (Number.isFinite(enemy.netX) && Number.isFinite(enemy.netY)) {
                        const jumpDist = Math.hypot(x - enemy.netX, y - enemy.netY);
                        if (jumpDist > 4.0) {
                            enemy.x = x;
                            enemy.y = y;
                            enemy.prevX = x;
                            enemy.prevY = y;
                            enemy.netVx = 0;
                            enemy.netVy = 0;
                        } else {
                            enemy.netVx = Math.max(-1.2, Math.min(1.2, x - enemy.netX));
                            enemy.netVy = Math.max(-1.2, Math.min(1.2, y - enemy.netY));
                        }
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
                    if (Number.isFinite(variant)) enemy.variant = variant;
                    if (Number.isFinite(attackSeq)) enemy.attackSeq = attackSeq;
                    applyBossWindup(enemy, windupData);
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
                                if (Number.isFinite(variant)) enemy.variant = variant;
                                if (Number.isFinite(attackSeq)) enemy.attackSeq = attackSeq;
                                applyBossWindup(enemy, windupData);
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
                        spawnTick: sim.tick,
                        pileUid: 0
                    });
                }
            }

            sim.pickups = sim.pickups.filter(p => hostPickupUids.has(p.uid));
        }

        // 4. Synchronize Dwarf Multicannons (sim.turrets)
        if (Array.isArray(msg.turrets)) {
            const turretMap = new Map();
            for (let i = 0; i < sim.turrets.length; i++) {
                turretMap.set(sim.turrets[i].uid, sim.turrets[i]);
            }
            const hostTurretUids = new Set();
            for (let i = 0; i < msg.turrets.length; i++) {
                const [uid, tx, ty, yaw, startTick, endTick, range, amount, interval] = msg.turrets[i];
                hostTurretUids.add(uid);
                let t = turretMap.get(uid);
                if (t) {
                    t.x = tx;
                    t.y = ty;
                    t.endTick = endTick;
                    t.range = range || 8;
                    t.amount = amount || 1;
                    t.interval = interval || 18;
                } else {
                    sim.turrets.push({
                        uid,
                        x: tx,
                        y: ty,
                        yaw: yaw & 2047,
                        startTick: startTick || sim.tick,
                        endTick: endTick || (sim.tick + 900),
                        nextShot: sim.tick + 2,
                        damage: 0,
                        range: range || 8,
                        amount: amount || 1,
                        interval: interval || 18
                    });
                }
            }
            sim.turrets = sim.turrets.filter(t => hostTurretUids.has(t.uid) && sim.tick < t.endTick);
        } else if (sim.turrets && sim.turrets.length > 0) {
            sim.turrets = [];
        }

        // 5. Synchronize Arceuus Thralls (sim.thralls)
        if (Array.isArray(msg.thralls)) {
            const thrallDefs = client.getThrallDefs ? client.getThrallDefs() : [];
            const thrallMap = new Map();
            for (let i = 0; i < sim.thralls.length; i++) {
                thrallMap.set(sim.thralls[i].uid, sim.thralls[i]);
            }
            const hostThrallUids = new Set();
            for (let i = 0; i < msg.thralls.length; i++) {
                const [uid, defId, ownerSlot, tx, ty, yaw, moving, attackStart, startTick, endTick] = msg.thralls[i];
                hostThrallUids.add(uid);
                const ownerEntity = ownerSlot === this.localSlot
                    ? sim.player
                    : (this.remotePeers.get(ownerSlot)?.entity || sim.player);
                let th = thrallMap.get(uid);
                if (th) {
                    th.owner = ownerEntity;
                    th.ownerSlot = ownerSlot;
                    th.endTick = endTick;
                    if (Math.hypot(tx - th.x, ty - th.y) > 2.5) {
                        th.x = tx;
                        th.y = ty;
                        th.prevX = tx;
                        th.prevY = ty;
                    }
                    if (Number.isFinite(attackStart) && attackStart > th.attackStart) {
                        th.attackStart = attackStart;
                    }
                } else {
                    const def = thrallDefs.find(d => d.id === defId) || thrallDefs[0];
                    if (def) {
                        sim.thralls.push({
                            uid,
                            def,
                            owner: ownerEntity,
                            ownerSlot,
                            x: tx,
                            y: ty,
                            prevX: tx,
                            prevY: ty,
                            yaw: yaw & 2047,
                            moving: Boolean(moving),
                            attackStart: attackStart ?? -1,
                            cooldown: 10,
                            damage: 0,
                            startTick: startTick || sim.tick,
                            endTick: endTick || (sim.tick + 900)
                        });
                    }
                }
            }
            sim.thralls = sim.thralls.filter(th => hostThrallUids.has(th.uid) && sim.tick < th.endTick);
        } else if (sim.thralls && sim.thralls.length > 0) {
            sim.thralls = [];
        }

        // 6. Synchronize Enemy Projectiles (sim.enemyProjectiles)
        if (Array.isArray(msg.enemyProjs)) {
            const epMap = new Map();
            for (let i = 0; i < sim.enemyProjectiles.length; i++) {
                epMap.set(sim.enemyProjectiles[i].uid, sim.enemyProjectiles[i]);
            }
            const hostEpUids = new Set();
            for (let i = 0; i < msg.enemyProjs.length; i++) {
                const [uid, spotAnim, ex, ey, vx, vy, yaw, startTick, life] = msg.enemyProjs[i];
                hostEpUids.add(uid);
                let ep = epMap.get(uid);
                if (ep) {
                    if (Math.hypot(ex - ep.x, ey - ep.y) > 2.5) {
                        ep.x = ex;
                        ep.y = ey;
                        ep.prevX = ex;
                        ep.prevY = ey;
                    } else {
                        ep.x = ep.x + (ex - ep.x) * 0.5;
                        ep.y = ep.y + (ey - ep.y) * 0.5;
                    }
                    ep.vx = vx;
                    ep.vy = vy;
                    ep.yaw = yaw & 2047;
                    ep.life = life;
                } else {
                    sim.enemyProjectiles.push({
                        uid,
                        attack: { spotAnim },
                        x: ex,
                        y: ey,
                        prevX: ex,
                        prevY: ey,
                        vx,
                        vy,
                        yaw: yaw & 2047,
                        startTick: startTick || sim.tick,
                        life: life || 30,
                        radius: 0.4,
                        homing: 0
                    });
                }
            }
            sim.enemyProjectiles = sim.enemyProjectiles.filter(ep => hostEpUids.has(ep.uid) && ep.life > 0);
        } else if (sim.enemyProjectiles && sim.enemyProjectiles.length > 0) {
            sim.enemyProjectiles = [];
        }

        // 7. Synchronize Visual SpotAnim Effects (sim.effects)
        if (Array.isArray(msg.effects) && sim.addEffect) {
            if (!this._seenEffectUids) this._seenEffectUids = new Set();
            for (let i = 0; i < msg.effects.length; i++) {
                const [uid, spotAnim, fx, fy, height, durationTicks, enemyUid] = msg.effects[i];
                if (this._seenEffectUids.has(uid)) continue;
                this._seenEffectUids.add(uid);
                sim.addEffect(spotAnim, fx, fy, height || 0, durationTicks || 30, enemyUid || 0);
            }
            if (this._seenEffectUids.size > 400) {
                const keep = Array.from(this._seenEffectUids).slice(-200);
                this._seenEffectUids = new Set(keep);
            }
        }

        // 8. Replay Authoritative Combat/Hitsplat/Boss Events on Guest
        if (Array.isArray(msg.visEvents) && msg.visEvents.length > 0 && client.handleEvents) {
            client.handleEvents(sim, msg.visEvents);
        }
    }

    applyRemoteInput(peer, msg) {
        if (!peer || !peer.entity || !msg || typeof msg !== 'object') return;
        const p2 = peer.entity;
        if (msg.dead === true) {
            p2.hp = 0;
            p2.spectating = true;
            if (p2.deathTick === -1) {
                p2.deathTick = window.gameClient?.sim?.tick || 0;
            }
        }
        if (p2.hp <= 0 || p2.spectating) {
            p2.moveX = 0;
            p2.moveY = 0;
            p2.vx = 0;
            p2.vy = 0;
            p2.moving = false;
            p2.activePrayer = null;
            return;
        }
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
        p2.activePrayer = (msg.activePrayer === 'magic' || msg.activePrayer === 'ranged' || msg.activePrayer === 'melee') ? msg.activePrayer : null;
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
        const requestedRoom = sanitizeRoomId(roomId);
        if (!requestedRoom && this.ws && this.ws.readyState === WebSocket.OPEN && this.roomId) {
            this.localReady = true;
            this.syncLocalToLobbyPlayers();
            this.sendLobbyUpdate();
            this.renderLobbyModal();
            return;
        }
        const cleanRoom = requestedRoom || this.roomId || MultiplayerManager.generateRoomId();
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

        const prevNameEl = box.querySelector('#coop-local-name');
        const wasNameFocused = Boolean(prevNameEl && document.activeElement === prevNameEl);
        const prevNameVal = wasNameFocused
            ? prevNameEl.value
            : (this.localNameDraft !== undefined ? this.localNameDraft : this.localName);
        const prevSelStart = wasNameFocused ? prevNameEl.selectionStart : null;
        const prevSelEnd = wasNameFocused ? prevNameEl.selectionEnd : null;

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
        const weights = getCoopDifficultyWeights(activeScaleParty);
        const hpScaleLabel = `${weights.hpMult}x Mob / ${weights.bossHpMult}x Boss HP`;
        const spawnScaleLabel = `${weights.spawnMult}x Spawns (+${Math.round(weights.heavyWeightBias * 100)}% Heavy Weight)`;
        const dmgScaleLabel = `${weights.dmgMult}x Dmg`;
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
}

// Global singleton instance
export const multiplayer = new MultiplayerManager();
window.multiplayer = multiplayer;

// ============================================================================
// OSRS Protection Prayer System for Fight Caves & TzTok-Jad (NPC ID 3127)
// ============================================================================
window._osrsPrayer = null; // 'magic' | 'ranged' | 'melee' | null

// Real OSRS prayer sprites from the game cache (rev 241): prayer book icons are sprites 127-129,
// overhead icons are sprite group 440 (frames 0 melee, 1 missiles, 2 magic).
const OSRS_PRAYER_ICONS = {
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

function drawOverheadPrayerEmblem(ctx, x, y, scale, prayerType) {
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

function setOsrsPrayer(type) {
    window._osrsPrayer = window._osrsPrayer === type ? null : type;
    const client = window.gameClient || window._client;
    if (client?.sim?.player) {
        client.sim.player.activePrayer = window._osrsPrayer;
    }
    updateOsrsPrayerBarUI();
}

function ensureOsrsPrayerBarUI() {
    let bar = document.getElementById('osrs-prayer-bar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'osrs-prayer-bar';
    bar.style.cssText = `
        position: fixed;
        bottom: 92px;
        left: 50%;
        transform: translateX(-50%);
        zoom: var(--ui-scale, 1);
        display: none;
        align-items: center;
        gap: 8px;
        background: rgba(28, 22, 15, 0.94);
        border: 2px solid #5a4a35;
        outline: 2px solid #0e0b07;
        padding: 6px 12px;
        z-index: 950;
        user-select: none;
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
            <button data-prayer="${p.id}" style="
                display: flex; align-items: center; gap: 6px;
                background: #1a140e; border: 2px solid #4a3c2c;
                color: #d4c4a8; padding: 3px 10px 3px 6px; cursor: pointer;
                font-family: 'OSRS Bold', monospace; font-size: 12px;
                border-radius: 3px; text-shadow: 1px 1px #000;">
                <img src="${OSRS_PRAYER_ICONS[p.id].book}" width="30" height="30" alt="" draggable="false"
                    style="image-rendering: pixelated; display: block; pointer-events: none;">
                <span>[${p.key}] ${p.label}</span>
            </button>
        `).join('')}
    `;
    bar.querySelectorAll('button[data-prayer]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            setOsrsPrayer(btn.getAttribute('data-prayer'));
            btn.blur();
        });
    });
    document.body.appendChild(bar);
    return bar;
}

function updateOsrsPrayerBarUI() {
    const bar = document.getElementById('osrs-prayer-bar');
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

let _cheatKeyBuffer = '';
window.l33th4x0r = function() {
    const client = window.gameClient || window._client;
    if (client && typeof client.redeemCode === 'function') {
        const res = client.redeemCode('l33th4x0r');
        if (multiplayer) {
            multiplayer.hostUnlockedCharacters = multiplayer.readLocalSaveUnlockedCharacters();
            multiplayer.updateLobbyUI?.();
        }
        return res;
    }
    return false;
};

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
    if (multiplayer?.gameStarted && (sim.player?.spectating || sim.player?.hp <= 0)) {
        if (ev.code === 'Tab' || ev.code === 'BracketRight') {
            ev.preventDefault();
            const next = multiplayer.cycleSpectateTarget(1);
            if (next) multiplayer.showToast(`Spectating P${next.slot}: ${next.name}`);
        } else if (ev.code === 'BracketLeft') {
            ev.preventDefault();
            const prev = multiplayer.cycleSpectateTarget(-1);
            if (prev) multiplayer.showToast(`Spectating P${prev.slot}: ${prev.name}`);
        }
        return;
    }

    const isFightCavesOrJad = sim.map?.id === 'fight_caves' || sim.enemies?.some(e => !e.dead && (e.def?.id === 'tztok_jad' || e.def?.id === 'tzkal_zuk'));
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

window._hideOsrsPrayerBar = function() {
    window._osrsPrayer = null;
    const client = window.gameClient || window._client;
    if (client?.sim?.player) {
        client.sim.player.activePrayer = null;
    }
    const bar = document.getElementById('osrs-prayer-bar');
    if (bar && bar.style.display !== 'none') {
        bar.style.display = 'none';
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
        const openBar = document.getElementById('osrs-prayer-bar');
        if (openBar && openBar.style.display !== 'none') openBar.style.display = 'none';
        return;
    }
    const isFightCavesOrJad = sim.map?.id === 'fight_caves' || sim.enemies?.some(e => !e.dead && (e.def?.id === 'tztok_jad' || e.def?.id === 'tzkal_zuk'));
    if (!isFightCavesOrJad) {
        // On guests the boss can drop out of the synced enemy list for a moment. Hide the bar right away,
        // but only switch prayers off once the boss has really been gone for a few seconds.
        const hiddenBar = document.getElementById('osrs-prayer-bar');
        if (hiddenBar && hiddenBar.style.display !== 'none') hiddenBar.style.display = 'none';
        if (window._osrsPrayer && performance.now() - (window._osrsBossLastSeen || 0) > 3000) window._hideOsrsPrayerBar();
        return;
    }
    window._osrsBossLastSeen = performance.now();
    const bar = ensureOsrsPrayerBarUI();
    if (bar.style.display !== 'flex') {
        bar.style.display = 'flex';
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
