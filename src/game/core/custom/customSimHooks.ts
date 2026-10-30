import type { BossAttackDef } from "../../content/types";
import type { Sim } from "../Sim";
import type { SpatialHash } from "../SpatialHash";
import type { Enemy, EnemyProjectile } from "../entities";

type SimInternal = {
    regenAccumulator: number;
    enemyHash: SpatialHash<Enemy>;
    heal(amount: number): void;
    showBlocked(enemy: Enemy): void;
    killEnemy(enemy: Enemy, killer: "player" | "enemy"): void;
};

export function applyCoopLampXp(sim: Sim, levels: number): void {
    const mp = typeof window !== "undefined" ? (window as any).multiplayer : undefined;
    const isCoop = Boolean(mp?.gameStarted && mp?.remotePeers && mp.remotePeers.size > 0);
    const playerCount = isCoop ? Math.max(1, 1 + mp.remotePeers.size) : 1;
    const levelsToGrant = levels / playerCount;
    const xpGain = (sim.xpForNextLevel - sim.xpForThisLevel) * levelsToGrant;
    sim.xp += xpGain;
    if (isCoop && typeof mp.send === "function") {
        mp.send({
            type: "coop_pickup",
            kind: "lamp_xp",
            levels: levelsToGrant,
            xpGained: xpGain,
        });
    }
}

export function stepCustomRegen(sim: Sim, ticksPerSecond: number): void {
    const player = sim.player;
    if (player.hp >= player.maxHp) {
        return;
    }
    const internal = sim as unknown as SimInternal;
    const hitPaused =
        sim.tick < (player.regenPausedUntil ?? 0) ||
        sim.tick - player.lastHitTick < 5 * ticksPerSecond;
    const rapidHeal =
        hitPaused && sim.stats.regen > 0
            ? (sim.passives.find((p) => p.id === "rapid_heal")?.value ?? 0)
            : 0;
    const statRegen = Math.max(0, sim.stats.regen - rapidHeal) / 60;
    let buffRegen = 0;
    for (const buff of sim.buffs) {
        buffRegen += (buff as { regenPerSec?: number }).regenPerSec ?? 0;
    }
    const totalRegen = statRegen + buffRegen;
    if (totalRegen > 0) {
        internal.regenAccumulator += totalRegen / ticksPerSecond;
        if (internal.regenAccumulator >= 1) {
            const amount = Math.floor(internal.regenAccumulator);
            internal.regenAccumulator -= amount;
            internal.heal(amount);
        }
    }
}

export function stepFactionProjectileHit(
    sim: Sim,
    projectile: EnemyProjectile,
    factionDamage: number,
): boolean {
    if (projectile.life <= 0 || projectile.faction === undefined) {
        return false;
    }
    const internal = sim as unknown as SimInternal;
    let hitFoe: Enemy | undefined;
    internal.enemyHash.query(projectile.x, projectile.y, projectile.radius + 1.5, (other) => {
        if (
            hitFoe ||
            other.uid === projectile.enemyUid ||
            other.dead ||
            other.boss ||
            other.elite ||
            other.def.faction === undefined ||
            other.def.faction === projectile.faction
        ) {
            return;
        }
        const dx = other.x - projectile.x;
        const dy = other.y - projectile.y;
        const rSum = projectile.radius + other.radius;
        if (dx * dx + dy * dy <= rSum * rSum) {
            hitFoe = other;
        }
    });
    if (!hitFoe) {
        return false;
    }
    projectile.life = 0;
    if (projectile.attack.impactSpotAnim !== undefined) {
        sim.addEffect(projectile.attack.impactSpotAnim, hitFoe.x, hitFoe.y, 0, 30);
    }
    if (hitFoe.shieldEnd > sim.tick) {
        internal.showBlocked(hitFoe);
        return true;
    }
    const amount = Math.max(
        1,
        Math.round(projectile.damage * factionDamage * sim.rng.range(0.85, 1.15)),
    );
    hitFoe.hp -= amount;
    hitFoe.flash = 5;
    if (!hitFoe.aggro && !hitFoe.foe) {
        const shooter = sim.enemies.find((e) => e.uid === projectile.enemyUid && !e.dead);
        if (shooter) {
            hitFoe.foe = shooter;
        }
    }
    sim.events.push({
        type: "damage",
        x: hitFoe.x,
        y: hitFoe.y,
        amount,
        enemyUid: hitFoe.uid,
        enemyId: hitFoe.def.id,
    });
    if (hitFoe.hp <= 0) {
        internal.killEnemy(hitFoe, "enemy");
    }
    return true;
}

export function resolveCustomBossPrayerHit(
    sim: Sim,
    enemyId: string,
    attack: BossAttackDef,
    damage: number,
): { blocked: boolean; damage: number; ignoreArmor?: boolean } {
    let ignoreArmor = attack.ignoreArmor;
    if (enemyId === "tztok_jad" || enemyId === "tzkal_zuk") {
        const player = sim.player;
        const reqPrayer =
            attack.name === "Magic"
                ? "magic"
                : attack.name === "Stomp" || attack.name === "Slam"
                  ? "melee"
                  : "ranged";
        const win = typeof window !== "undefined" ? (window as any) : undefined;
        const activePrayer =
            player.slot &&
            win?.multiplayer?.gameStarted &&
            player.slot !== win.multiplayer.localSlot
                ? (player.activePrayer ?? null)
                : (player.activePrayer ?? win?._osrsPrayer ?? null);
        if (activePrayer === reqPrayer) {
            sim.events.push({
                type: "playerHit",
                amount: 0,
                blocked: true,
                enemyId,
                elite: false,
                sound: 163,
                slot: player.slot,
            });
            return { blocked: true, damage: 0, ignoreArmor };
        }
        damage = Math.max(99, player.maxHp * 10);
        ignoreArmor = true;
    }
    return { blocked: false, damage, ignoreArmor };
}
