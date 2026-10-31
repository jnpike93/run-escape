import { getArmouryCost, getUpgradeLine } from "../../content/armoury";
import { CHARACTERS } from "../../content/characters";
import { CUSTOM_MAPS } from "../../content/custom/customMaps";
import { ALL_MAPS, MAPS, MAP_BY_ID } from "../../content/maps";
import type { RunSummary, SaveData } from "../save";

const VALID_SECRET_CODES = new Set(["dipperthedog", "barkelly", "l33th4x0r"]);
const ALWAYS_UNLOCKED_CUSTOM_MAP_IDS = new Set(["fight_caves"]);

export function isCustomMap(mapId: string): boolean {
    return ALWAYS_UNLOCKED_CUSTOM_MAP_IDS.has(mapId);
}

export type ChallengeMode = "normal" | "extreme_one_chunk" | "nightmare";

export type ChallengeModeDef = {
    id: ChallengeMode;
    name: string;
    shortName: string;
    difficultyMultiplier: number;
    pointsMultiplier: number;
    color: string;
    description: string;
};

export const CHALLENGE_MODES: readonly ChallengeModeDef[] = [
    {
        id: "normal",
        name: "Normal",
        shortName: "Normal",
        difficultyMultiplier: 1,
        pointsMultiplier: 1,
        color: "#ff981f",
        description: "Standard map difficulty (1x difficulty, 1x points).",
    },
    {
        id: "extreme_one_chunk",
        name: "Extreme One Chunk Man",
        shortName: "Extreme One Chunk",
        difficultyMultiplier: 2,
        pointsMultiplier: 1.5,
        color: "#ff6040",
        description: "2x map difficulty (2x monster & boss HP and damage) for 1.5x points.",
    },
    {
        id: "nightmare",
        name: "Nightmare Man",
        shortName: "Nightmare Man",
        difficultyMultiplier: 3,
        pointsMultiplier: 2.5,
        color: "#e040ff",
        description: "3x map difficulty (3x monster & boss HP and damage) for 2.5x points.",
    },
];

export function isChallengeMode(value: unknown): value is ChallengeMode {
    return value === "normal" || value === "extreme_one_chunk" || value === "nightmare";
}

export function getChallengeMode(mode?: ChallengeMode): ChallengeModeDef {
    return CHALLENGE_MODES.find((m) => m.id === mode) ?? CHALLENGE_MODES[0];
}

export function getChallengeDifficultyMultiplier(mode?: ChallengeMode): number {
    return getChallengeMode(mode).difficultyMultiplier;
}

export function getChallengePointsMultiplier(mode?: ChallengeMode): number {
    return getChallengeMode(mode).pointsMultiplier;
}

export type MapBestRecord = {
    seconds: number;
    winSeconds: number;
    kills: number;
    level: number;
    characterId?: string;
    bossesKilled?: number;
    points?: number;
    challengeMode?: ChallengeMode;
};

export type LevelPointsBreakdown = {
    killPoints: number;
    progressionPoints: number;
    clearPoints: number;
    endlessPoints: number;
    difficultyMultiplier: number;
    modePointsMultiplier: number;
    challengeMode: ChallengeMode;
    totalPoints: number;
};

const num = (value: unknown, fallback: number): number =>
    typeof value === "number" && isFinite(value) ? value : fallback;

export function getMapDifficultyMultiplier(mapId: string): number {
    if (mapId === "fight_caves") {
        return 3.0;
    }
    const map = MAP_BY_ID.get(mapId);
    if (!map) {
        return 1.0;
    }
    return Math.round((0.6 * map.difficulty.hp + 0.4 * map.difficulty.damage) * 100) / 100;
}

