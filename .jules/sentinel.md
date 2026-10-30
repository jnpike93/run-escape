## 2026-10-28 - Host Parsing Vulnerability in Custom Python WS Broker
**Vulnerability:** `urllib.parse.urlparse(origin).netloc.split(":")[0]` was used to validate `Origin` headers in `serve.py`. When an origin contains userinfo in authority (e.g. `http://localhost:pass@attacker.com`), `netloc.split(":")[0]` evaluates to `localhost`, bypassing origin checks.
**Learning:** `netloc` contains credentials if specified. Parsing hosts using `netloc.split(":")` is vulnerable to authority userinfo bypasses.
**Prevention:** Use `(urllib.parse.urlparse(url).hostname or "").lower()` to strictly extract the target host.

## 2026-10-30 - WebSocket Guest Role Escalation, Slot Spoofing, and Frame Rate Limiting in `serve.py`
**Vulnerability:** Guests in the co-op WebSocket relay could broadcast `game_over`, forge `coop_pickup` rewards (`victory`, `coins`), inject Host-only lobby settings (`party`, `mapId`, `difficultyMult`, `endless`, `unlockedCharacters`, `hostCharacter`) in `lobby_update`, spoof another player's `slot` in relayed payloads, hold `rooms_lock` during blocking room-full socket writes, and flood frames without per-connection rate limiting.
**Learning:** Relay brokers must enforce role-based payload schemas, overwrite identity fields (`senderSlot` and `slot`) from server-authenticated session state, avoid socket I/O inside global lock scopes, and bound frame rates per connection.
**Prevention:** Removed `game_over` from `GUEST_ALLOWED_MSG_TYPES`, restricted Guest `coop_pickup` to `kind == "lamp_xp"`, stripped Host-only keys from Guest `lobby_update` messages, stamped both `senderSlot` and `slot` from `current_slot`, moved room-full `sendall` outside `rooms_lock`, closed dead peer sockets on `sendall` failure, and added a 120 frames/sec sliding-window limit (closing with WebSocket status `1008`).

## 2026-10-30 - Guest `usedItemId` Spoofing and Unvalidated Simulation Side-Effects in Co-Op Loadout Sync
**Vulnerability:** Guests in co-op sessions could send `usedItemId` (`"black_chinchompa"`, `"red_chinchompa"`, `"bonecrusher"`) inside `coop_loadout` WebSocket messages to force the Host's authoritative simulation to trigger free infinite Chinchompa AoE damage explosions or Bonecrusher item magnet effects without possessing or consuming the item.
**Learning:** Host-authoritative multiplayer simulation handlers executing remote player item actions must strictly validate item IDs against an allowlist and verify loadout/inventory possession before executing simulation side-effects.
**Prevention:** Whitelist `usedItemId` strings and check `msg.inventory`, `msg.gear`, `msg.passives`, `msg.weapons`, or `peer.loadout` for item ownership before triggering item effects on the Host.
