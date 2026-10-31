// Run Escape - Multiplayer WebSocket Transport & Session Lifecycle
import {
    ALL_CHARACTERS,
    ALLOWED_CHARACTERS,
    DEFAULT_UNLOCKED_CHARACTERS,
    SLOT_DEFAULT_CHARS,
    sanitizeMapId,
    sanitizeName,
    sanitizeRoomId,
    sanitizeCharacter,
    sanitizeSlot
} from './mp-constants.js?v=8.6';

export const mpTransportMethods = {
    getSortedRemotePeers() {
        if (!this._sortedRemotePeers) {
            this._sortedRemotePeers = Array.from(this.remotePeers.values()).sort((a, b) => a.slot - b.slot);
        }
        return this._sortedRemotePeers;
    }
,

    invalidateSortedRemotePeers() {
        this._sortedRemotePeers = null;
    }
,

    getInviteLink() {
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomId);
        return url.toString();
    }
,

    connect(roomId) {
        if (this.ws) {
            try {
                this.ws.onopen = null;
                this.ws.onmessage = null;
                this.ws.onclose = null;
                this.ws.onerror = null;
                this.ws.close();
            } catch(e) {}
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        const safeRoom = sanitizeRoomId(roomId) || this.constructor.generateRoomId();
        this.roomId = safeRoom;
        this.role = null;
        this.lobbyLockedReason = null;
        this.localReady = false;
        this.lobbyPlayers.clear();
        this.syncLocalToLobbyPlayers();

        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${proto}//${window.location.host}/ws?room=${encodeURIComponent(safeRoom)}`;
        console.log('[Multiplayer] Connecting to:', wsUrl);

        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
            if (this.ws !== ws) return;
            console.log('[Multiplayer] WebSocket connected');
            this.heartbeatInterval = setInterval(() => {
                this.send({ type: 'ping' });
            }, 20000);
            this.checkLocalReady();
        };

        ws.onmessage = (event) => {
            if (this.ws !== ws) return;
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (err) {
                console.error('[Multiplayer] Failed parsing message:', err, event.data);
            }
        };

        ws.onclose = () => {
            if (this.ws !== ws) return;
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

        ws.onerror = (err) => {
            if (this.ws !== ws) return;
            console.error('[Multiplayer] WebSocket error:', err);
        };
    }
,

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            this.bus?.emit('net:send', data);
        }
    }
,

    async checkLocalReady() {
        const client = window.gameClient;
        if (client && client.assets && client.assets.models && client.assets.models.size >= 250) {
            this.localAssetsReady = true;
            this.updateLobbyUI();
        } else {
            setTimeout(() => this.checkLocalReady(), 500);
        }
    }
,

    reconcileActiveSlots(activeSlots) {
        if (!Array.isArray(activeSlots)) return;
        const validSet = new Set(activeSlots.map(s => sanitizeSlot(s, 0)).filter(s => s >= 1 && s <= 4));
        validSet.add(this.localSlot);
        if (this.gameStarted) {
            for (const s of Array.from(validSet)) {
                if (s !== this.localSlot && !this.remotePeers.has(s)) {
                    validSet.delete(s);
                }
            }
        }
        for (const s of this.lobbyPlayers.keys()) {
            if (!validSet.has(s)) {
                this.lobbyPlayers.delete(s);
            }
        }
        for (const s of validSet) {
            if (!this.lobbyPlayers.has(s)) {
                this.lobbyPlayers.set(s, {
                    slot: s,
                    name: (this.getRememberedPlayerName && this.getRememberedPlayerName(s)) || ('Player ' + s),
                    character: SLOT_DEFAULT_CHARS[s] || 'warrior',
                    ready: false,
                    isHost: s === this.hostSlot
                });
            }
        }
        this.peers = this.lobbyPlayers.size;
        this.peerConnected = this.peers >= 2;
    }
