import { MapDef } from "../types";
import { paced } from "../waves";

export const CUSTOM_MAPS: MapDef[] = [
    {
        id: "fight_caves",
        name: "Fight Caves",
        description:
            "TzHaar bats, blobs, rangers, healers and mages in the volcanic caldera. TzTok-Jad rises at 6:00 and TzKal-Zuk at 12:00 - switch Protection Prayers (Q: Magic, E: Ranged, R: Melee) before their attacks land, or be one-shot!",
        iconObjId: 6570,
        arena: { baseX: 2368, baseY: 5056, sizeX: 64, sizeY: 64 },
        spawn: { x: 2400.5, y: 5088.5 },
        difficulty: { hp: 1, damage: 1 },
        waves: paced([
            [{ id: "tz_kih", weight: 3 }, { id: "tz_kek", weight: 1 }],
            [{ id: "tz_kih", weight: 2 }, { id: "tz_kek", weight: 3 }],
            [{ id: "tz_kek", weight: 3 }, { id: "tok_xil", weight: 1 }],
            [{ id: "tok_xil", weight: 2 }, { id: "tz_kek", weight: 2 }],
            [{ id: "tok_xil", weight: 3 }, { id: "tz_kih", weight: 2 }],
            [{ id: "yt_mejkot", weight: 2 }, { id: "tok_xil", weight: 2 }],
            [{ id: "yt_mejkot", weight: 3 }, { id: "tz_kek", weight: 2 }],
            [{ id: "yt_mejkot", weight: 2 }, { id: "tok_xil", weight: 2 }, { id: "tz_kih", weight: 1 }],
            [{ id: "yt_mejkot", weight: 3 }, { id: "tok_xil", weight: 2 }],
            [{ id: "yt_mejkot", weight: 3 }, { id: "tok_xil", weight: 3 }],
            [{ id: "yt_mejkot", weight: 3 }, { id: "tok_xil", weight: 3 }],
            [{ id: "yt_mejkot", weight: 3 }, { id: "tok_xil", weight: 3 }],
            [{ id: "yt_mejkot", weight: 3 }, { id: "tok_xil", weight: 3 }],
            [{ id: "yt_mejkot", weight: 3 }, { id: "tok_xil", weight: 3 }],
            [{ id: "yt_mejkot", weight: 3 }, { id: "tok_xil", weight: 3 }],
        ]),
        events: [
            { at: 4, kind: "elite", enemyId: "tz_kek" },
            { at: 10, kind: "elite", enemyId: "tok_xil" },
            { at: 360, kind: "boss", enemyId: "tztok_jad", hp: 5500 },
            { at: 720, kind: "finalBoss", enemyId: "tzkal_zuk", hp: 15500 },
        ],
        finalBossWarning: "The volcano shatters... TzKal-Zuk is rising! Switch Protection Prayers (Q/E/R)!",
        victoryText: "TzKal-Zuk is slain! You have conquered the Fight Caves!",
    },
];
