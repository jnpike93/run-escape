// Run Escape - Multiplayer Actor Appearance Baking & Loadout Sync Methods
import { sanitizeSlot, sanitizeHexColor, sanitizePeerStats } from './mp-constants.js?v=8.5';

export const mpActorRendererMethods = {
    getLobbyGrowthMultiplier(sim) {
        if (!sim) return 0;
        const hostMetaGrowth = Number(sim.metaStats?.growth) || 0;
        const localTotalGrowth = Number(sim.stats?.growth) || 0;
        const localItemGrowth = Math.max(0, localTotalGrowth - hostMetaGrowth);
        const remoteCount = this.remotePeers ? this.remotePeers.size : 0;
        const partySize = Math.max(1, 1 + remoteCount);
        let sumItemGrowth = localItemGrowth;
        if (this.remotePeers) {
            for (const peer of this.remotePeers.values()) {
                const peerItemG = Number(peer.itemGrowth);
                if (Number.isFinite(peerItemG) && peerItemG > 0) {
                    sumItemGrowth += peerItemG;
                }
            }
        }
        return hostMetaGrowth + (sumItemGrowth / partySize);
    },

    sendLoadoutSync(client, healed = false, extra = null) {
        if (!client || !client.sim || this.remotePeers.size === 0) return;
        const sim = client.sim;
        try {
            client.updateHud?.(true);
        } catch (err) {}
        const hud = client.store?.getSnapshot()?.hud;
        const hostMetaGrowth = Number(sim.metaStats?.growth) || 0;
        const itemGrowth = Math.max(0, (Number(sim.stats?.growth) || 0) - hostMetaGrowth);

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
            level: Math.max(1, Math.round(Number(sim.level) || 1)),
            weapons,
            passives,
            gear,
            inventory,
            appearance,
            stats: sim.stats ? { ...sim.stats } : null,
            itemGrowth: Number(itemGrowth.toFixed(4)),
            usedItemId: extra?.usedItemId || null,
            hpDelta: Number.isFinite(Number(extra?.hpDelta)) ? Math.round(Number(extra.hpDelta)) : 0,
            hp: Math.round(sim.player.hp),
            maxHp: Math.round(sim.player.maxHp),
            healed: Boolean(healed)
        });
    },

    async bakeRemotePeerAppearance(client, peer, appearance) {
        if (!client || !client.assets || !peer || !appearance) return;
        if (Array.isArray(appearance) && client.getSimAppearance && client.sim) {
            try {
                appearance = client.getSimAppearance({
                    ...client.sim,
                    characterId: peer.characterId || peer.entity?.characterId || 'warrior',
                    weapons: peer.weapons || [],
                    gear: {}
                });
            } catch (err) {
                appearance = null;
            }
        }
        if (!appearance || !Array.isArray(appearance.equipment)) return;
        const equipKey = appearance.equipment.join(',');
        const dynKey = `player_dynamic_${peer.slot}`;
        if (peer.lastEquipKey === equipKey && client.assets.models.has(dynKey)) {
            if (peer.entity) peer.entity.hasDynamicModel = true;
            return;
        }
        peer.lastEquipKey = equipKey;
        const seqIds = this.playerSeqIds || [
            808, 819, 824, 836,
            386, 390, 393, 401, 426, 711, 806, 811, 1167, 1378, 1658, 1979,
            2062, 2614, 2661, 4230, 5061, 7638, 7640, 7642, 7644, 7855, 8056, 9493
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
    },

    applyRemoteLoadout(msg) {
        if (!msg || typeof msg !== 'object') return;
        const client = window.gameClient;
        const senderSlot = sanitizeSlot(msg.senderSlot || msg.slot, this.role === 'host' ? 2 : 1);
        if (!client || !client.sim || !this.gameStarted || !this.remotePeers || !this.remotePeers.has(senderSlot)) {
            if (!this._pendingLoadouts) this._pendingLoadouts = new Map();
            this._pendingLoadouts.set(senderSlot, msg);
            return;
        }
        const sim = client.sim;
        const peer = this.remotePeers.get(senderSlot);
        if (!peer || !peer.entity) return;
        const p2 = peer.entity;
        peer._loadoutReceived = true;

        if (Number.isFinite(Number(msg.level))) {
            const lvl = Math.max(1, Math.min(999, Math.round(Number(msg.level))));
            peer.level = lvl;
            p2.level = lvl;
            const dStat = this.damageStats?.get(senderSlot);
            if (dStat) dStat.level = lvl;
        }

        if (msg.stats && typeof msg.stats === 'object') {
            peer.stats = sanitizePeerStats(msg.stats);
        }
        if (Number.isFinite(Number(msg.itemGrowth))) {
            peer.itemGrowth = Math.min(3, Math.max(0, Number(msg.itemGrowth) || 0));
        } else if (peer.stats && Number.isFinite(Number(peer.stats.growth))) {
            peer.itemGrowth = Math.min(3, Math.max(0, Number(peer.stats.growth) - (Number(sim.metaStats?.growth) || 0)));
        }

        if (Number.isFinite(Number(msg.maxHp))) {
            const newMaxHp = Math.max(1, Math.min(1000, Math.round(Number(msg.maxHp))));
            if (newMaxHp > p2.maxHp) {
                p2.hp = Math.min(newMaxHp, p2.hp + (newMaxHp - p2.maxHp));
            }
            p2.maxHp = newMaxHp;
        }
        if (Number.isFinite(Number(msg.hpDelta)) && Number(msg.hpDelta) !== 0) {
            const clampedDelta = Math.max(-200, Math.min(200, Math.round(Number(msg.hpDelta))));
            p2.hp = Math.max(0, Math.min(p2.maxHp, Math.round(p2.hp + clampedDelta)));
        } else if (msg.healed && Number.isFinite(Number(msg.hp))) {
            p2.hp = Math.max(p2.hp, Math.min(p2.maxHp, Math.round(Number(msg.hp))));
        }

        const cleanUsedItem = typeof msg.usedItemId === 'string' ? msg.usedItemId.trim().toLowerCase() : null;
        const ALLOWED_USED_ITEMS = new Set(['bonecrusher', 'red_chinchompa', 'black_chinchompa']);
        if (this.role === 'host' && cleanUsedItem && ALLOWED_USED_ITEMS.has(cleanUsedItem) && client.sim) {
            const hasItemInMsgOrPeer = (
                (Array.isArray(msg.inventory) && msg.inventory.some(slot => slot && slot.id === cleanUsedItem)) ||
                (Array.isArray(msg.gear) && msg.gear.some(g => g && g.item && g.item.id === cleanUsedItem)) ||
                (Array.isArray(msg.passives) && msg.passives.some(p => p && p.id === cleanUsedItem)) ||
                (Array.isArray(msg.weapons) && msg.weapons.some(w => w && w.id === cleanUsedItem)) ||
                (peer.loadout?.inventory?.some(slot => slot && slot.id === cleanUsedItem)) ||
                (peer.loadout?.gear?.some(g => g && g.item && g.item.id === cleanUsedItem))
            );

            const nowMs = Date.now();
            if (hasItemInMsgOrPeer && (nowMs - (peer._lastItemUseMs || 0) >= 250)) {
                peer._lastItemUseMs = nowMs;
                if (cleanUsedItem === 'bonecrusher') {
                    const attractKey = 'attracted_s' + peer.slot;
                    const speedKey = 'speed_s' + peer.slot;
                    for (const pickup of client.sim.pickups) {
                        if (pickup.kind === 'bones' || pickup.kind === 'big_bones') {
                            pickup[attractKey] = true;
                            pickup[speedKey] = Math.max(pickup[speedKey] || 0, 0.15);
                        }
                    }
                } else if (cleanUsedItem === 'red_chinchompa' || cleanUsedItem === 'black_chinchompa') {
                    const isBlack = cleanUsedItem === 'black_chinchompa';
                    const baseDmg = isBlack ? 85 : 40;
                    const baseRadius = isBlack ? 5.5 : 4.2;
                    const spotAnim = isBlack ? 157 : 156;
                    const areaMult = 1 + (Number(peer.stats?.area) || Number(sim.stats?.area) || 0);
                    const radius = baseRadius * areaMult;
                    const prevAttacker = this._activeAttackerSlot;
                    const savedStats = sim.stats;
                    this._activeAttackerSlot = peer.slot;
                    if (peer.stats) sim.stats = { ...savedStats, ...peer.stats };
                    try {
                        if (typeof sim.addEffect === 'function') {
                            sim.addEffect(spotAnim, p2.x, p2.y, 60);
                        }
                        let effects = 0;
                        for (const enemy of sim.enemies) {
                            if (enemy.dead) continue;
                            if (Math.hypot(enemy.x - p2.x, enemy.y - p2.y) <= radius + (enemy.radius || 0.4)) {
                                sim.damageEnemy(enemy, baseDmg, 0.35, p2.x, p2.y);
                                if (effects < 8 && typeof sim.addEffect === 'function') {
                                    sim.addEffect(spotAnim, enemy.x, enemy.y, 60);
                                    effects++;
                                }
                            }
                        }
                    } finally {
                        sim.stats = savedStats;
                        this._activeAttackerSlot = prevAttacker;
                    }
                }
            }
        }

        if (Array.isArray(msg.weapons) && msg.weapons.length > 0 && msg.weapons.length <= 8) {
            const savedWeapons = sim.weapons;
            const savedAppVer = sim.appearanceVersion;
            const prevWeaponsById = new Map((peer.weapons || []).map(pw => [pw.def?.id || pw.id, pw]));
            const built = [];
            try {
                for (const w of msg.weapons) {
                    if (!w || typeof w.id !== 'string') continue;
                    const cleanId = w.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
                    sim.weapons = [];
                    try {
                        sim.addWeapon(cleanId, Math.min(0.5, Math.max(0, Number(w.bonus) || 0)));
                    } catch (addErr) {
                        console.warn(`[Multiplayer] Unknown weapon id "${cleanId}" for slot ${senderSlot}:`, addErr);
                        continue;
                    }
                    if (sim.weapons.length > 0) {
                        const inst = sim.weapons[0];
                        inst.level = Math.max(1, Math.min(99, Math.round(Number(w.level) || 1)));
                        const prevW = prevWeaponsById.get(cleanId) || prevWeaponsById.get(w.id);
                        if (prevW) {
                            inst.cooldown = prevW.cooldown;
                            inst.uses = prevW.uses || 0;
                        } else {
                            inst.cooldown = Math.min(inst.cooldown || 10, 10);
                        }
                        built.push(inst);
                    }
                }
            } catch (err) {
                console.warn(`[Multiplayer] Error syncing slot ${senderSlot} weapons:`, err);
            } finally {
                sim.weapons = savedWeapons;
                sim.appearanceVersion = savedAppVer;
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
                rarityColor: sanitizeHexColor(w.rarityColor, '#ff981f')
            }));
        }

        if (Array.isArray(msg.passives)) {
            peer.loadout.passives = msg.passives.slice(0, 6).map(p => ({
                id: String(p?.id || ''),
                name: String(p?.name || p?.id || 'Passive'),
                level: Math.max(1, Math.round(Number(p?.level) || 1)),
                maxLevel: Math.max(1, Math.round(Number(p?.maxLevel) || 5)),
                iconObjId: Number(p?.iconObjId) || 0,
                rarityColor: sanitizeHexColor(p?.rarityColor, '#ff981f')
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
                    rarityColor: sanitizeHexColor(g.item.rarityColor, '#ff981f')
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
                    rarityColor: sanitizeHexColor(slot.rarityColor, '#ff981f')
                };
            });
        }

        this.loadoutVersion = (this.loadoutVersion || 0) + 1;
        this.lastPartyHudKey = '';

        if (msg.appearance && p2.characterId !== 'dipper' && p2.characterId !== 'elias') {
            this.bakeRemotePeerAppearance(client, peer, msg.appearance);
        }
    },

};
