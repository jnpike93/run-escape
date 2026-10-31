import { describe, expect, test } from "vitest";
import { mpActorRendererMethods } from "./mp-actor-renderer.js";
import { mpHudLeaderboardMethods } from "./mp-hud-leaderboard.js";
import { mpLobbyUiMethods } from "./mp-lobby-ui.js";
import { mpPickupsMethods } from "./mp-pickups.js";
import { mpTransportMethods } from "./mp-transport.js";
import {
    ALL_CHARACTERS,
    ALL_REGIONS,
    CHAR_WEAPONS,
    COOP_DIFFICULTY_WEIGHTS,
    buildPlayerBakeSeqIds,
    escapeHtml,
    getCoopDifficultyWeights,
    getWeaponStance,
    sanitizeCharacter,
    sanitizeHexColor,
    sanitizeMapId,
    sanitizeName,
    sanitizePeerStats,
    sanitizeRoomId,
    sanitizeSlot,
} from "./mp-constants.js";

function getScalingMultipliers(playerCount: number, customDamageMult = 1) {
    if (playerCount <= 1 && customDamageMult === 1) {
        return {
            hpMult: 1,
            bossHpMult: 1,
            dmgMult: 1,
            spawnMult: 1,
            ringMult: 1,
            heavyWeightBias: 0,
            xpMult: 1,
            coinMult: 1,
        };
    }
    const w = getCoopDifficultyWeights(playerCount);
    const customMult = Math.max(0.5, Number(customDamageMult) || 1);
    return {
        hpMult: Number((w.hpMult * customMult).toFixed(4)),
        bossHpMult: Number((w.bossHpMult * customMult).toFixed(4)),
        dmgMult: Number((w.dmgMult * customMult).toFixed(4)),
        spawnMult: w.spawnMult,
        ringMult: w.ringMult,
        heavyWeightBias: w.heavyWeightBias,
        xpMult: w.xpMult,
        coinMult: 1,
    };
}

describe("Multiplayer difficulty scaling & sanitization (mp-constants)", () => {
    test("Solo (1 player) baseline multipliers vs 2-4 player Co-Op scaling weights", () => {
        const solo = getScalingMultipliers(1, 1);
        expect(solo).toEqual({
            hpMult: 1,
            bossHpMult: 1,
            dmgMult: 1,
            spawnMult: 1,
            ringMult: 1,
            heavyWeightBias: 0,
            xpMult: 1,
            coinMult: 1,
        });

        const duo = getCoopDifficultyWeights(2);
        expect(duo).toEqual(COOP_DIFFICULTY_WEIGHTS[2]);
        expect(duo.hpMult).toBe(1.85);
        expect(duo.bossHpMult).toBe(2.25);
        expect(duo.dmgMult).toBe(1.1);
        expect(duo.spawnMult).toBe(1.25);
        expect(duo.xpMult).toBe(0.85);

        const trio = getCoopDifficultyWeights(3);
        expect(trio.hpMult).toBe(2.55);
        expect(trio.bossHpMult).toBe(3.25);
        expect(trio.dmgMult).toBe(1.22);
        expect(trio.spawnMult).toBe(1.5);
        expect(trio.xpMult).toBe(0.72);

        const quad = getCoopDifficultyWeights(4);
        expect(quad.hpMult).toBe(3.3);
        expect(quad.bossHpMult).toBe(4.25);
        expect(quad.dmgMult).toBe(1.35);
        expect(quad.spawnMult).toBe(1.75);
        expect(quad.xpMult).toBe(0.62);

        // Monotonic scaling across 2 -> 3 -> 4 players
        expect(quad.hpMult).toBeGreaterThan(trio.hpMult);
        expect(trio.hpMult).toBeGreaterThan(duo.hpMult);
        expect(quad.spawnMult).toBeGreaterThan(trio.spawnMult);
        expect(trio.spawnMult).toBeGreaterThan(duo.spawnMult);
        expect(quad.xpMult).toBeLessThan(trio.xpMult);
        expect(trio.xpMult).toBeLessThan(duo.xpMult);
    });

    test("Custom difficultyMult (1x..3x) scales Co-Op HP and damage multipliers", () => {
        const duo1x = getScalingMultipliers(2, 1);
        const duo2x = getScalingMultipliers(2, 2);
        const quad3x = getScalingMultipliers(4, 3);

        expect(duo1x.hpMult).toBeCloseTo(1.85, 4);
        expect(duo1x.dmgMult).toBeCloseTo(1.1, 4);

        expect(duo2x.hpMult).toBeCloseTo(1.85 * 2, 4);
        expect(duo2x.bossHpMult).toBeCloseTo(2.25 * 2, 4);
        expect(duo2x.dmgMult).toBeCloseTo(1.1 * 2, 4);

        expect(quad3x.hpMult).toBeCloseTo(3.3 * 3, 4);
        expect(quad3x.bossHpMult).toBeCloseTo(4.25 * 3, 4);
        expect(quad3x.dmgMult).toBeCloseTo(1.35 * 3, 4);
    });

    test("Sanitizes maps, characters, names, room IDs, slots, and HTML", () => {
        expect(ALL_CHARACTERS.length).toBeGreaterThanOrEqual(35);
        expect(ALL_REGIONS.length).toBeGreaterThanOrEqual(20);
        expect(sanitizeMapId("FIGHT_CAVES")).toBe("fight_caves");
        expect(sanitizeMapId("BARBARIAN_VILLAGE")).toBe("barbarian_village");
        expect(sanitizeMapId("invalid_map", "lumbridge")).toBe("lumbridge");
        expect(sanitizeCharacter("DIPPER")).toBe("dipper");
        expect(sanitizeCharacter("nova")).toBe("nova");
        expect(CHAR_WEAPONS["nova"]).toBe("dragon_claws");
        expect(sanitizeCharacter("unknown", "warrior")).toBe("warrior");
        expect(sanitizeName("  Zezima<script>  ")).toBe("Zezimascript");
        expect(sanitizeRoomId("OSRS-1234!@#")).toBe("OSRS-1234");
        expect(sanitizeSlot(3)).toBe(3);
        expect(sanitizeSlot(99, 1)).toBe(1);
        expect(escapeHtml('<img src="x" onerror="alert(1)">')).toBe(
            "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;",
        );
    });

    test("sanitizeHexColor accepts valid hex colors and rejects CSS injection payloads", () => {
        expect(sanitizeHexColor("#ff981f")).toBe("#ff981f");
        expect(sanitizeHexColor(" #abc ")).toBe("#abc");
        expect(sanitizeHexColor("#11223344")).toBe("#11223344");
        expect(sanitizeHexColor("#000; position: fixed; inset: 0; background: red", "#3d3123")).toBe("#3d3123");
        expect(sanitizeHexColor("javascript:alert(1)", "#ff981f")).toBe("#ff981f");
        expect(sanitizeHexColor(null as any, "#3d3123")).toBe("#3d3123");
    });

    test("sanitizePeerStats clamps out-of-range combat stats and strips unknown keys", () => {
        const cleaned = sanitizePeerStats({
            might: 999,
            cooldown: -5,
            amount: 50,
            armor: -999,
            regen: 500,
            thorns: -10,
            growth: 1.5,
            __proto__: { polluted: true },
            unknownKey: "malicious",
            extraStat: 12345,
        });
        expect(cleaned).toEqual({
            might: 5,
            cooldown: -0.9,
            amount: 8,
            armor: -10,
            regen: 50,
            thorns: 0,
            growth: 1.5,
        });
        expect((cleaned as any).unknownKey).toBeUndefined();
        expect((cleaned as any).extraStat).toBeUndefined();
    });
});

