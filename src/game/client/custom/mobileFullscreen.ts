export type ViewportState = {
    width: number;
    height: number;
    fullscreen: boolean;
    portrait: boolean;
};

export function getViewportDimensions(
    win: Window = window,
    doc: Document = document,
): { width: number; height: number } {
    const vv = win?.visualViewport;
    const vvWidth = vv?.width;
    const vvHeight = vv?.height;

    const w =
        typeof vvWidth === "number" && Number.isFinite(vvWidth) && vvWidth > 0
            ? vvWidth
            : (typeof win?.innerWidth === "number" && Number.isFinite(win.innerWidth) && win.innerWidth > 0
                  ? win.innerWidth
                  : doc?.documentElement?.clientWidth) || 1;

    const h =
        typeof vvHeight === "number" && Number.isFinite(vvHeight) && vvHeight > 0
            ? vvHeight
            : (typeof win?.innerHeight === "number" && Number.isFinite(win.innerHeight) && win.innerHeight > 0
                  ? win.innerHeight
                  : doc?.documentElement?.clientHeight) || 1;

    return {
        width: Math.max(1, Math.round(w)),
        height: Math.max(1, Math.round(h)),
    };
}

export function isStandaloneOrFullscreen(
    win: Window = window,
    doc: Document = document,
): boolean {
    const d = doc as any;
    const hasFullscreenElement = Boolean(
        doc?.fullscreenElement ||
            d?.webkitFullscreenElement ||
            d?.mozFullScreenElement ||
            d?.msFullscreenElement,
    );
    if (hasFullscreenElement) {
        return true;
    }
    if (Boolean((win?.navigator as any)?.standalone === true)) {
        return true;
    }
    try {
        if (Boolean(win?.matchMedia?.("(display-mode: fullscreen)")?.matches)) {
            return true;
        }
        if (Boolean(win?.matchMedia?.("(display-mode: standalone)")?.matches)) {
            return true;
        }
    } catch {
        // Ignore matchMedia errors in restricted or mocked environments
    }
    return false;
}

export function canUseFullscreenApi(doc: Document = document): boolean {
    const el = doc?.documentElement as any;
    return Boolean(
        el &&
            (typeof el.requestFullscreen === "function" ||
                typeof el.webkitRequestFullscreen === "function") &&
            doc?.fullscreenEnabled !== false,
    );
}

export function isIosSafariBrowser(
    win: Window = window,
    doc: Document = document,
): boolean {
    if (isStandaloneOrFullscreen(win, doc) || canUseFullscreenApi(doc)) {
        return false;
    }
    const ua = win?.navigator?.userAgent ?? "";
    const isIosDevice =
        /\b(iPad|iPhone|iPod)\b/i.test(ua) ||
        (/\bMacintosh\b/i.test(ua) && (win?.navigator?.maxTouchPoints ?? 0) > 1);
    return isIosDevice;
}

export function syncViewportCssVars(
    win: Window = window,
    doc: Document = document,
): ViewportState {
    const { width, height } = getViewportDimensions(win, doc);
    const fullscreen = isStandaloneOrFullscreen(win, doc);
    const portrait = height > width;

    const rootEl = doc?.documentElement;
    if (rootEl) {
        rootEl.style?.setProperty?.("--app-width", `${width}px`);
        rootEl.style?.setProperty?.("--app-height", `${height}px`);
        rootEl.setAttribute?.("data-fullscreen", fullscreen ? "true" : "false");
        rootEl.setAttribute?.("data-orientation", portrait ? "portrait" : "landscape");
    }

    if ((win?.scrollX || win?.scrollY) && typeof win?.scrollTo === "function") {
        try {
            win.scrollTo(0, 0);
        } catch {
            // Ignore scroll errors
        }
    }

    return { width, height, fullscreen, portrait };
}

function tryLockLandscape(options?: { lockLandscape?: boolean }, win?: Window): void {
    if (options?.lockLandscape === false) {
        return;
    }
    try {
        const lockPromise = (win?.screen as any)?.orientation?.lock?.("landscape");
        if (lockPromise && typeof lockPromise.catch === "function") {
            lockPromise.catch(() => {});
        }
    } catch {
        // Orientation lock is optional on devices/browsers that reject it
    }
}