export function calculateRunPointsBreakdown(run: RunSummary): LevelPointsBreakdown {
    const map = MAP_BY_ID.get(run.mapId);
    const bossAt = map?.events?.find((ev) => ev.kind === "finalBoss")?.at ?? 900;
    const difficultyMultiplier = getMapDifficultyMultiplier(run.mapId);
    const challengeMode: ChallengeMode = isChallengeMode(run.challengeMode)
        ? run.challengeMode
        : "normal";
    const modePointsMultiplier = getChallengePointsMultiplier(challengeMode);
    const kills = Math.max(0, Math.floor(num(run.kills, 0)));
    const seconds = Math.max(0, num(run.seconds, 0));
    const minutes = Math.max(1, seconds / 60);
    const kpm = Math.min(300, kills / minutes);
    const killPoints = Math.round(kills * (10 + kpm * 0.04));
    const round = Math.max(1, Math.floor(num(run.round, 1)));
    const effectiveSec = run.endless && round > 1 ? seconds : Math.min(bossAt, seconds);
    const level = Math.max(1, Math.floor(num(run.level, 1)));
    const progressionPoints =
        seconds > 0 || level > 1 ? Math.round(effectiveSec * 2 + (level - 1) * 75) : 0;
    const bossesCount = Array.isArray(run.bossesKilled) ? run.bossesKilled.length : 0;
    const bossPoints = bossesCount * 500;
    const victoryBonus = run.victory ? 5000 : 0;
    const speedBonus = run.victory
        ? Math.max(0, Math.round(3000 - Math.max(0, seconds - bossAt) * 25))
        : 0;
    const clearPoints = bossPoints + victoryBonus + speedBonus;
    const extraRounds = run.endless ? Math.max(0, round - 1) : 0;
    const endlessPoints =
        extraRounds > 0 ? extraRounds * 4000 + extraRounds * extraRounds * 1000 : 0;
    const totalPoints = Math.round(
        (killPoints + progressionPoints + clearPoints + endlessPoints) *
            difficultyMultiplier *
            modePointsMultiplier,
    );
    return {
        killPoints,
        progressionPoints,
        clearPoints,
        endlessPoints,
        difficultyMultiplier,
        modePointsMultiplier,
        challengeMode,
        totalPoints,
    };
}

export function calculateRunPoints(run: RunSummary): number {
    return calculateRunPointsBreakdown(run).totalPoints;
}

