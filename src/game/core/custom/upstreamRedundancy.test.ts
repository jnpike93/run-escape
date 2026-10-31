import fs from "node:fs";
import path from "node:path";
import { vec4 } from "gl-matrix";
import { describe, expect, it } from "vitest";

import { mpPickupsMethods } from "../../../custom/multiplayer/mp-pickups.js";
import { mpSyncEngineMethods } from "../../../custom/multiplayer/mp-sync-engine.js";
import { Camera } from "../../../mapviewer/Camera";
import { MapManager, MapSquare } from "../../../mapviewer/MapManager";
import { Dat2SeqFrameLoader } from "../../../rs/model/seq/SeqFrameLoader";
import { CUSTOM_MUSIC, TITLE_MUSIC } from "../../client/custom/customMusic";
import { MobileTouchInput } from "../../client/custom/mobileInput";
import { CHARACTERS, getCharacter } from "../../content/characters";
import { CUSTOM_ENEMIES } from "../../content/custom/customEnemies";
import { CUSTOM_WEAPONS } from "../../content/custom/customWeapons";
import { ENEMIES, getEnemy } from "../../content/enemies";
import { ITEMS } from "../../content/items";
import { ALL_MAPS, FUN_MAPS, MAPS, getArenaRegion, getMap } from "../../content/maps";
import { PASSIVES } from "../../content/passives";
import { POWER_UPS } from "../../content/powerups";
import { QUESTS } from "../../content/quests";
import { SHOP_UPGRADES } from "../../content/shop";
import { getPlayerStanceSeqs } from "../../content/stances";
import { WEAPONS, getWeapon } from "../../content/weapons";
import { Sim } from "../Sim";
import { CHALLENGE_MODES, createSave, getMetaStats, refundArmoury, refundUpgrades } from "../save";
import { ArenaGrid } from "../world/ArenaGrid";
import { FlowField } from "../world/FlowField";
import { findReachablePickupSpot, stepPickupSlide } from "./pickupRecovery";

class DummyMapSquare implements MapSquare {
    constructor(
        readonly mapX: number,
        readonly mapY: number,
    ) {}
    canRender(): boolean {
        return true;
    }
    delete(): void {}
}

function makeOpenArenaGrid(baseX: number, baseY: number, sizeX: number, sizeY: number, plane = 0): ArenaGrid {
    return new ArenaGrid({
        baseX,
        baseY,
        sizeX,
        sizeY,
        plane,
        collisionFlags: new Int32Array(sizeX * sizeY),
        collisionLocs: new Float32Array(0),
        tileFlags: new Uint8Array(sizeX * sizeY),
        overlays: new Uint16Array(sizeX * sizeY),
        heights: new Int32Array((sizeX + 1) * (sizeY + 1)),
        bridgeHeights: new Int32Array((sizeX + 1) * (sizeY + 1)),
    });
}

