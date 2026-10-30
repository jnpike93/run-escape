// Tile coordinate readout shown under the in-game minimap.
// The sim stores player positions in OSRS world tile units (e.g. Lumbridge spawn is 3222.5, 3218.5),
// so the tile the player stands on is just the floored position.
// It can be turned off under Settings > Game > Tile coordinates.
(() => {
    const STYLE_ID = 'tile-coords-style';
    const READOUT_CLASS = 'ui-tile-coords';
    let minimapEl = null;
    let coordsEl = null;
    let lastTileX = NaN;
    let lastTileY = NaN;

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .ui-minimap { margin-bottom: 18px; }
            .${READOUT_CLASS} {
                position: absolute;
                top: 164px;
                left: 22px;
                width: 154px;
                text-align: center;
                font-family: "OSRS Small", sans-serif;
                font-size: 16px;
                line-height: 18px;
                color: #ffff00;
                text-shadow: 1px 1px 0 #000;
                white-space: nowrap;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    function tick() {
        if (!minimapEl || !minimapEl.isConnected) {
            minimapEl = document.querySelector('.ui-minimap');
            coordsEl = null;
        }
        if (minimapEl) {
            if (!coordsEl || !coordsEl.isConnected || coordsEl.parentElement !== minimapEl) {
                coordsEl = minimapEl.querySelector('.' + READOUT_CLASS);
                if (!coordsEl) {
                    coordsEl = document.createElement('div');
                    coordsEl.className = READOUT_CLASS;
                    minimapEl.appendChild(coordsEl);
                }
                lastTileX = NaN;
                lastTileY = NaN;
            }
            const player = window.gameClient?.sim?.player;
            // Settings > Game > Tile coordinates (on by default).
            const enabled = window.gameClient?.display?.showCoords !== false;
            if (enabled && player && Number.isFinite(player.x) && Number.isFinite(player.y)) {
                const tileX = Math.floor(player.x);
                const tileY = Math.floor(player.y);
                if (tileX !== lastTileX || tileY !== lastTileY) {
                    coordsEl.textContent = `Tile: ${tileX}, ${tileY}`;
                    lastTileX = tileX;
                    lastTileY = tileY;
                }
            } else if (lastTileX !== null || lastTileY !== null) {
                coordsEl.textContent = '';
                lastTileX = null;
                lastTileY = null;
            }
        }
        requestAnimationFrame(tick);
    }

    injectStyle();
    requestAnimationFrame(tick);
})();
