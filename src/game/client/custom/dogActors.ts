import { ActorModel } from "../../../mapviewer/webgl/actor/ActorRenderer";
import { Sim } from "../../core/Sim";
import { GameAssets } from "../GameAssets";

export const DOG_ACTOR_SCALE = 1.5;
export const DOG_HEIGHT_OFFSET = 0.11;

export function isDogCharacter(characterId?: string): boolean {
    return characterId === "dipper" || characterId === "elias";
}

export function getPlayerOrDogModel(
    assets: GameAssets,
    characterId?: string,
): ActorModel | undefined {
    if (characterId === "dipper") {
        return assets.get("corgi") || assets.getPlayer();
    }
    if (characterId === "elias") {
        return assets.get("chihuahua") || assets.getPlayer();
    }
    return assets.getPlayer();
}

export function resolveCoopEventPlayer(
    sim: Sim,
    event: { slot?: number; x?: number; y?: number },
    matchByPosition?: boolean,
): { x: number; y: number; prevX: number; prevY: number } {
    const mp = (window as any).multiplayer;
    if (mp?.gameStarted) {
        if (event.slot && event.slot !== mp.localSlot) {
            return mp.remotePeers?.get(event.slot)?.entity || sim.player;
        }
        if (
            matchByPosition &&
            mp.remotePeers &&
            event.x !== undefined &&
            event.y !== undefined &&
            Math.hypot(event.x - sim.player.x, event.y - sim.player.y) > 0.05
        ) {
            for (const peer of mp.remotePeers.values()) {
                if (
                    peer.entity &&
                    Math.hypot(event.x - peer.entity.x, event.y - peer.entity.y) <= 0.5
                ) {
                    return peer.entity;
                }
            }
        }
    }
    return sim.player;
}
