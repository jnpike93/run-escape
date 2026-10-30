// Writes a slim copy of the game's cache for hosting: only the groups the game
// reads, in the same dat2 format, so a first visit downloads a few MB instead
// of the whole cache.
//
// What the game reads is found by loading what it loads, with its own loaders:
// the renderer's textures, every model it bakes (enemies, spot animations,
// pickups and power-ups, the player in every outfit and every wearable item),
// its sounds and sprites, an icon for every item in the content, and each map's
// arena with MAP_MARGIN map squares around it. Then it all gets loaded again
// from the slim cache, and a group that's missing fails the script.
//
//   npx tsx scripts/cache/slim-cache.ts [out dir]
//
// The out dir (dist/caches by default, so run it after the build) gets a
// caches.json and the slim cache, named after what's in it so browsers fetch
// a changed one. Make it again whenever the content changes.
import { createHash } from "node:crypto";
import fs from "node:fs";

import { GAME_CACHE_NAME } from "../../src/game/cache";
import {
    GameAssets,
    HITSPLAT_SPRITES,
    PICKUP_OBJS,
    PILE_LOOKS,
    PLAYER_SEQS,
    getCharacterAppearance,
    getPlayerAttackSeqs,
} from "../../src/game/client/GameAssets";
import { getGameSoundIds } from "../../src/game/client/GameSounds";
import { CHARACTERS } from "../../src/game/content/characters";
import { ENEMIES } from "../../src/game/content/enemies";
import { CASKETS, GEAR, GEAR_SLOT_BY_ID, ITEMS } from "../../src/game/content/items";
import { ALL_MAPS, getArenaRegion } from "../../src/game/content/maps";
import { PASSIVES } from "../../src/game/content/passives";
import { POWER_UPS, THRALLS } from "../../src/game/content/powerups";
import { SHOP_UPGRADES } from "../../src/game/content/shop";
import { WEAPONS } from "../../src/game/content/weapons";
import { LoadedCache } from "../../src/mapviewer/Caches";
import { ActorBakeLoader } from "../../src/mapviewer/webgl/actor/ActorBakeLoader";
import { BakeRequest } from "../../src/mapviewer/webgl/actor/ActorBakeTypes";
import { SceneBuffer } from "../../src/mapviewer/webgl/buffer/SceneBuffer";
import { getSdTextureIds } from "../../src/mapviewer/webgl/loader/TextureIndex";
import { ItemIconLoader } from "../../src/mapviewer/worker/ItemIconLoader";
import { RegionDataLoader } from "../../src/mapviewer/worker/RegionDataLoader";
import { RenderDataLoader } from "../../src/mapviewer/worker/RenderDataLoader";
import { SoundLoader } from "../../src/mapviewer/worker/SoundLoader";
import { SpriteDataLoader } from "../../src/mapviewer/worker/SpriteDataLoader";
import {
    WorkerState,
    clearWorkerStateCaches,
    createWorkerState,
} from "../../src/mapviewer/worker/WorkerState";
import { CacheFiles } from "../../src/rs/cache/CacheFiles";
import { CacheIndex } from "../../src/rs/cache/CacheIndex";
import { CacheInfo } from "../../src/rs/cache/CacheInfo";
import { MemoryStore } from "../../src/rs/cache/store/MemoryStore";
import { Sector } from "../../src/rs/cache/store/Sector";
import { SectorCluster } from "../../src/rs/cache/store/SectorCluster";
import { LocModelLoader } from "../../src/rs/config/loctype/LocModelLoader";
import { SeqType } from "../../src/rs/config/seqtype/SeqType";
import { MapImageRenderer } from "../../src/rs/map/MapImageRenderer";
import { Model } from "../../src/rs/model/Model";
import {
    EquipSlot,
    PlayerAppearance,
    createAppearance,
} from "../../src/rs/model/player/PlayerModelLoader";
import { SeqModelAnimator } from "../../src/rs/model/seq/SeqModelAnimator";
import { Scene } from "../../src/rs/scene/Scene";
import { getIdFromTag } from "../../src/rs/scene/entity/EntityTag";
import { LocEntity } from "../../src/rs/scene/entity/LocEntity";
import { Hasher } from "../../src/util/Hasher";
import { loadCache, loadCacheInfos } from "./load-util";

