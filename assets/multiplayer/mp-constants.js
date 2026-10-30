// Run Escape - Multiplayer Constants & Sanitization Helpers

export const ALL_CHARACTERS = [
    { id: 'dipper', name: 'Dipper (Corgi)', weapon: 'throwing_knives', defaultUnlocked: false, secretCode: true },
    { id: 'elias', name: 'Elias (Chihuahua)', weapon: 'scimitar', defaultUnlocked: false, secretCode: true },
    { id: 'warrior', name: 'Warrior', weapon: 'scimitar', defaultUnlocked: true },
    { id: 'wizard', name: 'Wizard', weapon: 'fire_spells', defaultUnlocked: true },
    { id: 'ranger', name: 'Ranger', weapon: 'throwing_knives', defaultUnlocked: true },
    { id: 'monk', name: 'Monk', weapon: 'saradomin_strike', defaultUnlocked: false },
    { id: 'barbarian', name: 'Barbarian', weapon: 'two_handed_sword', defaultUnlocked: false },
    { id: 'ancient_mage', name: 'Ancient Mage', weapon: 'ice_burst', defaultUnlocked: false },
    { id: 'hunter', name: 'Hunter', weapon: 'shortbow', defaultUnlocked: false },
    { id: 'rogue', name: 'Rogue', weapon: 'throwing_knives', defaultUnlocked: false },
    { id: 'dragon_slayer', name: 'Dragon Slayer', weapon: 'scimitar', defaultUnlocked: false },
    { id: 'nomad', name: 'Nomad', weapon: 'throwing_axes', defaultUnlocked: false },
    { id: 'menaphite', name: 'Menaphite', weapon: 'smoke_burst', defaultUnlocked: false },
    { id: 'seer', name: 'Seer', weapon: 'elemental_runes', defaultUnlocked: false },
    { id: 'berserker', name: 'Berserker', weapon: 'two_handed_sword', defaultUnlocked: false },
    { id: 'obby_mauler', name: 'Obby Mauler', weapon: 'tzhaar_ket_om', defaultUnlocked: false },
    { id: 'pirate', name: 'Pirate', weapon: 'throwing_knives', defaultUnlocked: false },
    { id: 'pyromancer', name: 'Pyromancer', weapon: 'fire_spells', defaultUnlocked: false },
    { id: 'shayzien_soldier', name: 'Shayzien Soldier', weapon: 'scimitar', defaultUnlocked: false },
    { id: 'gladiator', name: 'Gladiator', weapon: 'dual_macuahuitl', defaultUnlocked: false },
    { id: 'javelineer', name: 'Javelineer', weapon: 'eclipse_atlatl', defaultUnlocked: false },
    { id: 'vampyre_hunter', name: 'Vampyre Hunter', weapon: 'ivandis_flail', defaultUnlocked: false },
    { id: 'werewolf', name: 'Werewolf', weapon: 'dragon_claws', defaultUnlocked: false },
    { id: 'godsword_knight', name: 'Godsword Knight', weapon: 'godsword', defaultUnlocked: false },
    { id: 'armadyl_ranger', name: 'Armadyl Ranger', weapon: 'armadyl_crossbow', defaultUnlocked: false },
    { id: 'elf_archer', name: 'Elf Archer', weapon: 'crystal_bow', defaultUnlocked: false },
    { id: 'gauntlet_runner', name: 'Gauntlet Runner', weapon: 'crystal_staff', defaultUnlocked: false },
    { id: 'infernal_champion', name: 'Infernal Champion', weapon: 'toxic_blowpipe', defaultUnlocked: false },
    { id: 'tzhaar_hur', name: 'TzHaar-Hur', weapon: 'toktz_mej_tal', defaultUnlocked: false },
    { id: 'scammer', name: 'Scammer', weapon: 'throwing_knives', defaultUnlocked: false },
    { id: 'f2p_pker', name: 'F2P PKer', weapon: 'two_handed_sword', defaultUnlocked: false },
    { id: 'durial321', name: 'Durial321', weapon: 'abyssal_whip', defaultUnlocked: false },
    { id: 'lms_sweat', name: 'LMS Sweat', weapon: 'ice_burst', defaultUnlocked: false },
    { id: 'castle_wars_veteran', name: 'Castle Wars Veteran', weapon: 'two_handed_sword', defaultUnlocked: false },
    { id: 'void_knight', name: 'Void Knight', weapon: 'scimitar', defaultUnlocked: false },
    { id: 'penance_fighter', name: 'Penance Fighter', weapon: 'battleaxe', defaultUnlocked: false }
];

