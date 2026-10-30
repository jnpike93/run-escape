import { CUSTOM_CHARACTERS } from "./customCharacters";
import { CUSTOM_ENEMIES } from "./customEnemies";
import {
    CUSTOM_CASKET_GEAR,
    CUSTOM_GEAR_OVERRIDES,
    CUSTOM_QUESTS,
    CUSTOM_WEAPONS,
} from "./customWeapons";
import {
    CharacterDef,
    EnemyDef,
    GearDef,
    PassiveDef,
    QuestDef,
    ShopUpgradeDef,
    UtilityDef,
    WeaponDef,
    WeaponLevel,
} from "../types";

const CHARACTER_DESCRIPTIONS: Record<string, string> = {
    warrior: "Starts with a bronze scimitar. +1 flat damage reduction.",
    wizard: "Starts with Fire Strike. +5% attack speed.",
    ranger: "Starts with bronze throwing knives. +10% movement speed.",
    monk: "Starts with Saradomin Strike. +15% attack speed.",
    barbarian: "Starts with a bronze 2h sword. +20% max hitpoints.",
    ancient_mage: "Starts with Ice Burst. +15% attack size (reach & AoE).",
    hunter: "Starts with a shortbow. +50% pickup range.",
    rogue: "Starts with bronze throwing knives. +25% coin gain and +10% drop rate & rarity luck.",
    dragon_slayer: "Starts with a bronze scimitar. +15% damage.",
    nomad: "Starts with bronze throwing axes. +5% movement speed and +10% damage.",
    menaphite: "Starts with Smoke Burst. +15% XP gain.",
    seer: "Starts with elemental runes. +25% effect & DoT duration.",
    berserker: "Starts with a bronze 2h sword. +0.5 flat damage reduction and +3 recoil damage.",
    obby_mauler: "Starts with a Tzhaar-ket-om. +10% damage and +10% max hitpoints.",
    pirate: "Starts with bronze throwing knives. +1 reroll per run and +5% drop rate & rarity luck.",
    shayzien_soldier:
        "Starts with a bronze scimitar. +0.5 flat damage reduction and +3 HP regen / min.",
    gladiator: "Starts with a dual macuahuitl. +10% attack speed and +5% damage.",
    javelineer: "Starts with an eclipse atlatl. +20% projectile speed and +10% attack size.",
    scammer:
        "Starts with bronze throwing knives. +50% coin gain and +10% drop rate & rarity luck. Trust them.",
    f2p_pker: "Starts with a bronze 2h sword. +10% damage and +5% movement speed.",
    durial321:
        "Starts with the Abyssal whip, but -30% max hitpoints. Everyone plays him in Falador.",
    lms_sweat: "Starts with Ice Burst. +10% attack speed and +10% attack size.",
};

export function applyCustomCharacters(characters: CharacterDef[]): void {
    for (const character of characters) {
        const desc = CHARACTER_DESCRIPTIONS[character.id];
        if (desc !== undefined) {
            character.description = desc;
        }
    }
    characters.unshift(...CUSTOM_CHARACTERS);
}

export function applyCustomEnemies(enemies: EnemyDef[]): void {
    const jad = enemies.find((e) => e.id === "tztok_jad");
    if (jad) {
        jad.speed = 1.4;
        jad.spawnMessage =
            "TzTok-Jad rises from the lava! Switch Protection Prayers (Q: Magic, E: Ranged, R: Melee)!";
        jad.boss = {
            attackInterval: 2.8,
            recovery: 2.2,
            enragedRecovery: 1.2,
            enrage: {
                message: "TzTok-Jad summons the healers!",
                shout: "JalYt, you will burn!",
            },
            attacks: [
                {
                    name: "Stomp",
                    kind: "swing",
                    damage: 99,
                    windup: 1.5,
                    cooldown: 0,
                    range: 3.6,
                    radius: 3.6,
                    weight: 4,
                    sound: 2500,
                },
                {
                    name: "Magic",
                    kind: "projectile",
                    damage: 99,
                    windup: 1.6,
                    cooldown: 0,
                    range: 18,
                    minRange: 2.5,
                    weight: 4,
                    speed: 9,
                    homing: 1.2,
                    castSpotAnim: 447,
                    spotAnim: 448,
                    impactSpotAnim: 157,
                    seq: 2656,
                    sound: 162,
                    hitSound: 163,
                },
                {
                    name: "Rockfall",
                    kind: "blast",
                    damage: 99,
                    windup: 1.6,
                    cooldown: 0,
                    range: 18,
                    minRange: 2.5,
                    radius: 2.2,
                    weight: 4,
                    impactSpotAnim: 451,
                    seq: 2652,
                    sound: 2500,
                },
                {
                    name: "Call healers",
                    kind: "summon",
                    damage: 1,
                    windup: 1,
                    cooldown: 18,
                    range: 18,
                    weight: 2,
                    summon: { enemyId: "yt_hurkot", count: 4 },
                    sound: 2500,
                    enraged: true,
                },
                {
                    name: "Rockstorm",
                    kind: "blast",
                    damage: 99,
                    windup: 1.6,
                    cooldown: 5,
                    range: 18,
                    radius: 2,
                    count: 5,
                    spread: 3.5,
                    weight: 4,
                    impactSpotAnim: 451,
                    seq: 2652,
                    sound: 2500,
                    enraged: true,
                },
            ],
        };
    }
    enemies.push(...CUSTOM_ENEMIES);
}

