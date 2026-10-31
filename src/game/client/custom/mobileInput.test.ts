import { describe, expect, it, vi } from "vitest";

import { DEADZONE_PX, MAX_RADIUS_PX, MobileTouchInput, PINCH_STEP_PX } from "./mobileInput";

type ListenerMap = Record<string, EventListener[]>;

function createMockElement(): {
    element: HTMLElement;
    dispatch: (type: string, touches: Array<{ identifier?: number; clientX: number; clientY: number }>) => {
        defaultPrevented: boolean;
    };
} {
    const listeners: ListenerMap = {};
    const element = {
        addEventListener: vi.fn((type: string, cb: EventListener) => {
            if (!listeners[type]) {
                listeners[type] = [];
            }
            listeners[type].push(cb);
        }),
        removeEventListener: vi.fn((type: string, cb: EventListener) => {
            if (listeners[type]) {
                listeners[type] = listeners[type].filter((fn) => fn !== cb);
            }
        }),
        parentElement: null,
    } as unknown as HTMLElement;

    const dispatch = (
        type: string,
        touches: Array<{ identifier?: number; clientX: number; clientY: number }>,
    ) => {
        let defaultPrevented = false;
        const event = {
            type,
            touches: touches.map((t, idx) => ({
                identifier: t.identifier ?? idx,
                clientX: t.clientX,
                clientY: t.clientY,
            })),
            preventDefault: () => {
                defaultPrevented = true;
            },
        } as unknown as Event;
        for (const cb of listeners[type] ?? []) {
            cb(event);
        }
        return { defaultPrevented };
    };

    return { element, dispatch };
}

