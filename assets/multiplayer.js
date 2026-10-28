// Run Escape - Multiplayer Co-Op Module (RFC 6455 WebSockets)
// Full 2-player networked co-op with class model baking, deterministic seeds,
// mutual player awareness (custom lobby names, overhead HP bars, nametags, party HUD, off-screen arrows),
// and automatic run termination on partner disconnect.

function sanitizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().slice(0, 14).replace(/[^a-zA-Z0-9 ()_-]/g, '');
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
        this.ws = null;
        this.peers = 1;
        this.peerConnected = false;
        
        this.localCharacter = 'dipper';
        this.remoteCharacter = 'warrior';
        this.localName = 'Player 1';
        this.remoteName = 'Player 2';
        this.localReady = false;
        this.remoteReady = false;
        
        this.gameStarted = false;
        this.gameConfig = null; // { seed, mapId, p1Char, p2Char, p1Name, p2Name }
        
        this.remoteInput = { moveX: 0, moveY: 0, tick: 0 };
        this.remoteState = null;
        
        this.modalEl = null;
        this.inGameHooked = false;

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

    connect(roomId) {
        if (this.ws) {
            try { this.ws.close(); } catch(e) {}
        }
        this.roomId = roomId;
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${proto}//${window.location.host}/ws?room=${encodeURIComponent(roomId)}`;
        console.log('[Multiplayer] Connecting to:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[Multiplayer] WebSocket connected');
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
            this.sendLobbyUpdate();
            this.updateLobbyUI();
        } else {
            setTimeout(() => this.checkLocalReady(), 500);
        }
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'welcome':
                this.role = msg.role;
                this.peers = msg.peers;
                this.peerConnected = msg.peers > 1;
                if (this.role === 'guest' && this.localName === 'Player 1') {
                    this.localName = 'Player 2';
                    this.remoteName = 'Player 1';
                }
                console.log(`[Multiplayer] Welcome: role=${this.role}, peers=${this.peers}`);
                this.sendLobbyUpdate();
                this.updateLobbyUI();
                break;

            case 'peer_joined':
                this.peerConnected = true;
                this.peers = msg.peers || 2;
                console.log('[Multiplayer] Peer joined');
                this.sendLobbyUpdate();
                this.showToast('Player 2 connected to lobby!');
                this.updateLobbyUI();
                break;

            case 'peer_leaving':
            case 'peer_left':
                console.log('[Multiplayer] Peer disconnected');
                this.peerConnected = false;
                this.peers = 1;
                this.remoteReady = false;
                if (this.gameStarted) {
                    this.endGameOnDisconnect('Co-Op Partner Disconnected - Game Over');
                } else {
                    this.showToast('Peer disconnected from lobby');
                    this.updateLobbyUI();
                }
                break;

            case 'lobby_update':
                const incomingLobbyName = sanitizeName(msg.name);
                if (this.role === 'host') {
                    this.remoteCharacter = msg.character || this.remoteCharacter;
                    if (incomingLobbyName) this.remoteName = incomingLobbyName;
                    this.remoteReady = !!msg.ready;
                } else {
                    this.remoteCharacter = msg.hostCharacter || msg.character || this.remoteCharacter;
                    if (incomingLobbyName) this.remoteName = incomingLobbyName;
                    this.remoteReady = !!msg.ready;
                }
                this.updateLobbyUI();
                break;

            case 'game_start':
                this.gameStarted = true;
                this.gameConfig = msg.config;
                if (this.role === 'host') {
                    const cleanP2 = sanitizeName(msg.config?.p2Name);
                    if (cleanP2) this.remoteName = cleanP2;
                } else {
                    const cleanP1 = sanitizeName(msg.config?.p1Name);
                    if (cleanP1) this.remoteName = cleanP1;
                }
                console.log('[Multiplayer] Game Starting with config:', this.gameConfig);
                this.closeLobbyModal();
                this.launchCoopRun(this.gameConfig);
                break;

            case 'input':
                this.remoteInput = msg;
                if (window.gameClient && window.gameClient.sim && window.gameClient.sim.player2) {
                    this.applyRemoteInput(window.gameClient.sim.player2, msg);
                }
                break;

            case 'sync_world':
                if (this.role === 'guest') {
                    this.applyWorldSync(msg);
                }
                break;

            case 'game_over':
                this.endGameOnDisconnect(msg.reason || 'Game Over');
                break;
        }
    }

    sendLobbyUpdate() {
        if (this.role === 'host') {
            this.send({
                type: 'lobby_update',
                hostCharacter: this.localCharacter,
                name: this.localName,
                ready: this.localReady
            });
        } else {
            this.send({
                type: 'lobby_update',
                character: this.localCharacter,
                name: this.localName,
                ready: this.localReady
            });
        }
    }

    setPlayerName(name) {
        this.localName = sanitizeName(name) || (this.role === 'host' ? 'Player 1' : 'Player 2');
        this.sendLobbyUpdate();
    }

    selectCharacter(charId) {
        this.localCharacter = charId;
        const client = window.gameClient;
        if (client) {
            client.store?.set({ characterId: charId });
            if (charId !== 'dipper' && client.getAppearance) {
                try {
                    client.assets?.setPlayerAppearance(client.getAppearance(charId));
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

    async ensureAllCharacterModels(client) {
        if (!client || !client.assets || !client.assets.models) return;
        const required = ['player_warrior', 'player_wizard', 'player_ranger', 'player_barbarian', 'player_monk'];
        const missing = required.filter(k => !client.assets.models.has(k));

        const CLASS_EQUIPMENT = {
            warrior: { 0: 1153, 4: 1115, 7: 1067, 3: 1321 }, // helm, torso, legs, scimitar
            wizard: { 0: 1017, 4: 577, 7: 1011, 1: 1021, 3: 1389 }, // hat, robe top, bottom, cape, staff
            ranger: { 0: 1169, 4: 1129, 7: 1095, 9: 1063, 3: 864 }, // coif, body, chaps, vambs, knives
            barbarian: { 0: 3751, 4: 3767, 7: 23246, 10: 3791, 3: 1307 }, // helm, shirt, skirt, boots, 2h
            monk: { 4: 544, 7: 542, 2: 1718, 3: 1389 } // monk top, bottom, amulet, staff
        };

        const seqIds = [808, 819, 824, 836, 390, 426, 711];
        const bakes = [];

        // Ensure Corgi is baked
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
            const eqMap = CLASS_EQUIPMENT[pureId];
            if (!eqMap) continue;
            const equip = new Array(12).fill(-1);
            for (const [slot, objId] of Object.entries(eqMap)) {
                equip[parseInt(slot)] = objId;
            }
            bakes.push({
                kind: 'player',
                key: cid,
                appearance: {
                    gender: 0,
                    colors: [0, 0, 0, 0, 0],
                    kits: [0, 10, 18, 26, 33, 36, 42],
                    equipment: equip
                },
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
        
        const startBtn = document.getElementById('coop-start-btn');
        if (startBtn) {
            startBtn.textContent = 'Preparing Lumbridge...';
            startBtn.disabled = true;
        }

        const client = await this.waitForGameClient(40000);
        if (!client) {
            this.showToast('Game client not ready');
            if (startBtn) {
                startBtn.textContent = 'Enter Lumbridge (Start Co-Op)';
                startBtn.disabled = false;
            }
            return;
        }

        const seed = Math.floor(Math.random() * 2147483647);
        const config = {
            seed,
            mapId: 'lumbridge',
            p1Char: this.localCharacter,
            p1Name: this.localName,
            p2Char: this.remoteCharacter || 'warrior',
            p2Name: this.remoteName
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

        // Wait until assets are fully baked to prevent missing monster models
        const modelWaitStart = Date.now();
        while (client.assets?.models?.size < 250 && (Date.now() - modelWaitStart) < 20000) {
            console.log('[Multiplayer] Waiting for models to finish baking... count:', client.assets?.models?.size);
            await new Promise(r => setTimeout(r, 250));
        }

        // Bake all player character models so Player 1 and Player 2 always render correctly
        await this.ensureAllCharacterModels(client);

        const isHost = this.role === 'host';
        const localChar = isHost ? config.p1Char : config.p2Char;
        const remoteChar = isHost ? config.p2Char : config.p1Char;

        console.log(`[Multiplayer] Launching run: Local=${localChar} (${this.localName}), Remote=${remoteChar} (${this.remoteName})`);

        // Set local character and map in store
        client.store.set({
            characterId: localChar,
            mapId: config.mapId || 'lumbridge'
        });

        // Set player appearance before starting run
        if (localChar !== 'dipper' && client.getAppearance) {
            try {
                await client.assets.setPlayerAppearance(client.getAppearance(localChar));
            } catch(e) {}
        }

        try {
            await client.startRun();
            this.setupInGameHooks(localChar, remoteChar);
        } catch (err) {
            console.error('[Multiplayer] Error starting run:', err);
        }
    }

    setupInGameHooks(localChar, remoteChar) {
        const client = window.gameClient;
        if (!client || !client.sim) return;
        const sim = client.sim;
        const isHost = this.role === 'host';

        const p1 = sim.player;
        p1.characterId = localChar;

        // Position players side-by-side with clear spacing
        if (isHost) {
            p1.x = 3222.0;
            p1.y = 3218.5;
            p1.prevX = 3222.0;
            p1.prevY = 3218.5;
            sim.player2 = {
                x: 3223.5,
                y: 3218.5,
                prevX: 3223.5,
                prevY: 3218.5,
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
                characterId: remoteChar
            };
        } else {
            p1.x = 3223.5;
            p1.y = 3218.5;
            p1.prevX = 3223.5;
            p1.prevY = 3218.5;
            sim.player2 = {
                x: 3222.0,
                y: 3218.5,
                prevX: 3222.0,
                prevY: 3218.5,
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
                characterId: remoteChar
            };
        }

        if (isHost) {
            // Spawn initial courtyard goblins on Host so both players immediately engage monsters
            if (client.getEnemyDef && sim.enemies.length < 5) {
                try {
                    const courtyardSpawns = [
                        { x: 3225.5, y: 3218.5 },
                        { x: 3220.0, y: 3218.5 },
                        { x: 3222.5, y: 3222.0 },
                        { x: 3222.5, y: 3215.0 },
                        { x: 3226.0, y: 3221.0 }
                    ];
                    for (const pos of courtyardSpawns) {
                        sim.spawnEnemy(client.getEnemyDef('goblin'), 'normal', pos);
                    }
                    console.log('[Multiplayer] Courtyard enemies spawned authoritatively on Host.');
                } catch (e) {
                    console.warn('[Multiplayer] Courtyard spawn note:', e);
                }
            }

            // Hook sim.stepEnemies on Host to target whichever player is closest
            const origStepEnemies = sim.stepEnemies.bind(sim);
            sim.stepEnemies = () => {
                if (!sim.player2 || sim.player2.hp <= 0) {
                    origStepEnemies();
                    return;
                }
                const p1 = sim.player;
                const p2 = sim.player2;
                const allEnemies = sim.enemies;

                const enemiesP1 = [];
                const enemiesP2 = [];
                for (let i = 0; i < allEnemies.length; i++) {
                    const enemy = allEnemies[i];
                    if (enemy.dead) {
                        enemiesP1.push(enemy);
                        continue;
                    }
                    const d1 = Math.hypot(p1.x - enemy.x, p1.y - enemy.y);
                    const d2 = Math.hypot(p2.x - enemy.x, p2.y - enemy.y);
                    if (d2 < d1) {
                        enemiesP2.push(enemy);
                    } else {
                        enemiesP1.push(enemy);
                    }
                }

                // Step enemies targeting Player 1
                sim.enemies = enemiesP1;
                sim.player = p1;
                origStepEnemies();

                // Step enemies targeting Player 2
                sim.enemies = enemiesP2;
                sim.player = p2;
                origStepEnemies();

                // Restore full enemy list and player reference
                sim.enemies = allEnemies;
                sim.player = p1;
            };
        } else {
            // Guest disables autonomous wave spawner, enemy stepping, and local pickup generation
            sim.stepDirector = () => {};
            sim.stepEnemies = () => {};
            sim.dropPickup = () => {};
            sim.dropCasket = () => {};
            sim.dropCasketOfTier = () => {};
            sim.rollPowerUp = () => {};
            sim.enemies = [];
            console.log('[Multiplayer] Guest initialized in client sync mode.');
        }

        // Arm Player 2 with their class weapon
        const CHAR_WEAPONS = {
            dipper: 'throwing_knives',
            warrior: 'scimitar',
            wizard: 'fire_spells',
            ranger: 'throwing_knives',
            barbarian: 'two_handed_sword',
            monk: 'saradomin_strike',
            ancient_mage: 'ice_burst'
        };
        const p2WeaponId = CHAR_WEAPONS[remoteChar] || 'throwing_knives';
        try {
            sim.addWeapon(p2WeaponId);
            sim.player2Weapons = [sim.weapons.pop()];
            console.log(`[Multiplayer] Player 2 armed with ${p2WeaponId}`);
        } catch (err) {
            console.error('[Multiplayer] Failed adding Player 2 weapon:', err);
        }

        // Hook sim.stepWeapons to fire Player 2's weapons
        const origStepWeapons = sim.stepWeapons.bind(sim);
        sim.stepWeapons = () => {
            origStepWeapons();

            if (sim.player2 && sim.player2Weapons) {
                const origPlayer = sim.player;
                sim.player = sim.player2;
                try {
                    for (const t of sim.player2Weapons) {
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
                                x: sim.player2.x,
                                y: sim.player2.y
                            });
                            if (!sim.player2.moving) {
                                sim.player2.attackSeq = n?.playerSeq ?? t.def.playerSeq;
                                sim.player2.attackStart = sim.tick;
                            }
                        }
                    }
                } finally {
                    sim.player = origPlayer;
                }
            }
        };

        // Hook sim.step to transmit local state, sync world, and step Player 2
        const origStep = sim.step.bind(sim);
        sim.step = (moveX, moveY) => {
            origStep(moveX, moveY);

            // Step Player 2
            if (sim.player2) {
                this.stepPlayer2(sim, sim.player2);
                if (isHost) {
                    this.stepPlayer2Pickups(sim, sim.player2);
                }
            }

            // Network transmission
            if (this.peerConnected) {
                if (isHost) {
                    // Check if either player died
                    if (!sim.runOver && (sim.player.hp <= 0 || (sim.player2 && sim.player2.hp <= 0))) {
                        this.send({ type: 'game_over', reason: 'A hero has fallen in battle!' });
                        this.endGameOnDisconnect('A hero has fallen - Game Over');
                        return;
                    }

                    // Host broadcasts authoritative world state every tick
                    const enemyData = [];
                    for (let i = 0; i < sim.enemies.length; i++) {
                        const e = sim.enemies[i];
                        if (!e.dead || (sim.tick - e.deathTick < 45)) {
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
                                p.value
                            ]);
                        }
                    }

                    this.send({
                        type: 'sync_world',
                        tick: sim.tick,
                        x: Math.round(sim.player.x * 100) / 100,
                        y: Math.round(sim.player.y * 100) / 100,
                        p1Hp: sim.player.hp,
                        p1MaxHp: sim.player.maxHp,
                        p2Hp: sim.player2 ? sim.player2.hp : 25,
                        p2MaxHp: sim.player2 ? sim.player2.maxHp : 25,
                        enemies: enemyData,
                        pickups: pickupData
                    });
                } else {
                    // Guest checks local death
                    if (!sim.runOver && sim.player.hp <= 0) {
                        this.send({ type: 'game_over', reason: 'Player 2 has fallen in battle!' });
                        this.endGameOnDisconnect('You have died - Game Over');
                        return;
                    }

                    // Guest transmits input and local position
                    this.send({
                        type: 'input',
                        tick: sim.tick,
                        moveX: moveX,
                        moveY: moveY,
                        x: Math.round(sim.player.x * 100) / 100,
                        y: Math.round(sim.player.y * 100) / 100
                    });
                }
            }
        };

        // Hook view.submitActors to render both characters with authentic models and colors
        if (client.view && !this.inGameHooked) {
            const origSubmitActors = client.view.submitActors.bind(client.view);
            client.view.submitActors = (actors, s, alpha) => {
                origSubmitActors(actors, s, alpha);

                // Render Player 2
                if (s.player2) {
                    const p2 = s.player2;
                    const isCorgi = p2.characterId === 'dipper';
                    let model;
                    if (isCorgi) {
                        model = client.assets.get('corgi');
                    } else {
                        model = client.assets.get('player_' + p2.characterId) || client.assets.getPlayer();
                    }

                    if (model && model.anims && model.anims.length > 0) {
                        let anim;
                        if (isCorgi) {
                            anim = p2.moving ? 
                                (model.getAnim(6560) || model.anims[0]) : 
                                (model.getAnim(6561) || model.anims[0]);
                        } else {
                            if (p2.attackSeq !== -1 && !p2.moving && (s.tick - p2.attackStart < 15)) {
                                anim = model.getAnim(p2.attackSeq) || model.getAnim(808) || model.anims[0];
                            } else if (p2.moving) {
                                anim = model.getAnim(824) || model.getAnim(819) || model.anims[0];
                            } else {
                                anim = model.getAnim(808) || model.anims[0];
                            }
                        }

                        const startTick = (p2.attackSeq !== -1 && !p2.moving) ? p2.attackStart : p2.moveStart;
                        const frame = anim ? anim.getFrame(s.tick - startTick) : 0;
                        const px = p2.prevX + (p2.x - p2.prevX) * alpha;
                        const py = p2.prevY + (p2.y - p2.prevY) * alpha;
                        const height = (s.grid ? s.grid.getHeight(px, py) / 128 : 0) - (isCorgi ? 0.22 : 0);

                        // Renders with full vibrant colors: scale 3.0 for Corgi so it is chunky, proud, and clearly visible
                        actors.draw(model, anim, frame, px, height, py, p2.yaw, {
                            scale: isCorgi ? 3.0 : 1.0,
                            flash: (p2.flash > 0) ? 0.4 : 0,
                            tint: isCorgi ? 16777215 : (p2.tint || 16777215)
                        });
                    }
                }
            };

            // Hook client.view.drawOverlay for mutual player awareness
            // Overhead HP bar, custom nametag, off-screen pointer, and party HUD
            const origDrawOverlay = client.view.drawOverlay.bind(client.view);
            const p2Screen = { x: 0, y: 0, visible: false };
            const p1Screen = { x: 0, y: 0, visible: false };

            client.view.drawOverlay = (overlayRenderer, s, alpha) => {
                origDrawOverlay(overlayRenderer, s, alpha);

                if (overlayRenderer && overlayRenderer.ctx) {
                    const ctx = overlayRenderer.ctx;
                    const w = overlayRenderer.width;
                    const h = overlayRenderer.height;
                    const scale = Math.max(h / 900, 0.75);

                    // 1. Draw Player 1 (Local Player) Name Tag above their overhead HP bar
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

                    // 2. Draw Player 2 (Remote Partner)
                    if (s.player2) {
                        const p2 = s.player2;
                        const px = p2.prevX + (p2.x - p2.prevX) * alpha;
                        const py = p2.prevY + (p2.y - p2.prevY) * alpha;
                        const isCorgi = p2.characterId === 'dipper';
                        const modelHeight = isCorgi ? 95 : 200;
                        const groundHeight = s.grid ? s.grid.getHeight(px, py) / 128 : 0;
                        const worldHeight = groundHeight - (modelHeight / 128) - (15 / 128);

                        overlayRenderer.project(px, worldHeight, py, p2Screen);

                        const displayName = this.remoteName.toUpperCase();
                        const classSub = isCorgi ? 'CORGI' : (p2.characterId || 'WARRIOR').toUpperCase();

                        // Check if Player 2 is visible on screen
                        const margin = 50;
                        const onScreen = p2Screen.visible && p2Screen.x >= margin && p2Screen.x <= w - margin && p2Screen.y >= margin && p2Screen.y <= h - margin;

                        if (onScreen) {
                            const barW = Math.round(34 * scale);
                            const barH = Math.round(6 * scale);
                            const barX = Math.round(p2Screen.x - barW / 2);
                            const barY = Math.round(p2Screen.y - barH * 0.6);

                            const hpRatio = Math.max(0, Math.min(1, p2.hp / (p2.maxHp || 25)));
                            const greenW = Math.floor(barW * hpRatio);

                            // Overhead Health Bar
                            ctx.fillStyle = '#000000';
                            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
                            ctx.fillStyle = '#00ff00';
                            ctx.fillRect(barX, barY, greenW, barH);
                            ctx.fillStyle = '#ff0000';
                            ctx.fillRect(barX + greenW, barY, barW - greenW, barH);

                            // Overhead Name Tag with custom player name
                            ctx.save();
                            ctx.font = `bold ${Math.round(13 * scale)}px "OSRS Bold", monospace, sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = '#000000';
                            const partnerTag = displayName.includes(classSub) ? displayName : `${displayName} (${classSub})`;
                            ctx.strokeText(partnerTag, p2Screen.x, barY - 4);
                            ctx.fillStyle = '#ffff00';
                            ctx.fillText(partnerTag, p2Screen.x, barY - 4);
                            ctx.restore();
                        } else {
                            // Off-screen indicator arrow pointing toward partner
                            const centerX = w / 2;
                            const centerY = h / 2;
                            let targetX = p2Screen.x;
                            let targetY = p2Screen.y;
                            if (!p2Screen.visible) {
                                targetX = centerX - (p2Screen.x - centerX);
                                targetY = centerY - (p2Screen.y - centerY);
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

                            // Golden chevron arrow
                            ctx.fillStyle = '#ff981f';
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

                            // Distance and name label
                            ctx.save();
                            ctx.font = `bold 12px "OSRS Small", monospace`;
                            ctx.textAlign = 'center';
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = '#000';
                            ctx.strokeText(`${displayName} (${distMeters}m)`, edgeX, edgeY + 20);
                            ctx.fillStyle = '#ffff00';
                            ctx.fillText(`${displayName} (${distMeters}m)`, edgeX, edgeY + 20);
                            ctx.restore();
                        }

                        // Update persistent Party HUD widget (located at bottom left to avoid item infographs)
                        this.updatePartyHUD(p2);
                    }
                }
            };

            // Hook CameraRig to dynamically frame both players
            if (client.cameraRig) {
                const origApply = client.cameraRig.apply.bind(client.cameraRig);
                client.cameraRig.apply = (camera, px, py, pz) => {
                    if (client.sim && client.sim.player2) {
                        const p1 = client.sim.player;
                        const p2 = client.sim.player2;
                        const midX = (p1.x + p2.x) / 2;
                        const midZ = (p1.y + p2.y) / 2;
                        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                        client.cameraRig.distance = Math.min(Math.max(18 + dist * 0.45, 16), 34);
                        origApply(camera, midX, py, midZ);
                    } else {
                        origApply(camera, px, py, pz);
                    }
                };
            }

            // Hook client.quitRun to cleanly notify peer
            const origQuitRun = client.quitRun?.bind(client);
            if (origQuitRun) {
                client.quitRun = () => {
                    if (this.gameStarted) {
                        this.send({ type: 'peer_leaving' });
                        this.gameStarted = false;
                        const hud = document.getElementById('coop-party-hud');
                        if (hud) hud.remove();
                    }
                    origQuitRun();
                };
            }

            this.inGameHooked = true;
        }

        this.showToast(`Co-Op Run Active! Teammate: ${this.remoteName.toUpperCase()} (${remoteChar.toUpperCase()})`);
    }

    // Party HUD widget located at bottom-left so it NEVER occludes top-left item/equipment infographs
    updatePartyHUD(p2) {
        let hud = document.getElementById('coop-party-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'coop-party-hud';
            hud.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 99;
                background: rgba(22, 17, 12, 0.92);
                border: 2px solid #5a4a35;
                padding: 6px 12px;
                border-radius: 4px;
                color: #ff981f;
                font-family: 'OSRS Bold', monospace;
                box-shadow: 0 4px 14px rgba(0,0,0,0.7);
                display: flex;
                flex-direction: column;
                gap: 2px;
                pointer-events: none;
                min-width: 155px;
                user-select: none;
            `;
            document.body.appendChild(hud);
        }

        const isCorgi = p2.characterId === 'dipper';
        const charName = escapeHtml(isCorgi ? 'CORGI' : (p2.characterId || 'WARRIOR').toUpperCase());
        const displayName = escapeHtml(this.remoteName.toUpperCase());
        const hp = Math.max(0, Math.round(p2.hp));
        const maxHp = p2.maxHp || 25;
        const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
        const hpPercent = Math.round(hpRatio * 100);
        const barColor = hpRatio > 0.5 ? '#00ff00' : (hpRatio > 0.25 ? '#ffff00' : '#ff0000');

        hud.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; margin-bottom: 1px;">
                <span style="color: #ff981f; letter-spacing: 1px;">CO-OP PARTNER</span>
                <span style="color: #00ff00; font-size: 9px;">● ONLINE</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span style="font-size: 13px; color: #ffffff; text-shadow: 1px 1px #000;">${displayName}</span>
                <span style="font-size: 10px; color: #ff981f;">${charName}</span>
            </div>
            <div style="background: #2b0000; border: 1px solid #4a3c2c; height: 9px; border-radius: 2px; overflow: hidden; margin-top: 2px;">
                <div style="background: ${barColor}; width: ${hpPercent}%; height: 100%; transition: width 0.15s ease-out;"></div>
            </div>
            <div style="font-size: 10px; color: #bbb; text-align: right;">${hp} / ${maxHp} HP</div>
        `;
    }

    endGameOnDisconnect(reason) {
        if (!this.gameStarted) return;
        this.gameStarted = false;
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

    stepPlayer2Pickups(sim, p2) {
        if (!sim.pickups || sim.pickups.length === 0) return;
        const magnet = 2.5 * (1 + (sim.stats?.magnet || 0));
        for (const pickup of sim.pickups) {
            if (pickup.value < 0) continue;
            const dx = p2.x - pickup.x;
            const dy = p2.y - pickup.y;
            const dist = Math.hypot(dx, dy);
            const magnetic = pickup.kind !== 'casket' && pickup.kind !== 'powerUp';
            if (!pickup.attracted && magnetic && dist < magnet) {
                pickup.attracted = true;
                pickup.speed = 0.05;
            }
            if (pickup.attracted && dist < 0.6) {
                sim.collect(pickup);
                pickup.value = -1;
            }
        }
    }

    applyWorldSync(msg) {
        const client = window.gameClient;
        if (!client || !client.sim) return;
        const sim = client.sim;

        // 1. Synchronize player states
        if (sim.player2) {
            if (msg.x !== undefined && msg.y !== undefined) {
                sim.player2.prevX = sim.player2.x;
                sim.player2.prevY = sim.player2.y;
                sim.player2.x = msg.x;
                sim.player2.y = msg.y;
            }
            if (msg.p1Hp !== undefined) {
                sim.player2.hp = msg.p1Hp;
                if (msg.p1MaxHp) sim.player2.maxHp = msg.p1MaxHp;
            }
        }

        if (sim.player) {
            if (msg.p2Hp !== undefined) {
                sim.player.hp = msg.p2Hp;
                if (msg.p2MaxHp) sim.player.maxHp = msg.p2MaxHp;
                if (sim.player.hp <= 0 && !sim.runOver) {
                    this.endGameOnDisconnect('You have died - Game Over');
                }
            }
        }

        // 2. Synchronize monsters
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
                    // Update positions with smooth interpolation support
                    enemy.prevX = enemy.x;
                    enemy.prevY = enemy.y;
                    enemy.x = x;
                    enemy.y = y;
                    enemy.hp = hp;
                    enemy.maxHp = maxHp;
                    enemy.yaw = yaw;
                    enemy.dead = !!dead;
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
                                enemy.hp = hp;
                                enemy.maxHp = maxHp;
                                enemy.yaw = yaw;
                                enemy.dead = !!dead;
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

            // Cull dead / removed enemies no longer on host
            sim.enemies = sim.enemies.filter(e => hostUids.has(e.uid));

            // Rebuild spatial hash so guest weapons and radar target the synced enemies
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
                const [uid, kind, px, py, val] = msg.pickups[i];
                hostPickupUids.add(uid);
                let p = pickupMap.get(uid);
                if (p) {
                    p.prevX = p.x;
                    p.prevY = p.y;
                    p.x = px;
                    p.y = py;
                    p.value = val;
                } else {
                    sim.pickups.push({
                        uid: uid,
                        kind: kind,
                        x: px,
                        y: py,
                        prevX: px,
                        prevY: py,
                        value: val,
                        attracted: false,
                        speed: 0,
                        spawnTick: sim.tick
                    });
                }
            }

            sim.pickups = sim.pickups.filter(p => hostPickupUids.has(p.uid));
        }
    }

    applyRemoteInput(p2, msg) {
        this.remoteInput = msg;
        if (msg.x !== undefined && msg.y !== undefined) {
            p2.prevX = p2.x;
            p2.prevY = p2.y;
            p2.x = msg.x;
            p2.y = msg.y;
        }
        if (msg.moveX !== undefined && (msg.moveX !== 0 || msg.moveY !== 0)) {
            p2.yaw = Math.round(Math.atan2(msg.moveX, msg.moveY) * (1024 / Math.PI));
            p2.moving = true;
        } else {
            p2.moving = false;
        }
    }

    stepPlayer2(sim, p2) {
        if (p2.flash > 0) p2.flash--;
        if (p2.invulnerable > 0) p2.invulnerable--;

        const input = this.remoteInput;
        const moveX = input.moveX || 0;
        const moveY = input.moveY || 0;
        const moving = moveX !== 0 || moveY !== 0;

        if (moving) {
            p2.yaw = Math.round(Math.atan2(moveX, moveY) * (1024 / Math.PI));
        }

        if (moving !== p2.moving) {
            p2.moving = moving;
            p2.moveStart = sim.tick;
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
        if (!roomId) {
            roomId = MultiplayerManager.generateRoomId();
        }
        this.connect(roomId);
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
            padding: 24px 32px;
            width: 580px;
            max-width: 90vw;
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

        const isHost = this.role === 'host' || this.role === null;
        const inviteLink = this.getInviteLink();
        const safeLocalName = escapeHtml(this.localName);
        const safeRemoteName = escapeHtml(this.remoteName);

        const characters = [
            { id: 'dipper', name: 'Dipper (Corgi)' },
            { id: 'warrior', name: 'Warrior' },
            { id: 'wizard', name: 'Wizard' },
            { id: 'ranger', name: 'Ranger' },
            { id: 'barbarian', name: 'Barbarian' },
        ];

        box.innerHTML = `
            <h2 style="margin: 0 0 12px; font-size: 26px; color: #ff981f; text-shadow: 2px 2px #000;">
                Online Co-Op Lobby
            </h2>
            <div style="font-size: 14px; color: #bbb; margin-bottom: 20px;">
                ${isHost ? 'Share the generated link below with Player 2 to join your run.' : 'Connected as Player 2 (Guest).'}
            </div>

            <!-- Room Code & Link Box -->
            <div style="background: #1a1510; border: 2px solid #3d3123; padding: 12px; margin-bottom: 20px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 14px; color: #888;">ROOM CODE:</span>
                    <span style="font-size: 20px; color: #ffff00; letter-spacing: 2px;">${this.roomId || 'CONNECTING...'}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <input id="coop-link-input" type="text" readonly value="${inviteLink}" 
                        style="flex: 1; background: #0c0906; border: 1px solid #5a4a35; color: #fff; padding: 6px 10px; font-family: monospace; font-size: 13px;" />
                    <button id="coop-copy-btn" style="
                        background: #4a3c2c; border: 2px solid #6b5842; color: #ff981f; padding: 6px 14px; 
                        cursor: pointer; font-family: 'OSRS Bold', monospace; font-size: 13px; font-weight: bold;">
                        Copy Link
                    </button>
                </div>
            </div>

            <!-- Players Cards with Custom Name Fields -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; text-align: left;">
                <!-- Player 1 Card -->
                <div style="background: #1e1812; border: 2px solid ${isHost ? '#ff981f' : '#3d3123'}; padding: 14px;">
                    <div style="font-size: 12px; color: #888; margin-bottom: 4px;">PLAYER 1 (HOST)</div>
                    ${isHost ? `
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 2px;">Your Name:</label>
                        <input id="coop-p1-name" type="text" maxlength="14" value="${safeLocalName}"
                            style="width: 100%; box-sizing: border-box; background: #0c0906; border: 1px solid #5a4a35; color: #ffff00; padding: 5px 8px; font-family: 'OSRS Bold', monospace; font-size: 14px; margin-bottom: 8px;" />
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 2px;">Character:</label>
                        <select id="coop-p1-char" style="width: 100%; background: #0c0906; border: 1px solid #5a4a35; color: #ff981f; padding: 6px; font-family: 'OSRS Small', monospace;">
                            ${characters.map(c => `<option value="${c.id}" ${this.localCharacter === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    ` : `
                        <div style="font-size: 18px; color: #ffff00; margin-bottom: 4px;">${safeRemoteName}</div>
                        <div style="font-size: 13px; color: #ff981f;">
                            Class: <strong>${(this.remoteCharacter || 'wizard').toUpperCase()}</strong>
                        </div>
                    `}
                </div>

                <!-- Player 2 Card -->
                <div style="background: #1e1812; border: 2px solid ${!isHost ? '#ff981f' : '#3d3123'}; padding: 14px;">
                    <div style="font-size: 12px; color: #888; margin-bottom: 4px;">PLAYER 2 (GUEST)</div>
                    ${!isHost ? `
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 2px;">Your Name:</label>
                        <input id="coop-p2-name" type="text" maxlength="14" value="${safeLocalName}"
                            style="width: 100%; box-sizing: border-box; background: #0c0906; border: 1px solid #5a4a35; color: #ffff00; padding: 5px 8px; font-family: 'OSRS Bold', monospace; font-size: 14px; margin-bottom: 8px;" />
                        <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 2px;">Character:</label>
                        <select id="coop-p2-char" style="width: 100%; background: #0c0906; border: 1px solid #5a4a35; color: #ff981f; padding: 6px; font-family: 'OSRS Small', monospace;">
                            ${characters.map(c => `<option value="${c.id}" ${this.localCharacter === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    ` : (this.peerConnected ? `
                        <div style="font-size: 18px; color: #ffff00; margin-bottom: 4px;">${safeRemoteName}</div>
                        <div style="font-size: 13px; color: #ff981f;">
                            Class: <strong>${(this.remoteCharacter || 'warrior').toUpperCase()}</strong>
                            <div style="font-size: 11px; color: ${this.remoteReady ? '#00ff00' : '#ffff00'}; margin-top: 4px;">
                                ${this.remoteReady ? '● Assets Ready' : '⏳ Baking Assets...'}
                            </div>
                        </div>
                    ` : `
                        <div style="font-size: 13px; color: #888; font-style: italic; margin-top: 12px;">
                            Waiting for Player 2 to join...
                        </div>
                    `)}
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: space-between; gap: 16px;">
                <button id="coop-close-btn" style="
                    flex: 1; background: #3d2f21; border: 2px solid #5a4a35; color: #aaa; padding: 10px;
                    cursor: pointer; font-family: 'OSRS Bold', monospace; font-size: 16px;">
                    Leave Lobby
                </button>
                ${isHost ? `
                    <button id="coop-start-btn" ${!this.peerConnected ? 'disabled' : ''} style="
                        flex: 2; background: ${this.peerConnected ? '#8a6414' : '#332719'}; 
                        border: 2px solid ${this.peerConnected ? '#d4af37' : '#443522'}; 
                        color: ${this.peerConnected ? '#fff' : '#665'}; padding: 10px;
                        cursor: ${this.peerConnected ? 'pointer' : 'not-allowed'}; 
                        font-family: 'OSRS Bold', monospace; font-size: 18px; text-shadow: 1px 1px #000;">
                        ${this.peerConnected ? (this.remoteReady ? 'Enter Lumbridge (Start Co-Op)' : 'Player 2 Loading Assets...') : 'Waiting for Player 2...'}
                    </button>
                ` : `
                    <div style="flex: 2; padding: 10px; color: #ffff00; font-size: 15px; align-self: center;">
                        ${this.localReady ? 'Assets Ready! Waiting for Host to start...' : 'Loading assets...'}
                    </div>
                `}
            </div>
        `;

        // Attach event listeners
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

        const p1NameInput = box.querySelector('#coop-p1-name');
        if (p1NameInput) {
            p1NameInput.oninput = (e) => this.setPlayerName(e.target.value);
        }

        const p2NameInput = box.querySelector('#coop-p2-name');
        if (p2NameInput) {
            p2NameInput.oninput = (e) => this.setPlayerName(e.target.value);
        }

        const p1Select = box.querySelector('#coop-p1-char');
        if (p1Select) {
            p1Select.onchange = (e) => this.selectCharacter(e.target.value);
        }

        const p2Select = box.querySelector('#coop-p2-char');
        if (p2Select) {
            p2Select.onchange = (e) => this.selectCharacter(e.target.value);
        }

        const startBtn = box.querySelector('#coop-start-btn');
        if (startBtn && this.peerConnected) {
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
    const room = params.get('room');
    if (room) {
        console.log('[Multiplayer] Auto-joining room from URL query:', room);
        setTimeout(() => {
            multiplayer.openLobbyModal(room);
        }, 1500);
    }
});