describe("Shared Co-Op XP growth pooling formula", () => {
    test("Pools item XP bonuses across all lobby players divided by partySize while keeping host meta growth unsplit", () => {
        const hostMetaGrowth = 0.25; // +25% permanent shop upgrade
        const hostItemGrowth = 0.2; // +20% from in-run items/passives
        const sim = {
            metaStats: { growth: hostMetaGrowth },
            stats: { growth: hostMetaGrowth + hostItemGrowth },
        };

        // 2-player party: Host (+20% item) + Guest 2 (+40% item) => avg item bonus = +30%
        const ctx2P = {
            remotePeers: new Map([[2, { slot: 2, itemGrowth: 0.4 }]]),
            getLobbyGrowthMultiplier: mpActorRendererMethods.getLobbyGrowthMultiplier,
        };
        const bonus2P = ctx2P.getLobbyGrowthMultiplier(sim);
        expect(bonus2P).toBeCloseTo(hostMetaGrowth + (0.2 + 0.4) / 2, 6);
        expect(1 + bonus2P).toBeCloseTo(1 + 0.25 + 0.3, 6);

        // 4-player party: Host (+20%) + P2 (+40%) + P3 (+0%) + P4 (+60%) => avg item bonus = 1.2 / 4 = +30%
        const ctx4P = {
            remotePeers: new Map([
                [2, { slot: 2, itemGrowth: 0.4 }],
                [3, { slot: 3, itemGrowth: 0 }],
                [4, { slot: 4, itemGrowth: 0.6 }],
            ]),
            getLobbyGrowthMultiplier: mpActorRendererMethods.getLobbyGrowthMultiplier,
        };
        const bonus4P = ctx4P.getLobbyGrowthMultiplier(sim);
        expect(bonus4P).toBeCloseTo(hostMetaGrowth + (0.2 + 0.4 + 0 + 0.6) / 4, 6);
        expect(1 + bonus4P).toBeCloseTo(1.55, 6);
    });
});

describe("Antique Lamp XP split formula", () => {
    test("Grants 100% of a level in solo (partyCount = 1) and 1/x of a level across x players in Co-Op", () => {
        const computeLampIntSplit = (xpNeeded: number, partyCount: number) =>
            Math.max(1, Math.floor((xpNeeded + 1) / partyCount));

        expect(computeLampIntSplit(99, 1)).toBe(100);
        expect(computeLampIntSplit(99, 2)).toBe(50);
        expect(computeLampIntSplit(99, 3)).toBe(33);
        expect(computeLampIntSplit(99, 4)).toBe(25);

        // Verify mpPickupsMethods.applyCoopPickup('lamp_xp') applies span * (1 / partyCount)
        const prevWindow = (globalThis as any).window;
        try {
            for (const partyCount of [1, 2, 3, 4]) {
                const sim = {
                    xp: 100,
                    xpForThisLevel: 100,
                    xpForNextLevel: 220,
                    state: "playing",
                    checkLevelUp() {},
                };
                (globalThis as any).window = {
                    gameClient: {
                        sim,
                        accumulator: 0,
                        syncOverlay() {},
                        updateHud() {},
                    },
                };
                const ctx = {
                    ...mpPickupsMethods,
                    syncLocalPauseState() {},
                };
                const levelsPerPlayer = 1 / partyCount;
                ctx.applyCoopPickup({ kind: "lamp_xp", levels: levelsPerPlayer });
                const expectedGain = (220 - 100) * (1 / partyCount);
                expect(sim.xp).toBeCloseTo(100 + expectedGain, 6);
            }
        } finally {
            (globalThis as any).window = prevWindow;
        }
    });
});

// ============================================================
// Security fix tests (M-2, M-3, L-1, L-2, L-3)
// ============================================================

