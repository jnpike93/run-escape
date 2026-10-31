import { useEffect, useState } from "react";

import { isTouchDevice } from "../../util/DeviceUtil";
import { GameClient } from "../client/GameClient";
import { UiSnapshot } from "../client/GameStore";
import {
    ViewportState,
    subscribeFullscreenAndViewport,
    syncViewportCssVars,
    toggleMobileFullscreen,
} from "../client/custom/mobileFullscreen";

const IOS_FULLSCREEN_GUIDE =
    "On iPhone Safari, tap the AA / Page menu in the address bar and choose 'Hide Toolbar', or tap Share -> 'Add to Home Screen' for fullscreen.";

export function useViewportState(): ViewportState {
    const [state, setState] = useState<ViewportState>(() => syncViewportCssVars());
    useEffect(() => {
        setState(syncViewportCssVars());
        return subscribeFullscreenAndViewport((next) => setState(next));
    }, []);
    return state;
}

const UI_SCALE_OPTIONS = [
    ["auto", "Auto"],
    [0.5, "0.5x"],
    [0.75, "0.75x"],
    [1, "1x"],
    [1.25, "1.25x"],
    [1.5, "1.5x"],
    [1.75, "1.75x"],
    [2, "2x"],
] as const;

export function computeAutoUiScale(
    width: number,
    height: number,
    baseWidth = 1150,
    baseHeight = 720,
    maxScale = 2,
): number {
    const fit = Math.min(height / baseHeight, width / baseWidth);
    if (fit < 1) {
        return Math.round(Math.max(0.45, fit) * 20) / 20;
    }
    return Math.round(Math.min(maxScale, Math.max(1, fit)) * 20) / 20;
}

export function UiScaleButtons({
    ui,
    client,
}: {
    ui: UiSnapshot;
    client: GameClient;
}): JSX.Element {
    const currentScale = (ui.display as any)?.uiScale ?? "auto";
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
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

export const GITHUB_REPO_URL = "https://github.com/jnpike93/run-escape";

export function AboutSetting(): JSX.Element {
    return (
        <div className="ui-setting">
            <div className="ui-setting-label">
                <div className="ui-setting-name">About</div>
                <div className="ui-setting-text">
                    GitHub repository:{" "}
                    <a
                        href={GITHUB_REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#ff981f", textDecoration: "underline" }}
                        onClick={(e) => e.currentTarget.blur()}
                    >
                        jnpike93/run-escape
                    </a>
                </div>
            </div>
            <div className="ui-setting-control">
                <a
                    href={GITHUB_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ui-button ui-button-small"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                    onClick={(e) => e.currentTarget.blur()}
                >
                    GitHub
                </a>
            </div>
        </div>
    );
}

export function AboutSection(): JSX.Element {
    return (
        <section className="ui-settings-section">
            <h3>About</h3>
            <AboutSetting />
        </section>
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
                "Hover or tap any weapon, passive, or equipment item above to see what it does."
            )}
        </div>
    );
}

export function FullscreenSetting(): JSX.Element {
    const { fullscreen } = useViewportState();
    const [iosTip, setIosTip] = useState(false);

    const onToggle = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        const res = await toggleMobileFullscreen({ lockLandscape: isTouchDevice });
        if (res.mode === "ios-guide") {
            setIosTip((v) => !v);
        } else {
            setIosTip(false);
        }
    };

    return (
        <>
            <div className="ui-setting">
                <div className="ui-setting-label">
                    <div className="ui-setting-name">Fullscreen</div>
                    <div className="ui-setting-text">Fill the screen and hide browser bars</div>
                </div>
                <div className="ui-setting-control">
                    <button
                        type="button"
                        className={
                            "ui-button ui-button-small ui-toggle" +
                            (fullscreen ? " ui-toggle-on" : "")
                        }
                        aria-label="Fullscreen"
                        aria-pressed={fullscreen}
                        onClick={onToggle}
                    >
                        {fullscreen ? "On" : "Off"}
                    </button>
                </div>
            </div>
            {iosTip && (
                <div
                    style={{
                        fontSize: "13px",
                        color: "#ffff00",
                        background: "rgba(16, 12, 8, 0.85)",
                        border: "1px solid #6b5e4a",
                        padding: "5px 8px",
                        marginBottom: "4px",
                    }}
                >
                    {IOS_FULLSCREEN_GUIDE}
                </div>
            )}
        </>
    );
}

export function HudFullscreenButton(): JSX.Element {
    const { fullscreen } = useViewportState();
    return (
        <button
            type="button"
            className="ui-button ui-button-small ui-hud-fullscreen"
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            aria-label={fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            aria-pressed={fullscreen}
            onClick={async (e) => {
                e.currentTarget.blur();
                await toggleMobileFullscreen({ lockLandscape: isTouchDevice });
            }}
        >
            {fullscreen ? "Exit Full" : "Full"}
        </button>
    );
}

export function HudPauseButton({ client }: { client: GameClient }): JSX.Element {
    return (
        <button
            className="ui-button ui-button-small ui-hud-pause"
            title="Pause (Esc / P)"
            aria-label="Pause"
            onClick={() => client.pause()}
        >
            Pause
        </button>
    );
}

export function HudControlButtons({ client }: { client: GameClient }): JSX.Element {
    return (
        <div className="ui-hud-actions">
            <HudFullscreenButton />
            <HudPauseButton client={client} />
        </div>
    );
}

export function MobileOrientationBanner(): JSX.Element | null {
    const [dismissed, setDismissed] = useState(false);
    const [iosGuide, setIosGuide] = useState(false);
    const { width, height, fullscreen, portrait } = useViewportState();

    const narrowPortrait = portrait && width < 600;
    const mobileNeedsFullscreen = isTouchDevice && !fullscreen && Math.min(width, height) < 560;

    if (dismissed || (!narrowPortrait && !mobileNeedsFullscreen)) {
        return null;
    }

    const message = iosGuide
        ? "Tap AA -> Hide Toolbar or Share -> Add to Home Screen for fullscreen."
        : portrait
          ? "Tip: Rotate to landscape or tap Fullscreen for the best mobile view."
          : "Tip: Tap Fullscreen to hide browser bars and fit your screen.";

    return (
        <div
            className="rs-border rs-background"
            style={{
                position: "absolute",
                top: "calc(6px + var(--safe-top, env(safe-area-inset-top, 0px)) / var(--ui-scale, 1))",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px",
                background: "rgba(30, 24, 16, 0.95)",
                border: "1px solid #6b5e4a",
                color: "#ff981f",
                fontSize: "13px",
                pointerEvents: "auto",
                maxWidth: "calc(94vw / var(--ui-scale, 1))",
                whiteSpace: "nowrap",
            }}
        >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{message}</span>
            {!fullscreen && (
                <button
                    type="button"
                    className="ui-button ui-button-small"
                    style={{ padding: "2px 6px", fontSize: "12px", color: "#0dc10d" }}
                    onClick={async () => {
                        const res = await toggleMobileFullscreen({ lockLandscape: true });
                        if (res.mode === "ios-guide") {
                            setIosGuide(true);
                        }
                    }}
                >
                    Fullscreen
                </button>
            )}
            <button
                type="button"
                className="ui-button ui-button-small"
                style={{ padding: "2px 6px", fontSize: "12px" }}
                onClick={() => setDismissed(true)}
            >
                Dismiss
            </button>
        </div>
    );
}
