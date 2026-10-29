// Tile coordinate readout shown under the in-game minimap.
// The sim stores player positions in OSRS world tile units (e.g. Lumbridge spawn is 3222.5, 3218.5),
// so the tile the player stands on is just the floored position.
// It can be turned off under Settings > Game > Tile coordinates.
(() => {
    const STYLE_ID = 'tile-coords-style';
    const READOUT_CLASS = 'ui-tile-coords';
    let lastText = '';

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
        const minimap = document.querySelector('.ui-minimap');
        if (minimap) {
            let readout = minimap.querySelector('.' + READOUT_CLASS);
            if (!readout) {
                readout = document.createElement('div');
                readout.className = READOUT_CLASS;
                minimap.appendChild(readout);
                lastText = '';
            }
            const player = window.gameClient?.sim?.player;
            // Settings > Game > Tile coordinates (on by default).
            const enabled = window.gameClient?.display?.showCoords !== false;
            const text = enabled && player && Number.isFinite(player.x) && Number.isFinite(player.y)
                ? `Tile: ${Math.floor(player.x)}, ${Math.floor(player.y)}`
                : '';
            if (text !== lastText) {
                readout.textContent = text;
                lastText = text;
            }
        }
        requestAnimationFrame(tick);
    }

    injectStyle();
    requestAnimationFrame(tick);
})();
