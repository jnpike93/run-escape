import { describe, expect, test } from "vitest";
import { mpActorRendererMethods } from "./mp-actor-renderer.js";
import {
    ALL_CHARACTERS,
    ALL_REGIONS,
    COOP_DIFFICULTY_WEIGHTS,
    escapeHtml,
    getCoopDifficultyWeights,
    sanitizeCharacter,
    sanitizeHexColor,
    sanitizeMapId,
    sanitizeName,
    sanitizePeerStats,
    sanitizeRoomId,
    sanitizeSlot,
} from "./mp-constants.js";
import { mpPickupsMethods } from "./mp-pickups.js";

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
        expect(ALL_REGIONS.length).toBeGreaterThanOrEqual(19);
        expect(sanitizeMapId("FIGHT_CAVES")).toBe("fight_caves");
        expect(sanitizeMapId("invalid_map", "lumbridge")).toBe("lumbridge");
        expect(sanitizeCharacter("DIPPER")).toBe("dipper");
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
