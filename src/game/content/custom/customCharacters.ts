import { CharacterDef } from "../types";

export const CUSTOM_CHARACTERS: CharacterDef[] = [
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
];
