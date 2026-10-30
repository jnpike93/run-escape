import { getArmouryCost, getUpgradeLine } from "../../content/armoury";
import { CHARACTERS } from "../../content/characters";
import { ALL_MAPS, MAPS } from "../../content/maps";
import type { RunSummary, SaveData } from "../save";

const VALID_SECRET_CODES = new Set(["dipperthedog", "barkelly", "l33th4x0r"]);

export type MapBestRecord = {
    seconds: number;
    winSeconds: number;
    kills: number;
    level: number;
    characterId?: string;
};

const num = (value: unknown, fallback: number): number =>
    typeof value === "number" && isFinite(value) ? value : fallback;

export function migrateCustomSaveFields(save: SaveData, data: Partial<SaveData>): void {
    if (Array.isArray(data.unlockedCodes)) {
        for (const s of data.unlockedCodes) {
            if (
                typeof s === "string" &&
                VALID_SECRET_CODES.has(s) &&
                !save.unlockedCodes.includes(s)
            ) {
                save.unlockedCodes.push(s);
            }
        }
    }
    save.unlockedCharacters = save.unlockedCharacters.filter(
        (s) =>
            (s !== "dipper" || save.unlockedCodes.includes("dipperthedog")) &&
            (s !== "elias" || save.unlockedCodes.includes("barkelly")),
    );
    if (data.mapBest && typeof data.mapBest === "object") {
        for (const [id, best] of Object.entries(data.mapBest)) {
            if (
                (ALL_MAPS.some((m) => m.id === id) || MAPS.some((m) => m.id === id)) &&
                best &&
                typeof best === "object"
            ) {
                save.mapBest[id] = {
                    seconds: num(best.seconds, 0),
                    winSeconds: num(best.winSeconds, 0),
                    kills: num(best.kills, 0),
                    level: num(best.level, 0),
                    characterId:
                        typeof best.characterId === "string" &&
                        CHARACTERS.some((c) => c.id === best.characterId)
                            ? best.characterId
                            : undefined,
                };
            }
        }
    }
}

export function recordCustomRunStats(save: SaveData, run: RunSummary): void {
    save.mapBest ??= {};
    const b = save.mapBest[run.mapId] ?? { seconds: 0, winSeconds: 0, kills: 0, level: 0 };
    if (run.seconds > (b.seconds ?? 0)) {
        b.seconds = run.seconds;
        b.characterId = run.characterId ?? b.characterId;
    }
    if (run.victory && (!b.winSeconds || run.seconds < b.winSeconds)) {
        b.winSeconds = run.seconds;
    }
    b.kills = Math.max(b.kills ?? 0, run.kills ?? 0);
    b.level = Math.max(b.level ?? 0, run.level ?? 0);
    save.mapBest[run.mapId] = b;
}

export function getArmourySpent(save: SaveData): number {
    let spent = 0;
    for (const [itemId, count] of Object.entries(save.armoury)) {
        const line = getUpgradeLine(itemId);
        const steps = Math.min(count, line.length - 1);
        for (let i = 1; i <= steps; i++) {
            spent += getArmouryCost(line[i]);
        }
    }
    return spent;
}

export function refundArmoury(save: SaveData): void {
    const spent = getArmourySpent(save);
    if (spent <= 0) {
        return;
    }
    save.coins += spent;
    save.armoury = {};
}
