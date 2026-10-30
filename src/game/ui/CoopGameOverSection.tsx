import { GameClient } from "../client/GameClient";

export function CoopDamageLeaderboardTable(): JSX.Element | null {
    const mp = (window as any).multiplayer;
    const rows = mp?.lastLeaderboard;
    if (
        (!mp?.isCoopSessionActive?.() && !(rows?.length > 0)) ||
        !Array.isArray(rows) ||
        rows.length === 0
    ) {
        return null;
    }
    return (
        <div
            id="coop-leaderboard"
            style={{
                marginTop: "10px",
                borderTop: "1px solid #5a4a35",
                paddingTop: "8px",
                width: "100%",
            }}
        >
            <div
                style={{
                    fontSize: "14px",
                    color: "#ffff00",
                    textAlign: "center",
                    marginBottom: "6px",
                    fontFamily: '"OSRS Bold", monospace',
                    textShadow: "1px 1px #000",
                }}
            >
                Co-Op Run Leaderboard
            </div>
            <table className="ui-result-table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                    <tr
                        style={{
                            color: "#b8a890",
                            borderBottom: "1px solid #4a3c2c",
                        }}
                    >
                        <th style={{ textAlign: "left", padding: "2px 4px" }}>#</th>
                        <th style={{ textAlign: "left", padding: "2px 4px" }}>Player</th>
                        <th style={{ textAlign: "right", padding: "2px 4px" }}>Lv</th>
                        <th style={{ textAlign: "right", padding: "2px 4px" }}>Damage</th>
                        <th style={{ textAlign: "right", padding: "2px 4px" }}>Share</th>
                        <th style={{ textAlign: "right", padding: "2px 4px" }}>Kills</th>
                        <th style={{ textAlign: "right", padding: "2px 4px" }}>Points</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row: any, idx: number) => (
                        <tr
                            key={row.slot}
                            style={{
                                color: row.isLocal ? "#ffff00" : "#ff981f",
                                fontWeight: row.isLocal ? "bold" : "normal",
                            }}
                        >
                            <td style={{ padding: "2px 4px" }}>{idx + 1}</td>
                            <td style={{ padding: "2px 4px" }}>
                                {row.name}{" "}
                                <span
                                    style={{
                                        color: "#b8a890",
                                        fontSize: "11px",
                                    }}
                                >
                                    ({row.charName})
                                </span>
                            </td>
                            <td
                                style={{
                                    textAlign: "right",
                                    padding: "2px 4px",
                                    color: "#00ff00",
                                }}
                            >
                                {row.level || 1}
                            </td>
                            <td
                                style={{
                                    textAlign: "right",
                                    padding: "2px 4px",
                                }}
                            >
                                {Math.round(row.damage).toLocaleString()}
                            </td>
                            <td
                                style={{
                                    textAlign: "right",
                                    padding: "2px 4px",
                                    color: "#40e0ff",
                                }}
                            >
                                {row.pct}%
                            </td>
                            <td
                                style={{
                                    textAlign: "right",
                                    padding: "2px 4px",
                                }}
                            >
                                {(row.kills || 0).toLocaleString()}
                            </td>
                            <td
                                style={{
                                    textAlign: "right",
                                    padding: "2px 4px",
                                    color: "#ffff00",
                                    fontWeight: "bold",
                                }}
                            >
                                {Math.round(row.points || 0).toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function CoopGameOverButtons({ client }: { client: GameClient }): JSX.Element {
    return (
        <div
            className="ui-row"
            style={{ display: "flex", gap: "8px", justifyContent: "center" }}
        >
            {(window as any).multiplayer?.isCoopSessionActive?.() ? (
                <>
                    <button
                        id="coop-return-lobby-btn"
                        className="ui-button ui-button-go"
                        onClick={() => (window as any).multiplayer.returnToLobby()}
                    >
                        Return to Co-Op Lobby
                    </button>
                    <button
                        id="coop-leave-title-btn"
                        className="ui-button"
                        onClick={() => (window as any).multiplayer.leaveCoopToTitle()}
                    >
                        Leave to Title
                    </button>
                </>
            ) : (
                <button className="ui-button ui-button-go" onClick={() => client.leaveRun()}>
                    Back to the title
                </button>
            )}
        </div>
    );
}
