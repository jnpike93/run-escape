import { COSINE, SINE } from "../../rs/MathConstants";
import { Rasterizer2D } from "../../rs/graphics/Rasterizer2D";
import { Rasterizer3D } from "../../rs/graphics/Rasterizer3D";
import { Model } from "../../rs/model/Model";
import { ICON_HEIGHT, ICON_WIDTH } from "./ItemIconLoader";
import { WorkerState } from "./RenderDataWorker";

const OUTLINE_RGB = 0x010101;
const SHADOW_RGB = 0x302020;
const INVALID_HSL_COLOR = -2;

const screenX = new Int32Array(4096);
const screenY = new Int32Array(4096);
const viewZ = new Int32Array(4096);

function projectModel(
    model: Model,
    yan2d: number,
    zan2d: number,
    xan2d: number,
    xOffset: number,
    yOffset: number,
    zOffset: number,
): boolean {
    if (model.verticesCount > screenX.length) {
        return false;
    }
    const centerX = Rasterizer3D.centerX;
    const centerY = Rasterizer3D.centerY;
    const sinY = SINE[yan2d & 2047];
    const cosY = COSINE[yan2d & 2047];
    const sinZ = SINE[zan2d & 2047];
    const cosZ = COSINE[zan2d & 2047];
    const sinX = SINE[xan2d & 2047];
    const cosX = COSINE[xan2d & 2047];
    const originZ = (yOffset * sinX + zOffset * cosX) >> 16;
    for (let i = 0; i < model.verticesCount; i++) {
        let x = model.verticesX[i];
        let y = model.verticesY[i];
        let z = model.verticesZ[i];
        if (zan2d !== 0) {
            const t = (y * sinZ + x * cosZ) >> 16;
            y = (y * cosZ - x * sinZ) >> 16;
            x = t;
        }
        if (yan2d !== 0) {
            const t = (z * sinY + x * cosY) >> 16;
            z = (z * cosY - x * sinY) >> 16;
            x = t;
        }
        x += xOffset;
        y += yOffset;
        z += zOffset;
        const t = (y * cosX - z * sinX) >> 16;
        z = (y * sinX + z * cosX) >> 16;
        y = t;
        viewZ[i] = z - originZ;
        if (z <= 0) {
            z = 1;
        }
        screenX[i] = (centerX + (x << 9) / z) | 0;
        screenY[i] = (centerY + (y << 9) / z) | 0;
    }
    return true;
}

function shadeTextureAverage(averageHsl: number, lightness: number): number {
    lightness = ((averageHsl & 0x7f) * lightness) >> 7;
    if (lightness < 2) {
        lightness = 2;
    } else if (lightness > 126) {
        lightness = 126;
    }
    return (averageHsl & 0xff80) + lightness;
}

function drawFace(model: Model, f: number, textureAverageHsl: (id: number) => number): void {
    const a = model.indices1[f];
    const b = model.indices2[f];
    const c = model.indices3[f];
    let hslA = model.faceColors1[f] & 0xffff;
    let hslB = model.faceColors2[f] & 0xffff;
    let hslC = model.faceColors3[f] & 0xffff;
    if (model.faceColors3[f] === -1) {
        hslB = hslC = hslA;
    }
    const textureId = model.faceTextures ? model.faceTextures[f] : -1;
    if (textureId !== -1) {
        const average = textureAverageHsl(textureId);
        hslA = shadeTextureAverage(average, hslA & 0x7f);
        hslB = shadeTextureAverage(average, hslB & 0x7f);
        hslC = shadeTextureAverage(average, hslC & 0x7f);
    }
    const xa = screenX[a];
    const xb = screenX[b];
    const xc = screenX[c];
    const endX = Rasterizer3D.endX;
    const endY = Rasterizer3D.endY;
    Rasterizer3D.rasterClipEnable =
        xa < 0 || xb < 0 || xc < 0 || xa > endX || xb > endX || xc > endX;
    if (screenY[a] < 0 && screenY[b] < 0 && screenY[c] < 0) {
        return;
    }
    if (screenY[a] > endY && screenY[b] > endY && screenY[c] > endY) {
        return;
    }
    Rasterizer3D.rasterAlpha = model.faceAlphas ? model.faceAlphas[f] & 0xff : 0;
    Rasterizer3D.rasterGouraud(screenY[a], screenY[b], screenY[c], xa, xb, xc, hslA, hslB, hslC);
    Rasterizer3D.rasterAlpha = 0;
}

