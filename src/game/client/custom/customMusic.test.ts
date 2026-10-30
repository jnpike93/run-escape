import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { ALL_MAPS } from "../../content/maps";
import { CUSTOM_MUSIC, TITLE_MUSIC } from "./customMusic";

describe("OSRS map and title music tracks", () => {
    test("every campaign and fun map has a music track assigned", () => {
        for (const map of ALL_MAPS) {
            expect(map.music, `Missing music on map ${map.id}`).toBeDefined();
            if (map.music !== "Massacre") {
                expect(CUSTOM_MUSIC[map.music!], `Unmapped track ${map.music} on ${map.id}`).toBeDefined();
            }
        }
    });

    test("title music and all custom music .ogg files exist on disk", () => {
        expect(CUSTOM_MUSIC[TITLE_MUSIC]).toBeDefined();
        const rootDir = path.resolve(__dirname, "../../../..");
        for (const [trackName, relUrl] of Object.entries(CUSTOM_MUSIC)) {
            const diskPath = path.resolve(rootDir, relUrl.replace(/^\.\//, ""));
            expect(fs.existsSync(diskPath), `Missing file for ${trackName}: ${diskPath}`).toBe(true);
            const stat = fs.statSync(diskPath);
            expect(stat.size, `Empty audio file for ${trackName}`).toBeGreaterThan(10000);
        }
    });
});

