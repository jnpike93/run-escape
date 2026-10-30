import type { Sim } from "../Sim";
import type { Pickup } from "../entities";
import { isCircleFree } from "../world/Collision";

export function isBlockedByStationaryEnemy(
    sim: Sim,
    x: number,
    y: number,
    playerRadius: number,
): boolean {
    for (const enemy of sim.enemies) {
        if (
            !enemy.dead &&
            enemy.def.stationary &&
            Math.hypot(x - enemy.x, y - enemy.y) < enemy.radius + playerRadius
        ) {
            return true;
        }
    }
    return false;
}

export function isPickupSpotReachable(
    sim: Sim,
    x: number,
    y: number,
    playerRadius: number,
): boolean {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    if (!sim.grid.contains(tileX, tileY) || sim.grid.isSolid(tileX, tileY)) {
        return false;
    }
    const playerPiece = sim.grid.getPiece(sim.flowField.targetX, sim.flowField.targetY);
    if (playerPiece >= 0 && sim.grid.getPiece(tileX, tileY) !== playerPiece) {
        return false;
    }
    if (sim.flowField.contains(tileX, tileY) && !sim.flowField.isReachable(tileX, tileY)) {
        return false;
    }
    if (!isCircleFree(sim.grid, x, y, playerRadius)) {
        return false;
    }
    if (isBlockedByStationaryEnemy(sim, x, y, playerRadius)) {
        return false;
    }
    return true;
}

// Finds the nearest reachable walkable spot for a pickup dropped over trees,
// rocks, water, lava, chasms, walls, ditches, or stationary obstacles,
// preferring tiles closer to the player.
export function findReachablePickupSpot(
    sim: Sim,
    x: number,
    y: number,
    playerRadius: number,
): { x: number; y: number } {
    if (isPickupSpotReachable(sim, x, y, playerRadius)) {
        return { x, y };
    }
    const startX = Math.floor(x);
    const startY = Math.floor(y);
    if (isPickupSpotReachable(sim, startX + 0.5, startY + 0.5, playerRadius)) {
        return { x: startX + 0.5, y: startY + 0.5 };
    }
    const player = sim.player;
    const offsetX = (x - startX - 0.5) * 0.5;
    const offsetY = (y - startY - 0.5) * 0.5;
    let bestX = player.x;
    let bestY = player.y;
    let bestScore = Infinity;
    for (let r = 1; r <= 32; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) {
                    continue;
                }
                const tx = startX + dx;
                const ty = startY + dy;
                let cx = tx + 0.5 + offsetX;
                let cy = ty + 0.5 + offsetY;
                if (!isPickupSpotReachable(sim, cx, cy, playerRadius)) {
                    cx = tx + 0.5;
                    cy = ty + 0.5;
                    if (!isPickupSpotReachable(sim, cx, cy, playerRadius)) {
                        continue;
                    }
                }
                const distDrop = Math.hypot(cx - x, cy - y);
                const distPlayer = Math.hypot(cx - player.x, cy - player.y);
                const score = distDrop + distPlayer * 0.25;
                if (score < bestScore) {
                    bestScore = score;
                    bestX = cx;
                    bestY = cy;
                }
            }
        }
        if (bestScore < Infinity) {
            break;
        }
    }
    return { x: bestX, y: bestY };
}

export function stepPickupSlide(sim: Sim, pickup: Pickup, playerRadius: number): boolean {
    if (
        pickup.targetX === undefined &&
        !isPickupSpotReachable(sim, pickup.x, pickup.y, playerRadius)
    ) {
        const safe = findReachablePickupSpot(sim, pickup.x, pickup.y, playerRadius);
        pickup.targetX = safe.x;
        pickup.targetY = safe.y;
    }
    if (pickup.targetX !== undefined && pickup.targetY !== undefined) {
        const tx = pickup.targetX - pickup.x;
        const ty = pickup.targetY - pickup.y;
        const td = Math.hypot(tx, ty);
        pickup.speed = Math.min(pickup.speed + 0.025, 0.35);
        if (td <= pickup.speed) {
            pickup.x = pickup.targetX;
            pickup.y = pickup.targetY;
            pickup.targetX = undefined;
            pickup.targetY = undefined;
            pickup.speed = 0;
        } else {
            pickup.x += (tx / td) * pickup.speed;
            pickup.y += (ty / td) * pickup.speed;
        }
        return true;
    }
    return false;
}
