import type { GameClient } from "../client/GameClient";

export interface MultiplayerBridge {
    gameStarted?: boolean;
    spectating?: boolean;
    isHost?: boolean;
    localId?: string | null;
    roomCode?: string | null;
    gameConfig?: {
        seed?: number;
        endless?: boolean;
        mapId?: string;
        upgrades?: Record<string, number>;
        unlockedItems?: string[];
        armoury?: Record<string, number>;
        [key: string]: any;
    } | null;
    players?: Map<string, any> | Record<string, any>;
    remotePlayers?: Map<string, any> | Record<string, any>;
    lastLeaderboard?: any[] | null;
    sendLobbyUpdate?: () => void;
    updateLobbyUI?: () => void;
    onLocalDeath?: () => void;
    onRunEnded?: (result?: any) => void;
    shouldAllowPause?: () => boolean;
    getAliveTargetPositions?: (sim: any) => Array<{ x: number; y: number }>;
    drawRemotePlayers2D?: (overlay: any, sim: any, alpha: number) => void;
    submitRemotePlayers3D?: (actors: any, sim: any, alpha: number) => void;
    drawMinimapDots?: (ctx: CanvasRenderingContext2D, sim: any, toMap: (x: number, y: number) => [number, number]) => void;
    [key: string]: any;
}

export interface OsrsPrayerBridge {
    active: "magic" | "ranged" | "melee" | null;
    setPrayer?: (p: string | null) => void;
    reset?: () => void;
    [key: string]: any;
}

declare global {
    interface Window {
        gameClient?: GameClient;
        multiplayer?: MultiplayerBridge;
        _osrsPrayer?: OsrsPrayerBridge;
        _drawOsrsPrayerOverlay?: (...args: any[]) => void;
        _hideOsrsPrayerBar?: () => void;
        _cooksAssistant?: Record<string, any>;
    }
}
