// Run Escape - Multiplayer Authoritative Simulation Hooks & World Sync Engine
import { ALL_CHARACTERS, CHAR_WEAPONS, SPAWN_OFFSETS, getCoopDifficultyWeights, sanitizeName, sanitizeSlot, sanitizeCharacter, escapeHtml } from './mp-constants.js?v=7.6';
import { drawOverheadPrayerEmblem } from './mp-prayers.js?v=7.6';

export const mpSyncEngineMethods = {
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
                                (!p2.moving || p2.attackSeq === 1979 || (s.tick - p2.attackStart) < 12) &&
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
    },


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
                    const nextHp = Math.max(0, Number(localPlayerSnapshot.hp));
                    if (nextHp < sim.player.hp) {
                        sim.player.regenPausedUntil = sim.tick + 150;
                    }
                    sim.player.hp = nextHp;
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
    },

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
    },

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
    },

};