export const ALLOWED_CHARACTERS = new Set(ALL_CHARACTERS.map(c => c.id));
export const CHAR_WEAPONS = Object.fromEntries(ALL_CHARACTERS.map(c => [c.id, c.weapon]));
export const DEFAULT_UNLOCKED_CHARACTERS = ALL_CHARACTERS.filter(c => c.defaultUnlocked).map(c => c.id);
export const SLOT_DEFAULT_CHARS = { 1: 'warrior', 2: 'wizard', 3: 'ranger', 4: 'warrior' };

export const ALL_REGIONS = [
    { id: 'lumbridge', name: 'Lumbridge', bosses: 'Count Draynor & Wise Old Man', difficulty: '1.0x Base HP / 1.0x Dmg' },
    { id: 'barrows', name: 'Barrows', bosses: 'The Six Barrows Brothers (Dharok Final)', difficulty: '1.25x Base HP / 1.15x Dmg' },
    { id: 'wilderness', name: 'Wilderness', bosses: 'Crazy Archaeologist, Chaos Fanatic & King Black Dragon', difficulty: '1.5x Base HP / 1.3x Dmg' },
    { id: 'desert', name: 'Kharidian Desert', bosses: 'Fareed, Dessous, Damis & Kalphite Queen', difficulty: '1.75x Base HP / 1.45x Dmg' },
    { id: 'fremennik', name: 'Fremennik Province', bosses: 'Dagannoth Kings & Vorkath', difficulty: '2.0x Base HP / 1.6x Dmg' },
    { id: 'karamja', name: 'Karamja', bosses: 'Elvarg, Nezikchened, Ket-Zek & TzTok-Jad', difficulty: '2.25x Base HP / 1.75x Dmg' },
    { id: 'kourend', name: 'Kourend', bosses: 'Lizardman Shaman, Sarachnis, Skotizo & Alchemical Hydra', difficulty: '2.5x Base HP / 1.9x Dmg' },
    { id: 'varlamore', name: 'Varlamore', bosses: 'Manticore, Colossi & Sol Heredit', difficulty: '2.75x Base HP / 2.05x Dmg' },
    { id: 'morytania', name: 'Morytania', bosses: 'Vanstrom Klause, Pestilent Bloat, Sotetseg & Verzik Vitur', difficulty: '3.0x Base HP / 2.2x Dmg' },
    { id: 'god_wars', name: 'God Wars Dungeon', bosses: 'Zilyana, Kree\'arra, K\'ril, Graardor & Nex', difficulty: '3.25x Base HP / 1.95x Dmg' },
    { id: 'prifddinas', name: 'Prifddinas', bosses: 'Zulrah, Zalcano, Crystalline & Corrupted Hunllef', difficulty: '3.5x Base HP / 2.5x Dmg' },
    { id: 'inferno', name: 'The Inferno', bosses: 'JalTok-Jad, Champions & Triple JalTok-Jads', difficulty: '3.75x Base HP / 2.7x Dmg' },
    { id: 'barbarian_village', name: 'Barbarian Village', bosses: 'Minotaur Warlord, Haakon the Champion & Gunthor the Brave', difficulty: '1.35x Base HP / 1.2x Dmg' },
    { id: 'fight_caves', name: 'Fight Caves (Jad & Zuk)', bosses: 'TzTok-Jad (6:00) & TzKal-Zuk (12:00 - Prayer Switch Required!)', difficulty: 'One-Shot Unless Praying (Q/E/R)' },
    { id: 'grand_exchange', name: 'Grand Exchange (Fun)', bosses: 'The Doubler, Lure Master, Bot Farmer & Melodox', difficulty: 'Endless Fun Map (1.0x Base)' },
    { id: 'east_varrock', name: 'East Varrock Ditch (Fun)', bosses: 'Clan Leader, Rune 2h Pure & Wildy Mage', difficulty: 'Endless Fun Map (1.0x Base)' },
    { id: 'falador', name: 'Falador Massacre (Fun)', bosses: 'Player Moderator, Cursed You & Mod Murdoch', difficulty: 'Endless Fun Map (All Durial321)' },
    { id: 'last_man_standing', name: 'Last Man Standing (Fun)', bosses: 'AGS Specer, Claws Specer & Dharok Risker', difficulty: 'Endless Fun Map (1.0x Base)' },
    { id: 'castle_wars', name: 'Castle Wars (Fun)', bosses: 'Flag Carrier, Catapult Crew & Zamorak Tank', difficulty: 'Endless Fun Map (1.0x Base)' },
    { id: 'pest_control', name: 'Pest Control (Fun)', bosses: 'Purple, Blue, Yellow & Red Portals', difficulty: 'Endless Fun Map (1.15x HP / 1.1x Dmg)' }
];
export const ALLOWED_REGIONS = new Set(ALL_REGIONS.map(r => r.id));

