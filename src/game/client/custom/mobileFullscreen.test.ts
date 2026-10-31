import { describe, expect, it, vi } from "vitest";
import {
    canUseFullscreenApi,
    enterMobileFullscreen,
    exitMobileFullscreen,
    getViewportDimensions,
    isIosSafariBrowser,
    isStandaloneOrFullscreen,
    subscribeFullscreenAndViewport,
    syncViewportCssVars,
    toggleMobileFullscreen,
} from "./mobileFullscreen";

function createMockEnv(overrides?: {
    innerWidth?: number;
    innerHeight?: number;
    vvWidth?: number;
    vvHeight?: number;
    clientWidth?: number;
    clientHeight?: number;
    userAgent?: string;
    maxTouchPoints?: number;
    standalone?: boolean;
    displayModeFullscreen?: boolean;
    displayModeStandalone?: boolean;
    fullscreenElement?: any;
    webkitFullscreenElement?: any;
    fullscreenEnabled?: boolean;
    requestFullscreen?: (...args: any[]) => Promise<void>;
    webkitRequestFullscreen?: () => Promise<void>;
    exitFullscreen?: () => Promise<void>;
    webkitExitFullscreen?: () => Promise<void>;
    scrollX?: number;
    scrollY?: number;
}) {
    const cssProps = new Map<string, string>();
    const attrs = new Map<string, string>();
    const winListeners = new Map<string, Set<(...args: any[]) => void>>();
    const docListeners = new Map<string, Set<(...args: any[]) => void>>();
    const vvListeners = new Map<string, Set<(...args: any[]) => void>>();

    const lockMock = vi.fn(() => Promise.resolve());
    const unlockMock = vi.fn();
    const scrollToMock = vi.fn();

    const doc: any = {
        fullscreenElement: overrides?.fullscreenElement ?? null,
        webkitFullscreenElement: overrides?.webkitFullscreenElement ?? null,
        fullscreenEnabled: overrides?.fullscreenEnabled ?? true,
        exitFullscreen: overrides?.exitFullscreen,
        webkitExitFullscreen: overrides?.webkitExitFullscreen,
        documentElement: {
            clientWidth: overrides?.clientWidth ?? 800,
            clientHeight: overrides?.clientHeight ?? 600,
            requestFullscreen: overrides?.requestFullscreen,
            webkitRequestFullscreen: overrides?.webkitRequestFullscreen,
            style: {
                setProperty: vi.fn((k: string, v: string) => cssProps.set(k, v)),
            },
            setAttribute: vi.fn((k: string, v: string) => attrs.set(k, v)),
        },
        addEventListener: vi.fn((type: string, fn: any) => {
            if (!docListeners.has(type)) docListeners.set(type, new Set());
            docListeners.get(type)!.add(fn);
        }),
        removeEventListener: vi.fn((type: string, fn: any) => {
            docListeners.get(type)?.delete(fn);
        }),
    };

    const visualViewport =
        overrides?.vvWidth !== undefined || overrides?.vvHeight !== undefined
            ? {
                  width: overrides?.vvWidth ?? 0,
                  height: overrides?.vvHeight ?? 0,
                  addEventListener: vi.fn((type: string, fn: any) => {
                      if (!vvListeners.has(type)) vvListeners.set(type, new Set());
                      vvListeners.get(type)!.add(fn);
                  }),
                  removeEventListener: vi.fn((type: string, fn: any) => {
                      vvListeners.get(type)?.delete(fn);
                  }),
              }
            : undefined;

    const win: any = {
        innerWidth: overrides?.innerWidth ?? 1024,
        innerHeight: overrides?.innerHeight ?? 768,
        scrollX: overrides?.scrollX ?? 0,
        scrollY: overrides?.scrollY ?? 0,
        scrollTo: scrollToMock,
        visualViewport,
        navigator: {
            userAgent: overrides?.userAgent ?? "Mozilla/5.0 (Linux; Android 14) Chrome/120.0",
            maxTouchPoints: overrides?.maxTouchPoints ?? 5,
            standalone: overrides?.standalone ?? false,
        },
        screen: {
            orientation: {
                lock: lockMock,
                unlock: unlockMock,
            },
        },
        matchMedia: vi.fn((query: string) => ({
            matches:
                (query === "(display-mode: fullscreen)" && Boolean(overrides?.displayModeFullscreen)) ||
                (query === "(display-mode: standalone)" && Boolean(overrides?.displayModeStandalone)),
        })),
        addEventListener: vi.fn((type: string, fn: any) => {
            if (!winListeners.has(type)) winListeners.set(type, new Set());
            winListeners.get(type)!.add(fn);
        }),
        removeEventListener: vi.fn((type: string, fn: any) => {
            winListeners.get(type)?.delete(fn);
        }),
    };

    return {
        win,
        doc,
        cssProps,
        attrs,
        lockMock,
        unlockMock,
        scrollToMock,
        winListeners,
        docListeners,
        vvListeners,
    };
}

