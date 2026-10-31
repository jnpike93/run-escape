import { EquipSlot } from "../../../rs/model/player/PlayerModelLoader";
import { CharacterDef } from "../types";

export const CUSTOM_CHARACTERS: CharacterDef[] = [
    {
        id: "penance_fighter",
        name: "Penance fighter",
        description:
            "A Barbarian Assault veteran in a Fighter torso, Berserker helm, and Penance gear. Starts with a bronze battleaxe. +10% melee damage, +10% attack speed, +0.5 flat damage reduction, and +5% movement speed.",
        style: "melee",
        startingWeapon: "battleaxe",
        equipment: {
            [EquipSlot.HEAD]: 3751,
            [EquipSlot.TORSO]: 10551,
            [EquipSlot.LEGS]: 10555,
            [EquipSlot.HANDS]: 10553,
            [EquipSlot.FEET]: 10552,
        },
        bonus: { meleeMight: 0.1, cooldown: 0.1, armor: 0.5, moveSpeed: 0.05 },
        unlock: { kind: "beatMap", mapId: "barbarian_village" },
    },
    {
        id: "dipper",
        name: "Dipper",
        description:
            "A fierce corgi. Starts with bronze throwing knives. +25% movement speed, +50% pickup range, and +1 flat damage reduction.",
        style: "ranged",
        startingWeapon: "throwing_knives",
        iconObjId: -16370,
        equipment: {},
        bonus: { moveSpeed: 0.25, magnet: 0.5, armor: 1 },
        unlock: { kind: "code", code: "dipperthedog" } as CharacterDef["unlock"],
    },
    {
        id: "elias",
        name: "Elias",
        description:
            "A feisty melee chihuahua. Starts with a bronze scimitar. +30% movement speed, +20% attack speed, +15% damage, and +1 flat damage reduction.",
        style: "melee",
        startingWeapon: "scimitar",
        iconObjId: -16543,
        equipment: {},
        bonus: { moveSpeed: 0.3, cooldown: 0.2, might: 0.15, armor: 1 },
        unlock: { kind: "code", code: "barkelly" } as CharacterDef["unlock"],
    },
    {
        id: "nova",
        name: "Nova",
        description:
            "An agile cat with nine lives. Starts with Dragon claws. +35% movement speed, +20% attack speed, +20% luck, +1 extra life, and +1 flat damage reduction.",
        style: "melee",
        startingWeapon: "dragon_claws",
        iconObjId: -2638,
        equipment: {},
        bonus: { moveSpeed: 0.35, cooldown: 0.2, luck: 0.2, revival: 1, armor: 1 },
        unlock: { kind: "code", code: "novathecat" } as CharacterDef["unlock"],
    },
];

const SPECIAL_CHARACTER_IDS = new Set(["dipper", "elias", "nova"]);

export function isSpecialCharacter(characterId: string): boolean {
    return SPECIAL_CHARACTER_IDS.has(characterId);
}