export const SPAWN_OFFSETS = {
    1: { dx: -0.75, dy: -0.5 },
    2: { dx: 0.75, dy: -0.5 },
    3: { dx: -0.75, dy: 0.75 },
    4: { dx: 0.75, dy: 0.75 }
};

export const COOP_DIFFICULTY_WEIGHTS = {
    1: { label: '1P Preview (2P Active on Start)', hpMult: 1.85, bossHpMult: 2.25, dmgMult: 1.10, spawnMult: 1.25, heavyWeightBias: 0.25, ringMult: 1.25, xpMult: 0.85 },
    2: { label: '2P Duo', hpMult: 1.85, bossHpMult: 2.25, dmgMult: 1.10, spawnMult: 1.25, heavyWeightBias: 0.25, ringMult: 1.25, xpMult: 0.85 },
    3: { label: '3P Trio', hpMult: 2.55, bossHpMult: 3.25, dmgMult: 1.22, spawnMult: 1.50, heavyWeightBias: 0.50, ringMult: 1.50, xpMult: 0.72 },
    4: { label: '4P Quad', hpMult: 3.30, bossHpMult: 4.25, dmgMult: 1.35, spawnMult: 1.75, heavyWeightBias: 0.80, ringMult: 1.75, xpMult: 0.62 }
};

export function getCoopDifficultyWeights(partyCount) {
    const clamped = Math.max(1, Math.min(4, Math.round(Number(partyCount) || 2)));
    return COOP_DIFFICULTY_WEIGHTS[clamped] || COOP_DIFFICULTY_WEIGHTS[2];
}

export function sanitizeMapId(mapId, fallback = 'lumbridge') {
    if (!mapId || typeof mapId !== 'string') return fallback;
    const normalized = mapId.trim().toLowerCase();
    return ALLOWED_REGIONS.has(normalized) ? normalized : fallback;
}

export function sanitizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().slice(0, 14).replace(/[^a-zA-Z0-9 ()_-]/g, '');
}

export function sanitizeRoomId(room) {
    if (!room || typeof room !== 'string') return '';
    return room.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
}

export function sanitizeCharacter(charId, fallback = 'warrior') {
    if (!charId || typeof charId !== 'string') return fallback;
    const normalized = charId.trim().toLowerCase();
    return ALLOWED_CHARACTERS.has(normalized) ? normalized : fallback;
}

export function sanitizeSlot(slot, fallback = 1) {
    const n = Math.round(Number(slot));
    return (Number.isFinite(n) && n >= 1 && n <= 4) ? n : fallback;
}

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function sanitizeHexColor(val, fallback = '#3d3123') {
    if (typeof val !== 'string') return fallback;
    const trimmed = val.trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : fallback;
}

const PEER_STAT_BOUNDS = {
    might: [-0.9, 5],
    cooldown: [-0.9, 3],
    area: [-0.9, 3],
    speed: [-0.9, 3],
    amount: [0, 8],
    duration: [-0.9, 10.0],
    luck: [-0.9, 5],
    growth: [-0.9, 5],
    greed: [-0.9, 5],
    magnet: [-0.9, 5],
    armor: [-10, 25],
    regen: [0, 50],
    maxHp: [-0.9, 5],
    thorns: [0, 50],
    healChance: [0, 1.0],
    healOnKill: [0, 200],
    critChance: [0, 1.0],
    critDamage: [0, 5.0],
    pierce: [0, 20],
    split: [0, 10],
    bounces: [0, 10]
};

