import { ActorAnim, ActorModel } from "../../../mapviewer/webgl/actor/ActorRenderer";
import { Sim } from "../../core/Sim";
import { GameAssets } from "../GameAssets";

export const DOG_ACTOR_SCALE = 1.5;
export const DOG_HEIGHT_OFFSET = 0.11;

export const CAT_SEQS = {
    idle: 317,
    walk: 314,
    run: 2662,
    attack: 315,
    hiss: 316,
    death: 320,
} as const;

export function isDogCharacter(characterId?: string): boolean {
    return characterId === "dipper" || characterId === "elias" || characterId === "nova";
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
    if (characterId === "nova") {
        return assets.get("neite") || assets.getPlayer();
    }
    return assets.getPlayer();
}

export function getPetCharacterAnim(
    model: ActorModel,
    characterId: string | undefined,
    player: {
        moving: boolean;
        moveStart: number;
        attackSeq: number;
        attackStart: number;
        deathTick: number;
    },
    tick: number,
    maxDeathTicks = 35,
): { anim: ActorAnim | undefined; frame: number } {
    if (characterId === "nova") {
        if (player.deathTick !== -1) {
            const deathAnim = model.getAnim(CAT_SEQS.death) || model.anims[0];
            return {
                anim: deathAnim,
                frame: deathAnim
                    ? deathAnim.getFrame(Math.min(tick - player.deathTick, maxDeathTicks), false)
                    : 0,
            };
        }
        if (player.attackSeq !== -1 && tick >= player.attackStart) {
            const attackAnim = model.getAnim(CAT_SEQS.attack) || model.getAnim(CAT_SEQS.hiss);
            if (attackAnim && tick - player.attackStart < attackAnim.totalTicks) {
                return {
                    anim: attackAnim,
                    frame: attackAnim.getFrame(tick - player.attackStart, false),
                };
            }
        }
        const moveOrIdle = player.moving
            ? model.getAnim(CAT_SEQS.run) || model.getAnim(CAT_SEQS.walk) || model.anims[0]
            : model.getAnim(CAT_SEQS.idle) || model.anims[0];
        return {
            anim: moveOrIdle,
            frame: moveOrIdle ? moveOrIdle.getFrame(tick - player.moveStart) : 0,
        };
    }
    const anim = player.moving
        ? model.getAnim(6560) || model.getAnim(CAT_SEQS.walk) || model.anims[0]
        : model.getAnim(6561) || model.getAnim(CAT_SEQS.idle) || model.anims[0];
    return {
        anim,
        frame: anim ? anim.getFrame(tick - player.moveStart) : 0,
    };
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