// Map squares loaded around each arena. The camera can be up to ~15 tiles
// outside the arena and sees 72 tiles (GameApp's RENDER_DISTANCE), so the
// renderer asks for at most two squares past the edge.
const MAP_MARGIN = 2;

const SECTOR_SIZE = Sector.SIZE;

const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify");
const verifyFull = args.includes("--verify-full");
const posArgs = args.filter((a) => !a.startsWith("--"));
const outDir = (posArgs[0] ?? (verifyOnly || verifyFull ? "caches" : "dist/caches")).replace(
    /\/?$/,
    "/",
);

// The map loaders draw minimap images on an OffscreenCanvas, which Node
// doesn't have. Only what they read from the cache matters here.
class NodeImageData {
    readonly data: Uint8ClampedArray;

    constructor(width: number, height: number) {
        this.data = new Uint8ClampedArray(width * height * 4);
    }
}
class NodeOffscreenCanvas {
    getContext() {
        return { putImageData() {} };
    }

    convertToBlob(): Promise<Blob> {
        return Promise.resolve(new Blob());
    }
}
Object.assign(globalThis, { ImageData: NodeImageData, OffscreenCanvas: NodeOffscreenCanvas });

// Skip CPU-only WebGL vertex packing, software minimap rasterization, and
// per-frame vertex matrix transforms that do not read from the cache store.
SceneBuffer.prototype.addTerrain = () => {};
SceneBuffer.prototype.addModel = () => {};
SceneBuffer.prototype.addModelGroup = () => {};
SceneBuffer.prototype.addModelAnimFrame = () => [0, 0];
SceneBuffer.prototype.addLocAnimatedGroups = () => [];
MapImageRenderer.prototype.renderMinimap = () => new Int32Array(0);
MapImageRenderer.prototype.renderMinimapHd = () => new Int32Array(0);
Scene.prototype.light = () => {};
SeqModelAnimator.prototype.animate = function (
    model: Model,
    seqType: SeqType,
    frame: number,
): Model {
    if (seqType.isSkeletalSeq()) {
        this.skeletalSeqLoader?.load(seqType.skeletalId);
    } else if (seqType.frameIds && seqType.frameIds.length > 0) {
        this.seqFrameLoader.load(seqType.frameIds[frame]);
    }
    return model;
};
LocModelLoader.prototype.transformModel = function (
    model: Model,
    seqType: SeqType,
    frame: number,
): Model {
    if (seqType.isSkeletalSeq()) {
        this.skeletalSeqLoader?.load(seqType.skeletalId);
    } else if (seqType.frameIds && seqType.frameIds.length > 0) {
        this.seqFrameLoader.load(seqType.frameIds[frame]);
    }
    return model;
};

// Every group read, as "index:archive"
const reads = new Set<string>();
const readGroup = MemoryStore.prototype.read;
MemoryStore.prototype.read = function (indexId: number, archiveId: number): Int8Array {
    reads.add(indexId + ":" + archiveId);
    return readGroup.call(this, indexId, archiveId);
};

// Every item the player can wear, in its slot: the outfits, held weapons, the
// pieces passives put on and casket gear
function getWornObjs(): [EquipSlot, number][] {
    const worn: [EquipSlot, number][] = [];
    for (const character of CHARACTERS) {
        for (const [slot, objId] of Object.entries(character.equipment)) {
            if (objId !== undefined) {
                worn.push([Number(slot), objId]);
            }
        }
    }
    // The fun maps' players (baked in getBaseRequests too)
    for (const enemy of ENEMIES) {
        for (const outfit of enemy.outfits ?? []) {
            for (const [slot, objId] of Object.entries(outfit.equipment)) {
                if (objId !== undefined && objId !== -1) {
                    worn.push([Number(slot), objId]);
                }
            }
        }
    }
    for (const weapon of WEAPONS) {
        for (const level of weapon.levels) {
            if (level.objId !== undefined) {
                worn.push([EquipSlot.WEAPON, level.objId]);
            }
        }
    }
    for (const passive of PASSIVES) {
        for (const piece of passive.equipment ?? []) {
            for (const objId of piece.objIds) {
                if (objId !== -1) {
                    worn.push([piece.slot, objId]);
                }
            }
        }
    }
    for (const gear of GEAR) {
        const equipSlot = GEAR_SLOT_BY_ID.get(gear.slot)?.equipSlot;
        if (equipSlot !== undefined) {
            worn.push([equipSlot, gear.objId]);
        }
    }
    return worn;
}

