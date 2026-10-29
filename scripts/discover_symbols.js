/**
 * discover_symbols.js - Automated Invariant Symbol Discovery Pipeline
 *
 * Deterministically extracts the 21 core game engine symbols, classes, registries,
 * and UI components across upstream Vite bundle builds (unpatched or patched)
 * using invariant anchor regular expressions and uniqueness assertions.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_BUNDLE_PATH = path.resolve(__dirname, '../assets/index-BucZ8BnA.js');

const SYMBOL_DEFINITIONS = [
  {
    name: 'Client',
    category: 'Core Engine',
    desc: 'Main game client controller class',
    regex: /return\s+([a-zA-Z0-9_$]+)\.create\(s\.mapViewer/
  },
  {
    name: 'Sim',
    category: 'Simulation',
    desc: 'Core deterministic simulation loop class',
    regex: /new\s+([a-zA-Z0-9_$]+)\(\{[^}]*grid:this\.grid,mapId:/
  },
  {
    name: 'Characters',
    category: 'Content Registry',
    desc: 'Adventurer characters definition array',
    regex: /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*\[\{id:"(?:warrior|dipper)",name:"(?:Warrior|Dipper)"/
  },
  {
    name: 'Maps',
    category: 'Content Registry',
    desc: 'Map levels definition array',
    regex: /victoryText:"(?:Sol Heredit is defeated!|The JalTok-Jads are slain! You are the champion of the Inferno!|TzKal-Zuk is slain! You have conquered the Fight Caves!)"\}\],\s*([a-zA-Z0-9_$]+)\s*=\s*\[\.\.\./
  },
  {
    name: 'ThrallDefs',
    category: 'Content Registry',
    desc: 'Thrall summon definitions array',
    regex: /([a-zA-Z0-9_$]+)\s*=\s*\[\{id:"ghost",name:"Greater Ghost"/
  },
  {
    name: 'EnemyDefLookup',
    category: 'Lookup Helpers',
    desc: 'Enemy definition getter function by ID',
    regex: /function\s+([a-zA-Z0-9_$]+)\([a-zA-Z0-9_$]+\)\{[^}]*throw new Error\("Unknown enemy "/
  },
  {
    name: 'AppearanceLookup',
    category: 'Rendering / Setup',
    desc: 'Player appearance generator function from characterId',
    regex: /function\s+([a-zA-Z0-9_$]+)\([a-zA-Z0-9_$]+\)\{const\s+[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\([a-zA-Z0-9_$]+\),[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\([a-zA-Z0-9_$]+\.equipment\);return\s+[a-zA-Z0-9_$]+\.kits/
  },
  {
    name: 'SimAppearance',
    category: 'Simulation',
    desc: 'Sim appearance calculation with held weapon & passives',
    regex: /function\s+([a-zA-Z0-9_$]+)\([a-zA-Z0-9_$]+\)\{const\s+[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\([a-zA-Z0-9_$]+\.characterId\),[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\.getHeldObjId\(\)/
  },
  {
    name: 'IconCache',
    category: 'Rendering / Cache',
    desc: 'Icon raster / sprite LRU cache instance',
    regex: /const\s+([a-zA-Z0-9_$]+)\s*=\s*new\s+(?:Th|oa);/
  },
  {
    name: 'IconRasterizer',
    category: 'Rendering / Cache',
    desc: 'Software 3D model icon rasterizer function',
    regex: /function\s+([a-zA-Z0-9_$]+)\([a-zA-Z0-9_$]+,[a-zA-Z0-9_$]+,[a-zA-Z0-9_$]+\)\{(?:if\([a-zA-Z0-9_$]+<0\)\{[\s\S]*?\})?const [a-zA-Z0-9_$]+=new Int32Array\([a-zA-Z0-9_$]+\*[a-zA-Z0-9_$]+\),[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\([a-zA-Z0-9_$]+,[a-zA-Z0-9_$]+,[a-zA-Z0-9_$]+\),[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\.objTypeLoader\.load/
  },
  {
    name: 'WaveBuilder',
    category: 'Simulation',
    desc: 'Wave definition matrix generator function',
    regex: /function\s+([a-zA-Z0-9_$]+)\([a-zA-Z0-9_$]+\)\{return [a-zA-Z0-9_$]+\.map\(\([a-zA-Z0-9_$]+,[a-zA-Z0-9_$]+\)=>\(?\{(?:\.\.\.[a-zA-Z0-9_$]+,enemies:[a-zA-Z0-9_$]+\[[a-zA-Z0-9_$]+\])\}\)?\)\}/
  },
  {
    name: 'Weapons',
    category: 'Content Registry',
    desc: 'Weapon progression registry array',
    regex: /const\s+(?:[a-zA-Z0-9_$]+=[0-9]+,)?([a-zA-Z0-9_$]+)\s*=\s*\[\{id:"scimitar",name:"Scimitar",kind:"slash"/
  },
  {
    name: 'WeaponDefLookup',
    category: 'Lookup Helpers',
    desc: 'Weapon definition getter function by ID',
    regex: /function\s+([a-zA-Z0-9_$]+)\([a-zA-Z0-9_$]+\)\{const\s+[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\.get\([a-zA-Z0-9_$]+\);if\(![a-zA-Z0-9_$]+\)throw new Error\("Unknown weapon "/
  },
  {
    name: 'Passives',
    category: 'Content Registry',
    desc: 'Passive upgrade registry array',
    regex: /const\s+([a-zA-Z0-9_$]+)\s*=\s*\[\{id:"piety",name:"Piety",description:"(?:Hit harder\.|Increases all weapon damage\.)"/
  },
  {
    name: 'PassiveDefLookup',
    category: 'Lookup Helpers',
    desc: 'Passive upgrade definition getter function by ID',
    regex: /function\s+([a-zA-Z0-9_$]+)\([a-zA-Z0-9_$]+\)\{const\s+[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\.get\([a-zA-Z0-9_$]+\);if\(![a-zA-Z0-9_$]+\)throw new Error\("Unknown passive "/
  },
  {
    name: 'PostRunStats',
    category: 'UI Components',
    desc: 'Post-run game over / victory dialog component',
    regex: /function\s+([a-zA-Z0-9_$]+)\(\{ui:[a-zA-Z0-9_$]+,client:[a-zA-Z0-9_$]+\}\)\{const\s+[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\.result,[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\.overlay==="victory"/
  },
  {
    name: 'PauseModal',
    category: 'UI Components',
    desc: 'Pause menu modal dialog component',
    regex: /function\s+([a-zA-Z0-9_$]+)\(\{ui:[a-zA-Z0-9_$]+,hud:[a-zA-Z0-9_$]+,client:[a-zA-Z0-9_$]+\}\)\{(?:const\[[a-zA-Z0-9_$,]+\]=[a-zA-Z0-9_$]+\.useState\(null\);)?return [a-zA-Z0-9_$]+\.jsx\("div",\{className:"ui-modal",children:[a-zA-Z0-9_$]+\.jsxs\("div",\{className:"ui-panel rs-border rs-background ui-pause"/
  },
  {
    name: 'SettingsModal',
    category: 'UI Components',
    desc: 'Settings modal dialog component',
    regex: /function\s+([a-zA-Z0-9_$]+)\(\{ui:[a-zA-Z0-9_$]+,client:[a-zA-Z0-9_$]+,onClose:[a-zA-Z0-9_$]+\}\)/
  },
  {
    name: 'AdventurerSelectModal',
    category: 'UI Components',
    desc: 'Adventurer selection screen component',
    regex: /function\s+([a-zA-Z0-9_$]+)\(\{ui:[a-zA-Z0-9_$]+,client:[a-zA-Z0-9_$]+\}\)\{const\s+[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\.save\.unlockedCharacters/
  },
  {
    name: 'MapDefLookup',
    category: 'Lookup Helpers',
    desc: 'Map definition lookup function by ID',
    regex: /const [a-zA-Z0-9_$]+=([a-zA-Z0-9_$]+)\(i\.mapId\)\.name/
  },
  {
    name: 'MapUnlockCheck',
    category: 'Save / State',
    desc: 'Map unlock status checker function',
    regex: /if\(!(?:window\.multiplayer\?\.gameStarted&&!)?([a-zA-Z0-9_$]+)\(this\.save,t\)\)return;/
  }
];

function countMatches(str, re) {
  const gRe = new RegExp(re.source, 'g');
  const matches = str.match(gRe);
  return matches ? matches.length : 0;
}

/**
 * Runs all 21 invariant anchor regexes against bundleCode, asserts each match
 * is unique (count === 1), and returns the resolved symbol map.
 * @param {string} bundleCode
 * @returns {Record<string, string>}
 */
