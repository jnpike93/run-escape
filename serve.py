import http.server
import socketserver
import urllib.parse
import hashlib
import base64
import struct
import threading
import os
import sys

PORT = int(os.environ.get("PORT", sys.argv[1] if len(sys.argv) > 1 else 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# WebSocket Room Broker: room_id -> list of (client_sock, lock, role)
rooms = {}
rooms_lock = threading.Lock()

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
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            return None
    return bytes(buf)

def handle_ws_client(sock, room_id):
    sock_lock = threading.Lock()
    with rooms_lock:
        if room_id not in rooms:
            rooms[room_id] = []
        peer_count = len(rooms[room_id])
        role = "host" if peer_count == 0 else "guest"
        rooms[room_id].append((sock, sock_lock, role))
    
    # Send welcome packet
    try:
        welcome = encode_ws_frame(f'{{"type":"welcome","role":"{role}","peers":{peer_count + 1},"room":"{room_id}"}}')
        with sock_lock:
            sock.sendall(welcome)
    except:
        pass

    # Notify existing peers that a new player joined
    if peer_count > 0:
        joined_msg = encode_ws_frame(f'{{"type":"peer_joined","role":"{role}","peers":{peer_count + 1}}}')
        with rooms_lock:
            peers = list(rooms.get(room_id, []))
        for peer_sock, peer_lock, _ in peers:
            if peer_sock != sock:
                try:
                    with peer_lock:
                        peer_sock.sendall(joined_msg)
                except:
                    pass

    try:
        while True:
            head = read_exact(sock, 2)
            if not head:
                break
            b0, b1 = head[0], head[1]
            opcode = b0 & 0x0F
            is_masked = bool(b1 & 0x80)
            length = b1 & 0x7F

            if length == 126:
                ext = read_exact(sock, 2)
                if not ext: break
                length = struct.unpack("!H", ext)[0]
            elif length == 127:
                ext = read_exact(sock, 8)
                if not ext: break
                length = struct.unpack("!Q", ext)[0]

            mask = read_exact(sock, 4) if is_masked else None
            payload = read_exact(sock, length)
            if payload is None:
                break

            if is_masked and mask:
                unmasked = bytearray(payload)
                for i in range(len(unmasked)):
                    unmasked[i] ^= mask[i % 4]
                payload = bytes(unmasked)

            if opcode == 8: # close
                break
            elif opcode == 9: # ping
                pong = encode_ws_frame(payload, opcode=10)
                with sock_lock:
                    sock.sendall(pong)
            elif opcode in (1, 2): # text or binary
                # Relay to all peers in the same room
                relay = encode_ws_frame(payload, opcode=opcode)
                with rooms_lock:
                    peers = list(rooms.get(room_id, []))
                for peer_sock, peer_lock, _ in peers:
                    if peer_sock != sock:
                        try:
                            with peer_lock:
                                peer_sock.sendall(relay)
                        except:
                            pass
    finally:
        with rooms_lock:
            if room_id in rooms:
                rooms[room_id] = [p for p in rooms[room_id] if p[0] != sock]
                left_msg = encode_ws_frame(f'{{"type":"peer_left","role":"{role}"}}')
                for peer_sock, peer_lock, _ in rooms[room_id]:
                    try:
                        with peer_lock:
                            peer_sock.sendall(left_msg)
                    except:
                        pass
                if not rooms[room_id]:
                    del rooms[room_id]
        try:
            sock.close()
        except:
            pass

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path.startswith("/ws"):
            u = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(u.query)
            room_id = qs.get("room", ["default"])[0].strip()

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

            handle_ws_client(self.connection, room_id)
            return

        super().do_GET()

    def end_headers(self):
        # Enable SharedArrayBuffer for multithreaded WebAssembly & Web Workers
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("Access-Control-Allow-Origin", "*")
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
    with http.server.ThreadingHTTPServer(("", port), CustomHandler) as httpd:
        print(f"Serving Run Escape + WebSocket Relay on http://localhost:{port} with COOP/COEP enabled...")
        httpd.serve_forever()