// Every item id in the content (objId, iconObjId, casketObjId, objIds...), for
// their icons
function getContentObjIds(): number[] {
    const ids = new Set<number>([
        ...Object.values(PICKUP_OBJS),
        ...Object.values(PILE_LOOKS).flatMap((looks) => looks.map((look) => look.objId)),
        // Cook's Assistant quest item ids (bucket of milk, egg, pot of flour)
        1927,
        1944,
        1933,
    ]);
    for (const [, objId] of getWornObjs()) {
        ids.add(objId);
    }
    const seen = new Set<object>();
    const visit = (value: unknown, key: string): void => {
        if (typeof value === "number") {
            if (/objIds?$/i.test(key)) {
                ids.add(value);
            }
        } else if (value && typeof value === "object" && !seen.has(value)) {
            seen.add(value);
            for (const [childKey, child] of Object.entries(value)) {
                visit(child, Array.isArray(value) ? key : childKey);
            }
        }
    };
    visit(
        {
            CHARACTERS,
            ENEMIES,
            WEAPONS,
            PASSIVES,
            ITEMS,
            CASKETS,
            POWER_UPS,
            THRALLS,
            ALL_MAPS,
            SHOP_UPGRADES,
        },
        "",
    );
    return [...ids];
}

// Stackables like coins have a model per stack size
function getStackCounts(state: WorkerState, objId: number): number[] {
    if (objId < 0) return [1];
    const counts = state.objTypeLoader.load(objId).countCo ?? [];
    return [1, ...counts.filter((count) => count > 1)];
}

function playerRequest(key: string, appearance: PlayerAppearance, seqIds: number[]): BakeRequest {
    return { kind: "player", key, appearance, seqIds };
}

function loadSceneLocEntities(
    state: WorkerState,
    scene: Scene,
    borderSize: number,
    minLevel: number,
): void {
    const { locTypeLoader, locModelLoader, varManager } = state;
    const maxLevel = minLevel;
    const seenAnimKeys = new Set<number>();
    const checkEntity = (entity: unknown, tag: bigint) => {
        if (!entity) return;
        locTypeLoader.load(getIdFromTag(tag));
        if (!(entity instanceof LocEntity)) return;
        let locType = locTypeLoader.load(entity.id);
        if (locType.transforms) {
            const transformed = locType.transform(varManager, locTypeLoader);
            if (!transformed) return;
            locType = transformed;
        }
        if (entity.seqId !== -1) {
            const key = entity.rotation + (entity.type << 3) + (locType.id << 10);
            if (seenAnimKeys.has(key)) return;
            seenAnimKeys.add(key);
            const seqType = locModelLoader.seqTypeLoader.load(entity.seqId);
            const frameCount = seqType.isSkeletalSeq()
                ? seqType.getSkeletalDuration()
                : (seqType.frameIds?.length ?? 0);
            for (let i = 0; i < frameCount; i++) {
                locModelLoader.getModelAnimated(
                    locType,
                    entity.type,
                    entity.rotation,
                    entity.seqId,
                    i,
                );
            }
        } else {
            locModelLoader.getModelAnimated(locType, entity.type, entity.rotation, -1, -1);
        }
    };

    const endX = scene.sizeX - borderSize;
    const endY = scene.sizeY - borderSize;
    for (let level = minLevel; level < scene.levels; level++) {
        for (let x = borderSize; x < endX; x++) {
            for (let y = borderSize; y < endY; y++) {
                const tile = scene.tiles[level][x][y];
                if (
                    !tile ||
                    (tile.minLevel > maxLevel && !scene.isPlayerLevel(level, x, y, maxLevel))
                ) {
                    continue;
                }
                if (level > maxLevel && scene.isInside(maxLevel, x, y)) {
                    continue;
                }
                if (tile.floorDecoration) {
                    checkEntity(tile.floorDecoration.entity, tile.floorDecoration.tag);
                }
                if (tile.wall) {
                    checkEntity(tile.wall.entity0, tile.wall.tag);
                    checkEntity(tile.wall.entity1, tile.wall.tag);
                }
                if (tile.wallDecoration) {
                    checkEntity(tile.wallDecoration.entity0, tile.wallDecoration.tag);
                    checkEntity(tile.wallDecoration.entity1, tile.wallDecoration.tag);
                }
                for (const loc of tile.locs) {
                    if (loc.startX !== x || loc.startY !== y) continue;
                    checkEntity(loc.entity, loc.tag);
                }
            }
        }
    }
}