describe("mobileFullscreen", () => {
    it("prefers visualViewport dimensions and falls back to innerWidth/clientWidth", () => {
        const env1 = createMockEnv({ vvWidth: 844.4, vvHeight: 390.2, innerWidth: 900, innerHeight: 500 });
        expect(getViewportDimensions(env1.win, env1.doc)).toEqual({ width: 844, height: 390 });

        const env2 = createMockEnv({ innerWidth: 667, innerHeight: 375 });
        expect(getViewportDimensions(env2.win, env2.doc)).toEqual({ width: 667, height: 375 });

        const env3 = createMockEnv({ innerWidth: 0, innerHeight: 0, clientWidth: 412, clientHeight: 915 });
        expect(getViewportDimensions(env3.win, env3.doc)).toEqual({ width: 412, height: 915 });
    });

    it("detects standalone and fullscreen states across APIs and display-mode media queries", () => {
        expect(isStandaloneOrFullscreen(createMockEnv().win, createMockEnv().doc)).toBe(false);

        const fsDom = createMockEnv({ fullscreenElement: {} });
        expect(isStandaloneOrFullscreen(fsDom.win, fsDom.doc)).toBe(true);

        const iosStandalone = createMockEnv({ standalone: true });
        expect(isStandaloneOrFullscreen(iosStandalone.win, iosStandalone.doc)).toBe(true);

        const pwaFullscreen = createMockEnv({ displayModeFullscreen: true });
        expect(isStandaloneOrFullscreen(pwaFullscreen.win, pwaFullscreen.doc)).toBe(true);

        const pwaStandalone = createMockEnv({ displayModeStandalone: true });
        expect(isStandaloneOrFullscreen(pwaStandalone.win, pwaStandalone.doc)).toBe(true);
    });

    it("detects Fullscreen API availability and iOS Safari browser fallback", () => {
        const androidEnv = createMockEnv({
            requestFullscreen: vi.fn(() => Promise.resolve()),
        });
        expect(canUseFullscreenApi(androidEnv.doc)).toBe(true);
        expect(isIosSafariBrowser(androidEnv.win, androidEnv.doc)).toBe(false);

        const iphoneSafari = createMockEnv({
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15",
        });
        expect(canUseFullscreenApi(iphoneSafari.doc)).toBe(false);
        expect(isIosSafariBrowser(iphoneSafari.win, iphoneSafari.doc)).toBe(true);

        const ipadDesktopMode = createMockEnv({
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            maxTouchPoints: 5,
        });
        expect(isIosSafariBrowser(ipadDesktopMode.win, ipadDesktopMode.doc)).toBe(true);
    });

    it("syncs CSS custom properties, data attributes, and resets window scroll offset", () => {
        const env = createMockEnv({
            vvWidth: 390,
            vvHeight: 844,
            scrollY: 42,
            fullscreenElement: {},
        });
        const state = syncViewportCssVars(env.win, env.doc);
        expect(state).toEqual({
            width: 390,
            height: 844,
            fullscreen: true,
            portrait: true,
        });
        expect(env.cssProps.get("--app-width")).toBe("390px");
        expect(env.cssProps.get("--app-height")).toBe("844px");
        expect(env.attrs.get("data-fullscreen")).toBe("true");
        expect(env.attrs.get("data-orientation")).toBe("portrait");
        expect(env.scrollToMock).toHaveBeenCalledWith(0, 0);
    });

    it("requests fullscreen with navigationUI hide and locks landscape orientation", async () => {
        const reqFs = vi.fn(async () => {
            env.doc.fullscreenElement = env.doc.documentElement;
        });
        const env = createMockEnv({
            vvWidth: 844,
            vvHeight: 390,
            requestFullscreen: reqFs,
        });

        const res = await enterMobileFullscreen({ lockLandscape: true }, env.win, env.doc);
        expect(res).toEqual({ ok: true, mode: "api" });
        expect(reqFs).toHaveBeenCalledWith({ navigationUI: "hide" });
        expect(env.lockMock).toHaveBeenCalledWith("landscape");
        expect(env.attrs.get("data-fullscreen")).toBe("true");
    });

    it("returns ios-guide when Fullscreen API is unavailable on iOS Safari", async () => {
        const env = createMockEnv({
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1",
        });
        const res = await enterMobileFullscreen(undefined, env.win, env.doc);
        expect(res).toEqual({ ok: false, mode: "ios-guide" });
    });

    it("toggles and exits fullscreen cleanly", async () => {
        const exitFs = vi.fn(async () => {
            env.doc.fullscreenElement = null;
        });
        const env = createMockEnv({
            fullscreenElement: {},
            exitFullscreen: exitFs,
        });

        const res = await toggleMobileFullscreen(undefined, env.win, env.doc);
        expect(res).toEqual({ ok: true, active: false, mode: "api" });
        expect(exitFs).toHaveBeenCalledTimes(1);
        expect(env.unlockMock).toHaveBeenCalledTimes(1);

        const exited = await exitMobileFullscreen(env.win, env.doc);
        expect(exited).toBe(true);
    });

    it("subscribes to viewport and fullscreen events and cleans up timers and listeners", () => {
        vi.useFakeTimers();
        try {
            const env = createMockEnv({ vvWidth: 800, vvHeight: 400 });
            const onChange = vi.fn();
            const unsubscribe = subscribeFullscreenAndViewport(onChange, env.win, env.doc);

            expect(env.cssProps.get("--app-width")).toBe("800px");

            // Trigger orientationchange
            env.win.visualViewport.width = 900;
            for (const fn of env.winListeners.get("orientationchange") ?? []) {
                fn();
            }
            expect(onChange).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(400);
            expect(onChange).toHaveBeenCalledTimes(3);

            unsubscribe();
            expect(env.winListeners.get("resize")?.size ?? 0).toBe(0);
            expect(env.docListeners.get("fullscreenchange")?.size ?? 0).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });
});
