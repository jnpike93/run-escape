# AGENT DIRECTIVE: Before modifying this file, read AGENTS.md, AGENT_NOTES.md, and .jules/sentinel.md.
# After completing changes, run `python -m unittest test_serve.py` and prepend a handoff entry to AGENT_NOTES.md.
import http.server
import urllib.parse
import hashlib
import base64
import struct
import threading
import socket
import json
import re
import os
import sys
import itertools

def _get_default_port():
    port_env = os.environ.get("PORT")
    if port_env:
        try:
            return int(port_env)
        except ValueError:
            pass
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except ValueError:
            pass
    return 8080

PORT = _get_default_port()
BIND_HOST = os.environ.get("HOST", "127.0.0.1")
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
MAX_FRAME_SIZE = 65536       # 64 KB max frame payload
MAX_ROOMS = 1000             # Maximum concurrent rooms
MAX_PEERS_PER_ROOM = 4       # 4-player co-op cap
MAX_CONNS_PER_IP = 16        # Maximum concurrent WebSocket connections per client IP
SOCKET_TIMEOUT = 60.0        # Socket read/write timeout in seconds

# WebSocket Room Broker: room_id -> list of (client_sock, lock, role, slot)
rooms = {}
ip_conns = {}
rooms_lock = threading.Lock()

HOST_ALLOWED_MSG_TYPES = {
    "lobby_update", "game_start", "sync_world", "game_over",
    "coop_pause", "coop_pickup", "coop_loadout"
}
GUEST_ALLOWED_MSG_TYPES = {
    "lobby_update", "input", "game_over",
    "coop_pause", "coop_pickup", "coop_loadout"
}

CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "connect-src 'self' blob: ws: wss:; "
    "worker-src 'self' blob:; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "frame-ancestors 'none'"
)

def is_allowed_origin(origin):
    if not origin:
        return False
    parsed_origin = urllib.parse.urlparse(origin)
    # Use parsed_origin.hostname to securely extract host without authority userinfo bypasses
    host_only = (parsed_origin.hostname or "").lower()
    allowed_hosts = {
        "localhost",
        "127.0.0.1",
        "cuteanimegirls.moe",
        "run-escape.cuteanimegirls.moe",
        "167.71.157.5"
    }
    return host_only in allowed_hosts or (
        host_only.endswith(".cuteanimegirls.moe") and not host_only.startswith(".")
    )

def safe_close(sock):
    if sock is not None:
        try:
            sock.close()
        except Exception:
            pass

def sanitize_room_id(raw_room):
    if not raw_room or not isinstance(raw_room, str):
        return "default"
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "", raw_room.strip())[:32]
    return cleaned if cleaned else "default"

def encode_ws_frame(msg, opcode=1):
    payload = msg.encode("utf-8") if isinstance(msg, str) else msg
    length = len(payload)
    if length < 126:
        header = struct.pack("!BB", 0x80 | opcode, length)
    elif length <= 0xFFFF:
        header = struct.pack("!BBH", 0x80 | opcode, 126, length)
    else:
        header = struct.pack("!BBQ", 0x80 | opcode, 127, length)
    return header + payload

def read_exact(sock, n):
    buf = bytearray()
    while len(buf) < n:
        try:
            chunk = sock.recv(n - len(buf))
            if not chunk:
                return None
            buf.extend(chunk)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, socket.timeout, TimeoutError, OSError):
            return None
    return bytes(buf)