async function loadWhatTheGameLoads(
    cache: LoadedCache,
    includeMapScenes: boolean = true,
): Promise<void> {
    const state = createWorkerState(cache, [], [], undefined as unknown as Cache);
    const load = async <I, D>(loader: RenderDataLoader<I, D>, input: I): Promise<void> => {
        loader.init();
        await loader.load(state, input);
        clearWorkerStateCaches(state);
    };

    // The renderer's texture array
    const allTextureIds = new Set<number>(getSdTextureIds(state.textureLoader));
    for (const id of allTextureIds) {
        state.textureLoader.getPixelsArgb(id, 128, true, 1.0);
    }

    const baseReqs = GameAssets.getBaseRequests();
    const playerSeqSet = new Set<number>([...Object.values(PLAYER_SEQS), ...getPlayerAttackSeqs()]);
    const npcSeqMap = new Map<number, Set<number>>();
    const otherReqs: BakeRequest[] = [];
    for (const req of baseReqs) {
        if (req.kind === "player") {
            for (const seqId of req.seqIds) playerSeqSet.add(seqId);
            otherReqs.push({ ...req, seqIds: [] });
        } else if (req.kind === "npc") {
            let set = npcSeqMap.get(req.npcId);
            if (!set) {
                set = new Set<number>();
                npcSeqMap.set(req.npcId, set);
            }
            for (const seqId of req.seqIds) set.add(seqId);
        } else {
            otherReqs.push(req);
        }
    }
    const dedupedNpcReqs: BakeRequest[] = [...npcSeqMap.entries()].map(([npcId, seqs]) => ({
        kind: "npc",
        key: `npc:${npcId}`,
        npcId,
        seqIds: [...seqs],
    }));

    const playerRequests: BakeRequest[] = [
        // Every body kit + all player sequences
        playerRequest("bare", createAppearance(), [...playerSeqSet]),
        ...CHARACTERS.map((character) =>
            playerRequest(character.id, getCharacterAppearance(character.id), []),
        ),
        ...getWornObjs().map(([slot, objId]) =>
            playerRequest(`${slot}:${objId}`, createAppearance({ [slot]: objId }), []),
        ),
    ];
    const questRequests: BakeRequest[] = [
        { kind: "npc", key: "quest:cook", npcId: 4626, seqIds: [808, 860] },
        { kind: "obj", key: "quest:obj:1927", objId: 1927, count: 1 },
        { kind: "obj", key: "quest:obj:1944", objId: 1944, count: 1 },
        { kind: "obj", key: "quest:obj:1933", objId: 1933, count: 1 },
    ];
    const bakeLoader = new ActorBakeLoader();
    const allBakeRequests = [...dedupedNpcReqs, ...otherReqs, ...questRequests, ...playerRequests];
    await load(bakeLoader, { requests: allBakeRequests, loadedTextureIds: allTextureIds });

    await load(new SoundLoader(), { ids: getGameSoundIds() });
    // The hitsplats, and the passives with an interface sprite for an icon
    const spriteIds = [
        ...Object.values(HITSPLAT_SPRITES),
        ...PASSIVES.flatMap((passive) =>
            passive.iconSpriteId !== undefined ? [passive.iconSpriteId] : [],
        ),
    ];
    await load(new SpriteDataLoader(), { spriteIds });
    await load(new ItemIconLoader(), {
        requests: getContentObjIds().flatMap((objId) =>
            getStackCounts(state, objId).map((count) => ({ objId, count })),
        ),
    });

    const borderSize = 6;
    if (includeMapScenes) {
        const regionLoader = new RegionDataLoader();
        regionLoader.init();
        for (const map of ALL_MAPS) {
            const region = getArenaRegion(map);
            await regionLoader.load(state, region);

            const { baseX, baseY, sizeX, sizeY, plane } = region;
            const firstX = Math.floor(baseX / Scene.MAP_SQUARE_SIZE) - MAP_MARGIN;
            const firstY = Math.floor(baseY / Scene.MAP_SQUARE_SIZE) - MAP_MARGIN;
            const lastX = Math.ceil((baseX + sizeX) / Scene.MAP_SQUARE_SIZE) - 1 + MAP_MARGIN;
            const lastY = Math.ceil((baseY + sizeY) / Scene.MAP_SQUARE_SIZE) - 1 + MAP_MARGIN;

            const fullBaseX = firstX * Scene.MAP_SQUARE_SIZE - borderSize;
            const fullBaseY = firstY * Scene.MAP_SQUARE_SIZE - borderSize;
            const fullSizeX = (lastX - firstX + 1) * Scene.MAP_SQUARE_SIZE + borderSize * 2;
            const fullSizeY = (lastY - firstY + 1) * Scene.MAP_SQUARE_SIZE + borderSize * 2;

            const scene = state.sceneBuilder.buildScene(
                fullBaseX,
                fullBaseY,
                fullSizeX,
                fullSizeY,
                false,
            );
            loadSceneLocEntities(state, scene, borderSize, plane);
        }
        clearWorkerStateCaches(state);
    } else {
        const seenMapArchiveSquares = new Set<string>();
        for (const map of ALL_MAPS) {
            const region = getArenaRegion(map);
            const { baseX, baseY, sizeX, sizeY } = region;
            const firstX = Math.floor((baseX - borderSize) / Scene.MAP_SQUARE_SIZE) - MAP_MARGIN;
            const firstY = Math.floor((baseY - borderSize) / Scene.MAP_SQUARE_SIZE) - MAP_MARGIN;
            const lastX =
                Math.ceil((baseX + sizeX + borderSize) / Scene.MAP_SQUARE_SIZE) - 1 + MAP_MARGIN;
            const lastY =
                Math.ceil((baseY + sizeY + borderSize) / Scene.MAP_SQUARE_SIZE) - 1 + MAP_MARGIN;
            for (let mx = firstX; mx <= lastX; mx++) {
                for (let my = firstY; my <= lastY; my++) {
                    const key = `${mx}:${my}`;
                    if (seenMapArchiveSquares.has(key)) continue;
                    seenMapArchiveSquares.add(key);
                    state.sceneBuilder.getTerrainData(mx, my);
                    state.sceneBuilder.getLocData(mx, my);
                }
            }
        }
    }
}

