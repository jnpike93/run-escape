#!/usr/bin/env node
/**
 * sync_dist.cjs - Synchronizes Vite build output from dist/ and canonical
 * hand-authored scripts from src/custom/ into the root static-served assets/
 * directory and updates index.html while preserving custom scripts,
 * subdirectories, cache-busting query strings, and CSP headers.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const DIST_ASSETS_DIR = path.join(DIST_DIR, "assets");
const ROOT_ASSETS_DIR = path.join(ROOT_DIR, "assets");
const CUSTOM_SRC_DIR = path.join(ROOT_DIR, "src", "custom");
const DIST_INDEX = path.join(DIST_DIR, "index.html");
const ROOT_INDEX = path.join(ROOT_DIR, "index.html");

const PRESERVED_ASSETS = new Set([
    "multiplayer",
    "prayer",
    "multiplayer.js",
    "cooks-assistant.js",
    "tile-coords.js",
    "debug-mode.js",
    "quest-complete.ogg",
]);

const OBSOLETE_HASHED_RE =
    /^(index|MapViewerApp|RenderDataWorker|module|favicon)-.*\.(js|css|wasm|ico)(\.map)?$/;

function copyCustomDirSync(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        if (/\.test\.(js|ts|tsx)$/.test(entry.name)) {
            continue;
        }
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyCustomDirSync(srcPath, destPath);
        } else if (entry.isFile()) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function main() {
    if (!fs.existsSync(DIST_ASSETS_DIR)) {
        console.error(`[sync_dist] Missing build directory: ${DIST_ASSETS_DIR}`);
        process.exit(1);
    }

    fs.mkdirSync(ROOT_ASSETS_DIR, { recursive: true });

    // Determine active cache-busting query string (?v=X.Y)
    let versionQuery = "?v=8.5";
    const argVer = process.argv.find((a) => a.startsWith("--version="));
    if (argVer) {
        versionQuery = `?v=${argVer.split("=")[1]}`;
    } else if (fs.existsSync(ROOT_INDEX)) {
        const m = fs.readFileSync(ROOT_INDEX, "utf8").match(/\?v=([0-9.]+)/);
        if (m) {
            versionQuery = `?v=${m[1]}`;
        }
    }

    // 1. Remove obsolete Vite-hashed bundles from root assets/
    for (const entry of fs.readdirSync(ROOT_ASSETS_DIR)) {
        if (PRESERVED_ASSETS.has(entry)) {
            continue;
        }
        const fullPath = path.join(ROOT_ASSETS_DIR, entry);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch {
            continue;
        }
        if (stat.isFile() && OBSOLETE_HASHED_RE.test(entry)) {
            fs.unlinkSync(fullPath);
        }
    }

    // 2. Copy canonical hand-authored custom runtime scripts and assets from src/custom/ into root assets/
    if (fs.existsSync(CUSTOM_SRC_DIR)) {
        copyCustomDirSync(CUSTOM_SRC_DIR, ROOT_ASSETS_DIR);
    }

    // 3. Copy all built files (excluding .map sourcemaps and hashed favicons) from dist/assets/ into root assets/
    const distEntries = fs
        .readdirSync(DIST_ASSETS_DIR)
        .filter((e) => !e.endsWith(".map") && !/^favicon-.*\.ico$/.test(e));
    let newIndexJs = null;
    let newIndexCss = null;

    for (const entry of distEntries) {
        const srcPath = path.join(DIST_ASSETS_DIR, entry);
        const destPath = path.join(ROOT_ASSETS_DIR, entry);
        const stat = fs.statSync(srcPath);
        if (stat.isFile()) {
            fs.copyFileSync(srcPath, destPath);
            if (/^index-[A-Za-z0-9_-]+\.js$/.test(entry)) {
                newIndexJs = entry;
            } else if (/^index-[A-Za-z0-9_-]+\.css$/.test(entry)) {
                newIndexCss = entry;
            }
        }
    }

    // Fallback to parsing dist/index.html if needed
    if ((!newIndexJs || !newIndexCss) && fs.existsSync(DIST_INDEX)) {
        const distHtml = fs.readFileSync(DIST_INDEX, "utf8");
        const jsMatch = distHtml.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
        const cssMatch = distHtml.match(/assets\/(index-[A-Za-z0-9_-]+\.css)/);
        if (!newIndexJs && jsMatch) newIndexJs = jsMatch[1];
        if (!newIndexCss && cssMatch) newIndexCss = cssMatch[1];
    }

    if (!newIndexJs || !newIndexCss) {
        console.error(
            `[sync_dist] Could not locate built index-*.js (${newIndexJs}) or index-*.css (${newIndexCss}) in dist/assets/`,
        );
        process.exit(1);
    }

    // 4. Inject cache-busting query string into cross-bundle imports in built JS files
    for (const entry of distEntries) {
        if (!entry.endsWith(".js")) continue;
        const jsPath = path.join(ROOT_ASSETS_DIR, entry);
        let code = fs.readFileSync(jsPath, "utf8");
        code = code
            .replace(/(\r?\n)?\/\/# sourceMappingURL=.*$/s, "")
            .replace(
                /(["']\.\/(?:index|MapViewerApp|RenderDataWorker|module)-[A-Za-z0-9_-]+\.(?:js|css))(["'])/g,
                `$1${versionQuery}$2`,
            )
            .replace(
                /(new URL\(["']\.\/RenderDataWorker-[A-Za-z0-9_-]+\.js)(["'])/g,
                `$1${versionQuery}$2`,
            );
        fs.writeFileSync(jsPath, code, "utf8");
    }

    // 5. Update root index.html, src/custom/multiplayer.js, and assets/multiplayer.js with versionQuery
    if (fs.existsSync(ROOT_INDEX)) {
        let html = fs.readFileSync(ROOT_INDEX, "utf8");
        html = html
            .replace(
                /(\.\/assets\/)index-[A-Za-z0-9_-]+\.js(\?v=[0-9.]+)?/g,
                `$1${newIndexJs}${versionQuery}`,
            )
            .replace(
                /(\.\/assets\/)index-[A-Za-z0-9_-]+\.css(\?v=[0-9.]+)?/g,
                `$1${newIndexCss}${versionQuery}`,
            )
            .replace(/\?v=[0-9.]+/g, versionQuery);
        fs.writeFileSync(ROOT_INDEX, html, "utf8");
    }

    for (const baseDir of [CUSTOM_SRC_DIR, ROOT_ASSETS_DIR]) {
        const mpPath = path.join(baseDir, "multiplayer.js");
        if (fs.existsSync(mpPath)) {
            const mpCode = fs.readFileSync(mpPath, "utf8").replace(/\?v=[0-9.]+/g, versionQuery);
            fs.writeFileSync(mpPath, mpCode, "utf8");
        }

        const mpDir = path.join(baseDir, "multiplayer");
        if (fs.existsSync(mpDir)) {
            for (const entry of fs.readdirSync(mpDir)) {
                if (!entry.endsWith(".js")) continue;
                const subPath = path.join(mpDir, entry);
                const subCode = fs.readFileSync(subPath, "utf8").replace(/\?v=[0-9.]+/g, versionQuery);
                fs.writeFileSync(subPath, subCode, "utf8");
            }
        }
    }

    console.log(
        `[sync_dist] Synced ${distEntries.length} files to assets/ (entry: ${newIndexJs}, styles: ${newIndexCss}, version: ${versionQuery})`,
    );
}

main();
