import fs from "fs";

import { CacheList, LoadedCache, XteaMap } from "../../src/mapviewer/Caches";
import { CacheFiles } from "../../src/rs/cache/CacheFiles";
import { CacheInfo, getLatestCache } from "../../src/rs/cache/CacheInfo";
import { detectCacheType } from "../../src/rs/cache/CacheType";

export function loadCacheInfos(cachesDir = "./caches/"): CacheInfo[] {
    const dir = cachesDir.replace(/\/?$/, "/");
    const json = fs.readFileSync(dir + "caches.json", "utf8");
    const infos: CacheInfo[] = JSON.parse(json);
    const fullDir = "./caches/osrs-241_2026-09-30/";
    if (
        !infos.some((c) => c.name === "osrs-241_2026-09-30") &&
        fs.existsSync(fullDir + "info.json")
    ) {
        const raw = JSON.parse(fs.readFileSync(fullDir + "info.json", "utf8"));
        infos.unshift({
            name: "osrs-241_2026-09-30",
            game: raw.game,
            environment: raw.environment,
            revision: raw.builds[0].major,
            timestamp: raw.timestamp,
            size: raw.size,
        });
    }
    return infos;
}

export function loadCacheList(caches: CacheInfo[]): CacheList {
    const latest = getLatestCache(caches);
    if (!latest) {
        throw new Error("No latest cache");
    }
    return {
        caches,
        latest,
    };
}

export function loadCacheFiles(cache: CacheInfo, cachesDir = "./caches/"): CacheFiles {
    const cachePath = cachesDir + cache.name + "/";

    const files = new Map<string, ArrayBuffer>();

    fs.readdirSync(cachePath).forEach((fileName: string) => {
        const buffer = fs.readFileSync(cachePath + fileName);

        files.set(
            fileName,
            buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        );
    });

    return new CacheFiles(files);
}

export function loadCache(info: CacheInfo, cachesDir = "./caches/"): LoadedCache {
    const files = loadCacheFiles(info, cachesDir);
    const xteas = loadXteas(info, cachesDir);
    return {
        info,
        type: detectCacheType(info),
        files,
        xteas,
    };
}

export function loadXteas(cache: CacheInfo, cachesDir = "./caches/"): XteaMap {
    const cachePath = cachesDir + cache.name + "/";
    const json = fs.readFileSync(cachePath + "keys.json", "utf8");
    const data: Record<string, number[]> = JSON.parse(json);
    return new Map(Object.keys(data).map((key) => [parseInt(key), data[key]]));
}