function parseKey(key: string): [number, number] {
    const [indexId, archiveId] = key.split(":").map(Number);
    return [indexId, archiveId];
}

function getIndexId(fileName: string): number | undefined {
    if (!fileName.startsWith(CacheFiles.INDEX_FILE_PREFIX)) {
        return undefined;
    }
    return parseInt(fileName.slice(CacheFiles.INDEX_FILE_PREFIX.length));
}

// A group's stored size, from its index file entry
function getGroupSize(files: CacheFiles, indexId: number, archiveId: number): number {
    const indexFile = files.files.get(CacheFiles.INDEX_FILE_PREFIX + indexId);
    const ptr = archiveId * SectorCluster.SIZE;
    if (!indexFile || ptr + SectorCluster.SIZE > indexFile.byteLength) {
        return 0;
    }
    const entry = new Uint8Array(indexFile, ptr, 3);
    return (entry[0] << 16) | (entry[1] << 8) | entry[2];
}

// Writes the groups the way the client stores them: each one in a chain of
// sectors in the dat2, its index file entry pointing at the first. Index files
// keep their length; the groups left out have empty entries.
function writeSlimFiles(full: CacheFiles, keys: string[]): Map<string, Uint8Array> {
    const store = MemoryStore.fromFiles(full);
    const indexFiles = new Map<number, Buffer>();
    for (const [name, data] of full.files) {
        const indexId = getIndexId(name);
        if (indexId !== undefined) {
            indexFiles.set(indexId, Buffer.alloc(data.byteLength));
        }
    }

    // Sector 0 stays empty: an entry pointing there means no group
    const sectors: Buffer[] = [Buffer.alloc(SECTOR_SIZE)];
    for (const [indexId, archiveId] of keys.map(parseKey)) {
        const data = readGroup.call(store, indexId, archiveId);
        const indexFile = indexFiles.get(indexId);
        if (data.length === 0 || !indexFile) {
            continue;
        }
        const extended = archiveId > 0xffff;
        const dataSize = extended ? Sector.EXTENDED_DATA_SIZE : Sector.DATA_SIZE;
        const count = Math.ceil(data.length / dataSize);
        const first = sectors.length;
        indexFile.writeUIntBE(data.length, archiveId * SectorCluster.SIZE, 3);
        indexFile.writeUIntBE(first, archiveId * SectorCluster.SIZE + 3, 3);
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.length);
        for (let chunk = 0; chunk < count; chunk++) {
            const sector = Buffer.alloc(SECTOR_SIZE);
            let offset = extended
                ? sector.writeInt32BE(archiveId, 0)
                : sector.writeUInt16BE(archiveId, 0);
            offset = sector.writeUInt16BE(chunk, offset);
            offset = sector.writeUIntBE(chunk + 1 < count ? first + chunk + 1 : 0, offset, 3);
            offset = sector.writeUInt8(indexId, offset);
            sector.set(bytes.subarray(chunk * dataSize, (chunk + 1) * dataSize), offset);
            sectors.push(sector);
        }
    }

    const files = new Map<string, Uint8Array>();
    files.set(CacheFiles.DAT2_FILE_NAME, Buffer.concat(sectors));
    for (const [indexId, indexFile] of indexFiles) {
        files.set(CacheFiles.INDEX_FILE_PREFIX + indexId, indexFile);
    }
    return files;
}