const UTILITY_OVERRIDES: Record<string, Partial<UtilityDef>> = {
    saradomin_brew: {
        description:
            "Heals 8 hitpoints. +20% max hitpoints and +2 flat damage reduction for 30 seconds.",
        use: { kind: "heal", amount: 8, stats: { maxHp: 0.2, armor: 2 }, seconds: 30 },
    },
    zamorak_brew: {
        description: "+35% damage, but -1 flat damage reduction, for 30 seconds.",
    },
    magic_potion: {
        description: "+20% attack size and +20% effect & DoT duration for 30 seconds.",
    },
    sanfew_serum: {
        description:
            "Heals 5 hitpoints, grants +10 HP regen / min for 60s, and cures & blocks poison and boss curses for 60s.",
        use: { kind: "cure", seconds: 60, heal: 5, stats: { regen: 10 } },
    },
    super_combat_potion: {
        description: "+25% damage, +1 flat damage reduction and +10% attack speed for 30 seconds.",
    },
    bastion_potion: {
        description:
            "+1 projectile, +20% projectile speed and +1.5 flat damage reduction for 30 seconds.",
    },
    battlemage_potion: {
        description:
            "+25% attack size, +25% effect & DoT duration and +1.5 flat damage reduction for 30 seconds.",
    },
    black_chinchompa: {
        description: "Deals 160 blast damage in a 6.5-tile radius around you.",
    },
    overload: {
        description: "+35% damage, +15% attack speed and +15% attack size for 30 seconds.",
    },
};

export function applyCustomItems(utility: UtilityDef[]): void {
    for (const item of utility) {
        const override = UTILITY_OVERRIDES[item.id];
        if (override) {
            Object.assign(item, override);
        }
    }
}

export function applyCustomGear(casketGear: GearDef[]): void {
    for (const gear of casketGear) {
        const override = CUSTOM_GEAR_OVERRIDES[gear.id];
        if (override) {
            Object.assign(gear, override);
        }
    }
    casketGear.push(...CUSTOM_CASKET_GEAR);
}

const PASSIVE_OVERRIDES: Record<string, Partial<PassiveDef>> = {
    piety: {
        description: "Increases all weapon damage.",
    },
    protect_melee: {
        description: "Reduces damage taken from every hit by a flat amount.",
        effect: "flat damage reduction",
    },
    rapid_heal: {
        description:
            "Passively regenerates hitpoints over time (+2.5 HP/min base per level; disabled for 5s when hit).",
        perLevel: 2.5,
        effect: "HP regen / min",
    },
    ring_of_wealth: {
        description: "Increases drop rates, casket/level-up rarity rolls, and coin gain.",
        effect: "drop rate, rarity luck & coin gain",
    },
    tome_of_fire: {
        description: "Increases attack speed across all weapons.",
        effect: "attack speed",
    },
    vengeance: {
        description: "Deals flat recoil damage back to any enemy that hits you.",
    },
    book_of_the_dead: {
        description: "Increases freeze, poison, debuff, orbit, and potion buff duration.",
        effect: "effect & DoT duration",
    },
};