export function calculateLevelPointsBreakdown(
    save: SaveData,
    mapId: string,
    pendingRun?: RunSummary,
): LevelPointsBreakdown {
    const map = MAP_BY_ID.get(mapId);
    const mb = save.mapBest?.[mapId];
    const eb = save.endlessBest?.[mapId];
    const wins = save.mapVictories?.[mapId] ?? 0;
    const endRound = Math.max(
        eb?.round ?? 0,
        pendingRun?.endless && pendingRun.mapId === mapId ? (pendingRun.round ?? 1) : 0,
    );
    const endSec = Math.max(
        eb?.seconds ?? 0,
        pendingRun?.endless && pendingRun.mapId === mapId ? pendingRun.seconds : 0,
    );
    const difficultyMultiplier = getMapDifficultyMultiplier(mapId);
    const savedMode: ChallengeMode = isChallengeMode(mb?.challengeMode)
        ? mb.challengeMode
        : "normal";
    if (!mb && endRound <= 0 && wins <= 0) {
        return {
            killPoints: 0,
            progressionPoints: 0,
            clearPoints: 0,
            endlessPoints: 0,
            difficultyMultiplier,
            modePointsMultiplier: 1,
            challengeMode: "normal",
            totalPoints: 0,
        };
    }
    const bossAt = map?.events?.find((ev) => ev.kind === "finalBoss")?.at ?? 900;
    const bestKills = Math.max(0, Math.floor(num(mb?.kills, 0)));
    const bestSec = Math.max(num(mb?.seconds, 0), endSec, wins > 0 ? bossAt : 0);
    const clearSec =
        num(mb?.winSeconds, 0) > 0 ? num(mb?.winSeconds, 0) : wins > 0 ? bossAt + 30 : 0;
    const bestLevel = Math.max(
        Math.floor(num(mb?.level, 0)),
        wins > 0 ? 30 : bestSec > 0 ? 1 : 0,
    );
    const minutes = Math.max(1, bestSec / 60);
    const kpm = Math.min(300, bestKills / minutes);
    const killPoints = Math.round(bestKills * (10 + kpm * 0.04));
    const effectiveSec = endRound > 1 ? Math.max(bestSec, endSec) : Math.min(bossAt, bestSec);
    const progressionPoints =
        bestSec > 0 || bestLevel > 1
            ? Math.round(effectiveSec * 2 + Math.max(0, bestLevel - 1) * 75)
            : 0;
    const mapBossEventCount =
        map?.events?.filter((e) => e.kind === "boss" || e.kind === "finalBoss").length ?? 1;
    const bossesCount = Math.max(
        Math.floor(num(mb?.bossesKilled, 0)),
        wins > 0 ? mapBossEventCount : 0,
    );
    const bossPoints = bossesCount * 500;
    const victoryBonus = wins > 0 ? 5000 : 0;
    const speedBonus =
        wins > 0 && clearSec > 0
            ? Math.max(0, Math.round(3000 - Math.max(0, clearSec - bossAt) * 25))
            : 0;
    const clearPoints = bossPoints + victoryBonus + speedBonus;
    const extraRounds = Math.max(0, Math.floor(endRound) - 1);
    const endlessPoints =
        extraRounds > 0 ? extraRounds * 4000 + extraRounds * extraRounds * 1000 : 0;
    const savedPts = Math.floor(num(mb?.points, 0));
    const computedTotal = Math.round(
        (killPoints + progressionPoints + clearPoints + endlessPoints) * difficultyMultiplier,
    );
    const useSaved = savedPts >= computedTotal && savedPts > 0;
    const challengeMode = useSaved ? savedMode : "normal";
    const modePointsMultiplier = getChallengePointsMultiplier(challengeMode);
    const totalPoints = Math.max(savedPts, computedTotal);
    return {
        killPoints,
        progressionPoints,
        clearPoints,
        endlessPoints,
        difficultyMultiplier,
        modePointsMultiplier,
        challengeMode,
        totalPoints,
    };
}

export function calculateLevelPoints(
    save: SaveData,
    mapId: string,
    pendingRun?: RunSummary,
): number {
    return calculateLevelPointsBreakdown(save, mapId, pendingRun).totalPoints;
}

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
                const rec: MapBestRecord = {
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
                if (typeof best.bossesKilled === "number" && isFinite(best.bossesKilled)) {
                    rec.bossesKilled = Math.max(0, Math.floor(best.bossesKilled));
                }
                if (typeof best.points === "number" && isFinite(best.points)) {
                    rec.points = Math.max(0, Math.floor(best.points));
                }
                if (isChallengeMode(best.challengeMode)) {
                    rec.challengeMode = best.challengeMode;
                }
                save.mapBest[id] = rec;
            }
        }
    }
}

export function recordCustomRunStats(save: SaveData, run: RunSummary): void {
    save.mapBest ??= {};
    const b = save.mapBest[run.mapId] ?? { seconds: 0, winSeconds: 0, kills: 0, level: 0 };
    b.bossesKilled = Math.max(
        b.bossesKilled ?? 0,
        Array.isArray(run.bossesKilled) ? run.bossesKilled.length : 0,
    );
    if (run.seconds > (b.seconds ?? 0)) {
        b.seconds = run.seconds;
        b.characterId = run.characterId ?? b.characterId;
    }
    if (run.victory && (!b.winSeconds || run.seconds < b.winSeconds)) {
        b.winSeconds = run.seconds;
    }
    b.kills = Math.max(b.kills ?? 0, run.kills ?? 0);
    b.level = Math.max(b.level ?? 0, run.level ?? 0);
    const runPts = calculateRunPoints(run);
    const prevPts = b.points ?? 0;
    if (runPts >= prevPts) {
        b.points = runPts;
        if (isChallengeMode(run.challengeMode)) {
            b.challengeMode = run.challengeMode;
        }
    }
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
