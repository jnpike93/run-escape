import { vec4 } from "gl-matrix";
import { describe, expect, test } from "vitest";

import { getMapSquareId } from "../rs/map/MapFileIndex";
import { Camera } from "./Camera";
import { MapManager, MapSquare } from "./MapManager";

class DummyMapSquare implements MapSquare {
    constructor(
        readonly mapX: number,
        readonly mapY: number,
    ) {}
    canRender(): boolean {
        return true;
    }
    delete(): void {}
}

describe("MapManager", () => {
    test("clamps queued map squares to playArea so out-of-arena border squares are not loaded", () => {
        const loaded: Array<[number, number]> = [];
        const manager = new MapManager<DummyMapSquare>(16, (mx, my) => {
            loaded.push([mx, my]);
        });
        manager.init(
            {
                getTerrainArchiveId: () => 1,
                getLocArchiveId: () => 1,
            },
            true,
        );

        // Lumbridge 3x3 arena: map squares 49..51, 49..51 (tiles 3136..3328)
        const playArea = vec4.fromValues(49 * 64, 49 * 64, 52 * 64, 52 * 64);
        const camera = new Camera(3140, -26, 3140, -400, 0);
        camera.update(800, 600);

        manager.update(camera, 1, 128, 2, playArea);

        expect(loaded.length).toBeGreaterThan(0);
        for (const [mx, my] of loaded) {
            expect(mx).toBeGreaterThanOrEqual(49);
            expect(mx).toBeLessThanOrEqual(51);
            expect(my).toBeGreaterThanOrEqual(49);
            expect(my).toBeLessThanOrEqual(51);
        }
    });

    test("clearMaps preserves invalidMapIds across plane changes", () => {
        const manager = new MapManager<DummyMapSquare>(16, () => {});
        manager.init(
            {
                getTerrainArchiveId: (mx, my) => (mx === 50 && my === 50 ? 1 : -1),
                getLocArchiveId: (mx, my) => (mx === 50 && my === 50 ? 1 : -1),
            },
            false,
        );

        expect(manager.invalidMapIds.has(getMapSquareId(10, 10))).toBe(true);
        manager.addMap(50, 50, new DummyMapSquare(50, 50));
        expect(manager.mapSquares.size).toBe(1);

        manager.cleanUp();
        expect(manager.mapSquares.size).toBe(0);
        expect(manager.invalidMapIds.has(getMapSquareId(10, 10))).toBe(true);
    });
});