def _register_ws_client(sock, sock_lock, room_id, client_ip):
    """
    Registers client connection in ip_conns and rooms datastructures under rooms_lock.
    Returns (success, role, slot, host_slot, active_slots, peer_count).
    """
    with rooms_lock:
        current_ip_count = ip_conns.get(client_ip, 0)
        if current_ip_count >= MAX_CONNS_PER_IP:
            safe_close(sock)
            return False, None, None, None, None, None

        if room_id not in rooms:
            if len(rooms) >= MAX_ROOMS:
                safe_close(sock)
                return False, None, None, None, None, None
            rooms[room_id] = []

        if len(rooms[room_id]) >= MAX_PEERS_PER_ROOM:
            try:
                err_frame = encode_ws_frame(json.dumps({
                    "type": "error",
                    "message": "Room is full (maximum 4 players)."
                }))
                sock.sendall(err_frame)
            except Exception:
                pass
            safe_close(sock)
            return False, None, None, None, None, None

        peer_count = len(rooms[room_id])
        used_slots = {p[3] for p in rooms[room_id] if len(p) > 3}
        slot = 1
        for candidate in range(1, MAX_PEERS_PER_ROOM + 1):
            if candidate not in used_slots:
                slot = candidate
                break
        has_host = any(p[2] == "host" for p in rooms[room_id])
        role = "host" if not has_host else "guest"
        rooms[room_id].append((sock, sock_lock, role, slot))
        active_slots = [p[3] for p in rooms[room_id]]
        host_slot = next((p[3] for p in rooms[room_id] if p[2] == "host"), 1)
        ip_conns[client_ip] = current_ip_count + 1
        return True, role, slot, host_slot, active_slots, peer_count


def _send_ws_welcome_and_notify_joined(sock, sock_lock, room_id, role, slot, host_slot, active_slots, peer_count):
    """
    Sends welcome message to the connecting socket and notifies existing peers in the room.
    """
    try:
        welcome = encode_ws_frame(json.dumps({
            "type": "welcome",
            "role": role,
            "slot": slot,
            "hostSlot": host_slot,
            "activeSlots": active_slots,
            "peers": peer_count + 1,
            "room": room_id
        }))
        with sock_lock:
            sock.sendall(welcome)
    except Exception:
        return False

    if peer_count > 0:
        joined_msg = encode_ws_frame(json.dumps({
            "type": "peer_joined",
            "role": role,
            "slot": slot,
            "hostSlot": host_slot,
            "activeSlots": active_slots,
            "peers": peer_count + 1
        }))
        with rooms_lock:
            peers = list(rooms.get(room_id, []))
        for peer_sock, peer_lock, _, _ in peers:
            if peer_sock != sock:
                try:
                    with peer_lock:
                        peer_sock.sendall(joined_msg)
                except Exception:
                    pass
    return True