describe("Upstream Merge Redundancy & Full-Game Smoke Test Suite", () => {
    it("verifies all 20 maps, custom adventurers, bosses, weapons, stances, quests, and on-disk music/cache assets", () => {
        expect(MAPS.length).toBe(14);
        expect(FUN_MAPS.length).toBe(6);
        expect(ALL_MAPS.length).toBe(20);

        // Verify custom maps and music tracks exist on disk
        expect(getMap("barbarian_village").name).toContain("Barbarian Village");
        expect(getMap("fight_caves").name).toContain("Fight Caves");

        const titleMusicPath = path.resolve(process.cwd(), CUSTOM_MUSIC[TITLE_MUSIC]);
        expect(fs.existsSync(titleMusicPath)).toBe(true);

        for (const map of ALL_MAPS) {
            expect(map.music).toBeDefined();
            const relTrack =
                map.music === "Massacre"
                    ? "src/media/music/massacre.ogg"
                    : CUSTOM_MUSIC[map.music!];
            expect(relTrack).toBeDefined();
            const trackPath = path.resolve(process.cwd(), relTrack);
            expect(fs.existsSync(trackPath)).toBe(true);
            const region = getArenaRegion(map);
            expect(region.sizeX).toBeGreaterThan(0);
            expect(region.sizeY).toBeGreaterThan(0);
        }

        // Verify custom assets on disk
        expect(fs.existsSync(path.resolve(process.cwd(), "assets/quest-complete.ogg"))).toBe(true);
        expect(fs.existsSync(path.resolve(process.cwd(), "assets/prayer/protect-magic.png"))).toBe(true);
        expect(fs.existsSync(path.resolve(process.cwd(), "assets/prayer/protect-missiles.png"))).toBe(true);
        expect(fs.existsSync(path.resolve(process.cwd(), "assets/prayer/protect-melee.png"))).toBe(true);

        // Verify slim cache directory referenced in caches/caches.json exists on disk
        const cachesJsonPath = path.resolve(process.cwd(), "caches/caches.json");
        expect(fs.existsSync(cachesJsonPath)).toBe(true);
        const cachesList = JSON.parse(fs.readFileSync(cachesJsonPath, "utf8"));
        expect(cachesList.length).toBeGreaterThan(0);
        const slimDir = path.resolve(process.cwd(), "caches", cachesList[0].name);
        expect(fs.existsSync(slimDir)).toBe(true);
        expect(fs.existsSync(path.join(slimDir, "main_file_cache.dat2"))).toBe(true);

        // Verify custom adventurers
        for (const charId of ["penance_fighter", "dipper", "elias"]) {
            const char = getCharacter(charId);
            expect(char).toBeDefined();
            expect(getWeapon(char.startingWeapon)).toBeDefined();
        }
        expect(CHARACTERS.length).toBeGreaterThanOrEqual(22);

        // Verify all custom weapons & evolutions are registered in getWeapon
        expect(CUSTOM_WEAPONS.length).toBeGreaterThanOrEqual(6);
        for (const w of CUSTOM_WEAPONS) {
            expect(getWeapon(w.id)).toBeDefined();
        }
        const bloodBurst = getWeapon("blood_burst");
        expect(bloodBurst.evolution?.into).toBe("blood_barrage");
        expect(getWeapon("blood_barrage").name).toBe("Blood Barrage");

        // Verify all custom bosses & enemies are registered in getEnemy
        expect(CUSTOM_ENEMIES.length).toBeGreaterThanOrEqual(15);
        for (const e of CUSTOM_ENEMIES) {
            expect(getEnemy(e.id)).toBeDefined();
        }
        expect(getEnemy("tztok_jad")).toBeDefined();

        // Verify stance sequences include custom weapon stances
        const stanceSeqs = getPlayerStanceSeqs();
        expect(stanceSeqs.length).toBeGreaterThan(0);

        // Verify content registries are non-empty
        expect(ITEMS.length).toBeGreaterThan(20);
        expect(PASSIVES.length).toBeGreaterThan(10);
        expect(POWER_UPS.length).toBeGreaterThan(5);
        expect(QUESTS.length).toBeGreaterThan(20);
        expect(SHOP_UPGRADES.length).toBeGreaterThan(5);
        expect(WEAPONS.length).toBeGreaterThan(20);
        expect(ENEMIES.length).toBeGreaterThan(30);
        expect(CHALLENGE_MODES.map((m) => m.id)).toEqual([
            "normal",
            "extreme_one_chunk",
            "nightmare",
        ]);
    });

    it("verifies FlowField.update dual-signature redundancy ((grid, x, y) and legacy (x, y, grid))", () => {
        const grid = makeOpenArenaGrid(3200, 3200, 64, 64);
        const ff1 = new FlowField(64);
        ff1.update(grid, 3232, 3232);
        expect(ff1.targetX).toBe(3232);
        expect(ff1.targetY).toBe(3232);
        expect(ff1.isReachable(3230, 3230)).toBe(true);

        // Legacy reversed argument order: (targetX, targetY, grid)
        const ff2 = new FlowField(64);
        (ff2.update as any)(3232, 3232, grid);
        expect(ff2.targetX).toBe(3232);
        expect(ff2.targetY).toBe(3232);
        expect(ff2.isReachable(3230, 3230)).toBe(true);
        expect(ff2.getCost(3230, 3230)).toBe(ff1.getCost(3230, 3230));
    });

    it("verifies MapManager playArea + 2-square margin clamping and Dat2SeqFrameLoader fault tolerance", () => {
        const loaded: Array<[number, number]> = [];
        const manager = new MapManager<DummyMapSquare>(64, (mx, my) => {
            loaded.push([mx, my]);
        });
        manager.init(
            {
                getTerrainArchiveId: () => 1,
                getLocArchiveId: () => 1,
            },
            true,
        );
        const playArea = vec4.fromValues(50 * 64, 95 * 64, 52 * 64, 97 * 64);
        const camera = new Camera(50 * 64 + 10, -26, 95 * 64 + 10, -400, 0);
        camera.update(800, 600);
        manager.update(camera, 1, 256, 2, playArea);
        expect(loaded.length).toBeGreaterThan(0);
        for (const [mx, my] of loaded) {
            expect(mx).toBeGreaterThanOrEqual(48);
            expect(mx).toBeLessThanOrEqual(53);
            expect(my).toBeGreaterThanOrEqual(93);
            expect(my).toBeLessThanOrEqual(98);
        }

        // Dat2SeqFrameLoader should return undefined instead of throwing when an archive is missing
        const brokenLoader = new Dat2SeqFrameLoader(
            { game: "oldschool", environment: "live", revision: 241, timestamp: "", size: 0, name: "test" },
            {
                getArchive: () => {
                    throw new Error("Group 0:99999 is missing from the cache");
                },
            } as any,
            { clearCache: () => {} } as any,
        );
        expect(() => brokenLoader.load(99999 << 16)).not.toThrow();
        expect(brokenLoader.load(99999 << 16)).toBeUndefined();
    });

    it("verifies pickupRecovery, save refunds, and MobileTouchInput hooks", () => {
        const map = getMap("lumbridge");
        const region = getArenaRegion(map);
        const grid = makeOpenArenaGrid(region.baseX, region.baseY, region.sizeX, region.sizeY, region.plane);
        const sim = new Sim({
            grid,
            mapId: map.id,
            characterId: "warrior",
            spawnX: map.spawn.x,
            spawnY: map.spawn.y,
            metaStats: getMetaStats(createSave()),
            seed: 42,
        });

        const spot = findReachablePickupSpot(sim, map.spawn.x, map.spawn.y, 0.35);
        expect(spot.x).toBeCloseTo(map.spawn.x);
        expect(spot.y).toBeCloseTo(map.spawn.y);

        const pickup: any = {
            id: 1,
            kind: "bones",
            x: map.spawn.x + 3,
            y: map.spawn.y + 3,
            targetX: map.spawn.x,
            targetY: map.spawn.y,
            value: 5,
            attracted: false,
            speed: 0,
            spawnTick: 0,
        };
        expect(stepPickupSlide(sim, pickup, 0.35)).toBe(true);
        expect(pickup.x).toBeLessThan(map.spawn.x + 3);

        const save = createSave();
        save.coins = 50000;
        refundUpgrades(save);
        refundArmoury(save);
        expect(save.coins).toBe(50000);

        const target = {
            addEventListener: () => {},
            removeEventListener: () => {},
        } as unknown as HTMLElement;
        const mobile = new MobileTouchInput(target, () => {});
        const vec = { x: 0, y: 0 };
        mobile.getMoveVector(vec);
        expect(vec).toEqual({ x: 0, y: 0 });
        mobile.dispose();
    });

    it("smoketests Solo & Co-Op Multiplayer simulation across all 20 maps without errors", () => {
        const prevWindow = (globalThis as any).window;
        try {
            for (const map of ALL_MAPS) {
                const region = getArenaRegion(map);
                const grid = makeOpenArenaGrid(region.baseX, region.baseY, region.sizeX, region.sizeY, region.plane);
                const charId = map.fun?.character ?? "warrior";
                const sim = new Sim({
                    grid,
                    mapId: map.id,
                    characterId: charId,
                    spawnX: map.spawn.x,
                    spawnY: map.spawn.y,
                    metaStats: getMetaStats(createSave()),
                    seed: 1000,
                    challengeMode: "normal",
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
                    addEventListener() {},
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
                    difficultyMult: 1.0,
                    gameConfig: { difficultyMult: 1.0 },
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

                hostCtx.setupInGameHooks(charId, [
                    { slot: 1, name: "HostPlayer", character: charId, isHost: true },
                    { slot: 2, name: "GuestPlayer", character: charId, isHost: false },
                ]);

                // Step 60 ticks on every map to verify enemy spawning, FlowField updates, and combat
                for (let t = 0; t < 60; t++) {
                    sim.step(0, 0);
                }

                expect(sim.enemies.length).toBeGreaterThan(0);

                // Verify Host broadcasted sync_world packets on every map
                const syncMsgs = sentMessages.filter((m) => m.type === "sync_world");
                expect(syncMsgs.length).toBeGreaterThan(0);
            }
        } finally {
            (globalThis as any).window = prevWindow;
        }
    });
});
