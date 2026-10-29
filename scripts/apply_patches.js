/**
 * apply_patches.js - Modular Bundle Patch Orchestrator
 *
 * Applies the 6 domain patch modules in `scripts/patches/` sequentially against
 * an unpatched upstream Vite bundle, verifying 21 invariant symbols before and
 * after patching and asserting uniqueness on every exact replacement rule.
 */

const fs = require('fs');
const path = require('path');
const { discoverSymbols } = require('./discover_symbols');

const DEFAULT_INPUT_PATH =
  'C:/Users/jakep/.gemini/antigravity/brain/7b774375-d1af-480a-aac6-1f4d05410206/scratch/v0140/index-BucZ8BnA.js';
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../assets/index-BucZ8BnA.js');

const PATCH_MODULES = [
  '01-core-engine.patch.js',
  '02-icon-rasterizer.patch.js',
  '03-maps.patch.js',
  '04-characters.patch.js',
  '05-weapons-passives.patch.js',
  '06-multiplayer-hooks.patch.js'
];

function replaceExact(code, label, target, replacement) {
  const idx = code.indexOf(target);
  if (idx === -1) {
    throw new Error(`Target not found for [${label}]: ${JSON.stringify(target.slice(0, 120))}`);
  }
  const secondIdx = code.indexOf(target, idx + 1);
  if (secondIdx !== -1) {
    throw new Error(`Multiple matches found for [${label}]: ${JSON.stringify(target.slice(0, 120))}`);
  }
  return code.slice(0, idx) + replacement + code.slice(idx + target.length);
}

function applyAllPatches(bundleCode) {
  let code = bundleCode.replace(/\r\n/g, '\n');
  const symbols = discoverSymbols(code);
  let totalRules = 0;

  for (const modName of PATCH_MODULES) {
    const modPath = path.join(__dirname, 'patches', modName);
    const mod = require(modPath);
    const beforeLen = code.length;
    code = mod.apply(code, replaceExact, symbols);
    totalRules += mod.RULES ? mod.RULES.length : 0;
    console.log(
      `  [OK] ${modName.padEnd(32)} (${String(mod.RULES.length).padStart(2)} rules, delta: ${
        code.length - beforeLen >= 0 ? '+' : ''
      }${code.length - beforeLen} bytes)`
    );
  }

  // Re-verify all 21 invariant symbols on the patched bundle
  discoverSymbols(code);
  return { code, totalRules, symbols };
}

if (require.main === module) {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT_PATH;
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT_PATH;

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input bundle not found at ${inputPath}`);
    process.exit(1);
  }

  const rawCode = fs.readFileSync(inputPath, 'utf8');
  console.log(`Applying modular patches to: ${inputPath} (${rawCode.length} bytes)`);
  const { code, totalRules } = applyAllPatches(rawCode);
  fs.writeFileSync(outputPath, code, 'utf8');
  console.log(`Successfully applied ${totalRules} rules across ${PATCH_MODULES.length} modules.`);
  console.log(`Wrote patched bundle to: ${outputPath} (${code.length} bytes)`);
}

module.exports = {
  PATCH_MODULES,
  replaceExact,
  applyAllPatches
};
