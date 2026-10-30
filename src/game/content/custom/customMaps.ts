import { MapDef } from "../types";
import { RUN_LENGTH, paced } from "../waves";

export const CUSTOM_MAPS: MapDef[] = [
    {
        id: "barbarian_village",
        name: "Barbarian Village",
        description:
            "Gunnarsgrunn's barbarians, axe-throwers, shieldmaidens and berserkers, Ice Mountain wolves " +
            "and Dwarven Mine scorpions, and the minotaurs, giant spiders, shades and ankou of the " +
            "Stronghold of Security beneath the village. The Minotaur Warlord and Haakon the Champion " +
            "come one by one, and Chieftain Gunthor the Brave leads the charge at the end.",
        // Rune battleaxe
        iconObjId: 1373,
        // Barbarian Village, the Stronghold of Security entrance, Ice Mountain,
        // Edgeville and the River Lum bridge (map squares 47-49 x 52-54)
        arena: { baseX: 47 * 64, baseY: 52 * 64, sizeX: 3 * 64, sizeY: 3 * 64 },
        // In the village courtyard, between the Stronghold entrance and the longhall
        spawn: { x: 3082.5, y: 3423.5 },
        difficulty: { hp: 1.35, damage: 1.2 },
        waves: paced([
            [
                { id: "dungeon_rat", weight: 3 },
                { id: "village_goblin", weight: 2 },
            ],
            [
                { id: "village_goblin", weight: 3 },
                { id: "barbarian_villager", weight: 2 },
            ],
            [
                { id: "barbarian_villager", weight: 3 },
                { id: "ice_wolf", weight: 1 },
            ],
            [
                { id: "barbarian_villager", weight: 3 },
                { id: "ice_wolf", weight: 2 },
            ],
            [
                { id: "mine_scorpion", weight: 3 },
                { id: "barbarian_villager", weight: 2 },
                { id: "barbarian_axeman", weight: 1 },
            ],
            [
                { id: "stronghold_minotaur", weight: 3 },
                { id: "mine_scorpion", weight: 2 },
            ],
            [
                { id: "zombie", weight: 3 },
                { id: "stronghold_minotaur", weight: 2 },
                { id: "barbarian_axeman", weight: 1 },
            ],
            [
                { id: "zombie", weight: 2 },
                { id: "skeleton", weight: 2 },
            ],
            [
                { id: "barbarian_shieldmaiden", weight: 3 },
                { id: "skeleton", weight: 2 },
                { id: "barbarian_axeman", weight: 1 },
            ],
            [
                { id: "pit_spider", weight: 3 },
                { id: "barbarian_shieldmaiden", weight: 2 },
            ],
            [
                { id: "stronghold_shade", weight: 3 },
                { id: "skeleton", weight: 1 },
            ],
            [
                { id: "sepulchre_ankou", weight: 3 },
                { id: "stronghold_shade", weight: 1 },
            ],
            [
                { id: "zombie", weight: 2 },
                { id: "skeleton", weight: 2 },
                { id: "sepulchre_ankou", weight: 2 },
            ],
            [
                { id: "pit_spider", weight: 2 },
                { id: "barbarian_berserker", weight: 2 },
                { id: "barbarian_axeman", weight: 1 },
            ],
            [
                { id: "barbarian_berserker", weight: 3 },
                { id: "sepulchre_ankou", weight: 2 },
                { id: "stronghold_shade", weight: 2 },
                { id: "pit_spider", weight: 2 },
            ],
        ]),
        events: [
            { at: 100, kind: "elite", enemyId: "village_goblin" },
            { at: 150, kind: "elite", enemyId: "barbarian_villager" },
            { at: 200, kind: "elite", enemyId: "ice_wolf" },
            { at: 250, kind: "elite", enemyId: "mine_scorpion" },
            { at: 300, kind: "boss", enemyId: "minotaur_warlord", hp: 2100 },
            { at: 360, kind: "ring", enemyId: "stronghold_minotaur", count: 30 },
            { at: 420, kind: "elite", enemyId: "zombie" },
            { at: 480, kind: "elite", enemyId: "skeleton" },
            { at: 540, kind: "elite", enemyId: "barbarian_shieldmaiden" },
            { at: 600, kind: "boss", enemyId: "haakon_the_champion", hp: 4000 },
            { at: 620, kind: "ring", enemyId: "sepulchre_ankou", count: 44 },
            { at: 660, kind: "elite", enemyId: "pit_spider" },
            { at: 720, kind: "elite", enemyId: "stronghold_shade" },
            { at: 780, kind: "elite", enemyId: "barbarian_shieldmaiden" },
            { at: 840, kind: "ring", enemyId: "barbarian_berserker", count: 56 },
            { at: 870, kind: "elite", enemyId: "barbarian_berserker" },
            { at: RUN_LENGTH, kind: "finalBoss", enemyId: "gunthor_the_brave", hp: 9500 },
        ],
        finalBossWarning: "War horns echo from the longhall... Gunthor the Brave is coming!",
        victoryText: "Chieftain Gunthor the Brave is defeated!",
    },
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
