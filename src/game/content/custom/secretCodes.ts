import type { GameClient } from "../../client/GameClient";
import { CHARACTERS } from "../characters";

export function redeemSecretCode(
    client: GameClient,
    code: string,
): { ok: boolean; message: string } {
    const cleaned = String(code ?? "")
        .trim()
        .toLowerCase();
    if (cleaned === "l33th4x0r") {
        if (!Array.isArray(client.save.unlockedCodes)) {
            client.save.unlockedCodes = [];
        }
        if (!client.save.unlockedCodes.includes("dipperthedog")) {
            client.save.unlockedCodes.push("dipperthedog");
        }
        if (!client.save.unlockedCodes.includes("barkelly")) {
            client.save.unlockedCodes.push("barkelly");
        }
        if (!client.save.unlockedCodes.includes("novathecat")) {
            client.save.unlockedCodes.push("novathecat");
        }
        if (!client.save.unlockedCodes.includes("l33th4x0r")) {
            client.save.unlockedCodes.push("l33th4x0r");
        }
        for (const c of CHARACTERS) {
            if (!client.save.unlockedCharacters.includes(c.id)) {
                client.save.unlockedCharacters.push(c.id);
            }
        }
        client.save.coins = 999999999;
        if (client.sim) {
            client.sim.coins = 999999999;
        }
        client.persist();
        (globalThis as any).window?.multiplayer?.sendLobbyUpdate?.();
        (globalThis as any).window?.multiplayer?.updateLobbyUI?.();
        client.sounds.taskDone();
        client.store.toast?.(
            "l33th4x0r activated: All characters & levels unlocked + 999,999,999 gold!",
        );
        return {
            ok: true,
            message: "All characters & levels unlocked + 999,999,999 gold granted!",
        };
    }
    if (cleaned === "dipperthedog") {
        if (!Array.isArray(client.save.unlockedCodes)) {
            client.save.unlockedCodes = [];
        }
        if (!client.save.unlockedCodes.includes("dipperthedog")) {
            client.save.unlockedCodes.push("dipperthedog");
        }
        const newlyUnlocked = !client.save.unlockedCharacters.includes("dipper");
        if (newlyUnlocked) {
            client.save.unlockedCharacters.push("dipper");
        }
        client.persist();
        client.selectCharacter("dipper");
        (globalThis as any).window?.multiplayer?.sendLobbyUpdate?.();
        (globalThis as any).window?.multiplayer?.updateLobbyUI?.();
        client.sounds.taskDone();
        return {
            ok: true,
            message: newlyUnlocked
                ? "Dipper the Corgi unlocked!"
                : "Dipper is already unlocked and selected!",
        };
    }
    if (cleaned === "barkelly") {
        if (!Array.isArray(client.save.unlockedCodes)) {
            client.save.unlockedCodes = [];
        }
        if (!client.save.unlockedCodes.includes("barkelly")) {
            client.save.unlockedCodes.push("barkelly");
        }
        const newlyUnlocked = !client.save.unlockedCharacters.includes("elias");
        if (newlyUnlocked) {
            client.save.unlockedCharacters.push("elias");
        }
        client.persist();
        client.selectCharacter("elias");
        (globalThis as any).window?.multiplayer?.sendLobbyUpdate?.();
        (globalThis as any).window?.multiplayer?.updateLobbyUI?.();
        client.sounds.taskDone();
        return {
            ok: true,
            message: newlyUnlocked
                ? "Elias the Chihuahua unlocked!"
                : "Elias is already unlocked and selected!",
        };
    }
    if (cleaned === "novathecat") {
        if (!Array.isArray(client.save.unlockedCodes)) {
            client.save.unlockedCodes = [];
        }
        if (!client.save.unlockedCodes.includes("novathecat")) {
            client.save.unlockedCodes.push("novathecat");
        }
        const newlyUnlocked = !client.save.unlockedCharacters.includes("nova");
        if (newlyUnlocked) {
            client.save.unlockedCharacters.push("nova");
        }
        client.persist();
        client.selectCharacter("nova");
        (globalThis as any).window?.multiplayer?.sendLobbyUpdate?.();
        (globalThis as any).window?.multiplayer?.updateLobbyUI?.();
        client.sounds.taskDone();
        return {
            ok: true,
            message: newlyUnlocked
                ? "Nova the Cat unlocked!"
                : "Nova is already unlocked and selected!",
        };
    }
    client.sounds.denied();
    return { ok: false, message: "Invalid secret code." };
}
