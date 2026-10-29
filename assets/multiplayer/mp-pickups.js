// Run Escape - Multiplayer Co-Op Pickups & Shared Loot Methods
import { sanitizeSlot } from './mp-constants.js?v=7.4';

export const mpPickupsMethods = {
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
    },

};
