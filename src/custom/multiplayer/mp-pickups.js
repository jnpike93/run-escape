// Run Escape - Multiplayer Co-Op Pickups & Shared Loot Methods
import { sanitizeSlot } from './mp-constants.js?v=8.5';

export const mpPickupsMethods = {
    applyCoopPickup(msg) {
        const client = window.gameClient;
        if (!client || !client.sim || !msg || typeof msg !== 'object') return;
        const sim = client.sim;
        const kind = msg.kind;
        if (kind !== 'lamp_xp' && msg.senderSlot !== undefined && sanitizeSlot(msg.senderSlot, 0) !== this.hostSlot) return;
        const val = Number.isFinite(Number(msg.value)) ? Number(msg.value) : 0;

        if (kind === 'bones' || kind === 'big_bones' || kind === 'xp') {
            if (val <= 0 && !Number.isFinite(Number(msg.xpGained))) return;
            const gained = Number.isFinite(Number(msg.xpGained)) && Number(msg.xpGained) > 0
                ? Number(msg.xpGained)
                : val * (1 + (this.getLobbyGrowthMultiplier ? this.getLobbyGrowthMultiplier(sim) : (sim.stats?.growth || 0)));
            const MAX_RUN_XP = 1e9;
            const hostXp = Number.isFinite(Number(msg.totalXp)) ? Math.min(MAX_RUN_XP, Math.max(0, Number(msg.totalXp))) : NaN;
            sim.xp = Number.isFinite(hostXp)
                ? Math.max(sim.xp + gained, hostXp)
                : (sim.xp + gained);
            client.sounds?.onEvents(sim, [{ type: 'pickup', kind: kind === 'xp' ? 'bones' : kind, value: val || 1 }]);
            sim.checkLevelUp();
            if (sim.state !== 'playing') {
                client.accumulator = 0;
                client.syncOverlay();
                this.syncLocalPauseState(client, true);
            }
            client.updateHud(true);
        } else if (kind === 'lamp_xp') {
            if (!Number.isFinite(Number(msg.levels)) || Number(msg.levels) <= 0) return;
            const levels = Math.min(1, Math.max(0.1, Number(msg.levels) || 0));
            const span = Math.max(1, (sim.xpForNextLevel || 0) - (sim.xpForThisLevel || 0));
            sim.xp += span * levels;
            sim.checkLevelUp();
            if (sim.state !== 'playing') {
                client.accumulator = 0;
                client.syncOverlay();
                this.syncLocalPauseState(client, true);
            }
            client.updateHud(true);
        } else if (kind === 'coins') {
            if (val <= 0) return;
            const safeVal = Math.min(50000, Math.max(0, Math.round(Number(msg.value || 0))));
            sim.coins += Math.round(safeVal * (1 + (sim.stats?.greed || 0)));
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
            if (!this._openedCasketUids) this._openedCasketUids = new Set();
            if (msg.pickupUid !== undefined && msg.pickupUid !== null) {
                if (this._openedCasketUids.has(msg.pickupUid)) return;
                this._openedCasketUids.add(msg.pickupUid);
            }
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
    },


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
                if (pickup.kind === 'bones' || pickup.kind === 'big_bones') {
                    const sharedGrowth = this.getLobbyGrowthMultiplier ? this.getLobbyGrowthMultiplier(sim) : (sim.stats?.growth || 0);
                    const xpGained = origVal * (1 + sharedGrowth);
                    sim.xp += xpGained;
                    sim.events.push({ type: 'pickup', kind: pickup.kind, value: origVal });
                    sim.checkLevelUp();
                    if (this.queueCoopPickup) {
                        this.queueCoopPickup({
                            type: 'coop_pickup',
                            kind: pickup.kind,
                            value: origVal,
                            xpGained: xpGained,
                            totalXp: sim.xp
                        });
                    } else {
                        this.send({
                            type: 'coop_pickup',
                            kind: pickup.kind,
                            value: origVal,
                            xpGained: xpGained,
                            totalXp: sim.xp
                        });
                    }
                    if (sim.state !== 'playing' && client) {
                        client.accumulator = 0;
                        client.syncOverlay();
                        this.syncLocalPauseState(client, true);
                    }
                    client?.updateHud?.(true);
                } else if (pickup.kind === 'coins') {
                    pickup.value = origVal;
                    sim.collect(pickup);
                    pickup.value = -1;
                } else if (pickup.kind === 'food') {
                    p2.hp = Math.min(p2.maxHp, p2.hp + origVal);
                    this.send({
                        type: 'coop_pickup',
                        kind: 'food',
                        targetSlot: peer.slot,
                        value: origVal
                    });
                } else if (pickup.kind === 'casket') {
                    if (pickup._casketCollected) continue;
                    pickup._casketCollected = true;
                    const pickupUid = pickup.uid || ('casket_' + sim.tick + '_' + Math.round(pickup.x * 100) + '_' + Math.round(pickup.y * 100));
                    if (!this._openedCasketUids) this._openedCasketUids = new Set();
                    if (this._openedCasketUids.has(pickupUid)) continue;
                    this._openedCasketUids.add(pickupUid);
                    const tier = pickup.tier || 'medium';
                    let latestChest = null;
                    if (!sim.player.spectating && sim.player.hp > 0) {
                        sim.openCasket(tier);
                        latestChest = sim.chests && sim.chests.length > 0 ? sim.chests[sim.chests.length - 1] : null;
                        if (client) {
                            client.handleEvents(sim, sim.takeEvents());
                            client.syncOverlay();
                            client.updateHud(true);
                        }
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
                        pickupUid,
                        excludeItemId: latestChest?.upgradedFrom || latestChest?.itemId || undefined
                    });
                    if (client) {
                        client.accumulator = 0;
                        this.syncLocalPauseState(client, true);
                    }
                } else if (pickup.kind === 'powerUp' || pickup.kind === 'powerup') {
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
                    if (pickup.powerUp === 'magnet') {
                        for (const p of sim.pickups) {
                            if (p.value >= 0 && p.kind !== 'casket' && p.kind !== 'powerUp' && p.kind !== 'powerup') {
                                p.attracted = false;
                                p[attractKey] = true;
                                p[speedKey] = Math.max(p[speedKey] || 0, 0.25);
                                p.pileUid = 0;
                            }
                        }
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
    },

    queueCoopPickup(msg) {
        if (!msg || typeof msg !== 'object') return;
        const kind = msg.kind;
        if (this._inSimStep === true) {
            if (kind === 'xp' || kind === 'bones' || kind === 'big_bones') {
                if (!this._batchedXpPickup) {
                    this._batchedXpPickup = {
                        type: 'coop_pickup',
                        kind: kind,
                        value: Number(msg.value) || 0,
                        xpGained: Number(msg.xpGained) || 0,
                        totalXp: Number(msg.totalXp) || 0
                    };
                } else {
                    if (kind === 'big_bones' || kind === 'xp') {
                        this._batchedXpPickup.kind = kind;
                    }
                    this._batchedXpPickup.value += Number(msg.value) || 0;
                    this._batchedXpPickup.xpGained += Number(msg.xpGained) || 0;
                    if (Number.isFinite(Number(msg.totalXp))) {
                        this._batchedXpPickup.totalXp = Number(msg.totalXp);
                    }
                }
                return;
            }
            if (kind === 'coins') {
                if (!this._batchedCoinsPickup) {
                    this._batchedCoinsPickup = {
                        type: 'coop_pickup',
                        kind: 'coins',
                        value: Number(msg.value) || 0
                    };
                } else {
                    this._batchedCoinsPickup.value += Number(msg.value) || 0;
                }
                return;
            }
        }
        this.send(msg);
    },

    flushCoopPickups() {
        if (this._batchedXpPickup) {
            const xpMsg = this._batchedXpPickup;
            this._batchedXpPickup = null;
            if (xpMsg.value > 0 || xpMsg.xpGained > 0) {
                this.send(xpMsg);
            }
        }
        if (this._batchedCoinsPickup) {
            const coinsMsg = this._batchedCoinsPickup;
            this._batchedCoinsPickup = null;
            if (coinsMsg.value > 0) {
                this.send(coinsMsg);
            }
        }
    },

};