function formatMb(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(1).padStart(6) + " MB";
}

function printSummary(full: CacheFiles, keys: string[]): void {
    const kept = new Map<number, { groups: number; bytes: number }>();
    for (const [indexId, archiveId] of keys.map(parseKey)) {
        const size = getGroupSize(full, indexId, archiveId);
        if (size > 0) {
            const index = kept.get(indexId) ?? { groups: 0, bytes: 0 };
            index.groups++;
            index.bytes += size;
            kept.set(indexId, index);
        }
    }
    const indexIds = [...full.files.keys()]
        .map(getIndexId)
        .filter((indexId) => indexId !== undefined)
        .sort((a, b) => a - b);
    console.log("index    groups kept              size kept");
    for (const indexId of indexIds) {
        const indexFile = full.files.get(CacheFiles.INDEX_FILE_PREFIX + indexId)!;
        let groups = 0;
        let bytes = 0;
        for (
            let archiveId = 0;
            archiveId < indexFile.byteLength / SectorCluster.SIZE;
            archiveId++
        ) {
            const size = getGroupSize(full, indexId, archiveId);
            if (size > 0) {
                groups++;
                bytes += size;
            }
        }
        const index = kept.get(indexId) ?? { groups: 0, bytes: 0 };
        console.log(
            String(indexId).padStart(5),
            `${index.groups} / ${groups}`.padStart(17),
            `${formatMb(index.bytes)} / ${formatMb(bytes)}`,
        );
    }
}

// Every group comes out of the slim cache as it went in, and loading what the
// game loads from it reads nothing that's missing
async function checkSlimCache(full: LoadedCache, slim: LoadedCache, keys: string[]): Promise<void> {
    const fullStore = MemoryStore.fromFiles(full.files);
    const slimStore = MemoryStore.fromFiles(slim.files);
    for (const [indexId, archiveId] of keys.map(parseKey)) {
        const expected = readGroup.call(fullStore, indexId, archiveId);
        const actual = readGroup.call(slimStore, indexId, archiveId);
        if (Buffer.compare(Buffer.from(expected), Buffer.from(actual)) !== 0) {
            throw new Error(`Group ${indexId}:${archiveId} was written wrong`);
        }
    }
    reads.clear();
    await loadWhatTheGameLoads(slim);
    // Including reads whose error a loader caught and went on from
    const missing = [...reads].filter((key) => {
        const [indexId, archiveId] = parseKey(key);
        return (
            getGroupSize(full.files, indexId, archiveId) > 0 &&
            getGroupSize(slim.files, indexId, archiveId) === 0
        );
    });
    if (missing.length > 0) {
        throw new Error(`Missing from the slim cache: ${missing.join(", ")}`);
    }
}

