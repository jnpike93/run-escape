import { useState } from "react";

import { GameClient } from "../client/GameClient";
import { UiSnapshot } from "../client/GameStore";

const UI_SCALE_OPTIONS = [
    ["auto", "Auto"],
    [1, "1x"],
    [1.25, "1.25x"],
    [1.5, "1.5x"],
    [1.75, "1.75x"],
    [2, "2x"],
] as const;

export function UiScaleButtons({
    ui,
    client,
}: {
    ui: UiSnapshot;
    client: GameClient;
}): JSX.Element {
    const currentScale = (ui.display as any)?.uiScale ?? "auto";
    return (
        <div style={{ display: "flex", gap: "4px" }}>
            {UI_SCALE_OPTIONS.map(([value, label]) => {
                const selected = currentScale === value;
                return (
                    <button
                        key={String(value)}
                        className={
                            "ui-button ui-button-small" + (selected ? " ui-card-selected" : "")
                        }
                        style={{
                            padding: "4px 8px",
                            color: selected ? "#ffff00" : undefined,
                        }}
                        onClick={(e) => {
                            (client as any).setUiScale(value);
                            e.currentTarget.blur();
                        }}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

export function SecretCodeSection({ client }: { client: GameClient }): JSX.Element {
    const [codeOpen, setCodeOpen] = useState(false);
    const [codeVal, setCodeVal] = useState("");
    const [codeMsg, setCodeMsg] = useState<{ ok: boolean; message: string }>();
    const submitCode = (e: React.FormEvent) => {
        e?.preventDefault?.();
        const r = (client as any).redeemCode(codeVal);
        setCodeMsg(r);
        if (r?.ok) {
            setCodeVal("");
        }
    };
    return (
        <>
            <div className="ui-setting">
                <div className="ui-setting-label">
                    <div className="ui-setting-name">Secret code</div>
                    <div className="ui-setting-text">Redeem a code to unlock hidden content</div>
                </div>
                <div className="ui-setting-control">
                    <button
                        className="ui-button ui-button-small"
                        onClick={(e) => {
                            setCodeOpen((v) => !v);
                            setCodeMsg(undefined);
                            e.currentTarget.blur();
                        }}
                    >
                        {codeOpen ? "Hide" : "Code"}
                    </button>
                </div>
            </div>
            {codeOpen && (
                <form
                    onSubmit={submitCode}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        padding: "6px 0",
                    }}
                >
                    <div style={{ display: "flex", gap: "6px" }}>
                        <input
                            type="text"
                            value={codeVal}
                            onChange={(e) => setCodeVal(e.target.value)}
                            placeholder="Enter secret code..."
                            autoComplete="off"
                            style={{
                                flex: 1,
                                background: "#110d08",
                                color: "#ff981f",
                                border: "1px solid #5a4a32",
                                padding: "5px 8px",
                                fontFamily: "inherit",
                                fontSize: "14px",
                            }}
                        />
                        <button type="submit" className="ui-button ui-button-small">
                            Unlock
                        </button>
                    </div>
                    {codeMsg && (
                        <div
                            style={{
                                fontSize: "13px",
                                color: codeMsg.ok ? "#00ff00" : "#ff4444",
                            }}
                        >
                            {codeMsg.message}
                        </div>
                    )}
                </form>
            )}
        </>
    );
}

export function PauseHoverInfoBox({
    hoverInfo,
}: {
    hoverInfo?: { name: string; text: string; color?: string } | null;
}): JSX.Element {
    return (
        <div
            style={{
                minHeight: "38px",
                margin: "6px 0",
                padding: "6px 10px",
                background: "rgba(16, 12, 8, 0.85)",
                border: "1px solid #5a4a35",
                borderRadius: "3px",
                fontSize: "13px",
                lineHeight: "1.35",
                color: hoverInfo ? "#f0e6d2" : "#887862",
            }}
        >
            {hoverInfo ? (
                <>
                    <strong style={{ color: hoverInfo.color || "#ff981f" }}>
                        {hoverInfo.name}:{" "}
                    </strong>
                    <span>{hoverInfo.text}</span>
                </>
            ) : (
                "Mouse over any weapon, passive, or equipment item above to see what it does."
            )}
        </div>
    );
}