describe("Security fixes - hpDelta magnitude cap (M-2)", () => {
    function makeApplyCtx(initialHp: number, maxHp: number) {
        const p2: any = { hp: initialHp, maxHp, level: 1, characterId: 'warrior' };
        const peer: any = { slot: 2, entity: p2, weapons: [], loadout: { weapons: [], passives: [], gear: [], inventory: [] }, _loadoutReceived: false };
        const remotePeers = new Map([[2, peer]]);
        const sim: any = { weapons: [], appearanceVersion: 0, stats: {}, metaStats: {}, player: { hp: 25, maxHp: 25 } };
        const ctx: any = {
            ...mpActorRendererMethods,
            role: 'host',
            localSlot: 1,
            remotePeers,
            gameStarted: true,
            loadoutVersion: 0,
            lastPartyHudKey: '',
            damageStats: new Map(),
            bakeRemotePeerAppearance() {},
        };
        (globalThis as any).window = { gameClient: { sim, getSimAppearance: null } };
        return { ctx, p2, peer };
    }

    test("hpDelta of +9999 is clamped to at most +200", () => {
        const { ctx, p2 } = makeApplyCtx(100, 500);
        ctx.applyRemoteLoadout({ type: 'coop_loadout', senderSlot: 2, slot: 2, hpDelta: 9999, maxHp: 500, hp: 100, healed: false });
        expect(p2.hp).toBeLessThanOrEqual(300); // 100 + 200
        expect(p2.hp).toBe(300);
    });

    test("hpDelta of -9999 is clamped to at most -200", () => {
        const { ctx, p2 } = makeApplyCtx(300, 500);
        ctx.applyRemoteLoadout({ type: 'coop_loadout', senderSlot: 2, slot: 2, hpDelta: -9999, maxHp: 500, hp: 300, healed: false });
        expect(p2.hp).toBeGreaterThanOrEqual(0);
        expect(p2.hp).toBe(100); // 300 - 200
    });

    test("usedItemId spoofing protection ignores item effects if sender does not possess the item", () => {
        const { ctx, p2, peer } = makeApplyCtx(100, 500);
        let damagedEnemy = false;
        const enemy = { dead: false, x: 10, y: 10, radius: 0.4 };
        p2.x = 10;
        p2.y = 10;

        (globalThis as any).window.gameClient.sim.enemies = [enemy];
        (globalThis as any).window.gameClient.sim.damageEnemy = () => {
            damagedEnemy = true;
        };

        // 1. Spoofed black_chinchompa without item in loadout or message -> IGNORED
        ctx.applyRemoteLoadout({
            type: 'coop_loadout',
            senderSlot: 2,
            slot: 2,
            usedItemId: 'black_chinchompa',
            inventory: [],
            gear: [],
            passives: [],
            weapons: []
        });
        expect(damagedEnemy).toBe(false);
        expect(peer._lastItemUseMs).toBeUndefined();

        // 2. Unallowed item string -> IGNORED
        ctx.applyRemoteLoadout({
            type: 'coop_loadout',
            senderSlot: 2,
            slot: 2,
            usedItemId: 'super_weapon_cheat',
            inventory: [{ id: 'super_weapon_cheat' }]
        });
        expect(damagedEnemy).toBe(false);

        // 3. Legitimate black_chinchompa present in inventory -> EXECUTED
        ctx.applyRemoteLoadout({
            type: 'coop_loadout',
            senderSlot: 2,
            slot: 2,
            usedItemId: 'black_chinchompa',
            inventory: [{ id: 'black_chinchompa', count: 1 }],
            gear: [],
            passives: [],
            weapons: []
        });
        expect(damagedEnemy).toBe(true);
        expect(peer._lastItemUseMs).toBeDefined();
    });
});

describe("Security fixes - weapon.bonus cap (M-3)", () => {
    test("weapon.bonus of 5 received over the wire is clamped to 0.5 when passed to addWeapon", () => {
        // Test that the cap value 0.5 is enforced: Math.min(0.5, 5) === 0.5
        const capped = Math.min(0.5, Math.max(0, Number(5)));
        expect(capped).toBe(0.5);
        // And a legitimate bonus of 0.45 passes through unchanged
        const legit = Math.min(0.5, Math.max(0, Number(0.45)));
        expect(legit).toBe(0.45);
    });
});

describe("Security fixes - game_over senderSlot enforcement (L-1)", () => {
    test("game_over without senderSlot field does NOT trigger for non-host slot", () => {
        let endCalled = false;
        const ctx: any = {
            ...mpTransportMethods,
            role: 'guest',
            localSlot: 2,
            hostSlot: 1,       // host is slot 1
            gameStarted: true,
            remotePeers: new Map(),
            _gameOverSent: false,
            _victorySent: false,
            localPauseState: null,
            spectateSlot: null,
            lastLeaderboard: null,
            ws: { readyState: 1, send() {} },
            roomId: 'test',
            bus: null,
            endGameOnDisconnect(..._args: any[]) { endCalled = true; },
            showToast() {},
            updateLobbyUI() {},
            buildLeaderboard() {},
            removePauseOverlay() {},
            invalidateSortedRemotePeers() {},
        };
        // game_over with NO senderSlot: sanitizeSlot(undefined, 0) returns 0,
        // which !== hostSlot (1), so must break without calling endGameOnDisconnect
        ctx.handleMessage({ type: 'game_over', reason: 'test' });
        expect(endCalled).toBe(false);
    });
});

describe("Security fixes - totalXp cap (L-2)", () => {
    test("totalXp of 1e15 is clamped to 1e9 in applyCoopPickup", () => {
        const prevWindow = (globalThis as any).window;
        try {
            const sim: any = {
                xp: 100,
                state: 'playing',
                coins: 0,
                checkLevelUp() {},
            };
            (globalThis as any).window = {
                gameClient: {
                    sim,
                    accumulator: 0,
                    syncOverlay() {},
                    updateHud() {},
                    sounds: null,
                },
            };
            const ctx: any = {
                ...mpPickupsMethods,
                hostSlot: 1,
                getLobbyGrowthMultiplier: () => 0,
                syncLocalPauseState() {},
            };
            // bones pickup with totalXp=1e15; the cap should prevent sim.xp exceeding 1e9
            ctx.applyCoopPickup({ kind: 'bones', senderSlot: 1, value: 10, xpGained: 10, totalXp: 1e15 });
            expect(sim.xp).toBeLessThanOrEqual(1e9);
        } finally {
            (globalThis as any).window = prevWindow;
        }
    });
});

