import {
    CSSProperties,
    ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

import { OsrsLoadingBar } from "../../components/rs/loading/OsrsLoadingBar";
import compass from "../../components/rs/minimap/compass.png";
import minimapFrame from "../../components/rs/minimap/minimap-frame.png";
import { EquipSlot } from "../../rs/model/player/PlayerModelLoader";
import { GameClient } from "../client/GameClient";
import {
    BuffView,
    GameStore,
    GearSlotView,
    HudView,
    InventorySlotView,
    QuestTrackView,
    SlotView,
    UiSnapshot,
} from "../client/GameStore";
import { formatTime } from "../client/GameView";
import { CHARACTERS, getCharacter } from "../content/characters";
import { isSpecialCharacter } from "../content/custom/customCharacters";
import { FUN_MAPS, MAPS, getMap } from "../content/maps";
import { RARITIES } from "../content/rarity";
import { SHOP_UPGRADES } from "../content/shop";
import { CharacterDef, CombatStyle, MapDef } from "../content/types";
import { MapReward, describeUnlockTask, getMapRewards } from "../content/unlocks";
import { WeaponStatLine, weaponStats } from "../content/weaponStats";
import { WEAPONS, getWeapon } from "../content/weapons";
import {
    SaveData,
    calculateLevelPoints,
    getNextUpgradeCost,
    importSave,
    isEndlessUnlocked,
    isMapUnlocked,
} from "../core/save";
import { ArmouryScreen } from "./ArmouryScreen";
import { ChangelogPanel } from "./ChangelogPanel";
import { ChestModal } from "./ChestModal";
import { Coins } from "./Coins";
import { CollectionLogScreen } from "./CollectionLogScreen";
import { CoopDamageLeaderboardTable, CoopGameOverButtons } from "./CoopGameOverSection";
import { PauseHoverInfoBox, SecretCodeSection, UiScaleButtons } from "./CustomSettingsControls";
import "./GameUi.css";
import { ItemIcon } from "./ItemIcon";
import { LeaderboardScreen } from "./LeaderboardScreen";
import { NoticePanel } from "./NoticePanel";
import { QuestScreen } from "./QuestScreen";
import { RerollButton } from "./RerollButton";
import { SkipButton } from "./SkipButton";
import { GAME_VERSION } from "./changelog";
import { Notice, loadNotice, markNoticeSeen, shouldShowNotice } from "./notice";

type Props = {
    store: GameStore;
    client?: GameClient;
};

// The UI is laid out for a window about 720 pixels tall; bigger windows draw
// it bigger, up to twice the size, so it isn't lost on a large screen
const UI_BASE_HEIGHT = 720;
const UI_BASE_WIDTH = 1150;
const UI_MAX_SCALE = 2;

function getUiScale(): number {
    const fit = Math.min(window.innerHeight / UI_BASE_HEIGHT, window.innerWidth / UI_BASE_WIDTH);
    // In twentieths, so a small resize doesn't relayout everything
    return Math.round(Math.min(UI_MAX_SCALE, Math.max(1, fit)) * 20) / 20;
}

function useUiScale(): number {
    const [scale, setScale] = useState(getUiScale);
    useEffect(() => {
        const onResize = () => setScale(getUiScale());
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    return scale;
}

export function GameUi({ store, client }: Props): JSX.Element {
    const ui = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const autoScale = useUiScale();
    const uScale = (ui.display as any)?.uiScale;
    const scale = typeof uScale === "number" ? uScale : autoScale;

    useEffect(() => {
        document.documentElement.style.setProperty("--ui-scale", String(scale));
    }, [scale]);

    if (ui.screen === "loading" || !client) {
        return (
            <div className="ui-fill ui-center ui-loading">
                <OsrsLoadingBar text={ui.loadingText} progress={ui.loadingProgress} />
            </div>
        );
    }

    // Every button clicks like the client's interface does (but not ones
    // with sounds of their own)
    const onClickCapture = (event: React.MouseEvent) => {
        if ((event.target as HTMLElement).closest("button:not([data-silent])")) {
            client.playClick();
        }
    };
    let screen: JSX.Element = <></>;
    switch (ui.screen) {
        case "title":
            screen = <TitleScreen ui={ui} client={client} />;
            break;
        case "characters":
            screen = <CharacterScreen ui={ui} client={client} />;
            break;
        case "shop":
            screen = <ShopScreen ui={ui} client={client} />;
            break;
        case "armoury":
            screen = <ArmouryScreen ui={ui} client={client} />;
            break;
        case "quests":
            screen = <QuestScreen ui={ui} client={client} />;
            break;
        case "leaderboard" as any:
            screen = <LeaderboardScreen ui={ui} client={client} />;
            break;
        case "collectionLog":
            screen = <CollectionLogScreen ui={ui} client={client} />;
            break;
        case "run":
            screen = <RunScreen ui={ui} client={client} />;
            break;
    }
    return (
        <div
            className="ui-contents"
            style={{ "--ui-scale": scale } as CSSProperties}
            onClickCapture={onClickCapture}
        >
            {screen}
        </div>
    );
}

type ScreenProps = { ui: UiSnapshot; client: GameClient };

// A setting's name and what it does, with its control on the right
function Setting({
    name,
    text,
    children,
}: {
    name: string;
    text?: string;
    children: ReactNode;
}): JSX.Element {
    return (
        <div className="ui-setting">
            <div className="ui-setting-label">
                <div className="ui-setting-name">{name}</div>
                {text && <div className="ui-setting-text">{text}</div>}
            </div>
            <div className="ui-setting-control">{children}</div>
        </div>
    );
}

function Toggle({
    on,
    label,
    onToggle,
}: {
    on: boolean;
    label: string;
    onToggle: () => void;
}): JSX.Element {
    return (
        <button
            className={"ui-button ui-button-small ui-toggle" + (on ? " ui-toggle-on" : "")}
            aria-label={label}
            aria-pressed={on}
            onClick={(e) => {
                onToggle();
                // Give Enter and Space back to the screen
                e.currentTarget.blur();
            }}
        >
            {on ? "On" : "Off"}
        </button>
    );
}

// music: the run's map has music, so it gets its own volume
function SoundSettings({
    ui,
    client,
    music = false,
}: ScreenProps & { music?: boolean }): JSX.Element {
    const { muted, volume } = ui.audio;
    return (
        <>
            <Setting name="Sound" text="M turns it on and off at any time">
                <Toggle on={!muted} label="Sound" onToggle={() => client.toggleMute()} />
            </Setting>
            <VolumeSetting
                name="Volume"
                value={volume}
                muted={muted}
                onChange={(value) => client.setVolume(value)}
            />
            {music && (
                <VolumeSetting
                    name="Music"
                    value={ui.audio.music}
                    muted={muted}
                    onChange={(value) => client.setMusicVolume(value)}
                />
            )}
        </>
    );
}

function VolumeSetting({
    name,
    value,
    muted,
    onChange,
}: {
    name: string;
    value: number;
    muted: boolean;
    onChange: (value: number) => void;
}): JSX.Element {
    return (
        <Setting name={name}>
            <input
                className={"ui-volume" + (muted ? " ui-volume-muted" : "")}
                type="range"
                min={0}
                max={100}
                value={Math.round(value * 100)}
                onChange={(e) => onChange(parseInt(e.target.value) / 100)}
                // Give the keys back to the game once it's set
                onPointerUp={(e) => e.currentTarget.blur()}
                aria-label={name}
            />
            <span className="ui-volume-value">{Math.round(value * 100)}%</span>
        </Setting>
    );
}

function AutoPauseSetting({ ui, client }: ScreenProps): JSX.Element {
    return (
        <Setting name="Auto-pause" text="Pause the run when you click away from the game">
            <Toggle
                on={ui.display.pauseOnBlur}
                label="Auto-pause"
                onToggle={() => client.toggleAutoPause()}
            />
        </Setting>
    );
}

// The community server's invite
const DISCORD_INVITE = "https://discord.gg/82gBtKz2Xx";

function DiscordLink(): JSX.Element | null {
    return null;
}

// Saves live in this browser; a file carries one to another, or keeps a copy
function SaveSetting({ ui, client }: ScreenProps): JSX.Element {
    const fileInput = useRef<HTMLInputElement>(null);
    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // So picking the same file again still counts
        e.target.value = "";
        if (!file) {
            return;
        }
        let save: SaveData;
        try {
            save = importSave(await file.text());
        } catch {
            window.alert(`${file.name} isn't a Run Escape save.`);
            return;
        }
        const describe = (s: SaveData) =>
            `${s.coins.toLocaleString()} coins, ${s.runs} runs, ${s.victories} wins`;
        const replace = window.confirm(
            `Replace your save (${describe(ui.save)}) with this one (${describe(save)})?\n\n` +
                "Export yours first if you want to keep it.",
        );
        if (replace) {
            client.replaceSave(save);
        }
    };
    return (
        <Setting
            name="Your progress"
            text="Kept in this browser. Export a copy to keep it safe or take it to another one."
        >
            <button
                className="ui-button ui-button-small"
                onClick={(e) => {
                    client.exportSave();
                    e.currentTarget.blur();
                }}
            >
                Export
            </button>
            <button
                className="ui-button ui-button-small"
                onClick={(e) => {
                    fileInput.current?.click();
                    e.currentTarget.blur();
                }}
            >
                Import
            </button>
            <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={onFile}
            />
        </Setting>
    );
}

// Behind the title screen's Settings button
function SettingsPanel({
    ui,
    client,
    onClose,
}: ScreenProps & { onClose: () => void }): JSX.Element {
    return (
        <div className="ui-panel rs-border rs-background ui-settings">
            <h2>Settings</h2>
            <div className="ui-settings-body">
                <section className="ui-settings-section">
                    <h3>Sound</h3>
                    <SoundSettings ui={ui} client={client} />
                </section>
                <section className="ui-settings-section">
                    <h3>Game</h3>
                    <Setting name="UI Scale" text="Scale menus, HUD and Co-Op lobby">
                        <UiScaleButtons ui={ui} client={client} />
                    </Setting>
                    <Setting
                        name="Camera spin"
                        text="The camera circles your adventurer on the menus"
                    >
                        <Toggle
                            on={ui.display.menuSpin}
                            label="Camera spin"
                            onToggle={() => client.toggleMenuSpin()}
                        />
                    </Setting>
                    <Setting
                        name="Tile coordinates"
                        text="Show your tile position under the minimap"
                    >
                        <Toggle
                            on={(ui.display as any).showCoords !== false}
                            label="Tile coordinates"
                            onToggle={() => (client as any).toggleCoords()}
                        />
                    </Setting>
                    <AutoPauseSetting ui={ui} client={client} />
                </section>
                <section className="ui-settings-section">
                    <h3>Save & Codes</h3>
                    <SaveSetting ui={ui} client={client} />
                    <SecretCodeSection client={client} />
                </section>
            </div>
            <div className="ui-row">
                <button className="ui-button" onClick={onClose}>
                    Back
                </button>
            </div>
        </div>
    );
}

function TitleScreen({ ui, client }: ScreenProps): JSX.Element {
    const save = ui.save;
    const [changelogOpen, setChangelogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // The notice, until it's closed (once for each new one)
    const [notice, setNotice] = useState<Notice>();
    useEffect(() => {
        let mounted = true;
        loadNotice().then((loaded) => {
            if (mounted && loaded && shouldShowNotice(loaded)) {
                setNotice(loaded);
            }
        });
        return () => {
            mounted = false;
        };
    }, []);
    const closeNotice = useCallback(() => {
        if (notice) {
            markNoticeSeen(notice);
        }
        setNotice(undefined);
    }, [notice]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
                return;
            }
            if (notice) {
                if (e.code === "Enter" || e.code === "Space" || e.code === "Escape") {
                    closeNotice();
                }
            } else if (changelogOpen || settingsOpen) {
                if (e.code === "Escape") {
                    setChangelogOpen(false);
                    setSettingsOpen(false);
                }
            } else if (e.code === "Enter" || e.code === "Space") {
                client.showScreen("characters");
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [client, changelogOpen, settingsOpen, notice, closeNotice]);
    if (changelogOpen) {
        return (
            <div className="ui-fill ui-center">
                <ChangelogPanel onClose={() => setChangelogOpen(false)} />
            </div>
        );
    }
    if (settingsOpen) {
        return (
            <div className="ui-fill ui-center">
                <SettingsPanel ui={ui} client={client} onClose={() => setSettingsOpen(false)} />
            </div>
        );
    }
    return (
        <div className="ui-fill ui-title">
            <div className="ui-title-logo">
                <h1>Run Escape</h1>
                <p>
                    Survive fifteen minutes and beat the boss. Wins and tasks bring new places and
                    adventurers.
                </p>
            </div>
            <div className="ui-title-bottom">
                <div className="ui-panel rs-border rs-background ui-title-menu">
                    <button
                        className="ui-button ui-button-big"
                        onClick={() => client.showScreen("characters")}
                    >
                        Start
                    </button>
                    <button
                        className="ui-button ui-button-big"
                        style={{ borderColor: "#e5b839", color: "#ffff00" }}
                        onClick={() => (window as any).multiplayer?.openLobbyModal()}
                    >
                        Co-Op Multiplayer
                    </button>
                    <button
                        className="ui-button ui-button-big"
                        onClick={() => client.showScreen("shop")}
                    >
                        Skills
                    </button>
                    <button
                        className="ui-button ui-button-big"
                        onClick={() => client.showScreen("armoury")}
                    >
                        Armoury
                    </button>
                    <button
                        className="ui-button ui-button-big"
                        onClick={() => client.showScreen("quests")}
                    >
                        Slayer Tasks
                    </button>
                    <button
                        className="ui-button ui-button-big"
                        onClick={() => client.showScreen("leaderboard" as any)}
                    >
                        Leaderboard
                    </button>
                    <button
                        className="ui-button ui-button-big"
                        onClick={() => client.showScreen("collectionLog")}
                    >
                        Collection log
                    </button>
                    <button
                        className="ui-button ui-button-big"
                        onClick={() => setSettingsOpen(true)}
                    >
                        Settings
                    </button>
                    <div className="ui-title-stats">
                        <Coins amount={save.coins} />
                        <div>
                            Runs {save.runs} · Wins {save.victories} · Best{" "}
                            {formatTime(save.bestSeconds)} · Best level {save.bestLevel}
                        </div>
                    </div>
                </div>
                <div className="ui-hint">
                    WASD to move · weapons fire on their own · Esc to pause · M to mute
                </div>
            </div>
            <DiscordLink />
            <button className="ui-version" onClick={() => setChangelogOpen(true)}>
                v{GAME_VERSION} · What's new
            </button>
            {notice && <NoticePanel notice={notice} onClose={closeNotice} />}
        </div>
    );
}

const STYLE_NAMES: Record<CombatStyle, string> = {
    melee: "Melee",
    ranged: "Ranged",
    magic: "Magic",
};

const STYLES: CombatStyle[] = ["melee", "ranged", "magic"];

// The Very rare weapon only this class can find
function getClassTreasure(style: CombatStyle) {
    return WEAPONS.find((w) => w.style === style && w.rarity === "veryRare");
}

function getStartingWeaponIcon(character: CharacterDef): number {
    const weapon = getWeapon(character.startingWeapon);
    return weapon.levels[0].objId ?? weapon.iconObjId;
}

// Step 1: Pick an adventurer (left panel: adventurer grid, right panel:
// adventurer & starting weapon details). Step 2: Pick a map (left panel:
// campaign & fun maps list, right panel: map details & unlock tasks), with the
// 3D character standing in view between the panels on both screens.
function CharacterScreen({ ui, client }: ScreenProps): JSX.Element {
    const [step, setStep] = useState<"adventurer" | "map">("adventurer");
    const [peekChar, setPeekChar] = useState<string>();
    const [peekMap, setPeekMap] = useState<string>();
    const activeChar = getCharacter(peekChar ?? ui.characterId);
    const activeMap = getMap(peekMap ?? ui.mapId);
    const selectedChar = getCharacter(ui.characterId);

    if (step === "adventurer") {
        return (
            <div className="ui-fill ui-select">
                <AdventurerPanel
                    ui={ui}
                    client={client}
                    onPeek={setPeekChar}
                />
                <AdventurerDetailsPanel save={ui.save} character={activeChar} />
                <div className="ui-panel rs-border rs-background ui-select-bar">
                    <button className="ui-button" onClick={() => client.showScreen("title")}>
                        Back
                    </button>
                    <Coins amount={ui.save.coins} />
                    <button
                        className="ui-button ui-button-go ui-select-go"
                        onClick={() => {
                            setPeekChar(undefined);
                            setStep("map");
                        }}
                    >
                        Select Map: {selectedChar.name} &rarr;
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ui-fill ui-select">
            <MapPanel ui={ui} client={client} onPeek={setPeekMap} />
            <MapDetailsPanel
                save={ui.save}
                map={activeMap}
                character={selectedChar}
                onBackToAdventurer={() => {
                    setPeekMap(undefined);
                    setStep("adventurer");
                }}
            />
            <div className="ui-panel rs-border rs-background ui-select-bar">
                <button
                    className="ui-button"
                    onClick={() => {
                        setPeekMap(undefined);
                        setStep("adventurer");
                    }}
                >
                    &larr; Adventurer ({selectedChar.name})
                </button>
                <Coins amount={ui.save.coins} />
                <EndlessSwitch ui={ui} client={client} />
                <button
                    className="ui-button ui-button-go ui-select-go"
                    onClick={() => client.startRun()}
                >
                    Enter {getMap(ui.mapId).name}
                    {ui.endless && !getMap(ui.mapId).fun && " endless"}
                </button>
            </div>
        </div>
    );
}

// Endless runs for the map picked, once it's been beaten (fun maps are
// always endless)
function EndlessSwitch({ ui, client }: ScreenProps): JSX.Element {
    if (getMap(ui.mapId).fun) {
        return (
            <div
                className="ui-endless"
                title="Fun maps are endless: a new round every fifteen minutes."
            >
                <span className="ui-endless-name">Endless</span>
                <span className="ui-endless-hint">Always</span>
            </div>
        );
    }
    const open = isEndlessUnlocked(ui.save, ui.mapId);
    return (
        <div
            className={"ui-endless" + (open ? "" : " ui-endless-locked")}
            title={
                open
                    ? "Round after round, each tougher than the last, until you fall. " +
                      "Your weapons, passives and gear keep getting stronger too."
                    : `Beat ${getMap(ui.mapId).name} to play it endless`
            }
        >
            <span className="ui-endless-name">Endless</span>
            {open ? (
                <Toggle on={ui.endless} label="Endless" onToggle={() => client.toggleEndless()} />
            ) : (
                <span className="ui-endless-hint">Beat the map</span>
            )}
        </div>
    );
}

// Adventurers by how they fight, each a tile of their outfit with the weapon
// they start with in its corner. The details pinned below are for the one
// pointed at (or tapped, so a locked one can say what it takes) until the
// pointer leaves the panel, then the one picked. Only moving the pointer
// changes it: the list scrolling under a still pointer doesn't.
function AdventurerPanel({
    ui,
    client,
    onPeek,
}: ScreenProps & { onPeek: (id: string | undefined) => void }): JSX.Element {
    const unlocked = ui.save.unlockedCharacters;
    const vChars = CHARACTERS.filter(
        (c) => !isSpecialCharacter(c.id) || unlocked.includes(c.id),
    );
    const specialChars = vChars.filter((c) => isSpecialCharacter(c.id));
    const opened = vChars.filter((c) => unlocked.includes(c.id)).length;
    const renderTile = (character: CharacterDef) => {
        const selected = character.id === ui.characterId;
        const iconObjId = (character as any).iconObjId;
        return (
            <button
                key={character.id}
                className={
                    "ui-card ui-tile" +
                    (selected ? " ui-card-selected" : "") +
                    (unlocked.includes(character.id) ? "" : " ui-card-locked")
                }
                aria-label={character.name}
                aria-pressed={selected}
                onMouseMove={() => onPeek(character.id)}
                onFocus={() => onPeek(character.id)}
                onBlur={() => onPeek(undefined)}
                onClick={() => client.selectCharacter(character.id)}
            >
                <ItemIcon
                    objId={
                        iconObjId ??
                        character.equipment[EquipSlot.TORSO] ??
                        getStartingWeaponIcon(character)
                    }
                    size={34}
                />
                {!iconObjId && (
                    <span className="ui-tile-badge">
                        <ItemIcon objId={getStartingWeaponIcon(character)} size={18} />
                    </span>
                )}
            </button>
        );
    };
    return (
        <div
            className="ui-panel rs-border rs-background ui-select-panel ui-select-adventurers"
            onMouseLeave={() => onPeek(undefined)}
        >
            <h2 className="ui-select-heading">
                Adventurer
                <span className="ui-select-count">
                    {opened} / {vChars.length}
                </span>
            </h2>
            <div className="ui-select-scroll">
                {STYLES.map((style) => {
                    const treasure = getClassTreasure(style);
                    return (
                        <div key={style} className="ui-style-group">
                            <div className="ui-style-name">
                                {STYLE_NAMES[style]}
                                {treasure && (
                                    <span className="ui-style-treasure">
                                        might find the{" "}
                                        <span style={{ color: RARITIES.veryRare.color }}>
                                            {treasure.name}
                                        </span>
                                    </span>
                                )}
                            </div>
                            <div className="ui-tiles">
                                {vChars
                                    .filter((c) => c.style === style && !isSpecialCharacter(c.id))
                                    .map(renderTile)}
                            </div>
                        </div>
                    );
                })}
                {specialChars.length > 0 && (
                    <div key="special" className="ui-style-group">
                        <div className="ui-style-name">Special</div>
                        <div className="ui-tiles">{specialChars.map(renderTile)}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AdventurerDetailsPanel({
    save,
    character,
}: {
    save: SaveData;
    character: CharacterDef;
}): JSX.Element {
    const unlocked = save.unlockedCharacters.includes(character.id);
    const weapon = getWeapon(character.startingWeapon);
    return (
        <div className="ui-panel rs-border rs-background ui-select-panel ui-select-details-panel">
            <h2 className="ui-select-heading">
                Details
                <span className="ui-select-count">
                    {isSpecialCharacter(character.id) ? "Special" : STYLE_NAMES[character.style]}
                </span>
            </h2>
            <div className="ui-select-details">
                <div className="ui-select-details-head">
                    <ItemIcon
                        objId={(character as any).iconObjId ?? getStartingWeaponIcon(character)}
                        size={36}
                    />
                    <div>
                        <div className="ui-card-title">{character.name}</div>
                        <div className="ui-card-style">
                            {isSpecialCharacter(character.id)
                                ? "Special"
                                : STYLE_NAMES[character.style]}
                        </div>
                    </div>
                </div>
                <div className="ui-card-text">{character.description}</div>
                {!unlocked && character.unlock && (
                    <div className="ui-card-cost">
                        {describeUnlockTask(character.unlock)} to unlock
                    </div>
                )}
            </div>
            <div className="ui-select-details">
                <div className="ui-select-details-head">
                    <ItemIcon objId={getStartingWeaponIcon(character)} size={32} />
                    <div>
                        <div className="ui-card-title">
                            {weapon.levels[0].name ?? weapon.name}
                        </div>
                        <div className="ui-card-style">Starting weapon</div>
                    </div>
                </div>
                <div className="ui-card-text">{weapon.description}</div>
                <ChoiceStats stats={weaponStats(weapon, weapon.levels[0])} />
            </div>
        </div>
    );
}

// The maps in the order they open, two to a row, the campaign's and then the
// fun ones, with details shown in the right-hand panel so the map list height
// never changes when hovering different maps.
function MapPanel({
    ui,
    client,
    onPeek,
}: ScreenProps & { onPeek: (id: string | undefined) => void }): JSX.Element {
    const save = ui.save;
    const beaten = MAPS.filter((m) => (save.mapVictories[m.id] ?? 0) > 0).length;
    const tile = (map: MapDef) => {
        const selected = map.id === ui.mapId;
        return (
            <button
                key={map.id}
                className={
                    "ui-card ui-map-tile" +
                    (selected ? " ui-card-selected" : "") +
                    (isMapUnlocked(save, map.id) ? "" : " ui-card-locked")
                }
                aria-pressed={selected}
                onMouseMove={() => onPeek(map.id)}
                onFocus={() => onPeek(map.id)}
                onBlur={() => onPeek(undefined)}
                onClick={() => client.selectMap(map.id)}
            >
                <ItemIcon objId={map.iconObjId} size={20} />
                <span className="ui-map-name">{map.name}</span>
                {(save.mapVictories[map.id] ?? 0) > 0 && (
                    <span className="ui-beaten" aria-label="Beaten" />
                )}
            </button>
        );
    };
    return (
        <div
            className="ui-panel rs-border rs-background ui-select-panel ui-select-adventurers"
            onMouseLeave={() => onPeek(undefined)}
        >
            <h2 className="ui-select-heading">
                Map
                <span className="ui-select-count">
                    {beaten} / {MAPS.length} beaten
                </span>
            </h2>
            <div className="ui-select-scroll">
                <div className="ui-style-group">
                    <div className="ui-style-name">Campaign</div>
                    <div className="ui-map-list">{MAPS.map(tile)}</div>
                </div>
                <div className="ui-style-group">
                    <div className="ui-style-name">
                        Fun maps
                        <span className="ui-style-treasure">endless, open from the start</span>
                    </div>
                    <div className="ui-map-list">{FUN_MAPS.map(tile)}</div>
                </div>
            </div>
        </div>
    );
}

function MapDetailsPanel({
    save,
    map,
    character,
    onBackToAdventurer,
}: {
    save: SaveData;
    map: MapDef;
    character: CharacterDef;
    onBackToAdventurer: () => void;
}): JSX.Element {
    return (
        <div className="ui-panel rs-border rs-background ui-select-panel ui-select-details-panel">
            <h2 className="ui-select-heading">
                Map Info
                <button
                    type="button"
                    className="ui-select-count"
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "#ff981f",
                        fontFamily: "inherit",
                    }}
                    onClick={onBackToAdventurer}
                >
                    Adventurer: {character.name} (change)
                </button>
            </h2>
            <div className="ui-select-scroll">
                <MapDetails save={save} map={map} />
            </div>
        </div>
    );
}

function MapDetails({ save, map }: { save: SaveData; map: MapDef }): JSX.Element {
    const wins = save.mapVictories[map.id] ?? 0;
    const unlocked = isMapUnlocked(save, map.id);
    const endless = save.endlessBest[map.id];
    const mapPoints = calculateLevelPoints(save, map.id);
    const mb = (save as any).mapBest?.[map.id];
    const bestKills = mb?.kills ?? 0;
    return (
        <div className="ui-select-details">
            <div className="ui-select-details-head">
                <ItemIcon objId={map.iconObjId} size={36} />
                <div>
                    <div className="ui-card-title">{map.name}</div>
                    <div className={unlocked ? "ui-card-style" : "ui-card-cost"}>
                        {map.fun
                            ? map.fun.character
                                ? `Fun map, endless. You play as ${getCharacter(map.fun.character).name}.`
                                : "Fun map, endless"
                            : !unlocked
                              ? `Beat ${MAPS[MAPS.indexOf(map) - 1].name} to unlock`
                              : wins > 0
                                ? `Beaten ${wins === 1 ? "once" : `${wins} times`}`
                                : "Not beaten yet"}
                    </div>
                    {mapPoints > 0 && (
                        <div className="ui-card-style" style={{ color: "#ffff00" }}>
                            Top score: {mapPoints.toLocaleString()} pts
                            {bestKills > 0 ? ` · Best kills: ${bestKills.toLocaleString()}` : ""}
                        </div>
                    )}
                    {(((save as any).mapBest?.[map.id]?.seconds ?? 0) > 0 ||
                        endless ||
                        wins > 0) && (
                        <div className="ui-card-style">
                            Best time:{" "}
                            {formatTime(
                                Math.max(
                                    (save as any).mapBest?.[map.id]?.seconds ?? 0,
                                    endless?.seconds ?? 0,
                                    wins > 0
                                        ? (map.events?.find((ev) => ev.kind === "finalBoss")?.at ??
                                              900)
                                        : 0,
                                ),
                            )}
                            {(save as any).mapBest?.[map.id]?.winSeconds > 0
                                ? ` · Fastest clear: ${formatTime((save as any).mapBest[map.id].winSeconds)}`
                                : ""}
                        </div>
                    )}
                    {endless && (
                        <div className="ui-card-style">
                            Endless best: round {endless.round}, {formatTime(endless.seconds)}
                        </div>
                    )}
                </div>
            </div>
            <div className="ui-card-text">{map.description}</div>
            <MapTasks save={save} mapId={map.id} />
        </div>
    );
}

// What a map's tasks bring in, task by task: adventurers (by the weapon they
// start with) and items, faded until they're earned
function MapTasks({ save, mapId }: { save: SaveData; mapId: string }): JSX.Element {
    const earned = (reward: MapReward) =>
        reward.kind === "character"
            ? save.unlockedCharacters.includes(reward.id)
            : save.unlockedItems.includes(reward.id);
    const tasks = new Map<string, MapReward[]>();
    for (const reward of getMapRewards(mapId)) {
        const task = describeUnlockTask(reward.unlock, false);
        tasks.set(task, [...(tasks.get(task) ?? []), reward]);
    }
    return (
        <div className="ui-tasks">
            {[...tasks].map(([task, rewards]) => (
                <div
                    key={task}
                    className={"ui-task" + (rewards.every(earned) ? " ui-task-done" : "")}
                >
                    <span className="ui-task-name">{task}:</span>
                    {rewards.map((reward) => (
                        <span
                            key={reward.kind + reward.id}
                            className={"ui-reward" + (earned(reward) ? "" : " ui-reward-locked")}
                        >
                            <ItemIcon objId={reward.iconObjId} size={20} />
                            {reward.name}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

function ShopScreen({ ui, client }: ScreenProps): JSX.Element {
    const save = ui.save;
    return (
        <div className="ui-fill ui-center">
            <div className="ui-panel rs-border rs-background ui-shop">
                <h2>Skills</h2>
                <p className="ui-subtle">Coins found in runs train your skills for good.</p>
                <div className="ui-shop-grid">
                    {SHOP_UPGRADES.map((upgrade) => {
                        const rank = save.upgrades[upgrade.id] ?? 0;
                        const cost = getNextUpgradeCost(save, upgrade.id);
                        const affordable = cost !== undefined && save.coins >= cost;
                        return (
                            <button
                                key={upgrade.id}
                                className={
                                    "ui-card ui-shop-card" + (affordable ? "" : " ui-card-dim")
                                }
                                disabled={cost === undefined}
                                onClick={() => client.buyUpgrade(upgrade.id)}
                            >
                                <div className="ui-card-title">{upgrade.name}</div>
                                <div className="ui-card-text">{upgrade.description}</div>
                                <div className="ui-pips">
                                    {Array.from({ length: upgrade.maxRank }, (_, i) => (
                                        <span
                                            key={i}
                                            className={i < rank ? "ui-pip ui-pip-on" : "ui-pip"}
                                        />
                                    ))}
                                </div>
                                <div className="ui-card-cost">
                                    {cost === undefined ? "Maxed" : <Coins amount={cost} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="ui-row">
                    <button className="ui-button" onClick={() => client.showScreen("title")}>
                        Back
                    </button>
                    <Coins amount={save.coins} />
                    <button
                        className="ui-button"
                        disabled={save.upgradesSpent === 0}
                        onClick={() => client.refundUpgrades()}
                    >
                        Refund all
                    </button>
                </div>
            </div>
        </div>
    );
}

function RunScreen({ ui, client }: ScreenProps): JSX.Element {
    const hud = ui.hud;
    return (
        <div className="ui-fill ui-run">
            {hud && <Hud hud={hud} client={client} questTracker={ui.display.questTracker} />}
            <div className="ui-toasts">
                {ui.toasts.map((toast) => (
                    <div key={toast.id} className="ui-toast">
                        {toast.text}
                    </div>
                ))}
            </div>
            {ui.overlay === "levelUp" && <LevelUpModal ui={ui} client={client} />}
            {ui.overlay === "chest" && ui.chest && (
                <ChestModal
                    key={ui.chest.uid}
                    chest={ui.chest}
                    rerolls={hud?.rerolls ?? 0}
                    client={client}
                />
            )}
            {ui.overlay === "paused" && hud && <PauseModal ui={ui} hud={hud} client={client} />}
            {(ui.overlay === "dead" || ui.overlay === "victory") && (
                <ResultModal ui={ui} client={client} />
            )}
        </div>
    );
}

// "3", "max", and past the last level (endless runs) "+2"
function formatSlotLevel(slot: SlotView): string {
    if (slot.level > slot.maxLevel) {
        return `+${slot.level - slot.maxLevel}`;
    }
    return slot.level === slot.maxLevel ? "max" : String(slot.level);
}

// A weapon or passive in the HUD, with what it does on a card shown while
// it's pointed at
function Slots({ slots, max }: { slots: SlotView[]; max: number }): JSX.Element {
    return (
        <div className="ui-slots">
            {Array.from({ length: max }, (_, i) => {
                const slot = slots[i];
                return (
                    <div
                        key={i}
                        className={"ui-slot" + (slot?.evolution?.ready ? " ui-slot-evolve" : "")}
                        style={slot ? { borderColor: slot.rarityColor } : undefined}
                    >
                        {slot && (
                            <>
                                <ItemIcon
                                    objId={slot.iconObjId}
                                    spriteId={slot.iconSpriteId}
                                    size={30}
                                />
                                <span className="ui-slot-level">{formatSlotLevel(slot)}</span>
                                <div className="ui-slot-tip rs-border rs-background">
                                    <div style={{ color: slot.rarityColor }}>{slot.name}</div>
                                    <div className="ui-slot-tip-level">
                                        {slot.level >= slot.maxLevel
                                            ? "Max level"
                                            : `Level ${slot.level} of ${slot.maxLevel}`}
                                    </div>
                                    {slot.stats?.map((line) => (
                                        <div key={line}>{line}</div>
                                    ))}
                                    {slot.detail && <div>{slot.detail}</div>}
                                    {slot.evolution && <EvolutionLine {...slot.evolution} />}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// How far a weapon has got towards its evolution, each half ticked off
function EvolutionLine({
    passive,
    maxed,
    hasPassive,
    ready,
}: NonNullable<SlotView["evolution"]>): JSX.Element {
    return ready ? (
        <div className="ui-evolve-ready">Ready to evolve</div>
    ) : (
        <div className="ui-evolve-line">
            Evolves with:{" "}
            <span className={maxed ? "ui-evolve-done" : undefined}>
                {maxed ? "✓" : "✗"} Max level
            </span>
            ,{" "}
            <span className={hasPassive ? "ui-evolve-done" : undefined}>
                {hasPassive ? "✓" : "✗"} {passive}
            </span>
        </div>
    );
}

// Worn gear, small, under the weapons and passives
function GearSlots({ gear }: { gear: GearSlotView[] }): JSX.Element {
    return (
        <div className="ui-slots ui-gear-slots">
            {gear.map((slot) => (
                <div
                    key={slot.slot}
                    className="ui-slot ui-gear-slot"
                    style={slot.item ? { borderColor: slot.item.rarity.color } : undefined}
                    title={
                        slot.item
                            ? `${slot.item.name}: ${slot.item.lines.join(", ")}` +
                              (slot.item.set ? `\n${slot.item.set.text}` : "")
                            : `${slot.name} (empty)`
                    }
                >
                    {slot.item ? (
                        <ItemIcon objId={slot.item.objId} size={22} />
                    ) : (
                        <span className="ui-gear-empty">{slot.name[0]}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

// Utility items, used with 1-4 or a click
function Inventory({
    inventory,
    client,
}: {
    inventory: InventorySlotView[];
    client: GameClient;
}): JSX.Element {
    return (
        <div className="ui-inventory">
            {inventory.map((slot, i) => (
                <button
                    key={i}
                    data-silent
                    className="ui-inv-slot"
                    style={slot ? { borderColor: slot.item.rarity.color } : undefined}
                    disabled={!slot}
                    title={slot ? `${slot.item.name}: ${slot.item.lines.join(" ")}` : ""}
                    // Keep focus on the game, so Space doesn't press it again
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => client.useItem(i)}
                >
                    <span className="ui-inv-key">{i + 1}</span>
                    {slot && <ItemIcon objId={slot.item.objId} size={30} />}
                    {slot && slot.count > 1 && <span className="ui-inv-count">{slot.count}</span>}
                </button>
            ))}
        </div>
    );
}

function Buffs({ buffs }: { buffs: BuffView[] }): JSX.Element {
    return (
        <div className="ui-buffs">
            {buffs.map((buff) => (
                <div
                    key={buff.id}
                    className={buff.harmful ? "ui-buff ui-buff-harmful" : "ui-buff"}
                    title={buff.name}
                >
                    <ItemIcon objId={buff.objId} size={24} />
                    <span>{buff.secondsLeft}s</span>
                    <div className="ui-buff-bar" style={{ width: `${buff.fraction * 100}%` }} />
                </div>
            ))}
        </div>
    );
}

function Hud({
    hud,
    client,
    questTracker,
}: {
    hud: HudView;
    client: GameClient;
    questTracker: boolean;
}): JSX.Element {
    const bossIn = hud.bossIn;
    return (
        <>
            <div className="ui-xp">
                <div className="ui-xp-fill" style={{ width: `${hud.xpFraction * 100}%` }} />
                <span className="ui-xp-level">Level {hud.level}</span>
            </div>
            <div className="ui-hud-top">
                <div className="ui-hud-left">
                    <Slots slots={hud.weapons} max={hud.maxWeapons} />
                    <Slots slots={hud.passives} max={hud.maxPassives} />
                    <GearSlots gear={hud.gear} />
                </div>
                <div className="ui-timer">{formatTime(hud.seconds)}</div>
                <div className="ui-hud-right">
                    <Minimap client={client} />
                    <div>
                        <span className="ui-skull">☠</span> {hud.kills.toLocaleString()}
                    </div>
                    <Coins amount={hud.coins} />
                    {hud.round !== undefined && <div className="ui-round">Round {hud.round}</div>}
                    {hud.quests.length > 0 && (
                        <QuestTracker quests={hud.quests} open={questTracker} client={client} />
                    )}
                </div>
            </div>
            {hud.boss ? (
                <div className="ui-boss">
                    <div className="ui-boss-name">
                        {hud.boss.name}
                        {hud.boss.enraged && <span className="ui-boss-enraged"> (enraged)</span>}
                    </div>
                    <div className="ui-boss-bar">
                        <div
                            className="ui-boss-fill"
                            style={{ width: `${hud.boss.fraction * 100}%` }}
                        />
                    </div>
                </div>
            ) : (
                bossIn <= 60 && (
                    <div className="ui-boss-warning">
                        {getMap(hud.mapId).finalBossWarning} {Math.ceil(bossIn)}s
                    </div>
                )
            )}
            <div className="ui-hud-bottom">
                {hud.buffs.length > 0 && <Buffs buffs={hud.buffs} />}
                <Inventory inventory={hud.inventory} client={client} />
                <div className={hud.poisoned ? "ui-hp ui-hp-poisoned" : "ui-hp"}>
                    <div
                        className="ui-hp-fill"
                        style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
                    />
                    <span>
                        {hud.hp} / {hud.maxHp}
                    </span>
                </div>
            </div>
        </>
    );
}

// The client's minimap frame and compass around a canvas the game draws on
// (runs face north, so the compass does too)
function Minimap({ client }: { client: GameClient }): JSX.Element {
    const canvasRef = useCallback(
        (canvas: HTMLCanvasElement | null) => client.setMinimapCanvas(canvas),
        [client],
    );
    return (
        <div className="ui-minimap">
            <canvas className="ui-minimap-map" ref={canvasRef} />
            <img className="ui-minimap-frame" src={minimapFrame} />
            <img className="ui-minimap-compass" src={compass} />
        </div>
    );
}

// A weapon's stats on a level up card: "Damage 10 → 13", the new value green
// when it's better
function ChoiceStats({ stats }: { stats: WeaponStatLine[] }): JSX.Element {
    return (
        <div className="ui-choice-stats">
            {stats.map((line) => (
                <span key={line.label} className="ui-choice-stat">
                    <span className="ui-choice-stat-label">{line.label}</span>{" "}
                    {line.from !== undefined && <>{line.from} → </>}
                    <span
                        className={
                            line.from === undefined
                                ? undefined
                                : line.better
                                  ? "ui-choice-stat-up"
                                  : "ui-choice-stat-down"
                        }
                    >
                        {line.value}
                    </span>
                </span>
            ))}
        </div>
    );
}

function LevelUpModal({ ui, client }: ScreenProps): JSX.Element {
    // The godsword's hilt is picked as the rest of the level up that took it
    // to its hilt level
    const hilt = ui.choices.some((choice) => choice.isHilt);
    return (
        <div className="ui-modal">
            <div className="ui-panel rs-border rs-background ui-levelup">
                <h2>
                    {hilt
                        ? "Your godsword needs a hilt!"
                        : "Congratulations, you've advanced a level!"}
                </h2>
                <p className="ui-subtle">
                    {hilt
                        ? "Pick the god whose hilt it takes, and with it its special attack:"
                        : `You are now level ${ui.hud?.level}. Choose a reward:`}
                </p>
                <div className="ui-choices">
                    {ui.choices.map((choice, i) => (
                        <button
                            key={i}
                            className={
                                "ui-card ui-choice" +
                                (choice.isEvolution ? " ui-choice-evolve" : "")
                            }
                            style={choice.rarity ? { borderColor: choice.rarity.color } : undefined}
                            onClick={() => client.choose(i)}
                        >
                            <span className="ui-choice-key">{i + 1}</span>
                            <ItemIcon
                                objId={choice.iconObjId}
                                spriteId={choice.iconSpriteId}
                                size={44}
                            />
                            <div className="ui-card-body">
                                <div className="ui-card-title">
                                    {choice.title}
                                    {choice.isNew && <span className="ui-tag">New!</span>}
                                    {choice.isEvolution && (
                                        <span className="ui-tag ui-tag-evolve">Evolution!</span>
                                    )}
                                    {choice.isHilt && (
                                        <span className="ui-tag ui-tag-evolve">Hilt</span>
                                    )}
                                </div>
                                <div className="ui-card-text">{choice.text}</div>
                                {choice.evolves && (
                                    <div
                                        className={
                                            "ui-card-evolves" +
                                            (choice.evolves.held ? " ui-card-evolves-held" : "")
                                        }
                                    >
                                        {choice.evolves.text}
                                    </div>
                                )}
                                {choice.stats && choice.stats.length > 0 && (
                                    <ChoiceStats stats={choice.stats} />
                                )}
                            </div>
                            {choice.rarity && (
                                <span className="ui-rarity" style={{ color: choice.rarity.color }}>
                                    {choice.rarity.name}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                {!hilt && (
                    <div className="ui-levelup-actions">
                        <RerollButton
                            rerolls={ui.hud?.rerolls ?? 0}
                            onReroll={() => client.reroll()}
                        />
                        {ui.hud?.skip && (
                            <SkipButton
                                cost={ui.hud.skip.cost}
                                affordable={ui.hud.skip.affordable}
                                onSkip={() => client.skip()}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// The quests this run is getting on with, under the minimap: click the title
// (or press Q) to fold it away
function QuestTracker({
    quests,
    open,
    client,
}: {
    quests: QuestTrackView[];
    open: boolean;
    client: GameClient;
}): JSX.Element {
    return (
        <div className="ui-quest-tracker">
            <button
                className="ui-quest-tracker-title"
                onClick={() => client.toggleQuestTracker()}
                title="Show or hide slayer tasks (Q)"
            >
                Slayer Tasks {open ? "▾" : "▸"}
            </button>
            {open &&
                quests.map((quest) => (
                    <div
                        key={quest.id}
                        className={"ui-quest-track " + questTrackClass(quest)}
                        title={quest.task}
                    >
                        <span className="ui-quest-track-name">{quest.name}</span>
                        <span className="ui-quest-track-progress">
                            {formatQuestProgress(quest)}
                        </span>
                    </div>
                ))}
        </div>
    );
}

// Coloured like the quest tab: red until started, yellow while under way,
// green once done
function questTrackClass(quest: QuestTrackView): string {
    return quest.finished ? "ui-quest-done" : quest.done > 0 ? "ui-quest-started" : "ui-quest-new";
}

function formatQuestProgress(quest: QuestTrackView): string {
    return quest.finished
        ? "Done"
        : `${quest.done.toLocaleString()} / ${quest.of.toLocaleString()}`;
}

function PauseModal({
    ui,
    hud,
    client,
}: {
    ui: UiSnapshot;
    hud: HudView;
    client: GameClient;
}): JSX.Element {
    const [hoverInfo, setHoverInfo] = useState<{
        name: string;
        color?: string;
        text: string;
    } | null>(null);
    return (
        <div className="ui-modal">
            <div className="ui-panel rs-border rs-background ui-pause">
                <h2>Paused</h2>
                <div className="ui-pause-columns">
                    <div className="ui-pause-column">
                        <div className="ui-pause-list">
                            {[...hud.weapons, ...hud.passives].map((slot) => (
                                <div
                                    key={slot.id}
                                    className="ui-pause-item"
                                    style={{ cursor: "help" }}
                                    onMouseEnter={() =>
                                        setHoverInfo({
                                            name: slot.name,
                                            color: slot.rarityColor,
                                            text: (slot as any).desc || slot.detail,
                                        })
                                    }
                                    onMouseLeave={() => setHoverInfo(null)}
                                >
                                    <ItemIcon
                                        objId={slot.iconObjId}
                                        spriteId={slot.iconSpriteId}
                                        size={28}
                                    />
                                    {/* The name, and what it does under it */}
                                    <span className="ui-pause-name">
                                        <span style={{ color: slot.rarityColor }}>{slot.name}</span>
                                        <span className="ui-pause-detail">
                                            {[...(slot.stats ?? []), slot.detail]
                                                .filter((text) => text)
                                                .join(", ")}
                                        </span>
                                        {slot.evolution && <EvolutionLine {...slot.evolution} />}
                                    </span>
                                    <span className="ui-pause-level">
                                        {slot.level >= slot.maxLevel
                                            ? "max"
                                            : `level ${slot.level}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {hud.stats.length > 0 && (
                            <>
                                <h3 className="ui-pause-heading">Your stats</h3>
                                <div className="ui-pause-stats">
                                    {hud.stats.map((line) => (
                                        <span key={line}>{line}</span>
                                    ))}
                                </div>
                            </>
                        )}
                        {hud.gear.some((slot) => slot.item) && (
                            <>
                                <h3 className="ui-pause-heading">Worn equipment</h3>
                                <div className="ui-pause-list">
                                    {hud.gear.map(
                                        ({ slot, item }) =>
                                            item && (
                                                <div
                                                    key={slot}
                                                    className="ui-pause-item"
                                                    style={{ cursor: "help" }}
                                                    onMouseEnter={() =>
                                                        setHoverInfo({
                                                            name: `${item.name} (${item.kindLabel})`,
                                                            color: item.rarity.color,
                                                            text: item.lines.join(" · "),
                                                        })
                                                    }
                                                    onMouseLeave={() => setHoverInfo(null)}
                                                >
                                                    <ItemIcon objId={item.objId} size={28} />
                                                    <span style={{ color: item.rarity.color }}>
                                                        {item.name}
                                                    </span>
                                                    <span className="ui-pause-detail">
                                                        {item.lines.join(", ")}
                                                        {item.set && (
                                                            <span
                                                                className={
                                                                    "ui-pause-set" +
                                                                    (item.set.active
                                                                        ? " ui-pause-set-on"
                                                                        : "")
                                                                }
                                                            >
                                                                {item.set.text}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            ),
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="ui-pause-column">
                        {hud.quests.length > 0 && (
                            <>
                                <h3 className="ui-pause-heading">Slayer Tasks</h3>
                                <div className="ui-pause-list">
                                    {hud.quests.map((quest) => (
                                        <div
                                            key={quest.id}
                                            className={"ui-pause-quest " + questTrackClass(quest)}
                                        >
                                            <span className="ui-quest-name">{quest.name}</span>
                                            <span className="ui-pause-detail">{quest.task}</span>
                                            <span className="ui-quest-progress">
                                                {formatQuestProgress(quest)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        <PauseHoverInfoBox hoverInfo={hoverInfo} />
                        <h3 className="ui-pause-heading">Settings</h3>
                        <SoundSettings
                            ui={ui}
                            client={client}
                            music={getMap(ui.mapId).music !== undefined}
                        />
                        <AutoPauseSetting ui={ui} client={client} />
                    </div>
                </div>
                <div className="ui-row">
                    <button className="ui-button" onClick={() => client.quitRun()}>
                        Give up
                    </button>
                    <button className="ui-button ui-button-go" onClick={() => client.resume()}>
                        Resume
                    </button>
                </div>
            </div>
        </div>
    );
}

// "Coif, Rune boots and Seers ring", or the first few "and 5 more"
function listNames(names: string[], most = 3): string {
    if (names.length === 1) {
        return names[0];
    }
    const shown = names.length > most ? names.slice(0, most - 1) : names.slice(0, -1);
    const rest =
        names.length > most ? `${names.length - shown.length} more` : names[names.length - 1];
    return `${shown.join(", ")} and ${rest}`;
}

// Damage a second, with a decimal while it's small
function formatPerSecond(perSecond: number): string {
    return perSecond < 100_000
        ? perSecond.toLocaleString(undefined, { maximumFractionDigits: perSecond < 10 ? 1 : 0 })
        : formatBig(perSecond);
}

// Big numbers the way OSRS shows a stack: in full up to 99,999, then 100K,
// then 10M, so an endless run's totals still fit
function formatBig(value: number): string {
    const n = Math.round(value);
    if (n < 100_000) {
        return n.toLocaleString();
    }
    if (n < 10_000_000) {
        return `${Math.floor(n / 1000).toLocaleString()}K`;
    }
    return `${Math.floor(n / 1_000_000).toLocaleString()}M`;
}

// A stat's number, shortened when it's big, in full when pointed at
function Big({ value }: { value: number }): JSX.Element {
    const n = Math.round(value);
    return <span title={n >= 100_000 ? n.toLocaleString() : undefined}>{formatBig(n)}</span>;
}

function ResultModal({ ui, client }: ScreenProps): JSX.Element {
    const result = ui.result;
    const victory = ui.overlay === "victory";
    return (
        <div className="ui-modal">
            <div className="ui-panel rs-border rs-background ui-result">
                <h2 className={victory ? "ui-victory" : "ui-defeat"}>
                    {victory && result
                        ? getMap(result.mapId).victoryText
                        : "Oh dear, you are dead!"}
                </h2>
                {result?.endlessRecord && (
                    <p className="ui-unlocked">
                        Your furthest endless run in {getMap(result.mapId).name}!
                    </p>
                )}
                {result?.pointsRecord && result.points > 0 && (
                    <p className="ui-unlocked">
                        New high score in {getMap(result.mapId).name}:{" "}
                        {result.points.toLocaleString()} pts!
                    </p>
                )}
                {result?.unlockedMap && (
                    <p className="ui-unlocked">{result.unlockedMap} is open to you now!</p>
                )}
                {result?.unlockedCharacters.map((name) => (
                    <p key={name} className="ui-unlocked">
                        The {name} joins you!
                    </p>
                ))}
                {result?.unlockedItems.map((name) => (
                    <p key={name} className="ui-unlocked">
                        {name} can be found now!
                    </p>
                ))}
                {result && result.newGear.length > 0 && (
                    <p className="ui-unlocked">New in the Armoury: {listNames(result.newGear)}</p>
                )}
                {result?.quests.map((quest) => (
                    <p key={quest.name} className="ui-unlocked">
                        Slayer task complete: {quest.name}! <Coins amount={quest.coins} />
                    </p>
                ))}
                {result && (
                    <div className="ui-result-columns">
                        <div className="ui-result-column">
                            <table className="ui-result-table">
                                <tbody>
                                    <tr>
                                        <td>Adventurer</td>
                                        <td>{result.characterName}</td>
                                    </tr>
                                    {result.endless && (
                                        <tr>
                                            <td>Endless round</td>
                                            <td>{result.round}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td>Survived</td>
                                        <td>{formatTime(result.seconds)}</td>
                                    </tr>
                                    <tr>
                                        <td>Level</td>
                                        <td>{result.level}</td>
                                    </tr>
                                    <tr>
                                        <td>Kills</td>
                                        <td>
                                            <Big value={result.kills} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Biggest hit</td>
                                        <td>
                                            <Big value={result.stats.highestHit} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Damage taken</td>
                                        <td>
                                            <Big value={result.stats.damageTaken} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Hitpoints healed</td>
                                        <td>
                                            <Big value={result.stats.healed} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Caskets opened</td>
                                        <td>{result.caskets}</td>
                                    </tr>
                                    {(result.stats.rerollsUsed > 0 || result.stats.skips > 0) && (
                                        <tr>
                                            <td>Rerolls / skips</td>
                                            <td>
                                                {result.stats.rerollsUsed} / {result.stats.skips}
                                            </td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td>Run points</td>
                                        <td style={{ color: "#ffff00", fontWeight: "bold" }}>
                                            {(result.points ?? 0).toLocaleString()} pts
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Coins banked</td>
                                        <td>
                                            <Coins amount={result.coins} />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            {result.bossKills.length > 0 && (
                                <>
                                    <h3 className="ui-pause-heading">Bosses</h3>
                                    <table className="ui-result-table">
                                        <tbody>
                                            {result.bossKills.map((boss, i) => (
                                                <tr key={i}>
                                                    <td>{boss.name}</td>
                                                    <td>{formatTime(boss.seconds)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </div>
                        {result.damage.length > 0 && (
                            <div className="ui-result-column">
                                <table className="ui-result-damage">
                                    <thead>
                                        <tr>
                                            <th />
                                            <th>Damage</th>
                                            <th>Kills</th>
                                            <th>DPS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.damage.map((row, i) => (
                                            <tr key={i}>
                                                <td>
                                                    <span className="ui-result-source">
                                                        {row.iconObjId !== undefined && (
                                                            <ItemIcon
                                                                objId={row.iconObjId}
                                                                spriteId={row.iconSpriteId}
                                                                size={24}
                                                            />
                                                        )}
                                                        <span
                                                            className="ui-result-name"
                                                            style={{ color: row.color }}
                                                            title={row.name}
                                                        >
                                                            {row.name}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td>
                                                    <Big value={row.damage} />
                                                </td>
                                                <td>
                                                    <Big value={row.kills} />
                                                </td>
                                                <td>
                                                    {row.perSecond !== undefined
                                                        ? formatPerSecond(row.perSecond)
                                                        : ""}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                <CoopDamageLeaderboardTable />
                <CoopGameOverButtons client={client} />
            </div>
        </div>
    );
}
