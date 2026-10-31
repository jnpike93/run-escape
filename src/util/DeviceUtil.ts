const hasWindow = typeof window !== "undefined";
const hasDocument = typeof document !== "undefined";
const hasNavigator = typeof navigator !== "undefined";

export const checkIphone = () => {
    const u = hasNavigator ? (navigator.userAgent ?? "") : "";
    return !!u.match(/iPhone/i);
};
export const checkAndroid = () => {
    const u = hasNavigator ? (navigator.userAgent ?? "") : "";
    return !!u.match(/Android/i);
};
export const checkIpad = () => {
    const u = hasNavigator ? (navigator.userAgent ?? "") : "";
    return !!u.match(/iPad/i);
};
export const checkMobile = () => {
    const u = hasNavigator ? (navigator.userAgent ?? "") : "";
    return !!u.match(/Android/i) || !!u.match(/iPhone/i);
};

export function checkIos() {
    if (!hasNavigator) {
        return false;
    }
    const ua = navigator.userAgent ?? "";
    // iPad on iOS 13 detection
    const isIpad = ua.includes("Macintosh") && (navigator.maxTouchPoints ?? 0) >= 1;
    return /iPad|iPhone|iPod/.test(ua) || isIpad;
}

export const isIos = checkIos();

export const isWallpaperEngine = hasWindow && !!window.wallpaperRegisterAudioListener;

export const isTouchDevice = !!(
    (hasNavigator && navigator.maxTouchPoints) ||
    (hasDocument && "ontouchstart" in document.documentElement)
);

export const isWebGL2Supported =
    hasDocument && !!document.createElement("canvas").getContext?.("webgl2");

export const isWebGPUSupported = hasNavigator && "gpu" in navigator;

// A finger is the main pointer: a phone or tablet, not a laptop with a touch screen
export const isCoarsePointer =
    hasWindow && !!window.matchMedia?.("(pointer: coarse)")?.matches;

// Phones report 3 or so, and filling that many pixels costs far more than it
// shows on a screen this small
const MAX_TOUCH_PIXEL_RATIO = 1.5;

export const pixelRatio = hasWindow
    ? isCoarsePointer
        ? Math.min(window.devicePixelRatio || 1, MAX_TOUCH_PIXEL_RATIO)
        : window.devicePixelRatio || 1
    : 1;