function discoverSymbols(bundleCode) {
  const symbols = {};
  for (const def of SYMBOL_DEFINITIONS) {
    const count = countMatches(bundleCode, def.regex);
    if (count !== 1) {
      throw new Error(
        `Symbol discovery failed for "${def.name}" (${def.category}): expected exactly 1 match, found ${count}`
      );
    }
    const match = bundleCode.match(def.regex);
    if (!match || !match[1]) {
      throw new Error(`Symbol discovery failed to capture identifier for "${def.name}"`);
    }
    symbols[def.name] = match[1];
  }
  return symbols;
}

if (require.main === module) {
  const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_BUNDLE_PATH;
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Bundle not found at ${targetPath}`);
    process.exit(1);
  }
  const bundleCode = fs.readFileSync(targetPath, 'utf8');
  const symbols = discoverSymbols(bundleCode);

  console.log(`Symbol Discovery Verified: ${path.basename(targetPath)} (${bundleCode.length} bytes)`);
  console.log('----------------------------------------------------------------------');
  console.log('| Canonical Symbol       | Category          | Resolved Identifier   |');
  console.log('|:-----------------------|:------------------|:----------------------|');
  for (const def of SYMBOL_DEFINITIONS) {
    console.log(
      `| ${def.name.padEnd(22)} | ${def.category.padEnd(17)} | ${symbols[def.name].padEnd(21)} |`
    );
  }
  console.log('----------------------------------------------------------------------');
  console.log(`All ${SYMBOL_DEFINITIONS.length} symbols uniquely resolved (count === 1).`);
}

module.exports = {
  SYMBOL_DEFINITIONS,
  discoverSymbols
};