async function main(): Promise<void> {
    const started = performance.now();
    await Hasher.init();

    if (verifyOnly || verifyFull) {
        const slimInfo = loadCacheInfos(outDir).find(
            (c) => c.slimOf === GAME_CACHE_NAME || c.name.startsWith(GAME_CACHE_NAME + "-slim-"),
        );
        if (!slimInfo) {
            throw new Error(`No slim cache for ${GAME_CACHE_NAME} found in ${outDir}caches.json`);
        }
        const slim = loadCache(slimInfo, outDir);
        reads.clear();
        await loadWhatTheGameLoads(slim, verifyFull);
        const missing = [...reads].filter((key) => {
            const [indexId, archiveId] = parseKey(key);
            return (
                indexId !== CacheIndex.META_INDEX_ID &&
                getGroupSize(slim.files, indexId, archiveId) === 0
            );
        });
        if (missing.length > 0) {
            throw new Error(`Missing from the slim cache: ${missing.join(", ")}`);
        }
        const seconds = ((performance.now() - started) / 1000).toFixed(2);
        console.log(
            `Verified ${slimInfo.name} (${reads.size} groups read, ${verifyFull ? "full" : "fast"} mode) in ${seconds}s`,
        );
        process.exit(0);
    }

    const fullInfo = loadCacheInfos().find((c) => c.name === GAME_CACHE_NAME);
    if (!fullInfo) {
        throw new Error(`Cache ${GAME_CACHE_NAME} not found in caches/caches.json`);
    }
    const full = loadCache(fullInfo);

    console.log(`Loading what the game loads from ${GAME_CACHE_NAME}...`);
    await loadWhatTheGameLoads(full);
    const metaEntries = full.files.files.get(CacheFiles.META_FILE_NAME)!.byteLength;
    for (let indexId = 0; indexId < metaEntries / SectorCluster.SIZE; indexId++) {
        // The reference tables, for every index
        reads.add(CacheIndex.META_INDEX_ID + ":" + indexId);
    }
    const keys = [...reads].sort((a, b) => {
        const [indexA, archiveA] = parseKey(a);
        const [indexB, archiveB] = parseKey(b);
        return indexA - indexB || archiveA - archiveB;
    });
    printSummary(full.files, keys);

    const files = writeSlimFiles(full.files, keys);
    const hash = createHash("sha256");
    for (const name of [...files.keys()].sort()) {
        hash.update(name).update(files.get(name)!);
    }
    const name = `${GAME_CACHE_NAME}-slim-${hash.digest("hex").slice(0, 8)}`;
    let size = 0;
    for (const data of files.values()) {
        size += data.byteLength;
    }
    const slimInfo: CacheInfo = { ...fullInfo, name, size, slimOf: GAME_CACHE_NAME };

    const dir = outDir + name + "/";
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const [fileName, data] of files) {
        fs.writeFileSync(dir + fileName, data);
    }
    fs.copyFileSync(`./caches/${GAME_CACHE_NAME}/keys.json`, dir + "keys.json");

    console.log(`Checking ${name}...`);
    try {
        await checkSlimCache(full, loadCache(slimInfo, outDir), keys);
    } catch (e) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw e;
    }

    // Only the newest slim cache stays
    for (const entry of fs.readdirSync(outDir)) {
        if (entry !== name && entry.startsWith(GAME_CACHE_NAME + "-slim-")) {
            fs.rmSync(outDir + entry, { recursive: true, force: true });
        }
    }
    fs.writeFileSync(outDir + "caches.json", JSON.stringify([slimInfo]), "utf8");

    const seconds = ((performance.now() - started) / 1000).toFixed(0);
    console.log(`Wrote ${outDir}${name} (${formatMb(size).trim()}) in ${seconds}s`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
