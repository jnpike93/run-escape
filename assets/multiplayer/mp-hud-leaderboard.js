// Run Escape - Multiplayer HUD, Spectator, Pause Overlay & Leaderboard Methods
import { ALL_CHARACTERS, sanitizeSlot, escapeHtml } from './mp-constants.js?v=7.6';

export const mpHudLeaderboardMethods = {
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
    },

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
    },

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
    },

    hasAnyRemotePause() {
        for (const peer of this.remotePeers.values()) {
            if (peer.pauseState !== null) return true;
        }
        return false;
    },

    getLocalPauseState(client) {
        if (!client || !client.sim || client.sim.runOver) return null;
        if (client.paused) return 'paused';
        if (client.sim.player?.spectating || client.sim.player?.hp <= 0) return null;
        if (client.sim.state === 'chest') return 'chest';
        if (client.sim.state === 'levelUp') return 'levelUp';
        return null;
    },

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
    },

    removePauseOverlay() {
        const el = document.getElementById('coop-pause-overlay');
        if (el) el.remove();
    },

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
    },


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
    },

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
    },

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
    },

};