def _read_ws_frame(sock):
    """
    Reads a single WebSocket frame from the socket.
    Returns (opcode, payload, error_flag).
    If connection closed or invalid header, returns (None, None, "EOF").
    If payload size exceeds MAX_FRAME_SIZE, returns (opcode, None, "TOO_LARGE").
    """
    head = read_exact(sock, 2)
    if not head:
        return None, None, "EOF"
    b0, b1 = head[0], head[1]
    opcode = b0 & 0x0F
    is_masked = bool(b1 & 0x80)
    length = b1 & 0x7F

    if length == 126:
        ext = read_exact(sock, 2)
        if not ext:
            return None, None, "EOF"
        length = struct.unpack("!H", ext)[0]
    elif length == 127:
        ext = read_exact(sock, 8)
        if not ext:
            return None, None, "EOF"
        length = struct.unpack("!Q", ext)[0]

    if length > MAX_FRAME_SIZE:
        return opcode, None, "TOO_LARGE"

    mask = read_exact(sock, 4) if is_masked else None
    payload = read_exact(sock, length)
    if payload is None:
        return None, None, "EOF"

    if is_masked and mask and length > 0:
        mask_rep = (mask * (length // 4 + 1))[:length]
        payload = (int.from_bytes(payload, "big") ^ int.from_bytes(mask_rep, "big")).to_bytes(length, "big")

    return opcode, payload, None


def _process_ws_text_message(sock, sock_lock, room_id, role, slot, payload):
    """
    Processes opcode 1 (text JSON frame), handles ping messages and relays allowed types to room peers.
    """
    try:
        decoded_text = payload.decode("utf-8")
        parsed_msg = json.loads(decoded_text)
    except Exception:
        return True

    if not isinstance(parsed_msg, dict):
        return True

    msg_type = parsed_msg.get("type")
    if not isinstance(msg_type, str):
        return True

    if msg_type == "ping":
        try:
            with sock_lock:
                sock.sendall(encode_ws_frame('{"type":"pong"}'))
        except Exception:
            return False
        return True

    with rooms_lock:
        room_entries = list(rooms.get(room_id, []))
        current_role = role
        current_slot = slot
        for p_sock, _, p_role, p_slot in room_entries:
            if p_sock == sock:
                current_role = p_role
                current_slot = p_slot
                break

    allowed_types = HOST_ALLOWED_MSG_TYPES if current_role == "host" else GUEST_ALLOWED_MSG_TYPES
    if msg_type not in allowed_types:
        return True

    parsed_msg["senderSlot"] = current_slot
    relay_payload = json.dumps(parsed_msg, separators=(",", ":")).encode("utf-8")
    relay = encode_ws_frame(relay_payload, opcode=1)
    for peer_sock, peer_lock, _, _ in room_entries:
        if peer_sock != sock:
            try:
                with peer_lock:
                    peer_sock.sendall(relay)
            except Exception:
                pass
    return True


def _run_ws_message_loop(sock, sock_lock, room_id, role, slot):
    """
    Main loop reading frames and dispatching based on WebSocket opcode.
    """
    while True:
        opcode, payload, err = _read_ws_frame(sock)
        if err == "TOO_LARGE":
            close_payload = struct.pack("!H", 1009) + b"Frame payload exceeds maximum size"
            try:
                with sock_lock:
                    sock.sendall(encode_ws_frame(close_payload, opcode=8))
            except Exception:
                pass
            break

        if err or opcode is None:
            break

        if opcode == 8:  # close
            break
        elif opcode == 9:  # ping
            pong = encode_ws_frame(payload[:125], opcode=10)
            try:
                with sock_lock:
                    sock.sendall(pong)
            except Exception:
                break
        elif opcode == 1:  # text JSON frame only
            if not _process_ws_text_message(sock, sock_lock, room_id, role, slot, payload):
                break


def _unregister_ws_client(sock, room_id, client_ip, registered, role, slot):
    """
    Unregisters client from rooms/ip_conns and notifies remaining peers of departure/promotion.
    """
    notify_peers = []
    departing_role = role
    departing_slot = slot
    promoted_host = False
    new_host_slot = None
    active_slots_after = []

    if registered:
        with rooms_lock:
            if client_ip in ip_conns:
                ip_conns[client_ip] = max(0, ip_conns[client_ip] - 1)
                if ip_conns[client_ip] == 0:
                    del ip_conns[client_ip]

            if room_id in rooms:
                remaining = []
                for p_sock, p_lock, p_role, p_slot in rooms[room_id]:
                    if p_sock == sock:
                        departing_role = p_role
                        departing_slot = p_slot
                    else:
                        remaining.append((p_sock, p_lock, p_role, p_slot))

                if remaining and not any(p[2] == "host" for p in remaining):
                    first_sock, first_lock, _, first_slot = remaining[0]
                    remaining[0] = (first_sock, first_lock, "host", first_slot)
                    promoted_host = True
                    new_host_slot = first_slot
                elif remaining:
                    new_host_slot = next((p[3] for p in remaining if p[2] == "host"), remaining[0][3])

                if remaining:
                    rooms[room_id] = remaining
                    notify_peers = list(remaining)
                    active_slots_after = [p[3] for p in remaining]
                else:
                    del rooms[room_id]

    if notify_peers:
        left_msg = encode_ws_frame(json.dumps({
            "type": "peer_left",
            "role": departing_role,
            "slot": departing_slot,
            "promotedToHost": promoted_host,
            "newHostSlot": new_host_slot,
            "activeSlots": active_slots_after,
            "peers": len(notify_peers)
        }))
        for peer_sock, peer_lock, _, _ in notify_peers:
            try:
                with peer_lock:
                    peer_sock.sendall(left_msg)
            except Exception:
                pass

    safe_close(sock)


def handle_ws_client(sock, room_id, client_ip):
    sock.settimeout(SOCKET_TIMEOUT)
    try:
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    except OSError:
        pass
    sock_lock = threading.Lock()

    registered, role, slot, host_slot, active_slots, peer_count = _register_ws_client(
        sock, sock_lock, room_id, client_ip
    )
    if not registered:
        return

    try:
        if _send_ws_welcome_and_notify_joined(
            sock, sock_lock, room_id, role, slot, host_slot, active_slots, peer_count
        ):
            _run_ws_message_loop(sock, sock_lock, room_id, role, slot)
    finally:
        _unregister_ws_client(sock, room_id, client_ip, registered, role, slot)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _get_client_ip(self):
        remote_ip = self.client_address[0] if self.client_address else "unknown"
        if remote_ip in ("127.0.0.1", "::1"):
            forwarded = self.headers.get("X-Real-IP")
            if forwarded:
                return forwarded.strip()[:64]
        return remote_ip

    def do_GET(self):
        if self.path.startswith("/ws"):
            origin = self.headers.get("Origin")
            if not origin:
                self.send_error(403, "Forbidden Origin")
                return

            if not is_allowed_origin(origin):
                self.send_error(403, "Forbidden Origin")
                return

            u = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(u.query)
            raw_room = qs.get("room", ["default"])[0]
            room_id = sanitize_room_id(raw_room)

            key = self.headers.get("Sec-WebSocket-Key")
            if not key:
                self.send_error(400, "Missing Sec-WebSocket-Key")
                return

            MAGIC = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
            accept = base64.b64encode(hashlib.sha1(key.encode() + MAGIC).digest()).decode()

            self.send_response(101, "Switching Protocols")
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", accept)
            self.end_headers()

            handle_ws_client(self.connection, room_id, self._get_client_ip())
            return

        super().do_GET()

    def send_head(self):
        raw_path = urllib.parse.urlsplit(self.path).path
        unquoted_path = urllib.parse.unquote(raw_path)
        if "\\" in unquoted_path or "\x00" in unquoted_path:
            self.send_error(404, "File not found")
            return None

        # Translate path to filesystem path and resolve canonical path
        try:
            target_path = self.translate_path(self.path)
            real_target = os.path.realpath(target_path)
            real_dir = os.path.realpath(DIRECTORY)
            if os.path.commonpath([real_dir, real_target]) != real_dir:
                self.send_error(404, "File not found")
                return None
        except Exception:
            self.send_error(404, "File not found")
            return None

        # Determine relative path from DIRECTORY for allowlist validation
        rel_path = os.path.relpath(real_target, real_dir)
        normalized = "/" + rel_path.replace(os.sep, "/").lstrip("/") if rel_path != "." else "/"

        # Check for hidden files/directories or parent references in normalized relative path
        parts = [p for p in normalized.strip("/").split("/") if p]
        if any(part.startswith(".") or part in (".", "..") for part in parts):
            self.send_error(404, "File not found")
            return None

        # Enforce strict public static asset allowlist
        allowed_exact = {"/", "/index.html", "/favicon.ico"}
        is_allowed_asset = (
            normalized.startswith("/assets/")
            and not normalized.endswith(".map")
            and normalized != "/assets/index-BiDFrk06.js"
        )
        is_allowed_cache = normalized.startswith("/caches/") and not normalized.endswith(".map")

        if normalized not in allowed_exact and not is_allowed_asset and not is_allowed_cache:
            self.send_error(404, "File not found")
            return None

        return super().send_head()

    def list_directory(self, path):
        self.send_error(404, "Directory listing disabled")
        return None

    def end_headers(self):
        # Enable SharedArrayBuffer for multithreaded WebAssembly & Web Workers
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Security-Policy", CSP_POLICY)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".wasm"):
            return "application/wasm"
        if path.endswith(".js"):
            return "application/javascript"
        if path.endswith(".css"):
            return "text/css"
        if path.endswith(".json"):
            return "application/json"
        if path.endswith(".ttf"):
            return "font/ttf"
        return super().guess_type(path)

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    bind_host = sys.argv[2] if len(sys.argv) > 2 else BIND_HOST
    with http.server.ThreadingHTTPServer((bind_host, port), CustomHandler) as httpd:
        print(f"Serving Run Escape + WebSocket Relay on http://{bind_host}:{port} with COOP/COEP enabled...")
        httpd.serve_forever()