export function applyCustomPassives(passives: PassiveDef[]): void {
    for (const passive of passives) {
        const override = PASSIVE_OVERRIDES[passive.id];
        if (override) {
            Object.assign(passive, override);
        }
    }
}

const SHOP_DESCRIPTIONS: Record<string, string> = {
    defence: "+1 flat damage reduction",
    hitpoints: "+20% max hitpoints (+5 base HP)",
    prayer: "+1.5 HP regen / min",
    attack: "+2.5% attack speed",
    magic: "+5% attack size (reach & AoE)",
    herblore: "+15% effect & DoT duration",
    fletching: "+1 projectile per attack",
    slayer: "+10% drop rate & rarity luck",
    farming: "+3% XP gain",
    mining: "+10% coin gain",
};

export function applyCustomShopUpgrades(upgrades: ShopUpgradeDef[]): void {
    for (const upgrade of upgrades) {
        const desc = SHOP_DESCRIPTIONS[upgrade.id];
        if (desc !== undefined) {
            upgrade.description = desc;
        }
    }
}

const QUEST_NAMES: Record<string, string> = {
    ernest_the_chicken: "Birds of a Feather",
    goblin_diplomacy: "Lumbridge Goblin Cull",
    imp_catcher: "Lesser Imp Assignment",
    the_restless_ghost: "Graveyard Spectres",
    vampyre_slayer: "Count of Draynor Manor",
    shades_of_mortton: "Mort'ton Shade Purge",
    sins_of_the_father: "Feral Vampyre Hunt",
    the_dig_site: "Wilderness Demi-Boss: Ruins",
    desert_treasure: "Mahjarrat Shadow Lords",
    contact: "Kharidian Scarab Swarms",
    horror_from_the_deep: "Lighthouse Dagannoths",
    troll_stronghold: "Fremennik Troll Task",
    royal_trouble: "Kings of Waterbirth Island",
    dragon_slayer_ii: "Ungael Blue Dragon Boss",
    monkey_madness: "Karamja Jungle Monkeys",
    dragon_slayer: "Crandor Green Dragon",
    legends_quest: "Black Demon of the Jungle",
    a_kingdom_divided: "Shayzien Lizardman Task",
    perilous_moons: "Neypotzli Nagua Assignment",
    nature_spirit: "Mort Myre Ghast Cleansing",
    darkness_of_hallowvale: "Darkmeyer Vyrewatch Task",
    a_night_at_the_theatre: "Lady Verzik of Sinhaza",
    temple_of_ikov: "Armadyl's Eyrie Aviansies",
    the_frozen_door: "God Wars Generals",
    secrets_of_the_north: "The Fifth General: Nex",
    roving_elves: "Iorwerth Clan Elves",
    regicide: "Serpent of Zul-Andra",
    song_of_the_elves: "The Red Prison's Hunllef",
    the_inferno: "TzKal-Zuk's Crucible",
    ratcatchers: "Gielinor Vermin Extermination",
    demon_slayer: "Lesser Demon Assignment",
    pirates_treasure: "Clue Hunter's Casket Bounty",
};

export function applyCustomQuests(quests: QuestDef[]): void {
    for (const quest of quests) {
        const name = QUEST_NAMES[quest.id];
        if (name !== undefined) {
            quest.name = name;
        }
    }
    quests.push(...CUSTOM_QUESTS);
}

type CustomWeaponLevel = WeaponLevel & { heal?: number };

type WeaponOverride = {
    description?: string;
    lifesteal?: WeaponDef["lifesteal"];
    pairedPassive?: string;
    levels?: Record<number, Partial<CustomWeaponLevel>>;
};