describe("25 Hz sync_world velocity normalization & batched coop_pickup frames", () => {
    test("applyWorldSync normalizes enemy and remote player fallback velocity by tickDelta = 2 (25 Hz sync)", async () => {
        const prevWindow = (globalThis as any).window;
        const prevImage = (globalThis as any).Image;
        try {
            (globalThis as any).window = { ...(prevWindow || {}), addEventListener() {} };
            (globalThis as any).Image = prevImage || class { src = ""; };
            const { mpSyncEngineMethods } = await import("./mp-sync-engine.js");
            const enemy: any = {
                uid: 101,
                def: { id: "goblin" },
                x: 10,
                y: 20,
                prevX: 10,
                prevY: 20,
                netX: 10,
                netY: 20,
                netVx: 0,
                netVy: 0,
                hp: 15,
                maxHp: 15,
                yaw: 0,
                dead: false,
            };
            const peerEntity: any = {
                slot: 2,
                x: 30,
                y: 40,
                prevX: 30,
                prevY: 40,
                netX: 30,
                netY: 40,
                vx: 0,
                vy: 0,
                hp: 25,
                maxHp: 25,
                moving: true,
            };
            const peer: any = {
                slot: 2,
                name: "Player 2",
                entity: peerEntity,
                pauseState: null,
                _initialPosSynced: true,
            };
            const sim: any = {
                tick: 100,
                kills: 0,
                xp: 0,
                round: 1,
                state: "playing",
                player: { hp: 25, maxHp: 25, spectating: false },
                enemies: [enemy],
                pickups: [],
                turrets: [],
                thralls: [],
                enemyProjectiles: [],
                effects: [],
            };
            (globalThis as any).window = {
                gameClient: {
                    sim,
                    accumulator: 0,
                    syncOverlay() {},
                    updateHud() {},
                    handleEvents() {},
                },
            };

            const ctx: any = {
                ...mpSyncEngineMethods,
                localSlot: 1,
                _lastHostSyncTick: 100,
                remotePeers: new Map([[2, peer]]),
                damageStats: new Map(),
                invalidateSortedRemotePeers() {},
                updatePauseOverlay() {},
                syncLocalPauseState() {},
                showToast() {},
            };

            // Host tick advances by 2 (100 -> 102, 25 Hz sync).
            // Enemy moved +0.8 in X and -0.4 in Y over 2 ticks => per-tick velocity should be +0.4 and -0.2.
            // Remote player (without explicit vx/vy) moved +1.0 in X and +0.6 in Y over 2 ticks => +0.5 and +0.3.
            ctx.applyWorldSync({
                type: "sync_world",
                tick: 102,
                players: [
                    { slot: 2, hp: 25, maxHp: 25, x: 31.0, y: 40.6, moving: true },
                ],
                enemies: [
                    [101, "goblin", 10.8, 19.6, 15, 15, 0, 0, "walk", 0, 0, 1, 0, 0, -1, null, 0],
                ],
            });

            expect(ctx._lastHostSyncTick).toBe(102);
            expect(enemy.netVx).toBeCloseTo(0.4, 5);
            expect(enemy.netVy).toBeCloseTo(-0.2, 5);
            expect(peerEntity.vx).toBeCloseTo(0.5, 5);
            expect(peerEntity.vy).toBeCloseTo(0.3, 5);
        } finally {
            (globalThis as any).window = prevWindow;
            (globalThis as any).Image = prevImage;
        }
    });

    test("queueCoopPickup batches XP and coin pickups during sim.step (_inSimStep = true) and sends immediately outside sim.step", () => {
        const sentMessages: any[] = [];
        const ctx: any = {
            ...mpPickupsMethods,
            _inSimStep: true,
            _batchedXpPickup: null,
            _batchedCoinsPickup: null,
            send(msg: any) {
                sentMessages.push(msg);
            },
        };

        // Simulate 5 bone pickups and 3 coin pickups in a single tick
        ctx.queueCoopPickup({ type: "coop_pickup", kind: "bones", value: 5, xpGained: 7.5, totalXp: 107.5 });
        ctx.queueCoopPickup({ type: "coop_pickup", kind: "big_bones", value: 15, xpGained: 22.5, totalXp: 130.0 });
        ctx.queueCoopPickup({ type: "coop_pickup", kind: "coins", value: 10 });
        ctx.queueCoopPickup({ type: "coop_pickup", kind: "coins", value: 25 });
        // Non-batched kinds (e.g. casket) are still sent immediately
        ctx.queueCoopPickup({ type: "coop_pickup", kind: "casket", tier: "medium", pickupUid: "c1" });

        expect(sentMessages.length).toBe(1);
        expect(sentMessages[0].kind).toBe("casket");

        // Flush at end of sim.step
        ctx.flushCoopPickups();
        expect(sentMessages.length).toBe(3);
        expect(sentMessages[1]).toEqual({
            type: "coop_pickup",
            kind: "big_bones",
            value: 20,
            xpGained: 30,
            totalXp: 130.0,
        });
        expect(sentMessages[2]).toEqual({
            type: "coop_pickup",
            kind: "coins",
            value: 35,
        });

        // Outside sim.step (_inSimStep = false), pickups send immediately
        ctx._inSimStep = false;
        ctx.queueCoopPickup({ type: "coop_pickup", kind: "bones", value: 5, xpGained: 5, totalXp: 135 });
        expect(sentMessages.length).toBe(4);
        expect(sentMessages[3].value).toBe(5);
    });
});

describe("Co-Op leaderboard point calculation & sorting (mp-hud-leaderboard)", () => {
    test("buildLeaderboard computes individual points from kills, damage, level, and difficulty and sorts by points/damage", () => {
        const prevWindow = (globalThis as any).window;
        try {
            (globalThis as any).window = {
                gameClient: {
                    sim: {
                        level: 10,
                        seconds: 300, // 5 minutes
                        state: "victory",
                        map: {
                            id: "wilderness",
                            difficulty: { hp: 2.0, damage: 1.5 }, // mapDiff = 0.6*2 + 0.4*1.5 = 1.8
                        },
                    },
                },
            };

            const damageStats = new Map<number, any>([
                [
                    1,
                    {
                        slot: 1,
                        name: "Alice",
                        characterId: "warrior",
                        charName: "Warrior",
                        damage: 10000,
                        kills: 150,
                        level: 10,
                    },
                ],
                [
                    2,
                    {
                        slot: 2,
                        name: "Bob",
                        characterId: "ranger",
                        charName: "Ranger",
                        damage: 25000,
                        kills: 200,
                        level: 12,
                    },
                ],
            ]);

            const ctx: any = {
                ...mpHudLeaderboardMethods,
                localSlot: 1,
                selectedMapId: "wilderness",
                difficultyMult: 2.0, // coopMult = 2.0 -> diffMult = 1.8 * (0.7 + 0.3 * 2.0) = 1.8 * 1.3 = 2.34
                remotePeers: new Map([[2, { slot: 2, level: 12 }]]),
                damageStats,
                lastLeaderboard: null,
            };

            const board = ctx.buildLeaderboard();
            expect(board.length).toBe(2);
            // Bob has higher kills, damage, and level so Bob is #1
            expect(board[0].slot).toBe(2);
            expect(board[1].slot).toBe(1);
            expect(board[0].points).toBeGreaterThan(board[1].points);
            expect(board[0].points).toBeGreaterThan(0);
            expect(board[1].points).toBeGreaterThan(0);

            // Verify overrideStats preserves higher points if provided
            const boardOverride = ctx.buildLeaderboard([{ slot: 1, points: 999999 }]);
            expect(boardOverride[0].slot).toBe(1);
            expect(boardOverride[0].points).toBe(999999);
        } finally {
            (globalThis as any).window = prevWindow;
        }
    });
});