function drawModel(model: Model, textureAverageHsl: (id: number) => number): void {
    const faceCount = model.faceCount;
    const faces: number[] = [];
    const depth = new Int32Array(faceCount);
    for (let f = 0; f < faceCount; f++) {
        if (model.faceColors3[f] === INVALID_HSL_COLOR) {
            continue;
        }
        const a = model.indices1[f];
        const b = model.indices2[f];
        const c = model.indices3[f];
        const cross =
            (screenX[b] - screenX[a]) * (screenY[c] - screenY[a]) -
            (screenY[b] - screenY[a]) * (screenX[c] - screenX[a]);
        if (cross >= 0) {
            continue;
        }
        depth[f] = Math.trunc((viewZ[a] + viewZ[b] + viewZ[c]) / 3) + model.radius;
        faces.push(f);
    }
    faces.sort((fa, fb) => depth[fb] - depth[fa] || fa - fb);

    const priorities = model.faceRenderPriorities;
    if (!priorities) {
        for (const f of faces) {
            drawFace(model, f, textureAverageHsl);
        }
        return;
    }

    const byPriority: number[][] = [];
    const depthSums = new Array<number>(12).fill(0);
    for (let p = 0; p < 12; p++) {
        byPriority.push([]);
    }
    for (const f of faces) {
        const p = Math.min(priorities[f] & 0xff, 11);
        byPriority[p].push(f);
        depthSums[p] += depth[f];
    }
    const averageDepth = (p1: number, p2: number): number => {
        const count = byPriority[p1].length + byPriority[p2].length;
        return count > 0 ? Math.trunc((depthSums[p1] + depthSums[p2]) / count) : 0;
    };
    const depth12 = averageDepth(1, 2);
    const depth34 = averageDepth(3, 4);
    const depth68 = averageDepth(6, 8);

    const late = byPriority[10].concat(byPriority[11]);
    let next = 0;
    const nextDepth = (): number => (next < late.length ? depth[late[next]] : -1000);
    for (let p = 0; p < 10; p++) {
        const before = p === 0 ? depth12 : p === 3 ? depth34 : p === 5 ? depth68 : undefined;
        if (before !== undefined) {
            while (nextDepth() > before) {
                drawFace(model, late[next++], textureAverageHsl);
            }
        }
        for (const f of byPriority[p]) {
            drawFace(model, f, textureAverageHsl);
        }
    }
    while (next < late.length) {
        drawFace(model, late[next++], textureAverageHsl);
    }
}

function outlineAndShadow(pixels: Int32Array, width: number, height: number): void {
    const copy = pixels.slice();
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = x + y * width;
            if (copy[i] !== 0) {
                continue;
            }
            if (
                (x > 0 && copy[i - 1] !== 0) ||
                (y > 0 && copy[i - width] !== 0) ||
                (x < width - 1 && copy[i + 1] !== 0) ||
                (y < height - 1 && copy[i + width] !== 0)
            ) {
                pixels[i] = OUTLINE_RGB;
            }
        }
    }
    for (let y = height - 1; y > 0; y--) {
        for (let x = width - 1; x > 0; x--) {
            const i = x + y * width;
            if (pixels[i] === 0 && pixels[i - width - 1] !== 0) {
                pixels[i] = SHADOW_RGB;
            }
        }
    }
}

export function renderNpcItemIcon(state: WorkerState, objId: number): Int32Array {
    const pixels = new Int32Array(ICON_WIDTH * ICON_HEIGHT);
    const npcType = state.npcTypeLoader.load(-objId);
    const idleSeq = npcType.idleSeqId !== -1 ? npcType.idleSeqId : 6561;
    const model =
        state.npcModelLoader.getModel(npcType, idleSeq, 0) ||
        state.npcModelLoader.getModel(npcType, -1, -1);
    if (!model) {
        return pixels;
    }
    Rasterizer2D.setRaster(pixels, ICON_WIDTH, ICON_HEIGHT);
    Rasterizer2D.setClip(0, 0, ICON_WIDTH, ICON_HEIGHT);
    Rasterizer3D.setClip();
    Rasterizer3D.setViewport(18, 16);
    Rasterizer3D.rasterGouraudLowRes = false;
    Rasterizer3D.rasterAlpha = 0;
    model.calculateBoundsCylinder();
    let bh = 0;
    let brSq = 1;
    for (let c = 0; c < model.verticesCount; c++) {
        const vy = -model.verticesY[c];
        if (vy > bh) {
            bh = vy;
        }
        const vx = model.verticesX[c];
        const vz = model.verticesZ[c];
        const rSq = vx * vx + vz * vz;
        if (rSq > brSq) {
            brSq = rSq;
        }
    }
    const br = Math.sqrt(brSq);
    const ext = Math.max(bh, br * 1.85, 20);
    const zoom = Math.round((ext * 512) / 25);
    const xan = 190;
    const yan = 1740;
    const sin = (SINE[xan & 2047] * zoom) >> 16;
    const cos = (COSINE[xan & 2047] * zoom) >> 16;
    if (projectModel(model, yan, 0, xan, 0, ((bh / 2) | 0) + sin + 2, cos + 2)) {
        drawModel(model, (id) => state.textureLoader.getAverageHsl(id));
    }
    outlineAndShadow(pixels, ICON_WIDTH, ICON_HEIGHT);
    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] !== 0) {
            pixels[i] |= 0xff000000;
        }
    }
    return pixels;
}