,

    handleMessage(msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type) {
            this.bus?.emit('net:message:' + msg.type, msg);
            this.bus?.emit('net:message', msg);
        }
        switch (msg.type) {
            case 'pong':
                break;

            case 'error':
                if (typeof msg.message === 'string') {
                    const errText = msg.message.slice(0, 80);
                    this.showToast(errText);
                    if (msg.code === 'room_locked' || /in progress|locked|full/i.test(errText)) {
                        this.lobbyLockedReason = errText;
                        this.updateLobbyUI?.();
                    }
                }
                break;

            case 'welcome': {
                if (this.gameStarted) break;
                if (msg.role !== 'host' && msg.role !== 'guest') break;
                this.lobbyLockedReason = null;
                this.role = msg.role;
                this.localSlot = sanitizeSlot(msg.slot, msg.role === 'host' ? 1 : 2);
                this.hostSlot = sanitizeSlot(msg.hostSlot, 1);
                this.peers = Number.isFinite(Number(msg.peers)) ? Math.max(1, Math.min(4, Math.round(Number(msg.peers)))) : 1;
                this.peerConnected = this.peers >= 2;
                if (msg.room) {
                    const cleanRoom = sanitizeRoomId(msg.room);
                    if (cleanRoom) this.roomId = cleanRoom;
                }
                const remembered = this.getRememberedPlayerName ? this.getRememberedPlayerName(this.localSlot) : '';
                if (remembered) {
                    this.localName = remembered;
                    this.localNameDraft = remembered;
                    this.localNameCustomized = true;
                } else if (!this.localNameCustomized) {
                    this.localName = 'Player ' + this.localSlot;
                    this.localNameDraft = this.localName;
                }
                this.localReady = false;
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
                if (this.gameStarted && !this.remotePeers.has(joinedSlot)) {
                    console.log(`[Multiplayer] Ignoring peer_joined from slot ${joinedSlot} while game is in progress`);
                    break;
                }
                if (msg.hostSlot) this.hostSlot = sanitizeSlot(msg.hostSlot, this.hostSlot);
                if (!this.lobbyPlayers.has(joinedSlot)) {
                    this.lobbyPlayers.set(joinedSlot, {
                        slot: joinedSlot,
                        name: (this.getRememberedPlayerName && this.getRememberedPlayerName(joinedSlot)) || ('Player ' + joinedSlot),
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
                const isHostLeaving = msg.role === 'host' || (leftSlot > 0 && leftSlot === this.hostSlot);
                const departingPeer = this.remotePeers.get(leftSlot);
                if (this.gameStarted && !isHostLeaving && !departingPeer) {
                    if (leftSlot && leftSlot !== this.localSlot) {
                        this.lobbyPlayers.delete(leftSlot);
                    }
                    console.log(`[Multiplayer] Ignoring disconnect of non-participating slot ${leftSlot} during active run`);
                    break;
                }
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
                const sSlot = sanitizeSlot(msg.senderSlot || msg.slot, 2);
                const senderSlot = sSlot;
                if (this.gameStarted && senderSlot !== this.localSlot && senderSlot !== this.hostSlot && !this.remotePeers.has(senderSlot)) {
                    break;
                }
                const incomingName = sanitizeName(msg.name) || (this.getRememberedPlayerName && this.getRememberedPlayerName(senderSlot)) || `Player ${senderSlot}`;
                const hostUnlocked = this.getUnlockedCharacters();

                if (this.savePlayerNameForSlot && !/^Player\s+[1-4]$/i.test(incomingName)) {
                    this.savePlayerNameForSlot(senderSlot, incomingName);
                }

                if (this.gameStarted) {
                    const activePeer = this.remotePeers.get(senderSlot);
                    if (activePeer && incomingName) {
                        activePeer.name = incomingName;
                        this.lastPartyHudFastKey = '';
                    }
                }

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
                    const isFromHost = !msg.senderSlot || sanitizeSlot(msg.senderSlot, 0) === this.hostSlot;
                    if (isFromHost) {
                        if (msg.difficultyMult !== undefined) {
                            const dm = Number(msg.difficultyMult);
                            if (Number.isFinite(dm) && dm >= 0.5 && dm <= 10) {
                                this.difficultyMult = dm;
                            }
                        }
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
                    }
                    if (isFromHost && Array.isArray(msg.party)) {
                        const nextSlots = new Set([this.localSlot]);
                        for (const p of msg.party) {
                            if (!p || typeof p !== 'object') continue;
                            const s = sanitizeSlot(p.slot, 0);
                            if (s < 1 || s > 4) continue;
                            nextSlots.add(s);
                            if (p.isHost) this.hostSlot = s;
                            const pName = sanitizeName(p.name) || (this.getRememberedPlayerName && this.getRememberedPlayerName(s)) || `Player ${s}`;
                            if (this.savePlayerNameForSlot && !/^Player\s+[1-4]$/i.test(pName)) {
                                this.savePlayerNameForSlot(s, pName);
                            }
                            if (this.gameStarted) {
                                const activePeer = this.remotePeers.get(s);
                                if (activePeer && pName) {
                                    activePeer.name = pName;
                                    this.lastPartyHudFastKey = '';
                                }
                            }
                            if (s === this.localSlot) continue;
                            this.lobbyPlayers.set(s, {
                                slot: s,
                                name: pName,
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
                const cfg = msg.config;
                this.gameStarted = true;
                const rawPlayers = Array.isArray(cfg.players) ? cfg.players : [];
                const dedupedMap = new Map();
                rawPlayers
                    .filter(p => p && typeof p === 'object')
                    .slice(0, 4)
                    .forEach((p, idx) => {
                        const s = sanitizeSlot(p.slot, idx + 1);
                        const pName = sanitizeName(p.name) || (this.getRememberedPlayerName && this.getRememberedPlayerName(s)) || `Player ${s}`;
                        if (this.savePlayerNameForSlot && !/^Player\s+[1-4]$/i.test(pName)) {
                            this.savePlayerNameForSlot(s, pName);
                        }
                        dedupedMap.set(s, {
                            slot: s,
                            name: pName,
                            character: sanitizeCharacter(p.character, SLOT_DEFAULT_CHARS[s] || 'warrior'),
                            isHost: Boolean(p.isHost)
                        });
                    });
                const sanitizedPlayers = Array.from(dedupedMap.values()).sort((a, b) => a.slot - b.slot);

                if (!sanitizedPlayers.some(p => p.slot === this.localSlot)) {
                    const matched =
                        sanitizedPlayers.find(p => !p.isHost && p.slot !== 1 && p.name === this.localName) ||
                        sanitizedPlayers.find(p => !p.isHost && p.slot !== 1);
                    if (matched) {
                        this.localSlot = matched.slot;
                    }
                }

                const cleanUpgrades = {};
                if (cfg.upgrades && typeof cfg.upgrades === 'object') {
                    for (const [k, v] of Object.entries(cfg.upgrades)) {
                        if (typeof k === 'string' && k.length <= 40 && Number.isFinite(Number(v))) {
                            cleanUpgrades[k] = Math.max(0, Math.min(20, Math.round(Number(v))));
                        }
                    }
                }
                const cleanArmoury = {};
                if (cfg.armoury && typeof cfg.armoury === 'object') {
                    for (const [k, v] of Object.entries(cfg.armoury)) {
                        if (typeof k === 'string' && k.length <= 40) {
                            cleanArmoury[k] = Boolean(v);
                        }
                    }
                }

                this.gameConfig = {
                    seed: Number.isFinite(Number(cfg.seed)) ? (Number(cfg.seed) >>> 0) : 1,
                    mapId: sanitizeMapId(cfg.mapId, 'lumbridge'),
                    endless: Boolean(cfg.endless),
                    difficultyMult: Number.isFinite(Number(cfg.difficultyMult))
                        ? Math.max(0.5, Math.min(10, Number(cfg.difficultyMult)))
                        : (this.difficultyMult || 1.0),
                    partySize: Math.max(2, Math.min(4, sanitizedPlayers.length || 2)),
                    players: sanitizedPlayers,
                    unlockedItems: Array.isArray(cfg.unlockedItems)
                        ? cfg.unlockedItems.filter(id => typeof id === 'string' && id.length <= 40 && /^[a-zA-Z0-9_-]+$/.test(id)).slice(0, 200)
                        : [],
                    upgrades: cleanUpgrades,
                    armoury: cleanArmoury
                };
                this.selectedMapId = this.gameConfig.mapId;
                this.selectedEndless = this.gameConfig.endless;
                this.difficultyMult = this.gameConfig.difficultyMult;
                console.log('[Multiplayer] Game Starting with 2-4P config:', this.gameConfig);
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
                if (sanitizeSlot(msg.senderSlot, 0) !== this.hostSlot) break;
                this.endGameOnDisconnect(typeof msg.reason === 'string' ? msg.reason.slice(0, 80) : 'Game Over', msg.leaderboard);
                break;
        }
    }
,

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
,

    isCoopSessionActive() {
        return Boolean(
            (this.ws && this.ws.readyState === WebSocket.OPEN && this.roomId) ||
            (Array.isArray(this.lastLeaderboard) && this.lastLeaderboard.length > 0)
        );
    }
,

    returnToLobby() {
        const prevPlayers = new Map();
        if (Array.isArray(this.gameConfig?.players)) {
            for (const p of this.gameConfig.players) {
                if (!p) continue;
                const s = sanitizeSlot(p.slot, 1);
                const pName = sanitizeName(p.name) || (this.getRememberedPlayerName && this.getRememberedPlayerName(s)) || `Player ${s}`;
                if (this.savePlayerNameForSlot && !/^Player\s+[1-4]$/i.test(pName)) {
                    this.savePlayerNameForSlot(s, pName);
                }
                prevPlayers.set(s, {
                    slot: s,
                    name: pName,
                    character: sanitizeCharacter(p.character, SLOT_DEFAULT_CHARS[s] || 'warrior'),
                    ready: false,
                    isHost: Boolean(p.isHost || s === this.hostSlot)
                });
            }
        }
        for (const [s, peer] of this.remotePeers.entries()) {
            const pName = sanitizeName(peer.name) || (this.getRememberedPlayerName && this.getRememberedPlayerName(s)) || `Player ${s}`;
            if (this.savePlayerNameForSlot && !/^Player\s+[1-4]$/i.test(pName)) {
                this.savePlayerNameForSlot(s, pName);
            }
            prevPlayers.set(s, {
                slot: s,
                name: pName,
                character: sanitizeCharacter(peer.characterId, SLOT_DEFAULT_CHARS[s] || 'warrior'),
                ready: false,
                isHost: s === this.hostSlot
            });
        }
        for (const existing of this.lobbyPlayers.values()) {
            if (existing) existing.ready = false;
        }
        for (const [s, lp] of prevPlayers.entries()) {
            if (!this.lobbyPlayers.has(s)) {
                this.lobbyPlayers.set(s, lp);
            } else {
                const existing = this.lobbyPlayers.get(s);
                existing.ready = false;
                if (!existing.name || /^Player\s+[1-4]$/i.test(existing.name)) {
                    existing.name = lp.name;
                }
            }
        }
        this.localReady = false;
        this.localName = (this.getRememberedPlayerName && this.getRememberedPlayerName(this.localSlot)) || this.localName;
        this.localNameDraft = this.localName;

        this.lastLeaderboard = null;
        this.gameStarted = false;
        this._gameOverSent = false;
        this._victorySent = false;
        this.localPauseState = null;
        this.spectateSlot = null;
        this.remotePeers.clear();
        this.invalidateSortedRemotePeers();
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
            this.localReady = false;
            this.syncLocalToLobbyPlayers();
            this.sendLobbyUpdate();
            this.renderLobbyModal();
        } else {
            this.syncLocalToLobbyPlayers();
            this.openLobbyModal(this.roomId || null);
        }
    }
,

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

};