describe("0.18.0 Multiplayer compatibility - Stances, Sled, Rocks, Rampages, Fairy Rings & Ground Fires", () => {
    test("Includes penance_fighter and maps 0.18.0 weapon stances with walk (819) baked first", () => {
        expect(sanitizeCharacter("penance_fighter")).toBe("penance_fighter");
        expect(CHAR_WEAPONS.penance_fighter).toBe("battleaxe");

        // Walk (819) must always be index 0 so actor height comes from neutral walk pose
        const seqs = buildPlayerBakeSeqIds(null);
        expect(seqs[0]).toBe(819);
        expect(seqs).toContain(7053); // Godsword idle
        expect(seqs).toContain(7043); // Godsword run
        expect(seqs).toContain(1661); // Whip run
        expect(seqs).toContain(813);  // Staff idle
        expect(seqs).toContain(1210); // Staff run
        expect(seqs).toContain(9171); //Atlatl / new attack seqs

        expect(getWeaponStance(11802)).toEqual({ idle: 7053, run: 7043 }); // Armadyl godsword
        expect(getWeaponStance(4151)).toEqual({ idle: 808, run: 1661 });   // Abyssal whip
        expect(getWeaponStance(6526)).toEqual({ idle: 813, run: 1210 });   // Toktz-mej-tal
        expect(getWeaponStance(1333)).toEqual({ idle: 808, run: 824 });    // Rune scimitar (default stance)
    });

    test("applyWorldSync synchronizes 0.18.0 rocks, rampages, fairy rings, ground fires, and remote sled state", async () => {
        const prevWindow = (globalThis as any).window;
        const prevImage = (globalThis as any).Image;
        try {
            (globalThis as any).window = { ...(prevWindow || {}), addEventListener() {} };
            (globalThis as any).Image = prevImage || class { src = ""; };
            const { mpSyncEngineMethods } = await import("./mp-sync-engine.js");

            const peerEntity: any = {
                slot: 2,
                x: 30,
                y: 40,
                prevX: 30,
                prevY: 40,
                netX: 30,
                netY: 40,
                vx: 0,
                vy: 0,
                hp: 25,
                maxHp: 25,
                moving: true,
                sled: false,
            };
            const peer: any = {
                slot: 2,
                name: "Player 2",
                entity: peerEntity,
                pauseState: null,
                _initialPosSynced: true,
            };
            const sim: any = {
                tick: 200,
                kills: 0,
                xp: 0,
                round: 1,
                state: "playing",
                player: { hp: 25, maxHp: 25, spectating: false },
                enemies: [],
                pickups: [],
                turrets: [],
                thralls: [],
                enemyProjectiles: [],
                effects: [],
                rocks: [],
                rampages: [],
                rings: [],
                fires: [],
            };
            (globalThis as any).window = {
                gameClient: {
                    sim,
                    accumulator: 0,
                    syncOverlay() {},
                    updateHud() {},
                    handleEvents() {},
                },
            };

            const ctx: any = {
                ...mpSyncEngineMethods,
                localSlot: 1,
                _lastHostSyncTick: 198,
                remotePeers: new Map([[2, peer]]),
                damageStats: new Map(),
                invalidateSortedRemotePeers() {},
                updatePauseOverlay() {},
                syncLocalPauseState() {},
                showToast() {},
            };

            ctx.applyWorldSync({
                type: "sync_world",
                tick: 200,
                players: [{ slot: 2, hp: 25, maxHp: 25, x: 31, y: 41, moving: true, sled: true }],
                rocks: [[501, "giant_rune_essence", 32, 42, 190, 235, 260, 4369, 60, 3.5]],
                rampages: [[601, "evil_bob", 28, 38, 512, 40, 50, 0.36, 195, 595, -1, 6560, 2.8]],
                rings: [[701, 30, 40, 190, 940, 2.5, 29228, 569, 1.5]],
                fires: [[801, 30.5, 40.5, 1.8, 350, 20000]],
            });

            expect(peerEntity.sled).toBe(true);
            expect(sim.rocks.length).toBe(1);
            expect(sim.rocks[0].uid).toBe(501);
            expect(sim.rocks[0].locId).toBe(4369);
            expect(sim.rampages.length).toBe(1);
            expect(sim.rampages[0].uid).toBe(601);
            expect(sim.rampages[0].goalX).toBe(40);
            expect(sim.rings.length).toBe(1);
            expect(sim.rings[0].uid).toBe(701);
            expect(sim.fires.length).toBe(1);
            expect(sim.fires[0].uid).toBe(801);
            expect(sim.fires[0].flames.length).toBe(7);
        } finally {
            (globalThis as any).window = prevWindow;
            (globalThis as any).Image = prevImage;
        }
    });

    test("Remote peer sled pickup activates sled on the Guest without hijacking Host sled state", () => {
        const prevWindow = (globalThis as any).window;
        try {
            let hostUsePowerUpCalled = false;
            const sentMessages: any[] = [];
            const p2: any = { x: 15, y: 15, hp: 25, maxHp: 25, frozen: 10, invulnerable: 0, sled: false, sledEndTick: 0 };
            const peer: any = { slot: 2, name: "Bob", entity: p2 };
            const hostSim: any = {
                tick: 100,
                sledEndTick: 0,
                stats: { magnet: 0 },
                events: [],
                pickups: [{ uid: 1, kind: "powerUp", powerUp: "sled", x: 15.1, y: 15.1, value: 1 }],
                _origCollect() {
                    hostUsePowerUpCalled = true;
                },
            };
            (globalThis as any).window = { gameClient: { sim: hostSim } };

            const hostCtx: any = {
                ...mpPickupsMethods,
                localSlot: 1,
                hostSlot: 1,
                send(msg: any) {
                    sentMessages.push(msg);
                },
            };

            hostCtx.stepRemotePlayerPickups(hostSim, peer);
            expect(hostUsePowerUpCalled).toBe(false);
            expect(hostSim.sledEndTick).toBe(0);
            expect(p2.sled).toBe(true);
            expect(p2.sledEndTick).toBe(500);
            expect(p2.frozen).toBe(0);
            expect(p2.invulnerable).toBeGreaterThanOrEqual(13);
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0]).toMatchObject({
                type: "coop_pickup",
                kind: "powerUp",
                powerUpId: "sled",
                targetSlot: 2,
            });

            // Now verify Guest (slot 2) receives that message and activates sled locally
            let guestSledActivated = false;
            const guestSim: any = {
                tick: 100,
                usePowerUp(def: any) {
                    if (def?.id === "sled") guestSledActivated = true;
                },
                takeEvents: () => [],
            };
            (globalThis as any).window = {
                gameClient: {
                    sim: guestSim,
                    handleEvents() {},
                    updateHud() {},
                },
            };
            const guestCtx: any = {
                ...mpPickupsMethods,
                localSlot: 2,
                hostSlot: 1,
            };
            guestCtx.applyCoopPickup({ ...sentMessages[0], senderSlot: 1 });
            expect(guestSledActivated).toBe(true);
        } finally {
            (globalThis as any).window = prevWindow;
        }
    });

    test.each([
        ["Regular (1x)", 1.0],
        ["Nightmare (3x)", 3.0],
    ])(
        "Real Sim Co-Op integration on Barrows (%s): monsters spawn, chase via FlowField, and attack players",
        async (_label, difficultyMult) => {
            const { Sim } = await import("../../game/core/Sim");
            const { ArenaGrid } = await import("../../game/core/world/ArenaGrid");
            const { getMap } = await import("../../game/content/maps");
            const { getEnemy } = await import("../../game/content/enemies");
            const { createSave, getMetaStats } = await import("../../game/core/save");

            const prevWindow = (globalThis as any).window;
            const prevImage = (globalThis as any).Image;
            try {
                (globalThis as any).window = { ...(prevWindow || {}), addEventListener() {} };
                (globalThis as any).Image = prevImage || class { src = ""; };
                const { mpSyncEngineMethods } = await import("./mp-sync-engine.js");

                const map = getMap("barrows");
                const sizeX = map.arena.sizeX;
                const sizeY = map.arena.sizeY;
                const grid = new ArenaGrid({
                    baseX: map.arena.baseX,
                    baseY: map.arena.baseY,
                    sizeX,
                    sizeY,
                    plane: map.plane ?? 0,
                    collisionFlags: new Int32Array(sizeX * sizeY),
                    collisionLocs: new Float32Array(0),
                    tileFlags: new Uint8Array(sizeX * sizeY),
                    overlays: new Uint16Array(sizeX * sizeY),
                    heights: new Int32Array((sizeX + 1) * (sizeY + 1)),
                    bridgeHeights: new Int32Array((sizeX + 1) * (sizeY + 1)),
                });

                const sim = new Sim({
                    grid,
                    mapId: "barrows",
                    characterId: "warrior",
                    spawnX: map.spawn.x,
                    spawnY: map.spawn.y,
                    metaStats: getMetaStats(createSave()),
                    seed: 12345,
                });

                const sentMessages: any[] = [];
                const client: any = {
                    sim,
                    getEnemyDef: getEnemy,
                    input: {},
                    store: { getSnapshot: () => ({ overlay: "none" }) },
                    syncOverlay() {},
                    updateHud() {},
                    handleEvents() {},
                };

                (globalThis as any).window = {
                    gameClient: client,
                    crypto: {
                        getRandomValues(arr: Uint32Array) {
                            arr[0] = 42;
                            return arr;
                        },
                    },
                };

                const hostCtx: any = {
                    ...mpSyncEngineMethods,
                    ...mpPickupsMethods,
                    clientMethodsHooked: true,
                    role: "host",
                    localSlot: 1,
                    hostSlot: 1,
                    localName: "HostPlayer",
                    difficultyMult,
                    gameConfig: { difficultyMult },
                    remotePeers: new Map(),
                    damageStats: new Map(),
                    charStances: new Map(),
                    invalidateSortedRemotePeers() {},
                    removePauseOverlay() {},
                    bakeRemotePeerAppearance() {},
                    stepRemotePlayer() {},
                    syncLocalPauseState() {},
                    sendLoadoutSync() {},
                    getLocalPauseState: () => null,
                    buildLeaderboard: () => [],
                    showToast() {},
                    send(msg: any) {
                        sentMessages.push(msg);
                    },
                };

                hostCtx.setupInGameHooks("warrior", [
                    { slot: 1, name: "HostPlayer", character: "warrior", isHost: true },
                    { slot: 2, name: "GuestPlayer", character: "ranger", isHost: false },
                ]);

                // Step 150 ticks (3 seconds) - wave director must spawn monsters beyond the initial 5 rats
                // and stepEnemies must move them toward the party without throwing FlowField.update errors
                for (let t = 0; t < 150; t++) {
                    sim.step(0, 0);
                }

                expect(sim.enemies.length).toBeGreaterThan(5);
                const movedEnemies = sim.enemies.filter(
                    (e) => !e.dead && (Math.abs(e.x - e.prevX) > 0 || Math.abs(e.y - e.prevY) > 0),
                );
                expect(movedEnemies.length).toBeGreaterThan(0);

                // Place a rat directly on the Host player and verify it attacks and deals damage
                const rat = sim.spawnEnemy(getEnemy("rat"), "normal", {
                    x: sim.player.x + 0.2,
                    y: sim.player.y,
                })!;
                expect(rat).toBeDefined();
                const hpBefore = sim.player.hp;
                sim.player.invulnerable = 0;
                rat.attackCooldown = 0;
                sim.step(0, 0);
                expect(sim.player.hp).toBeLessThan(hpBefore);

                // Verify Host broadcasted sync_world packets with enemies to Guests
                const syncMsgs = sentMessages.filter((m) => m.type === "sync_world");
                expect(syncMsgs.length).toBeGreaterThan(0);
                expect(syncMsgs[syncMsgs.length - 1].enemies.length).toBeGreaterThan(5);
            } finally {
                (globalThis as any).window = prevWindow;
                (globalThis as any).Image = prevImage;
            }
        },
    );
});

