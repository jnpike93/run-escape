import { CacheFiles, ProgressListener } from "../rs/cache/CacheFiles";
import { CacheInfo, getLatestCache } from "../rs/cache/CacheInfo";
import { CacheType, detectCacheType } from "../rs/cache/CacheType";

// Next to the page, so the game can be served from a folder (fetched from the
// page, never from a worker, so it's relative to the page's URL)
const CACHE_PATH = "caches/";

const CACHE_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

export async function fetchCacheInfos(): Promise<CacheInfo[]> {
    const resp = await fetch(CACHE_PATH + "caches.json?v=8.3", { cache: "no-cache" });
    if (!resp.ok) {
        throw new Error(`Failed to fetch caches.json: ${resp.status} ${resp.statusText}`);
    }
    const infos: CacheInfo[] = await resp.json();
    for (const info of infos) {
        if (!CACHE_NAME_PATTERN.test(info.name)) {
            throw new Error(`Invalid cache name: ${JSON.stringify(info.name)}`);
        }
    }
    return infos;
}

export type CacheList = {
    caches: CacheInfo[];
    latest: CacheInfo;
};

export async function fetchCacheList(): Promise<CacheList | undefined> {
    try {
        const caches = await fetchCacheInfos();
        const latest = getLatestCache(caches);
        if (!latest) {
            return undefined;
        }
        return {
            caches,
            latest,
        };
    } catch (e) {
        const isNetworkError = e instanceof TypeError;
        const kind = isNetworkError ? "network" : "parse/validation";
        throw new Error(
            `Failed to load cache list (${kind} failure). Run \`npm run download-caches\` to fetch the game caches. Original error: ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}

export type LoadedCache = {
    info: CacheInfo;
    type: CacheType;
    files: CacheFiles;
    xteas: XteaMap;
};

export async function loadCacheFiles(
    info: CacheInfo,
    signal?: AbortSignal,
    progressListener?: ProgressListener,
): Promise<LoadedCache> {
    const cachePath = CACHE_PATH + info.name + "/";

    const xteasPromise = fetchXteas(cachePath + "keys.json", signal);

    const cacheType = detectCacheType(info);
    const files = await CacheFiles.fetchFiles(
        cacheType,
        cachePath,
        info.name,
        true,
        signal,
        progressListener,
    );

    const xteas = await xteasPromise;

    return {
        info,
        type: cacheType,
        files,
        xteas,
    };
}

export type XteaMap = Map<number, number[]>;

export async function fetchXteas(url: RequestInfo, signal?: AbortSignal): Promise<XteaMap> {
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error(`fetchXteas: HTTP ${resp.status} for ${String(url)}`);
    const data: unknown = await resp.json();
    if (!data || typeof data !== "object") throw new Error("fetchXteas: invalid response");
    const map = new Map<number, number[]>();
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        const regionId = parseInt(key, 10);
        if (!Number.isFinite(regionId)) continue;
        if (
            !Array.isArray(val) ||
            val.length !== 4 ||
            !val.every((v): v is number => Number.isFinite(v as number))
        )
            continue;
        map.set(regionId, val as number[]);
    }
    return map;
}
