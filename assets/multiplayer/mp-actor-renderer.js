// Run Escape - Multiplayer Actor Appearance Baking & Loadout Sync Methods
import { sanitizeSlot } from './mp-constants.js?v=7.5';

export const mpActorRendererMethods = {
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
    },

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
    },

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
    },

};