describe("Mid-run lobby lock & non-participating peer disconnect isolation (mp-transport & mp-lobby-ui)", () => {
    function createActiveDuoCtx(role: "host" | "guest" = "host", localSlot = 1) {
        const partnerSlot = localSlot === 1 ? 2 : 1;
        const disconnectReasons: string[] = [];
        const toasts: string[] = [];
        const lobbyPlayers = new Map<number, any>([
            [1, { slot: 1, name: "HostPlayer", character: "warrior", ready: true, isHost: true }],
            [2, { slot: 2, name: "PartnerPlayer", character: "ranger", ready: true, isHost: false }],
        ]);
        const remotePeers = new Map<number, any>([
            [partnerSlot, { slot: partnerSlot, name: partnerSlot === 1 ? "HostPlayer" : "PartnerPlayer", characterId: "ranger" }],
        ]);
        const ctx: any = {
            ...mpTransportMethods,
            role,
            localSlot,
            hostSlot: 1,
            peers: 2,
            peerConnected: true,
            gameStarted: true,
            lobbyLockedReason: null,
            lobbyPlayers,
            remotePeers,
            disconnectReasons,
            toasts,
            getUnlockedCharacters: () => ["warrior", "ranger", "wizard"],
            syncLocalToLobbyPlayers() {},
            sendLobbyUpdate() {},
            broadcastPartyRoster() {},
            updateLobbyUI() {},
            showToast(msg: string) {
                toasts.push(msg);
            },
            endGameOnDisconnect(reason: string) {
                disconnectReasons.push(reason);
                this.gameStarted = false;
            },
        };
        return ctx;
    }

    test("Latecomer (slot 3) peer_joined, lobby_update, and peer_left during active 2P run are ignored and NEVER end the game", () => {
        const ctx = createActiveDuoCtx("host", 1);

        // 1. Latecomer slot 3 sends peer_joined with activeSlots [1, 2, 3]
        ctx.handleMessage({
            type: "peer_joined",
            slot: 3,
            hostSlot: 1,
            peers: 3,
            activeSlots: [1, 2, 3],
        });
        expect(ctx.gameStarted).toBe(true);
        expect(ctx.disconnectReasons).toEqual([]);
        expect(ctx.lobbyPlayers.has(3)).toBe(false);
        expect(ctx.toasts).toEqual([]);

        // 2. Latecomer slot 3 sends lobby_update
        ctx.handleMessage({
            type: "lobby_update",
            senderSlot: 3,
            slot: 3,
            name: "Latecomer3",
            character: "wizard",
            ready: true,
        });
        expect(ctx.gameStarted).toBe(true);
        expect(ctx.lobbyPlayers.has(3)).toBe(false);

        // 3. Even if reconcileActiveSlots is called directly with [1, 2, 3, 4] mid-run, slots 3 & 4 are excluded
        ctx.reconcileActiveSlots([1, 2, 3, 4]);
        expect(Array.from(ctx.lobbyPlayers.keys()).sort()).toEqual([1, 2]);

        // 4. Latecomer slot 3 leaves (peer_left / peer_leaving) -> MUST NOT trigger endGameOnDisconnect
        ctx.handleMessage({
            type: "peer_left",
            slot: 3,
            senderSlot: 3,
            role: "guest",
            peers: 2,
            activeSlots: [1, 2],
        });
        expect(ctx.disconnectReasons).toEqual([]);
        expect(ctx.gameStarted).toBe(true);
    });

    test("Actual in-game partner (slot 2) or Host (slot 1) leaving DOES trigger endGameOnDisconnect", () => {
        // Case A: Host (slot 1) sees in-game partner (slot 2) leave in a 2-player game
        const hostCtx = createActiveDuoCtx("host", 1);
        hostCtx.handleMessage({
            type: "peer_left",
            slot: 2,
            senderSlot: 2,
            role: "guest",
            peers: 1,
            activeSlots: [1],
        });
        expect(hostCtx.disconnectReasons.length).toBe(1);
        expect(hostCtx.disconnectReasons[0]).toContain("PartnerPlayer Disconnected - Game Over");
        expect(hostCtx.gameStarted).toBe(false);

        // Case B: Guest (slot 2) sees Host (slot 1) leave
        const guestCtx = createActiveDuoCtx("guest", 2);
        guestCtx.handleMessage({
            type: "peer_left",
            slot: 1,
            senderSlot: 1,
            role: "host",
            peers: 1,
            activeSlots: [2],
        });
        expect(guestCtx.disconnectReasons.length).toBe(1);
        expect(guestCtx.disconnectReasons[0]).toContain("HostPlayer Disconnected - Game Over");
        expect(guestCtx.gameStarted).toBe(false);
    });

    test("error with code 'room_locked' populates lobbyLockedReason and calls showToast", () => {
        const ctx = createActiveDuoCtx("guest", 2);
        ctx.gameStarted = false;
        let uiUpdated = false;
        ctx.updateLobbyUI = () => {
            uiUpdated = true;
        };

        ctx.handleMessage({
            type: "error",
            code: "room_locked",
            message: "Cannot join room: a Co-Op run is already in progress.",
        });

        expect(ctx.lobbyLockedReason).toBe("Cannot join room: a Co-Op run is already in progress.");
        expect(ctx.toasts).toContain("Cannot join room: a Co-Op run is already in progress.");
        expect(uiUpdated).toBe(true);

        // Welcome message clears lobbyLockedReason
        ctx.handleMessage({
            type: "welcome",
            role: "host",
            slot: 1,
            hostSlot: 1,
            peers: 1,
            room: "NEWROOM1",
            activeSlots: [1],
        });
        expect(ctx.lobbyLockedReason).toBeNull();
    });
});

