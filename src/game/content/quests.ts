import { getEnemy } from "./enemies";
import { getMap } from "./maps";
import { QuestDef, QuestObjective } from "./types";

// Slayer Tasks: goals that take as many runs as they take, each paying coins once
// when the run that finishes it ends. In map/Slayer Master order, with the ones
// done across Gielinor last.
export const QUESTS: QuestDef[] = [
    {
        id: "ernest_the_chicken",
        name: "Birds of a Feather",
        mapId: "lumbridge",
        objective: { kind: "kill", enemyIds: ["chicken"], count: 75, what: "chickens" },
        coins: 100,
    },
    {
        id: "goblin_diplomacy",
        name: "Lumbridge Goblin Cull",
        mapId: "lumbridge",
        objective: { kind: "kill", enemyIds: ["goblin"], count: 300, what: "goblins" },
        coins: 150,
    },
    {
        id: "imp_catcher",
        name: "Lesser Imp Assignment",
        mapId: "lumbridge",
        objective: { kind: "kill", enemyIds: ["imp"], count: 200, what: "imps" },
        coins: 150,
    },
    {
        id: "the_restless_ghost",
        name: "Graveyard Spectres",
        mapId: "lumbridge",
        objective: { kind: "kill", enemyIds: ["ghost"], count: 500, what: "ghosts" },
        coins: 200,
    },
    {
        id: "vampyre_slayer",
        name: "Count of Draynor Manor",
        mapId: "lumbridge",
        objective: { kind: "kill", enemyIds: ["count_draynor"], count: 1 },
        coins: 300,
    },
    {
        id: "shades_of_mortton",
        name: "Mort'ton Shade Purge",
        mapId: "barrows",
        objective: { kind: "kill", enemyIds: ["shade"], count: 1000, what: "Loar Shades" },
        coins: 400,
    },
    {
        id: "sins_of_the_father",
        name: "Feral Vampyre Hunt",
        mapId: "barrows",
        objective: {
            kind: "kill",
            enemyIds: ["feral_vampyre"],
            count: 1000,
            what: "Feral Vampyres",
        },
        coins: 400,
    },
    {
        id: "the_dig_site",
        name: "Wilderness Demi-Boss: Ruins",
        mapId: "wilderness",
        objective: {
            kind: "kill",
            enemyIds: ["crazy_archaeologist"],
            count: 1,
            what: "the Crazy archaeologist",
        },
        coins: 400,
    },
    {
        id: "desert_treasure",
        name: "Mahjarrat Shadow Lords",
        mapId: "desert",
        objective: { kind: "killEach", enemyIds: ["fareed", "dessous", "damis_risen"] },
        coins: 1000,
    },
    {
        id: "contact",
        name: "Kharidian Scarab Swarms",
        mapId: "desert",
        objective: {
            kind: "kill",
            enemyIds: ["scarab_swarm"],
            count: 50,
            what: "scarab swarms",
        },
        coins: 400,
    },
    {
        id: "horror_from_the_deep",
        name: "Lighthouse Dagannoths",
        mapId: "fremennik",
        objective: { kind: "kill", enemyIds: ["dagannoth"], count: 1000, what: "dagannoths" },
        coins: 500,
    },
    {
        id: "troll_stronghold",
        name: "Fremennik Troll Task",
        mapId: "fremennik",
        objective: {
            kind: "kill",
            enemyIds: ["mountain_troll", "ice_troll"],
            count: 1000,
            what: "trolls",
        },
        coins: 500,
    },
    {
        id: "royal_trouble",
        name: "Kings of Waterbirth Island",
        mapId: "fremennik",
        objective: {
            kind: "killEach",
            enemyIds: ["dagannoth_rex", "dagannoth_supreme", "dagannoth_prime"],
            what: "each of the Dagannoth Kings",
        },
        coins: 1000,
    },
    {
        id: "dragon_slayer_ii",
        name: "Ungael Blue Dragon Boss",
        mapId: "fremennik",
        objective: { kind: "kill", enemyIds: ["vorkath"], count: 1 },
        coins: 1500,
    },
    {
        id: "monkey_madness",
        name: "Karamja Jungle Monkeys",
        mapId: "karamja",
        objective: { kind: "kill", enemyIds: ["monkey"], count: 300, what: "monkeys" },
        coins: 500,
    },
    {
        id: "dragon_slayer",
        name: "Crandor Green Dragon",
        mapId: "karamja",
        objective: { kind: "kill", enemyIds: ["elvarg"], count: 1 },
        coins: 1000,
    },
    {
        id: "legends_quest",
        name: "Black Demon of the Jungle",
        mapId: "karamja",
        objective: { kind: "kill", enemyIds: ["nezikchened"], count: 1 },
        coins: 1000,
    },
    {
        id: "a_kingdom_divided",
        name: "Shayzien Lizardman Task",
        mapId: "kourend",
        objective: {
            kind: "kill",
            enemyIds: ["lizardman", "lizardman_brute"],
            count: 1000,
            what: "lizardmen",
        },
        coins: 600,
    },
    {
        id: "perilous_moons",
        name: "Neypotzli Nagua Assignment",
        mapId: "varlamore",
        objective: {
            kind: "kill",
            enemyIds: ["sulphur_nagua", "frost_nagua"],
            count: 1000,
            what: "naguas",
        },
        coins: 700,
    },
    {
        id: "nature_spirit",
        name: "Mort Myre Ghast Cleansing",
        mapId: "morytania",
        objective: { kind: "kill", enemyIds: ["ghast"], count: 500, what: "ghasts" },
        coins: 700,
    },
    {
        id: "darkness_of_hallowvale",
        name: "Darkmeyer Vyrewatch Task",
        mapId: "morytania",
        objective: {
            kind: "kill",
            enemyIds: ["vampyre_juvenile", "vampyre_juvinate", "vyrewatch", "vyrewatch_sentinel"],
            count: 1000,
            what: "vampyres",
        },
        coins: 800,
    },
    {
        id: "a_night_at_the_theatre",
        name: "Lady Verzik of Sinhaza",
        mapId: "morytania",
        // Her last form, the spider: she isn't beaten until it is
        objective: { kind: "kill", enemyIds: ["verzik_vitur_spider"], count: 1 },
        coins: 2000,
    },
    {
        id: "temple_of_ikov",
        name: "Armadyl's Eyrie Aviansies",
        mapId: "god_wars",
        objective: {
            kind: "kill",
            enemyIds: ["aviansie", "aviansie_veteran"],
            count: 1000,
            what: "aviansies",
        },
        coins: 800,
    },
    {
        id: "the_frozen_door",
        name: "God Wars Generals",
        mapId: "god_wars",
        objective: {
            kind: "killEach",
            enemyIds: ["commander_zilyana", "kreearra", "kril_tsutsaroth", "general_graardor"],
            what: "each of the four generals",
        },
        coins: 1500,
    },
    {
        id: "secrets_of_the_north",
        name: "The Fifth General: Nex",
        mapId: "god_wars",
        // Her last form, ice
        objective: { kind: "kill", enemyIds: ["nex_ice"], count: 1 },
        coins: 2000,
    },
    {
        id: "roving_elves",
        name: "Iorwerth Clan Elves",
        mapId: "prifddinas",
        objective: {
            kind: "kill",
            enemyIds: ["elf_guard", "iorwerth_warrior", "iorwerth_archer"],
            count: 1000,
            what: "elves",
        },
        coins: 900,
    },
    {
        id: "regicide",
        name: "Serpent of Zul-Andra",
        mapId: "prifddinas",
        // Its last form, the blue one
        objective: { kind: "kill", enemyIds: ["zulrah_tanzanite"], count: 1 },
        coins: 1200,
    },
    {
        id: "song_of_the_elves",
        name: "The Red Prison's Hunllef",
        mapId: "prifddinas",
        objective: { kind: "kill", enemyIds: ["corrupted_hunllef"], count: 1 },
        coins: 2000,
    },
    // No OSRS quest goes into Mor Ul Rek, so these are named for the Inferno's
    // combat achievements and the Inferno itself
    {
        id: "nibblers_begone",
        name: "Nibblers, Begone!",
        mapId: "inferno",
        objective: { kind: "kill", enemyIds: ["jal_nib"], count: 1000, what: "nibblers" },
        coins: 900,
    },
    {
        id: "jad_what_are_you_doing_here",
        name: "Jad? What Are You Doing Here?",
        mapId: "inferno",
        objective: { kind: "kill", enemyIds: ["jaltok_jad"], count: 1 },
        coins: 1200,
    },
    {
        id: "the_inferno",
        name: "TzKal-Zuk's Crucible",
        mapId: "inferno",
        objective: { kind: "beatMap", mapId: "inferno" },
        coins: 2500,
    },
    {
        id: "ratcatchers",
        name: "Gielinor Vermin Extermination",
        objective: {
            kind: "kill",
            enemyIds: ["rat", "giant_rat", "crypt_rat", "giant_crypt_rat", "crystalline_rat"],
            count: 1000,
            what: "rats",
        },
        coins: 400,
    },
    {
        id: "demon_slayer",
        name: "Lesser Demon Assignment",
        objective: {
            kind: "kill",
            enemyIds: ["revenant_demon", "lesser_demon", "reanimated_demon"],
            count: 300,
            what: "demons",
        },
        coins: 600,
    },
    {
        id: "pirates_treasure",
        name: "Clue Hunter's Casket Bounty",
        objective: { kind: "caskets", count: 30 },
        coins: 500,
    },
];

export const QUEST_BY_ID: Map<string, QuestDef> = new Map(QUESTS.map((q) => [q.id, q]));

// "Kill 75 chickens", "Kill Count Draynor", "Kill Fareed, Dessous and Damis",
// "Open 30 reward caskets", "Beat The Inferno"
export function describeQuest(objective: QuestObjective): string {
    switch (objective.kind) {
        case "kill":
            return objective.count === 1
                ? `Kill ${objective.what ?? getEnemy(objective.enemyIds[0]).name}`
                : `Kill ${objective.count.toLocaleString()} ${objective.what}`;
        case "killEach":
            return `Kill ${objective.what ?? joinNames(objective.enemyIds.map((id) => getEnemy(id).name))}`;
        case "caskets":
            return `Open ${objective.count} reward caskets`;
        case "beatMap":
            return `Beat ${getMap(objective.mapId).name}`;
    }
}

function joinNames(names: string[]): string {
    return names.length > 1
        ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
        : names[0];
}
