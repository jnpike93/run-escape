#!/usr/bin/env node
/**
 * auto_sync_upstream.cjs - Automated upstream merge, TypeScript/Vite build,
 * bundle cache-busting sync, verification suite, and PM2 reload script.
 *
 * Designed to run via cron on cuteanimegirls.moe (/opt/run-escape) as well as
 * in CI or local environments. Safely rolls back on any merge conflict or test
 * failure so the live production server is never left in a broken state.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync, spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const GIT_DIR = path.join(ROOT_DIR, ".git");
const LOCK_FILE = path.join(GIT_DIR, "auto_sync_upstream.lock");
const UPSTREAM_URL = "https://github.com/Dynrothe/Run-Escape.git";
const INDEX_HTML = path.join(ROOT_DIR, "index.html");
const CHANGELOG_MD = path.join(ROOT_DIR, "docs", "CHANGELOG.md");
const AGENT_NOTES_MD = path.join(ROOT_DIR, "docs", "AGENT_NOTES.md");
const ASSETS_DIR = path.join(ROOT_DIR, "assets");
const CUSTOM_SRC_DIR = path.join(ROOT_DIR, "src", "custom");

function log(msg) {
    const ts = new Date().toISOString();
    console.log(`[auto_sync ${ts}] ${msg}`);
}

function run(cmd, opts = {}) {
    return execSync(cmd, {
        cwd: ROOT_DIR,
        encoding: "utf8",
        stdio: opts.stdio || "pipe",
        ...opts,
    }).trim();
}

function tryRun(cmd, opts = {}) {
    try {
        const out = run(cmd, opts);
        return { ok: true, out };
    } catch (err) {
        return {
            ok: false,
            out: (err.stdout || "") + "\n" + (err.stderr || err.message || ""),
        };
    }
}

function acquireLock() {
    if (!fs.existsSync(GIT_DIR)) {
        console.error(`[auto_sync] Not a git repository: ${ROOT_DIR}`);
        process.exit(1);
    }
    if (fs.existsSync(LOCK_FILE)) {
        try {
            const pid = parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10);
            if (pid) {
                process.kill(pid, 0);
                log(`Another sync process (PID ${pid}) is currently running. Exiting.`);
                process.exit(0);
            }
        } catch {
            // Stale lock file; overwrite below
        }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid), "utf8");
    const cleanup = () => {
        try {
            if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
        } catch {}
    };
    process.on("exit", cleanup);
    process.on("SIGINT", () => {
        cleanup();
        process.exit(130);
    });
    process.on("SIGTERM", () => {
        cleanup();
        process.exit(143);
    });
}

function readNextVersion() {
    let current = "8.4";
    if (fs.existsSync(INDEX_HTML)) {
        const m = fs.readFileSync(INDEX_HTML, "utf8").match(/\?v=([0-9]+)\.([0-9]+)/);
        if (m) {
            const major = parseInt(m[1], 10);
            const minor = parseInt(m[2], 10) + 1;
            return { oldVer: `${m[1]}.${m[2]}`, newVer: `${major}.${minor}` };
        }
    }
    return { oldVer: current, newVer: "8.5" };
}

function updateChangelogAndNotes(oldVer, newVer, upstreamCommits, upstreamSha) {
    const today = new Date().toISOString().slice(0, 10);

    for (const baseDir of [CUSTOM_SRC_DIR, ASSETS_DIR]) {
        const mpPath = path.join(baseDir, "multiplayer.js");
        if (fs.existsSync(mpPath)) {
            const mpCode = fs.readFileSync(mpPath, "utf8").replace(/\?v=[0-9.]+/g, `?v=${newVer}`);
            fs.writeFileSync(mpPath, mpCode, "utf8");
        }
    }

    if (fs.existsSync(CHANGELOG_MD)) {
        let cl = fs.readFileSync(CHANGELOG_MD, "utf8");
        cl = cl.replace(
            /^## Custom Edition Updates \(v[0-9.]+\)/m,
            `## Custom Edition Updates (v${newVer})`,
        );
        fs.writeFileSync(CHANGELOG_MD, cl, "utf8");
    }

    if (fs.existsSync(AGENT_NOTES_MD)) {
        let notes = fs.readFileSync(AGENT_NOTES_MD, "utf8");
        notes = notes
            .replaceAll(`?v=${oldVer}`, `?v=${newVer}`)
            .replace(
                /\(Version `\?v=[0-9.]+`/g,
                `(Version \`?v=${newVer}\``,
            );

        const summaryLines = upstreamCommits
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(0, 10)
            .map((line) => `  - Merged upstream ${line}`)
            .join("\n");

        const entry = [
            `### ${today} - Automated Cron Sync - Upstream Merge (\`${upstreamSha}\`, v${newVer})`,
            `- **Commit / PR**: Automated upstream sync from \`upstream/main\` (\`${upstreamSha}\`, \`?v=${newVer}\`)`,
            `- **Files Modified**: \`src/**\`, \`assets/**\`, \`index.html\`, \`docs/CHANGELOG.md\`, \`docs/AGENT_NOTES.md\``,
            `- **Bundle / Version Impact**: Bumped cache-busting query string from \`?v=${oldVer}\` to \`?v=${newVer}\`.`,
            `- **What Changed**:`,
            summaryLines || `  - Merged latest commits from \`upstream/main\`.`,
            `- **Notes / Invariants for Future Agents**:`,
            `  - Automated merge verified via \`npx tsc --noEmit\`, \`npm test\`, \`test_serve.py\`, and \`node --check assets/multiplayer.js\`.`,
            "",
        ].join("\n");

        const marker = "## 3. Chronological Agent Handoff Log\n\n";
        if (notes.includes(marker)) {
            notes = notes.replace(marker, marker + entry + "\n");
        }
        fs.writeFileSync(AGENT_NOTES_MD, notes, "utf8");
    }
}

function syncBundleHashesInAgentNotes() {
    if (!fs.existsSync(AGENT_NOTES_MD) || !fs.existsSync(ASSETS_DIR)) return;
    const entries = fs.readdirSync(ASSETS_DIR);
    const findAsset = (prefix, ext) =>
        entries.find((e) => e.startsWith(prefix) && e.endsWith(ext));

    const indexJs = findAsset("index-", ".js");
    const indexCss = findAsset("index-", ".css");
    const mapViewerJs = findAsset("MapViewerApp-", ".js");
    const workerJs = findAsset("RenderDataWorker-", ".js");

    let notes = fs.readFileSync(AGENT_NOTES_MD, "utf8");
    if (indexJs) notes = notes.replace(/index-[A-Za-z0-9_-]+\.js/g, indexJs);
    if (indexCss) notes = notes.replace(/index-[A-Za-z0-9_-]+\.css/g, indexCss);
    if (mapViewerJs) notes = notes.replace(/MapViewerApp-[A-Za-z0-9_-]+\.js/g, mapViewerJs);
    if (workerJs) notes = notes.replace(/RenderDataWorker-[A-Za-z0-9_-]+\.js/g, workerJs);
    fs.writeFileSync(AGENT_NOTES_MD, notes, "utf8");
}

function rollback(prevHead, reason) {
    console.error(`[auto_sync] ERROR: ${reason}`);
    console.error(`[auto_sync] Rolling back to ${prevHead} to preserve server integrity.`);
    tryRun("git merge --abort");
    tryRun(`git reset --hard ${prevHead}`);
    tryRun("git clean -fd");
    process.exit(1);
}

function main() {
    const isDryRun = process.argv.includes("--dry-run");
    acquireLock();

    // Ensure upstream remote is configured
    const remotes = run("git remote");
    if (!remotes.split(/\r?\n/).includes("upstream")) {
        log(`Adding upstream remote: ${UPSTREAM_URL}`);
        run(`git remote add upstream ${UPSTREAM_URL}`);
    } else {
        run(`git remote set-url upstream ${UPSTREAM_URL}`);
    }

    // Ensure git author identity exists for automated commits on server
    if (!tryRun("git config user.name").out.trim()) {
        run('git config user.name "Run Escape Auto-Sync"');
    }
    if (!tryRun("git config user.email").out.trim()) {
        run('git config user.email "autosync@cuteanimegirls.moe"');
    }

    log("Fetching origin/main and upstream/main...");
    tryRun("git fetch origin main");
    const fetchUp = tryRun("git fetch upstream main");
    if (!fetchUp.ok) {
        console.error(`[auto_sync] Failed to fetch upstream/main:\n${fetchUp.out}`);
        process.exit(1);
    }

    // Fast-forward to origin/main if origin has newer commits and working tree is clean
    const originAhead = parseInt(
        tryRun("git rev-list HEAD..origin/main --count").out.trim() || "0",
        10,
    );
    if (originAhead > 0 && !isDryRun) {
        log(`origin/main is ahead by ${originAhead} commit(s); syncing origin/main first...`);
        const ff = tryRun("git merge --ff-only origin/main");
        if (ff.ok) {
            tryRun("pm2 restart ecosystem.config.cjs --update-env");
        }
    }

    const upstreamCount = parseInt(
        run("git rev-list HEAD..upstream/main --count") || "0",
        10,
    );

    if (upstreamCount === 0) {
        log("Up to date with upstream/main (0 new commits).");
        return;
    }

    const prevHead = run("git rev-parse HEAD");
    const upstreamSha = run("git rev-parse --short upstream/main");
    const upstreamCommits = run('git log HEAD..upstream/main --pretty=format:"%h: %s"');

    log(`Found ${upstreamCount} new commit(s) on upstream/main (${upstreamSha}):\n${upstreamCommits}`);

    if (isDryRun) {
        log("Dry-run mode enabled; exiting before merge.");
        return;
    }

    // If upstream force-pushed an unrelated root commit, graft the previous upstream baseline
    // so Git performs a clean 3-way diff against the prior upstream release.
    const hasMergeBase = tryRun("git merge-base HEAD upstream/main").ok;
    if (!hasMergeBase) {
        const baselineSha = "b29f532010e0edfc5f97c52764aa60902680d8b3";
        const upstreamRoot = run("git rev-list --max-parents=0 upstream/main").split(/\r?\n/)[0];
        if (upstreamRoot && tryRun(`git cat-file -e ${baselineSha}^{commit}`).ok) {
            log(`Upstream history was rewritten; grafting ${upstreamRoot} onto baseline ${baselineSha} for 3-way merge...`);
            tryRun(`git replace --graft ${upstreamRoot} ${baselineSha}`);
        }
    }

    // Attempt merge without committing yet
    const mergeRes = tryRun("git merge --no-commit --no-ff --allow-unrelated-histories upstream/main");
    const conflictFiles = run("git diff --name-only --diff-filter=U")
        .split(/\r?\n/)
        .filter(Boolean);

    // Auto-resolve generated/regenerated files if they are the only conflicts
    const AUTO_RESOLVABLE = new Set([
        "index.html",
        "CHANGELOG.md",
        "AGENT_NOTES.md",
        "docs/CHANGELOG.md",
        "docs/AGENT_NOTES.md",
    ]);
    const hardConflicts = conflictFiles.filter(
        (f) => !AUTO_RESOLVABLE.has(f) && !f.startsWith("assets/"),
    );

    if (hardConflicts.length > 0) {
        rollback(
            prevHead,
            `Source merge conflicts detected in: ${hardConflicts.join(", ")}. Manual/agent resolution required.`,
        );
    }

    for (const f of conflictFiles) {
        if (AUTO_RESOLVABLE.has(f) || f.startsWith("assets/")) {
            tryRun(`git checkout --ours -- "${f}"`);
            tryRun(`git add -- "${f}"`);
        }
    }

    if (!mergeRes.ok && conflictFiles.length === 0) {
        rollback(prevHead, `git merge failed:\n${mergeRes.out}`);
    }

    // Ensure dependencies are installed if package.json changed or vite is missing
    const viteBin = path.join(ROOT_DIR, "node_modules", ".bin", "vite");
    const changedSincePrev = run("git diff --name-only HEAD");
    if (
        !fs.existsSync(viteBin) ||
        changedSincePrev.includes("package.json") ||
        changedSincePrev.includes("package-lock.json")
    ) {
        log("Installing/updating npm dependencies...");
        const npmRes = tryRun("npm install --no-audit --no-fund");
        if (!npmRes.ok) {
            rollback(prevHead, `npm install failed:\n${npmRes.out}`);
        }
    }

    const { oldVer, newVer } = readNextVersion();
    log(`Updating docs/CHANGELOG.md and docs/AGENT_NOTES.md (${oldVer} -> ${newVer})...`);
    updateChangelogAndNotes(oldVer, newVer, upstreamCommits, upstreamSha);

    log(`Building TypeScript source and syncing bundles (?v=${newVer})...`);
    const buildRes = tryRun(`npx vite build && node scripts/sync_dist.cjs --version=${newVer}`);
    if (!buildRes.ok) {
        rollback(prevHead, `Build failed:\n${buildRes.out}`);
    }

    syncBundleHashesInAgentNotes();

    log("Running verification suite (tsc, vitest, test_serve.py, multiplayer.js)...");
    const tscRes = tryRun("npx tsc --noEmit");
    if (!tscRes.ok) {
        rollback(prevHead, `TypeScript verification failed:\n${tscRes.out}`);
    }

    const testRes = tryRun("npm test");
    if (!testRes.ok) {
        rollback(prevHead, `Vitest suite failed:\n${testRes.out}`);
    }

    const pyCmd = spawnSync("python3", ["--version"]).status === 0 ? "python3" : "python";
    const pyRes = tryRun(`${pyCmd} -m unittest test_serve.py`);
    if (!pyRes.ok) {
        rollback(prevHead, `Python server unit tests failed:\n${pyRes.out}`);
    }

    const mpCheck = tryRun("node --check src/custom/multiplayer.js && node --check assets/multiplayer.js");
    if (!mpCheck.ok) {
        rollback(prevHead, `multiplayer.js syntax check failed:\n${mpCheck.out}`);
    }

    log("All verification checks passed. Committing merged update...");
    run("git add -A");
    const commitMsg = `chore(sync): auto-merge upstream/main (${upstreamSha}, ?v=${newVer})`;
    const commitRes = tryRun(`git commit -m "${commitMsg}"`);
    if (!commitRes.ok) {
        rollback(prevHead, `git commit failed:\n${commitRes.out}`);
    }

    // Reload PM2 if running on production server
    if (spawnSync("pm2", ["-v"]).status === 0) {
        log("Reloading PM2 run-escape service...");
        tryRun("pm2 restart ecosystem.config.cjs --update-env");
        tryRun("pm2 save");
    }

    // Push back to origin/main if credentials are available
    const pushRes = tryRun("git push origin main");
    if (pushRes.ok) {
        log("Pushed merged commit to origin/main.");
    } else {
        log("Local server commit complete (origin push skipped or no push credentials configured on host).");
    }

    log(`Successfully merged upstream/main (${upstreamSha}) and deployed ?v=${newVer}.`);
}

main();