export async function enterMobileFullscreen(
    options?: { lockLandscape?: boolean },
    win: Window = window,
    doc: Document = document,
): Promise<{ ok: boolean; mode: "api" | "standalone" | "ios-guide" | "unsupported" }> {
    if (isStandaloneOrFullscreen(win, doc)) {
        tryLockLandscape(options, win);
        syncViewportCssVars(win, doc);
        return { ok: true, mode: "standalone" };
    }

    const el = doc?.documentElement as any;
    if (el && doc?.fullscreenEnabled !== false) {
        if (typeof el.requestFullscreen === "function") {
            try {
                try {
                    await el.requestFullscreen({ navigationUI: "hide" } as any);
                } catch {
                    await el.requestFullscreen();
                }
                tryLockLandscape(options, win);
                syncViewportCssVars(win, doc);
                return { ok: true, mode: "api" };
            } catch {
                // Fall through to fallback paths if requestFullscreen rejected
            }
        } else if (typeof el.webkitRequestFullscreen === "function") {
            try {
                await el.webkitRequestFullscreen();
                tryLockLandscape(options, win);
                syncViewportCssVars(win, doc);
                return { ok: true, mode: "api" };
            } catch {
                // Fall through to fallback paths
            }
        }
    }

    syncViewportCssVars(win, doc);
    if (isIosSafariBrowser(win, doc)) {
        return { ok: false, mode: "ios-guide" };
    }
    return { ok: false, mode: "unsupported" };
}

export async function exitMobileFullscreen(
    win: Window = window,
    doc: Document = document,
): Promise<boolean> {
    try {
        (win?.screen as any)?.orientation?.unlock?.();
    } catch {
        // Ignore unlock errors
    }

    const d = doc as any;
    try {
        if (doc?.fullscreenElement && typeof doc.exitFullscreen === "function") {
            await doc.exitFullscreen();
        } else if (d?.webkitFullscreenElement && typeof d.webkitExitFullscreen === "function") {
            await d.webkitExitFullscreen();
        }
    } catch {
        // Ignore exitFullscreen errors
    }

    syncViewportCssVars(win, doc);
    return true;
}

export async function toggleMobileFullscreen(
    options?: { lockLandscape?: boolean },
    win: Window = window,
    doc: Document = document,
): Promise<{
    ok: boolean;
    active: boolean;
    mode: "api" | "standalone" | "ios-guide" | "unsupported";
}> {
    const d = doc as any;
    const hasActiveDomFullscreen = Boolean(doc?.fullscreenElement || d?.webkitFullscreenElement);
    if (hasActiveDomFullscreen) {
        await exitMobileFullscreen(win, doc);
        return { ok: true, active: false, mode: "api" };
    }
    const res = await enterMobileFullscreen(options, win, doc);
    return { ...res, active: res.ok };
}

export function subscribeFullscreenAndViewport(
    onChange: (state: ViewportState) => void,
    win: Window = window,
    doc: Document = document,
): () => void {
    syncViewportCssVars(win, doc);

    const timers = new Set<ReturnType<typeof setTimeout>>();

    const emit = () => {
        const state = syncViewportCssVars(win, doc);
        onChange(state);
    };

    const emitWithDelays = () => {
        emit();
        for (const delay of [120, 350]) {
            const id = setTimeout(() => {
                timers.delete(id);
                emit();
            }, delay);
            timers.add(id);
        }
    };

    win?.addEventListener?.("resize", emit, { passive: true } as any);
    win?.addEventListener?.("orientationchange", emitWithDelays, { passive: true } as any);
    doc?.addEventListener?.("fullscreenchange", emitWithDelays);
    doc?.addEventListener?.("webkitfullscreenchange", emitWithDelays);

    const vv = win?.visualViewport;
    vv?.addEventListener?.("resize", emit, { passive: true } as any);
    vv?.addEventListener?.("scroll", emit, { passive: true } as any);

    return () => {
        for (const id of timers) {
            clearTimeout(id);
        }
        timers.clear();
        win?.removeEventListener?.("resize", emit);
        win?.removeEventListener?.("orientationchange", emitWithDelays);
        doc?.removeEventListener?.("fullscreenchange", emitWithDelays);
        doc?.removeEventListener?.("webkitfullscreenchange", emitWithDelays);
        vv?.removeEventListener?.("resize", emit);
        vv?.removeEventListener?.("scroll", emit);
    };
}
