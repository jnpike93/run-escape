export const DEADZONE_PX = 8;
export const MAX_RADIUS_PX = 52;
export const PINCH_STEP_PX = 40;

type TouchPoint = {
    identifier: number;
    clientX: number;
    clientY: number;
};

type TouchEventLike = Event & {
    touches: ArrayLike<TouchPoint>;
    changedTouches?: ArrayLike<TouchPoint>;
};

export class MobileTouchInput {
    private activeTouchId: number | null = null;
    private originX = 0;
    private originY = 0;
    private currentX = 0;
    private currentY = 0;
    private moveX = 0;
    private moveY = 0;

    private pinchLastDist: number | null = null;
    private pinchAccum = 0;

    private ringEl: HTMLDivElement | null = null;
    private knobEl: HTMLDivElement | null = null;

    constructor(
        private readonly target: HTMLElement,
        private readonly onZoom?: (steps: number) => void,
    ) {
        this.target.addEventListener("touchstart", this.onTouchStart as EventListener, {
            passive: false,
        });
        this.target.addEventListener("touchmove", this.onTouchMove as EventListener, {
            passive: false,
        });
        this.target.addEventListener("touchend", this.onTouchEnd as EventListener, {
            passive: false,
        });
        this.target.addEventListener("touchcancel", this.onTouchEnd as EventListener, {
            passive: false,
        });
    }

    getMoveVector(out: { x: number; y: number }): { x: number; y: number } {
        out.x = this.moveX;
        out.y = this.moveY;
        return out;
    }

    reset(): void {
        this.activeTouchId = null;
        this.moveX = 0;
        this.moveY = 0;
        this.pinchLastDist = null;
        this.pinchAccum = 0;
        this.hideIndicator();
    }

    dispose(): void {
        this.reset();
        this.target.removeEventListener("touchstart", this.onTouchStart as EventListener);
        this.target.removeEventListener("touchmove", this.onTouchMove as EventListener);
        this.target.removeEventListener("touchend", this.onTouchEnd as EventListener);
        this.target.removeEventListener("touchcancel", this.onTouchEnd as EventListener);
        if (this.ringEl && this.ringEl.parentNode) {
            this.ringEl.parentNode.removeChild(this.ringEl);
        }
        this.ringEl = null;
        this.knobEl = null;
    }

    private onTouchStart = (event: TouchEventLike): void => {
        const touches = event.touches;
        if (!touches) {
            return;
        }
        if (touches.length === 1) {
            const touch = touches[0];
            this.activeTouchId = touch.identifier ?? 0;
            this.originX = touch.clientX;
            this.originY = touch.clientY;
            this.currentX = this.originX;
            this.currentY = this.originY;
            this.moveX = 0;
            this.moveY = 0;
            this.pinchLastDist = null;
            this.pinchAccum = 0;
            this.hideIndicator();
        } else if (touches.length === 2) {
            this.activeTouchId = null;
            this.moveX = 0;
            this.moveY = 0;
            this.hideIndicator();
            const t0 = touches[0];
            const t1 = touches[1];
            this.pinchLastDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            this.pinchAccum = 0;
        }
    };

    private onTouchMove = (event: TouchEventLike): void => {
        if (typeof event.preventDefault === "function") {
            event.preventDefault();
        }
        const touches = event.touches;
        if (!touches) {
            return;
        }

        if (touches.length === 2) {
            this.activeTouchId = null;
            this.moveX = 0;
            this.moveY = 0;
            this.hideIndicator();

            const t0 = touches[0];
            const t1 = touches[1];
            const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            if (this.pinchLastDist === null) {
                this.pinchLastDist = dist;
                this.pinchAccum = 0;
                return;
            }
            const delta = dist - this.pinchLastDist;
            this.pinchLastDist = dist;
            this.pinchAccum += delta;

            const pinchSteps = Math.trunc(this.pinchAccum / PINCH_STEP_PX);
            if (pinchSteps !== 0) {
                this.pinchAccum -= pinchSteps * PINCH_STEP_PX;
                // Pinching fingers apart (positive delta) = zoom in = negative wheel step (-1)
                // Pinching fingers together (negative delta) = zoom out = positive wheel step (+1)
                this.onZoom?.(-pinchSteps);
            }
            return;
        }

        if (touches.length === 1 && this.activeTouchId !== null) {
            const touch = this.findTouch(touches, this.activeTouchId);
            if (!touch) {
                return;
            }
            this.currentX = touch.clientX;
            this.currentY = touch.clientY;
            const dx = this.currentX - this.originX;
            const dy = this.currentY - this.originY;
            const dist = Math.hypot(dx, dy);

            if (dist <= DEADZONE_PX) {
                this.moveX = 0;
                this.moveY = 0;
                this.hideIndicator();
                return;
            }

            const clampedDist = Math.min(dist, MAX_RADIUS_PX);
            const mag = (clampedDist - DEADZONE_PX) / (MAX_RADIUS_PX - DEADZONE_PX);
            this.moveX = (dx / dist) * mag;
            this.moveY = (-dy / dist) * mag;
            this.updateIndicator((dx / dist) * clampedDist, (dy / dist) * clampedDist);
        }
    };

    private onTouchEnd = (event: TouchEventLike): void => {
        const touches = event.touches;
        if (!touches || touches.length === 0) {
            this.reset();
            return;
        }
        if (touches.length < 2) {
            this.pinchLastDist = null;
            this.pinchAccum = 0;
        }
        if (this.activeTouchId !== null && !this.findTouch(touches, this.activeTouchId)) {
            this.activeTouchId = null;
            this.moveX = 0;
            this.moveY = 0;
            this.hideIndicator();
        }
    };

    private findTouch(touches: ArrayLike<TouchPoint>, id: number): TouchPoint | undefined {
        for (let i = 0; i < touches.length; i++) {
            const t = touches[i];
            if ((t.identifier ?? 0) === id) {
                return t;
            }
        }
        return undefined;
    }

    private ensureIndicator(): void {
        if (this.ringEl || typeof document === "undefined" || typeof document.createElement !== "function") {
            return;
        }
        const host = this.target.parentElement ?? document.body;
        if (!host || typeof host.appendChild !== "function") {
            return;
        }
        const ring = document.createElement("div");
        ring.className = "mobile-joystick-ring";
        ring.style.cssText =
            "position:fixed;width:104px;height:104px;border:2px solid rgba(255, 152, 31, 0.55);" +
            "background:rgba(30, 24, 16, 0.35);border-radius:50%;pointer-events:none;z-index:40;" +
            "box-sizing:border-box;display:none;";

        const knob = document.createElement("div");
        knob.className = "mobile-joystick-knob";
        knob.style.cssText =
            "position:absolute;left:50%;top:50%;width:42px;height:42px;border:2px solid #ff981f;" +
            "background:rgba(255, 152, 31, 0.45);border-radius:50%;pointer-events:none;" +
            "box-sizing:border-box;transform:translate(-50%, -50%);";

        ring.appendChild(knob);
        host.appendChild(ring);
        this.ringEl = ring;
        this.knobEl = knob;
    }

    private updateIndicator(offsetX: number, offsetY: number): void {
        this.ensureIndicator();
        if (!this.ringEl || !this.knobEl) {
            return;
        }
        this.ringEl.style.display = "block";
        this.ringEl.style.left = `${this.originX - 52}px`;
        this.ringEl.style.top = `${this.originY - 52}px`;
        this.knobEl.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    }

    private hideIndicator(): void {
        if (this.ringEl) {
            this.ringEl.style.display = "none";
        }
    }
}