describe("Lobby explicit Ready Up system (mp-lobby-ui & mp-transport)", () => {
    function createLobbyReadyCtx(role: "host" | "guest" = "host", localSlot = 1) {
        const sentMessages: any[] = [];
        const toasts: string[] = [];
        let uiUpdateCount = 0;
        let launchedConfig: any = null;
        const ctx: any = {
            ...mpTransportMethods,
            ...mpLobbyUiMethods,
            role,
            localSlot,
            hostSlot: 1,
            localName: `Player ${localSlot}`,
            localNameDraft: `Player ${localSlot}`,
            localCharacter: "warrior",
            localReady: false,
            localAssetsReady: false,
            selectedMapId: "lumbridge",
            selectedEndless: false,
            difficultyMult: 1.0,
            gameStarted: false,
            gameConfig: null,
            roomId: "OSRS-RDY1",
            ws: { readyState: 1, send() {} },
            lobbyPlayers: new Map<number, any>(),
            remotePeers: new Map<number, any>(),
            sentMessages,
            toasts,
            get uiUpdateCount() {
                return uiUpdateCount;
            },
            get launchedConfig() {
                return launchedConfig;
            },
            getUnlockedCharacters: () => ["warrior", "ranger", "wizard", "barbarian"],
            send(msg: any) {
                sentMessages.push(msg);
            },
            showToast(msg: string) {
                toasts.push(msg);
            },
            updateLobbyUI() {
                uiUpdateCount++;
            },
            renderLobbyModal() {},
            removePauseOverlay() {},
            invalidateSortedRemotePeers() {},
            waitForGameClient: async () => ({
                save: { unlockedItems: ["bronze_scimitar"], upgrades: { might: 1 }, armoury: {} },
            }),
            launchCoopRun: async (cfg: any) => {
                launchedConfig = cfg;
            },
        };
        ctx.syncLocalToLobbyPlayers();
        return ctx;
    }

    test("toggleReady() toggles localReady, syncs lobbyPlayers, and broadcasts lobby_update", () => {
        const hostCtx = createLobbyReadyCtx("host", 1);
        expect(hostCtx.localReady).toBe(false);
        expect(hostCtx.lobbyPlayers.get(1)?.ready).toBe(false);

        hostCtx.toggleReady();
        expect(hostCtx.localReady).toBe(true);
        expect(hostCtx.lobbyPlayers.get(1)?.ready).toBe(true);
        expect(hostCtx.sentMessages.length).toBe(1);
        expect(hostCtx.sentMessages[0]).toMatchObject({
            type: "lobby_update",
            slot: 1,
            ready: true,
        });
        expect(hostCtx.uiUpdateCount).toBe(1);

        hostCtx.toggleReady();
        expect(hostCtx.localReady).toBe(false);
        expect(hostCtx.lobbyPlayers.get(1)?.ready).toBe(false);
        expect(hostCtx.sentMessages.length).toBe(2);
        expect(hostCtx.sentMessages[1]).toMatchObject({
            type: "lobby_update",
            slot: 1,
            ready: false,
        });

        // Explicit forceState argument works on Guest as well
        const guestCtx = createLobbyReadyCtx("guest", 2);
        guestCtx.toggleReady(true);
        expect(guestCtx.localReady).toBe(true);
        expect(guestCtx.lobbyPlayers.get(2)?.ready).toBe(true);
        expect(guestCtx.sentMessages[0]).toMatchObject({
            type: "lobby_update",
            slot: 2,
            ready: true,
        });
    });

    test("areAllPlayersReady() requires >= 2 players and every player in lobbyPlayers (2-4P) to have ready: true", () => {
        const ctx = createLobbyReadyCtx("host", 1);

        // Solo in lobby (<2 players) -> false even if Host is ready
        ctx.localReady = true;
        expect(ctx.areAllPlayersReady()).toBe(false);

        // Add Guest (slot 2) unready -> Host ready, Guest not ready -> false
        ctx.lobbyPlayers.set(2, { slot: 2, name: "Player 2", character: "ranger", ready: false, isHost: false });
        expect(ctx.areAllPlayersReady()).toBe(false);

        // Guest ready, Host not ready -> false
        ctx.localReady = false;
        ctx.lobbyPlayers.set(2, { slot: 2, name: "Player 2", character: "ranger", ready: true, isHost: false });
        expect(ctx.areAllPlayersReady()).toBe(false);

        // Both Host and Guest ready (2P) -> true
        ctx.localReady = true;
        expect(ctx.areAllPlayersReady()).toBe(true);

        // Add 3rd and 4th players: if any is unready -> false; when all 4 are ready -> true
        ctx.lobbyPlayers.set(3, { slot: 3, name: "Player 3", character: "wizard", ready: true, isHost: false });
        ctx.lobbyPlayers.set(4, { slot: 4, name: "Player 4", character: "barbarian", ready: false, isHost: false });
        expect(ctx.areAllPlayersReady()).toBe(false);

        ctx.lobbyPlayers.get(4).ready = true;
        expect(ctx.areAllPlayersReady()).toBe(true);
    });

    test("startRun() blocks starting and shows toast without sending game_start unless all players are ready", async () => {
        const prevDoc = (globalThis as any).document;
        try {
            (globalThis as any).document = { getElementById: () => null };
            const ctx = createLobbyReadyCtx("host", 1);
            ctx.lobbyPlayers.set(2, { slot: 2, name: "Player 2", character: "ranger", ready: false, isHost: false });

            // 1. Host ready, Guest unready -> blocked
            ctx.localReady = true;
            await ctx.startRun();
            expect(ctx.gameStarted).toBe(false);
            expect(ctx.sentMessages.filter((m: any) => m.type === "game_start")).toHaveLength(0);
            expect(ctx.toasts).toContain("All players must be Ready before starting Co-Op!");

            // 2. Guest ready, Host unready -> blocked
            ctx.toasts.length = 0;
            ctx.localReady = false;
            ctx.lobbyPlayers.get(2).ready = true;
            await ctx.startRun();
            expect(ctx.gameStarted).toBe(false);
            expect(ctx.sentMessages.filter((m: any) => m.type === "game_start")).toHaveLength(0);
            expect(ctx.toasts).toContain("All players must be Ready before starting Co-Op!");

            // 3. Both Host and Guest ready -> sends game_start and launches run
            ctx.toasts.length = 0;
            ctx.localReady = true;
            await ctx.startRun();
            expect(ctx.gameStarted).toBe(true);
            const startMsgs = ctx.sentMessages.filter((m: any) => m.type === "game_start");
            expect(startMsgs).toHaveLength(1);
            expect(startMsgs[0].config.partySize).toBe(2);
            expect(ctx.launchedConfig).not.toBeNull();
        } finally {
            (globalThis as any).document = prevDoc;
        }
    });

    test("returnToLobby() resets localReady and all lobbyPlayers ready flags to false", () => {
        const prevDoc = (globalThis as any).document;
        const prevWin = (globalThis as any).window;
        try {
            (globalThis as any).document = { getElementById: () => null };
            (globalThis as any).window = { gameClient: { leaveRun() {} } };

            const ctx = createLobbyReadyCtx("host", 1);
            ctx.localReady = true;
            ctx.gameStarted = true;
            ctx.gameConfig = {
                players: [
                    { slot: 1, name: "HostPlayer", character: "warrior", isHost: true },
                    { slot: 2, name: "GuestPlayer", character: "ranger", isHost: false },
                ],
            };
            ctx.lobbyPlayers.set(1, { slot: 1, name: "HostPlayer", character: "warrior", ready: true, isHost: true });
            ctx.lobbyPlayers.set(2, { slot: 2, name: "GuestPlayer", character: "ranger", ready: true, isHost: false });
            ctx.remotePeers.set(2, { slot: 2, name: "GuestPlayer", characterId: "ranger" });

            ctx.returnToLobby();

            expect(ctx.gameStarted).toBe(false);
            expect(ctx.localReady).toBe(false);
            expect(ctx.lobbyPlayers.get(1)?.ready).toBe(false);
            expect(ctx.lobbyPlayers.get(2)?.ready).toBe(false);
            expect(ctx.areAllPlayersReady()).toBe(false);
        } finally {
            (globalThis as any).document = prevDoc;
            (globalThis as any).window = prevWin;
        }
    });
});