const WEAPON_OVERRIDES: Record<string, WeaponOverride> = {
    scimitar: {
        levels: {
            5: { description: "+8% attack speed (1.25s cooldown)." },
            7: { description: "+3 damage, +9% attack speed (1.15s cooldown)." },
        },
    },
    fire_spells: {
        levels: {
            3: { description: "+10% attack speed (1.0s cooldown)." },
            4: { description: "Learns Fire Blast: +3 damage, 0.9-tile AoE splash." },
            6: { description: "Learns Fire Wave: +3 damage, +33% AoE splash (1.2 tiles)." },
            7: { description: "+11% attack speed (0.9s cooldown), +1 pierce." },
        },
    },
    throwing_knives: {
        levels: {
            3: { description: "+8% attack speed (0.6s cooldown)." },
        },
    },
    ice_burst: {
        levels: {
            3: { description: "+10% attack speed (2.1s cooldown)." },
            4: { description: "+42% freeze duration (0.85s)." },
            7: { description: "+11% attack speed (1.9s cooldown)." },
        },
    },
    smoke_burst: {
        levels: {
            3: { description: "+10% attack speed (2.1s cooldown)." },
            6: { description: "4 poison dmg/s for 4s (+33% duration)." },
            7: { description: "+11% attack speed (1.9s cooldown)." },
        },
    },
    shadow_burst: {
        levels: {
            3: { description: "+10% attack speed (2.1s cooldown)." },
            4: { description: "+50% debuff duration (6s)." },
            7: { description: "+11% attack speed (1.9s cooldown)." },
        },
    },
    blood_burst: {
        description:
            "Crimson bursts around you that drain life (15% chance per hit to heal 25% of damage dealt, up to 2 HP). Evolves into Blood Barrage at max level.",
        lifesteal: { chance: 0.15, fraction: 0.25, max: 2, spotAnim: 1542 },
        pairedPassive: "rapid_heal",
        levels: {
            0: { damage: 11, cooldown: 1.8, knockback: 0.25 },
            1: { damage: 11, cooldown: 1.8, knockback: 0.25 },
            2: { damage: 14, cooldown: 1.8, knockback: 0.25, description: "+3 damage." },
            3: {
                damage: 14,
                cooldown: 1.55,
                knockback: 0.25,
                description: "+16% attack speed (1.55s cooldown).",
            },
            4: { damage: 18, cooldown: 1.55, knockback: 0.25, description: "+4 damage." },
            5: { damage: 18, cooldown: 1.55, knockback: 0.25 },
            6: { damage: 23, cooldown: 1.55, knockback: 0.25, description: "+5 damage." },
            7: {
                damage: 17,
                cooldown: 1.55,
                knockback: 0.25,
                heal: 2,
                description: "+3 damage, +1 heal.",
            },
        },
    },
    blood_barrage: {
        description: "Drains the life of every enemy around you, healing you each cast.",
        lifesteal: { chance: 0.25, fraction: 0.25, max: 2, spotAnim: 1542 },
        levels: {
            0: {
                damage: 38,
                cooldown: 1.1,
                knockback: 0.35,
                description:
                    "Evolved from Blood Burst. Massive crimson barrage that drains up to 2 HP per hit.",
            },
        },
    },
    saradomin_strike: {
        levels: {
            3: { description: "+67% strike AoE radius (1.0 tile)." },
            4: { description: "+10% attack speed (3.0s cooldown)." },
        },
    },
    two_handed_sword: {
        levels: {
            5: { description: "+10% attack speed (1.45s cooldown)." },
            6: { description: "+17% sweep arc width." },
        },
    },
    colossal_blade: {
        description:
            "Evolved 2h sword. Sweeps both sides; bosses and elites take +50% bonus hit damage.",
    },
    shortbow: {
        levels: {
            4: { description: "+13% attack speed (0.8s cooldown)." },
            7: { description: "+14% attack speed (0.7s cooldown), +1 pierce." },
        },
    },
    throwing_axes: {
        levels: {
            5: { description: "+2 damage, +10% attack speed (1.0s cooldown)." },
        },
    },
    elemental_runes: {
        levels: {
            4: { description: "+18% orbit radius, +17% duration (3.5s)." },
            7: { description: "+17% orbit speed, +14% duration (4.0s)." },
        },
    },
    scythe_of_vitur: {
        description:
            "Sweeps a wide arc in front of you. Bosses and elites take 3 hits (+50% and +25% bonus hits).",
        levels: {
            3: { description: "+14% attack speed (1.1s cooldown)." },
        },
    },
    armadyl_godsword: {
        description: "A heavy two-handed sweep. Every 3rd swing is The Judgement (210% damage).",
        levels: {
            3: { description: "+12% attack speed (1.7s cooldown)." },
        },
    },
    bandos_godsword: {
        description:
            "A heavy two-handed sweep. Every 3rd swing is Warstrike (150% damage; targets take +25% damage for 10s).",
        levels: {
            3: { description: "+12% attack speed (1.7s cooldown)." },
        },
    },
    saradomin_godsword: {
        description:
            "A heavy two-handed sweep. Every 3rd swing is Healing Blade (140% damage; heals 50% of damage dealt, up to 3 HP).",
        levels: {
            3: { description: "+12% attack speed (1.7s cooldown)." },
        },
    },
    zamorak_godsword: {
        description:
            "A heavy two-handed sweep. Every 3rd swing is Ice Cleave (140% damage; freezes targets for 2.5s).",
        levels: {
            3: { description: "+12% attack speed (1.7s cooldown)." },
        },
    },
    godsword: {
        levels: {
            3: { description: "+12% attack speed (1.7s cooldown)." },
        },
    },
    osmumtens_fang: {
        description:
            "Fast, precise stabs at the closest enemy. Bosses and elites take a 2nd hit for +60% damage.",
        levels: {
            3: { description: "+13% attack speed (0.75s cooldown)." },
        },
    },
    tzhaar_ket_om: {
        description:
            "A crushing sweep with heavy knockback. Every 4th swing is Quake (130% damage; stuns targets for 2s).",
        levels: {
            3: { description: "+11% attack speed (1.9s cooldown)." },
        },
    },
    dragon_warhammer: {
        description:
            "Heavy blows at the closest enemy. Every 3rd swing is Smash (150% damage; targets take +30% damage for 8s).",
        levels: {
            3: { description: "+12% attack speed (1.25s cooldown)." },
        },
    },
    dual_macuahuitl: {
        levels: {
            2: { description: "+15% attack speed (0.65s cooldown)." },
        },
    },
    twisted_bow: {
        levels: {
            3: { description: "+10%-15% attack speed (1.0s cooldown)." },
        },
    },
    bow_of_faerdhinen: {
        levels: {
            4: { description: "+1 arrow, +15% attack speed (0.65s cooldown)." },
        },
    },
    toxic_blowpipe: {
        levels: {
            3: { description: "+2 damage, +29% attack speed (0.35s cooldown)." },
            4: { description: "6 venom dmg/s for 4s (+33% duration)." },
        },
    },
    dragon_hunter_crossbow: {
        description:
            "Fires piercing bolts at the nearest enemy. Bosses and elites take a 2nd hit for +50% damage.",
        levels: {
            3: { description: "+10%-15% attack speed (1.0s cooldown)." },
        },
    },
    eclipse_atlatl: {
        levels: {
            4: { description: "+17% attack speed (0.6s cooldown), 4 burn dmg/s." },
        },
    },
    tumekens_shadow: {
        levels: {
            3: { description: "+30% AoE splash (1.3 tiles), +1 pierce." },
            4: { description: "+1 blast, +12% attack speed (1.25s cooldown)." },
        },
    },
    harmonised_nightmare_staff: {
        levels: {
            3: { description: "+14% attack speed (0.7s cooldown)." },
            4: { description: "+25% AoE splash (1.0 tile), +1 pierce." },
        },
    },
    sanguinesti_staff: {
        levels: {
            3: { description: "+14% attack speed (1.05s cooldown), +1 pierce." },
        },
    },
    kodai_wand: {
        levels: {
            3: { description: "+16% attack speed (0.95s cooldown)." },
            4: { description: "+3 damage, +30% AoE splash (1.3 tiles)." },
        },
    },
    blue_moon_spear: {
        levels: {
            3: { description: "+50% freeze duration (1.5s)." },
            4: { description: "+1 strike, +13% attack speed (2.3s cooldown)." },
        },
    },
};

export function applyCustomWeapons(weapons: WeaponDef[]): void {
    for (const weapon of weapons) {
        const override = WEAPON_OVERRIDES[weapon.id];
        if (!override) continue;
        if (override.description !== undefined) {
            weapon.description = override.description;
        }
        if (override.lifesteal !== undefined) {
            weapon.lifesteal = override.lifesteal;
        }
        if (override.pairedPassive !== undefined) {
            weapon.pairedPassive = override.pairedPassive;
        }
        if (override.levels) {
            for (const [idxStr, patch] of Object.entries(override.levels)) {
                const level = weapon.levels[Number(idxStr)];
                if (level) {
                    Object.assign(level, patch);
                }
            }
        }
    }
    weapons.push(...CUSTOM_WEAPONS);
}