export function sanitizePeerStats(raw) {
    const clean = {};
    if (!raw || typeof raw !== 'object') return clean;
    for (const [key, [minVal, maxVal]] of Object.entries(PEER_STAT_BOUNDS)) {
        if (raw[key] !== undefined) {
            const n = Number(raw[key]);
            if (Number.isFinite(n)) {
                clean[key] = Math.min(maxVal, Math.max(minVal, n));
            }
        }
    }
    return clean;
}

// Weapon stance animations matching src/game/content/stances.ts (0.18.0)
export const DEFAULT_PLAYER_STANCE = { idle: 808, run: 824 };

export const PLAYER_STANCES = [
    // 2h swords
    { idle: 2561, run: 2563, objIds: [1307, 1309, 1311, 1313, 1315, 1317, 1319, 7158] },
    // Godswords
    { idle: 7053, run: 7043, objIds: [11802, 11804, 11806, 11808, 26233] },
    // Colossal blade
    { idle: 9460, run: 9459, objIds: [27021] },
    // Elder maul
    { idle: 7518, run: 7519, objIds: [21003] },
    // Tzhaar-ket-om and Hill giant club
    { idle: 2065, run: 824, objIds: [6528, 20756] },
    // Dinh's bulwarks
    { idle: 7508, run: 7509, objIds: [21015, 28682] },
    // Scythes
    { idle: 8057, run: 824, objIds: [22325, 25739] },
    // Ivandis and Blisterwood flails
    { idle: 8009, run: 8016, objIds: [22398, 24699] },
    // Abyssal whip
    { idle: 808, run: 1661, objIds: [4151] },
    // Osmumten's fang
    { idle: 809, run: 824, objIds: [26219] },
    // Thunder khopesh
    { idle: 11935, run: 11937, objIds: [30388] },
    // Blue moon spear
    { idle: 11120, run: 11118, objIds: [28988] },
    // Staves, wands, sceptres, Toktz-mej-tal, blowpipe, atlatl, crystal staff
    {
        idle: 813,
        run: 1210,
        objIds: [
            1387, 1389, 6526, 9013, 12926, 21006, 21276, 22323, 22370, 23898, 23899, 23900, 25489, 25491,
            25492, 25731, 29000
        ]
    },
    // Nightmare staves
    { idle: 4504, run: 1210, objIds: [24423, 24425] },
    // Tumeken's shadows
    { idle: 9494, run: 1707, objIds: [27275, 28547] },
    // Crossbows
    { idle: 4591, run: 4228, objIds: [11785, 21012] }
];

const STANCE_BY_OBJ = new Map(
    PLAYER_STANCES.flatMap(s => s.objIds.map(objId => [objId, { idle: s.idle, run: s.run }]))
);

export function getWeaponStance(objId) {
    const id = Number(objId);
    if (!Number.isFinite(id) || id <= 0) return DEFAULT_PLAYER_STANCE;
    return STANCE_BY_OBJ.get(id) || DEFAULT_PLAYER_STANCE;
}

export function getPlayerStanceSeqs() {
    return [...new Set(PLAYER_STANCES.flatMap(s => [s.idle, s.run]))];
}

// Walk (819) must always be first so the baked actor height comes from the neutral walk pose
// rather than raised-weapon stances (matching GameAssets.ts in 0.18.0).
export const DEFAULT_PLAYER_ATTACK_SEQS = [
    386, 390, 393, 401, 426, 711, 806, 811, 1167, 1378, 1658, 1979,
    2062, 2614, 2661, 3157, 4230, 5061, 7045, 7511, 7514, 7516, 7638,
    7640, 7642, 7644, 7855, 8056, 9171, 9493, 10656, 10989, 11140
];

export function buildPlayerBakeSeqIds(client) {
    const dynamicAttackSeqs = [];
    if (client && typeof client.getWeapons === 'function') {
        try {
            for (const w of client.getWeapons()) {
                if (Number.isFinite(w?.playerSeq)) dynamicAttackSeqs.push(w.playerSeq);
                if (Number.isFinite(w?.special?.playerSeq)) dynamicAttackSeqs.push(w.special.playerSeq);
            }
        } catch (err) {}
    }
    return [...new Set([
        819, 808, 824, 836,
        ...getPlayerStanceSeqs(),
        ...DEFAULT_PLAYER_ATTACK_SEQS,
        ...dynamicAttackSeqs
    ])];
}