describe("MobileTouchInput", () => {
    it("returns (0, 0) within the deadzone (dist <= 8px)", () => {
        const { element, dispatch } = createMockElement();
        const input = new MobileTouchInput(element);
        const out = { x: 0, y: 0 };

        dispatch("touchstart", [{ identifier: 1, clientX: 100, clientY: 100 }]);
        expect(input.getMoveVector(out)).toEqual({ x: 0, y: 0 });

        // Drag exactly DEADZONE_PX right
        dispatch("touchmove", [{ identifier: 1, clientX: 100 + DEADZONE_PX, clientY: 100 }]);
        expect(input.getMoveVector(out)).toEqual({ x: 0, y: 0 });

        // Drag inside deadzone diagonally (e.g. 4, 4 -> dist ~5.66)
        dispatch("touchmove", [{ identifier: 1, clientX: 104, clientY: 104 }]);
        expect(input.getMoveVector(out)).toEqual({ x: 0, y: 0 });

        input.dispose();
    });

    it("computes cardinal and diagonal movement vectors with screen-Y inverted to north (+y)", () => {
        const { element, dispatch } = createMockElement();
        const input = new MobileTouchInput(element);
        const out = { x: 0, y: 0 };

        dispatch("touchstart", [{ identifier: 1, clientX: 200, clientY: 200 }]);

        // Drag east (right): +x, 0y
        dispatch("touchmove", [{ identifier: 1, clientX: 200 + MAX_RADIUS_PX, clientY: 200 }]);
        input.getMoveVector(out);
        expect(out.x).toBeCloseTo(1, 5);
        expect(out.y).toBeCloseTo(0, 5);

        // Drag west (left): -x, 0y
        dispatch("touchmove", [{ identifier: 1, clientX: 200 - MAX_RADIUS_PX, clientY: 200 }]);
        input.getMoveVector(out);
        expect(out.x).toBeCloseTo(-1, 5);
        expect(out.y).toBeCloseTo(0, 5);

        // Drag north (screen up, clientY decreases): 0x, +y
        dispatch("touchmove", [{ identifier: 1, clientX: 200, clientY: 200 - MAX_RADIUS_PX }]);
        input.getMoveVector(out);
        expect(out.x).toBeCloseTo(0, 5);
        expect(out.y).toBeCloseTo(1, 5);

        // Drag south (screen down, clientY increases): 0x, -y
        dispatch("touchmove", [{ identifier: 1, clientX: 200, clientY: 200 + MAX_RADIUS_PX }]);
        input.getMoveVector(out);
        expect(out.x).toBeCloseTo(0, 5);
        expect(out.y).toBeCloseTo(-1, 5);

        // Drag northeast (right + up) at max radius: (+sqrt(0.5), +sqrt(0.5))
        dispatch("touchmove", [
            { identifier: 1, clientX: 200 + 100, clientY: 200 - 100 },
        ]);
        input.getMoveVector(out);
        expect(out.x).toBeCloseTo(Math.SQRT1_2, 5);
        expect(out.y).toBeCloseTo(Math.SQRT1_2, 5);

        input.dispose();
    });

    it("scales magnitude smoothly between DEADZONE_PX and MAX_RADIUS_PX and clamps beyond MAX_RADIUS_PX", () => {
        const { element, dispatch } = createMockElement();
        const input = new MobileTouchInput(element);
        const out = { x: 0, y: 0 };

        dispatch("touchstart", [{ identifier: 1, clientX: 100, clientY: 100 }]);

        // Halfway between DEADZONE_PX (8) and MAX_RADIUS_PX (52) is dist = 30 -> mag = 0.5
        const midDist = (DEADZONE_PX + MAX_RADIUS_PX) / 2;
        dispatch("touchmove", [{ identifier: 1, clientX: 100 + midDist, clientY: 100 }]);
        input.getMoveVector(out);
        expect(out.x).toBeCloseTo(0.5, 5);
        expect(out.y).toBeCloseTo(0, 5);

        // Drag far past MAX_RADIUS_PX (e.g. 200px) -> magnitude clamped to 1.0
        dispatch("touchmove", [{ identifier: 1, clientX: 300, clientY: 100 }]);
        input.getMoveVector(out);
        expect(out.x).toBeCloseTo(1, 5);
        expect(out.y).toBeCloseTo(0, 5);

        input.dispose();
    });

    it("handles two-finger pinch-to-zoom and clears single-finger movement while pinching", () => {
        const { element, dispatch } = createMockElement();
        const zoomSteps: number[] = [];
        const input = new MobileTouchInput(element, (steps) => zoomSteps.push(steps));
        const out = { x: 0, y: 0 };

        // Start walking east with 1 finger
        dispatch("touchstart", [{ identifier: 1, clientX: 100, clientY: 100 }]);
        dispatch("touchmove", [{ identifier: 1, clientX: 160, clientY: 100 }]);
        expect(input.getMoveVector(out).x).toBeCloseTo(1, 5);

        // Second finger touches down at distance 100px from first finger
        dispatch("touchstart", [
            { identifier: 1, clientX: 100, clientY: 100 },
            { identifier: 2, clientX: 200, clientY: 100 },
        ]);
        expect(input.getMoveVector(out)).toEqual({ x: 0, y: 0 });

        // Spread fingers apart by 2 * PINCH_STEP_PX (distance 100 -> 180) -> zoom in (-2 wheel steps)
        dispatch("touchmove", [
            { identifier: 1, clientX: 100, clientY: 100 },
            { identifier: 2, clientX: 100 + 100 + PINCH_STEP_PX * 2, clientY: 100 },
        ]);
        expect(zoomSteps).toEqual([-2]);
        expect(input.getMoveVector(out)).toEqual({ x: 0, y: 0 });

        // Pinch fingers together by PINCH_STEP_PX (distance 180 -> 140) -> zoom out (+1 wheel step)
        dispatch("touchmove", [
            { identifier: 1, clientX: 100, clientY: 100 },
            { identifier: 2, clientX: 100 + 100 + PINCH_STEP_PX, clientY: 100 },
        ]);
        expect(zoomSteps).toEqual([-2, 1]);

        input.dispose();
    });

    it("clears movement vector on touchend, touchcancel, and reset()", () => {
        const { element, dispatch } = createMockElement();
        const input = new MobileTouchInput(element);
        const out = { x: 0, y: 0 };

        dispatch("touchstart", [{ identifier: 1, clientX: 100, clientY: 100 }]);
        dispatch("touchmove", [{ identifier: 1, clientX: 160, clientY: 100 }]);
        expect(input.getMoveVector(out).x).toBeGreaterThan(0);

        dispatch("touchend", []);
        expect(input.getMoveVector(out)).toEqual({ x: 0, y: 0 });

        dispatch("touchstart", [{ identifier: 2, clientX: 100, clientY: 100 }]);
        dispatch("touchmove", [{ identifier: 2, clientX: 100, clientY: 40 }]);
        expect(input.getMoveVector(out).y).toBeGreaterThan(0);

        input.reset();
        expect(input.getMoveVector(out)).toEqual({ x: 0, y: 0 });

        input.dispose();
    });
});
