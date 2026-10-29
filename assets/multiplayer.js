// Run Escape - Multiplayer Co-Op Module (RFC 6455 WebSockets)
// AGENT DIRECTIVE: Before modifying this file, read ../AGENTS.md and ../AGENT_NOTES.md.
// After completing changes, run `node --check assets/multiplayer.js`, bump `?v=X.Y` across all 6 entry points in ../AGENTS.md, and prepend a handoff entry to ../AGENT_NOTES.md.
// Supports 2 to 4 players with Host-authoritative simulation, class model baking,
// jitter-free velocity extrapolation + soft correction, dynamic party HP scaling,
// mutual player awareness (custom lobby names, overhead HP bars, nametags, multi-partner HUD, off-screen arrows),
// and synchronized pause/casket barriers.


import {
    ALL_CHARACTERS,
    ALLOWED_CHARACTERS,
    CHAR_WEAPONS,
    SPAWN_OFFSETS,
    COOP_DIFFICULTY_WEIGHTS,
    getCoopDifficultyWeights,
    ALL_REGIONS,
    sanitizeMapId,
    sanitizeName,
    sanitizeRoomId,
    sanitizeCharacter,
    sanitizeSlot,
    escapeHtml
} from './multiplayer/mp-constants.js?v=7.9';
import { MpEventBus } from './multiplayer/mp-event-bus.js?v=7.9';
import { initOsrsPrayers } from './multiplayer/mp-prayers.js?v=7.9';
import { mpTransportMethods } from './multiplayer/mp-transport.js?v=7.9';
import { mpLobbyUiMethods } from './multiplayer/mp-lobby-ui.js?v=7.9';
import { mpHudLeaderboardMethods } from './multiplayer/mp-hud-leaderboard.js?v=7.9';
import { mpActorRendererMethods } from './multiplayer/mp-actor-renderer.js?v=7.9';
import { mpPickupsMethods } from './multiplayer/mp-pickups.js?v=7.9';
import { mpSyncEngineMethods } from './multiplayer/mp-sync-engine.js?v=7.9';

export class MultiplayerManager {
    constructor() {
        this.bus = new MpEventBus();
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

}

Object.assign(
    MultiplayerManager.prototype,
    mpTransportMethods,
    mpLobbyUiMethods,
    mpHudLeaderboardMethods,
    mpActorRendererMethods,
    mpPickupsMethods,
    mpSyncEngineMethods
);

export const multiplayer = new MultiplayerManager();
window.multiplayer = multiplayer;
initOsrsPrayers(multiplayer);

// Disable browser right-click context menu in the game window
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

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
