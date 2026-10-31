import { useEffect } from "react";

import { GameClient } from "../client/GameClient";
import { UiSnapshot } from "../client/GameStore";
import { formatTime } from "../client/GameView";
import { CHARACTERS } from "../content/characters";
import { FUN_MAPS, MAPS } from "../content/maps";
import { MapDef } from "../content/types";
import { calculateLevelPointsBreakdown, getChallengeMode } from "../core/save";
import { Coins } from "./Coins";
import { ItemIcon } from "./ItemIcon";

type Props = { ui: UiSnapshot; client: GameClient };

export function LeaderboardScreen({ ui, client }: Props): JSX.Element {
    const save = ui.save;
    useEffect(() => {
        const onKey = (f: KeyboardEvent) => {
            if (f.code === "Escape") {
                client.showScreen("title");
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [client]);
    const renderRow = (m: MapDef) => {
        const mb = (save as any).mapBest?.[m.id];
        const eb = save.endlessBest?.[m.id];
        const wins = save.mapVictories?.[m.id] ?? 0;
        const bossAt = m.events?.find((ev) => ev.kind === "finalBoss")?.at ?? 900;
        const bestSec = Math.max(mb?.seconds ?? 0, eb?.seconds ?? 0, wins > 0 ? bossAt : 0);
        const clearSec = mb?.winSeconds > 0 ? mb.winSeconds : wins > 0 ? bossAt : 0;
        const charName = mb?.characterId
            ? (CHARACTERS.find((c) => c.id === mb.characterId)?.name ?? "")
            : "";
        const statusClass = wins > 0 ? "done" : bestSec > 0 ? "started" : "new";
        const breakdown = calculateLevelPointsBreakdown(save, m.id);
        const pts = breakdown.totalPoints;
        const bestKills = mb?.kills ?? 0;
        const modeDef = getChallengeMode(breakdown.challengeMode);
        const modeBonusLine =
            breakdown.challengeMode !== "normal"
                ? `\n• ${modeDef.name} (${modeDef.difficultyMultiplier}x diff): ${breakdown.modePointsMultiplier}x points`
                : "";
        const pointsTooltip =
            pts > 0
                ? `${m.name} Top Score (${breakdown.difficultyMultiplier}x difficulty${breakdown.challengeMode !== "normal" ? `, ${modeDef.name}` : ""}):\n• Best Run Kills (${bestKills.toLocaleString()}): +${breakdown.killPoints.toLocaleString()} base\n• Survival & Level: +${breakdown.progressionPoints.toLocaleString()} base\n• Bosses & Clear Speed: +${breakdown.clearPoints.toLocaleString()} base${breakdown.endlessPoints > 0 ? `\n• Endless Rounds: +${breakdown.endlessPoints.toLocaleString()} base` : ""}${modeBonusLine}\n= ${pts.toLocaleString()} pts`
                : `${m.name} (${breakdown.difficultyMultiplier}x difficulty): Play a run to set a top score!`;
        return (
            <div
                key={m.id}
                className={"ui-quest ui-quest-" + statusClass}
                title={pointsTooltip}
                style={{ gridTemplateColumns: "195px minmax(0,1fr) 130px 125px 115px" }}
            >
                <span
                    className="ui-quest-name"
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                    <ItemIcon objId={m.iconObjId} size={20} />
                    {m.name}
                </span>
                <span
                    className="ui-quest-task"
                    style={{ color: bestSec > 0 ? "#f0e6d2" : "#8a7f6a" }}
                >
                    Best time:{" "}
                    <strong style={{ color: bestSec > 0 ? "#ffff00" : "#8a7f6a" }}>
                        {bestSec > 0 ? formatTime(bestSec) : "--:--"}
                    </strong>
                    {charName ? ` (${charName})` : eb ? ` (Round ${eb.round})` : ""}
                </span>
                <span
                    className="ui-quest-progress"
                    style={{
                        color: clearSec > 0 ? "#00ff00" : eb ? "#40e0ff" : "#8a7f6a",
                    }}
                >
                    {m.fun
                        ? eb
                            ? `Round ${eb.round} · ${formatTime(eb.seconds)}`
                            : bestSec > 0
                              ? formatTime(bestSec)
                              : "Endless"
                        : clearSec > 0
                          ? `Clear: ${formatTime(clearSec)}`
                          : eb
                            ? `Round ${eb.round}`
                            : "Not beaten"}
                </span>
                <span
                    className="ui-quest-reward"
                    style={{
                        color: wins > 0 ? "#ff981f" : "#8a7f6a",
                        fontSize: "14px",
                    }}
                >
                    {m.fun
                        ? bestKills > 0
                            ? `${bestKills.toLocaleString()} kills`
                            : "Fun map"
                        : `${wins} ${wins === 1 ? "win" : "wins"}${
                              bestKills > 0
                                  ? ` · ${bestKills.toLocaleString()}☠`
                                  : eb
                                    ? ` · R${eb.round}`
                                    : ""
                          }`}
                </span>
                <span
                    className="ui-quest-reward"
                    title={pointsTooltip}
                    style={{
                        color: pts > 0 ? "#ffff00" : "#8a7f6a",
                        fontWeight: pts > 0 ? "bold" : "normal",
                        fontSize: "14px",
                        textAlign: "right",
                    }}
                >
                    {pts > 0 ? `${pts.toLocaleString()} pts` : "--"}
                </span>
            </div>
        );
    };
    return (
        <div className="ui-fill ui-center">
            <div className="ui-panel rs-border rs-background ui-quests">
                <h2>Leaderboard</h2>
                <p className="ui-subtle">
                    Your top run score, best survival time, fastest boss clear, and furthest endless
                    run for every level.
                </p>
                <div className="ui-quest-list">
                    <section className="ui-quest-group">
                        <h3 className="ui-quest-group-name">Campaign Levels</h3>
                        {MAPS.map(renderRow)}
                    </section>
                    <section className="ui-quest-group">
                        <h3 className="ui-quest-group-name">Fun & Endless Levels</h3>
                        {FUN_MAPS.map(renderRow)}
                    </section>
                </div>
                <div className="ui-row">
                    <button className="ui-button" onClick={() => client.showScreen("title")}>
                        Back
                    </button>
                    <span className="ui-quests-count">
                        Runs {save.runs} · Wins {save.victories} · Overall Best{" "}
                        {formatTime(save.bestSeconds)} · Best Level {save.bestLevel}
                    </span>
                    <Coins amount={save.coins} />
                </div>
            </div>
        </div>
    );
}
