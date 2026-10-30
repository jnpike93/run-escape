import unittest
from serve import is_allowed_origin, safe_close
from unittest.mock import MagicMock

class TestSafeClose(unittest.TestCase):
    def test_safe_close_valid_socket(self):
        mock_sock = MagicMock()
        safe_close(mock_sock)
        mock_sock.close.assert_called_once()

    def test_safe_close_socket_raising_exception(self):
        mock_sock = MagicMock()
        mock_sock.close.side_effect = Exception("Socket error")
        try:
            safe_close(mock_sock)
        except Exception as e:
            self.fail(f"safe_close raised an exception: {e}")
        mock_sock.close.assert_called_once()

    def test_safe_close_none(self):
        try:
            safe_close(None)
        except Exception as e:
            self.fail(f"safe_close(None) raised an exception: {e}")
import os
import sys
from unittest.mock import patch
from serve import is_allowed_origin, _get_default_port

class TestGetDefaultPort(unittest.TestCase):
    def test_port_from_env_valid(self):
        with patch.dict(os.environ, {"PORT": "9000"}, clear=True), patch.object(sys, "argv", ["serve.py"]):
            self.assertEqual(_get_default_port(), 9000)

    def test_port_from_env_invalid_falls_back_to_argv(self):
        with patch.dict(os.environ, {"PORT": "invalid"}, clear=True), patch.object(sys, "argv", ["serve.py", "9001"]):
            self.assertEqual(_get_default_port(), 9001)

    def test_port_from_env_invalid_and_argv_invalid_falls_back_to_8080(self):
        with patch.dict(os.environ, {"PORT": "invalid"}, clear=True), patch.object(sys, "argv", ["serve.py", "not-a-number"]):
            self.assertEqual(_get_default_port(), 8080)

    def test_port_from_argv_valid(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(sys, "argv", ["serve.py", "8888"]):
            self.assertEqual(_get_default_port(), 8888)

    def test_port_from_argv_invalid_falls_back_to_8080(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(sys, "argv", ["serve.py", "abc"]):
            self.assertEqual(_get_default_port(), 8080)

    def test_default_fallback_8080(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(sys, "argv", ["serve.py"]):
            self.assertEqual(_get_default_port(), 8080)
from serve import is_allowed_origin, sanitize_room_id

class TestSanitizeRoomId(unittest.TestCase):
    def test_default_fallback_for_empty_or_invalid_type(self):
        invalid_inputs = [None, "", "   ", 123, [], {}, True, False]
        for raw in invalid_inputs:
            with self.subTest(raw=raw):
                self.assertEqual(sanitize_room_id(raw), "default")

    def test_valid_room_ids(self):
        valid_cases = [
            ("room123", "room123"),
            ("ROOM-123_abc", "ROOM-123_abc"),
            ("  room1  ", "room1"),
            ("a" * 32, "a" * 32),
        ]
        for raw, expected in valid_cases:
            with self.subTest(raw=raw):
                self.assertEqual(sanitize_room_id(raw), expected)

    def test_strips_disallowed_characters(self):
        cases = [
            ("room!@#$%^&*()", "room"),
            ("room id with spaces", "roomidwithspaces"),
            ("<script>alert(1)</script>", "scriptalert1script"),
            ("../../etc/passwd", "etcpasswd"),
            ("room.name?query=1", "roomnamequery1"),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(sanitize_room_id(raw), expected)

    def test_truncates_long_room_ids(self):
        long_raw = "a" * 50
        self.assertEqual(sanitize_room_id(long_raw), "a" * 32)

        long_with_spaces = "  " + "b" * 40 + "  "
        self.assertEqual(sanitize_room_id(long_with_spaces), "b" * 32)

    def test_all_disallowed_chars_falls_back_to_default(self):
        disallowed_only = [
            "!!!",
            "   @@@   ",
            "   \t\n   ",
            "  <<<>>>  ",
        ]
        for raw in disallowed_only:
            with self.subTest(raw=raw):
                self.assertEqual(sanitize_room_id(raw), "default")

from unittest.mock import patch
import io
import os
import tempfile
import shutil
from serve import is_allowed_origin, CustomHandler, DIRECTORY

class DummyServer:
    pass

class DummyRequest:
    def makefile(self, *args, **kwargs):
        return io.BytesIO()
import json
import struct
import threading
import serve
from serve import (
    is_allowed_origin,
    sanitize_room_id,
    encode_ws_frame,
    _register_ws_client,
    _unregister_ws_client,
    _read_ws_frame,
    _process_ws_text_message,
    handle_ws_client,
    rooms,
    ip_conns,
    rooms_lock,
    MAX_CONNS_PER_IP,
    MAX_PEERS_PER_ROOM,
    MAX_ROOMS
)

class MockSocket:
    def __init__(self, recv_bytes=b""):
        self.recv_buf = bytearray(recv_bytes)
        self.sent_data = bytearray()
        self.closed = False

    def recv(self, bufsize):
        if not self.recv_buf:
            return b""
        chunk = self.recv_buf[:bufsize]
        self.recv_buf = self.recv_buf[bufsize:]
        return bytes(chunk)

    def sendall(self, data):
        self.sent_data.extend(data)

    def settimeout(self, timeout):
        pass

    def setsockopt(self, level, optname, value):
        pass

    def close(self):
        self.closed = True

from serve import is_allowed_origin, encode_ws_frame
import socket
from unittest.mock import Mock
from serve import is_allowed_origin, read_exact

class TestReadExact(unittest.TestCase):
    def test_read_exact_full_chunk(self):
        sock = Mock()
        sock.recv.return_value = b"hello"
        res = read_exact(sock, 5)
        self.assertEqual(res, b"hello")
        sock.recv.assert_called_once_with(5)

    def test_read_exact_multiple_partial_chunks(self):
        sock = Mock()
        sock.recv.side_effect = [b"hel", b"lo"]
        res = read_exact(sock, 5)
        self.assertEqual(res, b"hello")
        self.assertEqual(sock.recv.call_count, 2)
        sock.recv.assert_any_call(5)
        sock.recv.assert_any_call(2)

    def test_read_exact_zero_bytes(self):
        sock = Mock()
        res = read_exact(sock, 0)
        self.assertEqual(res, b"")
        sock.recv.assert_not_called()

    def test_read_exact_eof(self):
        sock = Mock()
        sock.recv.side_effect = [b"hel", b""]
        res = read_exact(sock, 5)
        self.assertIsNone(res)

    def test_read_exact_socket_exceptions(self):
        exceptions = [
            ConnectionAbortedError(),
            ConnectionResetError(),
            BrokenPipeError(),
            socket.timeout(),
            TimeoutError(),
            OSError("Socket error"),
        ]
        for exc in exceptions:
            with self.subTest(exc=type(exc).__name__):
                sock = Mock()
                sock.recv.side_effect = exc
                res = read_exact(sock, 10)
                self.assertIsNone(res)

class TestOriginValidation(unittest.TestCase):
    def test_valid_origins(self):
        valid = [
            "http://localhost",
            "http://localhost:8080",
            "https://127.0.0.1:3000",
            "https://cuteanimegirls.moe",
            "https://run-escape.cuteanimegirls.moe",
            "https://sub.cuteanimegirls.moe",
            "http://167.71.157.5:8085",
        ]
        for url in valid:
            with self.subTest(url=url):
                self.assertTrue(is_allowed_origin(url))

    def test_invalid_origins(self):
        invalid = [
            "http://attacker.com",
            "http://evilcuteanimegirls.moe",
            "http://attacker-cuteanimegirls.moe",
            "http://localhost.attacker.com",
            "http://cuteanimegirls.moe.attacker.com",
            "http://localhost:password@attacker.com",
            "http://localhost@attacker.com",
            "http://127.0.0.1:secret@attacker.com",
            "http://cuteanimegirls.moe@attacker.com",
            "http://.cuteanimegirls.moe",
            "invalid-url",
            "",
            None,
        ]
        for url in invalid:
            with self.subTest(url=url):
                self.assertFalse(is_allowed_origin(url))

class TestStaticFileHandler(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.temp_dir, "assets"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, "caches"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, "docs"), exist_ok=True)

        with open(os.path.join(self.temp_dir, "index.html"), "w") as f:
            f.write("<html>Index</html>")
        with open(os.path.join(self.temp_dir, "favicon.ico"), "w") as f:
            f.write("ico")
        with open(os.path.join(self.temp_dir, "assets", "main.js"), "w") as f:
            f.write("console.log(1);")
        with open(os.path.join(self.temp_dir, "caches", "data.json"), "w") as f:
            f.write("{}")
        with open(os.path.join(self.temp_dir, "docs", "CHANGELOG.md"), "w") as f:
            f.write("# Changelog")

        self.handler = CustomHandler.__new__(CustomHandler)
        self.handler.directory = self.temp_dir
        self.handler.rfile = io.BytesIO()
        self.handler.wfile = io.BytesIO()
        self.handler.client_address = ("127.0.0.1", 12345)
        self.handler.connection = DummyRequest()
        self.handler.server = DummyServer()
        self.handler.headers = {}
        self.handler.requestline = "GET / HTTP/1.1"
        self.handler.command = "GET"
        self.handler.request_version = "HTTP/1.1"
        self.handler.protocol_version = "HTTP/1.1"
        self.handler.error_code = None
        self.handler.error_message = None

        def mock_send_error(code, message=None, explain=None):
            self.handler.error_code = code
            self.handler.error_message = message

        self.handler.send_error = mock_send_error

        # Patch serve.DIRECTORY dynamically during handler operations
        self._dir_patch = patch("serve.DIRECTORY", self.temp_dir)
        self._dir_patch.start()

    def tearDown(self):
        self._dir_patch.stop()
        shutil.rmtree(self.temp_dir)

    def test_allowed_paths(self):
        allowed = [
            "/index.html",
            "/favicon.ico",
            "/assets/main.js",
            "/caches/data.json",
            "/docs/CHANGELOG.md",
        ]
        for p in allowed:
            with self.subTest(path=p):
                self.handler.path = p
                self.handler.requestline = f"GET {p} HTTP/1.1"
                self.handler.error_code = None
                res = self.handler.send_head()
                self.assertIsNone(self.handler.error_code)
                if res is not None:
                    res.close()

    def test_path_traversal_attempts(self):
        traversal_paths = [
            "/serve.py",
            "/../serve.py",
            "/assets/../serve.py",
            "/assets/%2e%2e/serve.py",
            "/assets/%2e%2e%2fserve.py",
            "/assets/..%2fserve.py",
            "/assets/%252e%252e/serve.py",
            "/assets/..\\serve.py",
            "/assets/\x00serve.py",
            "/assets/%00serve.py",
            "/assets/.env",
            "/assets/index-BiDFrk06.js",
            "/assets/bundle.js.map",
            "/etc/passwd",
        ]
        for p in traversal_paths:
            with self.subTest(path=p):
                self.handler.path = p
                self.handler.error_code = None
                res = self.handler.send_head()
                self.assertEqual(self.handler.error_code, 404, f"Path {p} was not blocked with 404")
                self.assertIsNone(res)

class TestWebSocketHelpers(unittest.TestCase):
    def setUp(self):
        with rooms_lock:
            rooms.clear()
            ip_conns.clear()

    def tearDown(self):
        with rooms_lock:
            rooms.clear()
            ip_conns.clear()

    def test_sanitize_room_id(self):
        self.assertEqual(sanitize_room_id("room123"), "room123")
        self.assertEqual(sanitize_room_id("room!@#$%^&*()_+"), "room_")
        self.assertEqual(sanitize_room_id(""), "default")
        self.assertEqual(sanitize_room_id(None), "default")
        self.assertEqual(sanitize_room_id("   "), "default")
        self.assertEqual(sanitize_room_id("a" * 50), "a" * 32)

    def test_short_payload_string(self):
        msg = "hello"
        frame = encode_ws_frame(msg, opcode=1)
        # FIN bit (0x80) | text opcode (1) = 0x81
        self.assertEqual(frame[0], 0x81)
        self.assertEqual(frame[1], 5)
        self.assertEqual(frame[2:], b"hello")

        payload = "x" * 200
        frame_med = encode_ws_frame(payload, opcode=1)
        self.assertEqual(frame_med[0], 0x81)
        self.assertEqual(frame_med[1], 126)
        length = struct.unpack("!H", frame_med[2:4])[0]
        self.assertEqual(length, 200)
        self.assertEqual(frame_med[4:], payload.encode("utf-8"))

    def test_register_and_unregister_ws_client(self):
        sock1 = MockSocket()
        sock1_lock = threading.Lock()
        reg, role1, slot1, host_slot1, active_slots1, peer_count1 = _register_ws_client(
            sock1, sock1_lock, "test_room", "127.0.0.1"
        )
        self.assertTrue(reg)
        self.assertEqual(role1, "host")
        self.assertEqual(slot1, 1)
        self.assertEqual(host_slot1, 1)
        self.assertEqual(peer_count1, 0)

        sock2 = MockSocket()
        sock2_lock = threading.Lock()
        reg2, role2, slot2, host_slot2, active_slots2, peer_count2 = _register_ws_client(
            sock2, sock2_lock, "test_room", "127.0.0.1"
        )
        self.assertTrue(reg2)
        self.assertEqual(role2, "guest")
        self.assertEqual(slot2, 2)
        self.assertEqual(host_slot2, 1)
        self.assertEqual(peer_count2, 1)

        # Unregister host and check promotion
        _unregister_ws_client(sock1, "test_room", "127.0.0.1", True, role1, slot1)
        with rooms_lock:
            remaining = rooms.get("test_room", [])
            self.assertEqual(len(remaining), 1)
            self.assertEqual(remaining[0][2], "host")
            self.assertEqual(remaining[0][3], 2)

        _unregister_ws_client(sock2, "test_room", "127.0.0.1", True, role2, slot2)
        with rooms_lock:
            self.assertNotIn("test_room", rooms)
            self.assertNotIn("127.0.0.1", ip_conns)

    def test_register_ip_limit(self):
        ip = "10.0.0.1"
        sockets = []
        for i in range(MAX_CONNS_PER_IP):
            sock = MockSocket()
            sockets.append(sock)
            reg, _, _, _, _, _ = _register_ws_client(sock, threading.Lock(), f"room_{i}", ip)
            self.assertTrue(reg)

        # Next connection should be rejected
        overflow_sock = MockSocket()
        reg_over, _, _, _, _, _ = _register_ws_client(overflow_sock, threading.Lock(), "room_over", ip)
        self.assertFalse(reg_over)
        self.assertTrue(overflow_sock.closed)

    def test_read_ws_frame(self):
        payload_data = b"ping"
        frame = encode_ws_frame(payload_data, opcode=9)
        sock = MockSocket(frame)
        opcode, payload, err = _read_ws_frame(sock)
        self.assertIsNone(err)
        self.assertEqual(opcode, 9)
        self.assertEqual(payload, payload_data)

    def test_process_ws_text_message_ping(self):
        sock = MockSocket()
        sock_lock = threading.Lock()
        res = _process_ws_text_message(sock, sock_lock, "room", "host", 1, b'{"type":"ping"}')
        self.assertTrue(res)
        self.assertIn(b'{"type":"pong"}', sock.sent_data)

    def test_process_ws_text_message_relay(self):
        host_sock = MockSocket()
        guest_sock = MockSocket()
        guest_lock = threading.Lock()

        with rooms_lock:
            rooms["room"] = [
                (host_sock, threading.Lock(), "host", 1),
                (guest_sock, guest_lock, "guest", 2)
            ]

        msg = json.dumps({"type": "game_start"}).encode("utf-8")
        res = _process_ws_text_message(host_sock, threading.Lock(), "room", "host", 1, msg)
        self.assertTrue(res)
        self.assertIn(b"game_start", guest_sock.sent_data)
        self.assertIn(b'"senderSlot":1', guest_sock.sent_data)

    def test_short_payload_bytes(self):
        msg = b"world"
        frame = encode_ws_frame(msg, opcode=2)
        # FIN bit (0x80) | binary opcode (2) = 0x82
        self.assertEqual(frame[0], 0x82)
        self.assertEqual(frame[1], 5)
        self.assertEqual(frame[2:], b"world")

    def test_empty_payload(self):
        frame = encode_ws_frame("", opcode=1)
        self.assertEqual(frame[0], 0x81)
        self.assertEqual(frame[1], 0)
        self.assertEqual(len(frame), 2)

    def test_custom_opcodes(self):
        # Ping (opcode 9)
        ping_frame = encode_ws_frame("ping", opcode=9)
        self.assertEqual(ping_frame[0], 0x89)
        # Pong (opcode 10 / 0x0A)
        pong_frame = encode_ws_frame("pong", opcode=10)
        self.assertEqual(pong_frame[0], 0x8A)
        # Close (opcode 8)
        close_frame = encode_ws_frame(b"\x03\xe8", opcode=8)
        self.assertEqual(close_frame[0], 0x88)

    def test_utf8_multabyte_string(self):
        msg = "🚀 Anime ✨"
        payload = msg.encode("utf-8")
        frame = encode_ws_frame(msg, opcode=1)
        self.assertEqual(frame[0], 0x81)
        self.assertEqual(frame[1], len(payload))
        self.assertEqual(frame[2:], payload)

    def test_medium_payload_length_boundary_126(self):
        # 126 bytes payload uses 2-byte extended payload length header
        msg = b"A" * 126
        frame = encode_ws_frame(msg, opcode=1)
        self.assertEqual(frame[0], 0x81)
        self.assertEqual(frame[1], 126)
        # Next 2 bytes (H format in big endian) represent length 126
        import struct
        length = struct.unpack("!H", frame[2:4])[0]
        self.assertEqual(length, 126)
        self.assertEqual(frame[4:], msg)

    def test_medium_payload_length_65535(self):
        # 65535 (0xFFFF) bytes payload uses 2-byte extended payload length header
        msg = b"B" * 65535
        frame = encode_ws_frame(msg, opcode=1)
        self.assertEqual(frame[0], 0x81)
        self.assertEqual(frame[1], 126)
        import struct
        length = struct.unpack("!H", frame[2:4])[0]
        self.assertEqual(length, 65535)
        self.assertEqual(frame[4:], msg)

    def test_large_payload_length_65536(self):
        # 65536 (0x10000) bytes payload uses 8-byte extended payload length header
        msg = b"C" * 65536
        frame = encode_ws_frame(msg, opcode=1)
        self.assertEqual(frame[0], 0x81)
        self.assertEqual(frame[1], 127)
        import struct
        length = struct.unpack("!Q", frame[2:10])[0]
        self.assertEqual(length, 65536)
        self.assertEqual(frame[10:], msg)
import itertools

def unmask_payload(payload, mask):
    if not mask:
        return payload
    return bytes(p ^ m for p, m in zip(payload, itertools.cycle(mask)))

class TestWebSocketMasking(unittest.TestCase):
    def test_unmasking(self):
        # Sample RFC 6455 test vector or standard payload
        # Mask: 0x37 0xfa 0x21 0x3d ("5..."), Payload: unmasked "Hello" -> b'Hello'
        key = b"\x37\xfa\x21\x3d"
        # RFC 6455 example 5.7: "Hello" masked with key 0x37fa213d is 0x7f 0x9f 0x4d 0x51 0x58
        masked_hello = b"\x7f\x9f\x4d\x51\x58"
        self.assertEqual(unmask_payload(masked_hello, key), b"Hello")

    def test_unmasking_various_lengths(self):
        mask = b"\x01\x02\x03\x04"
        for length in [1, 2, 3, 4, 5, 125, 126, 65536]:
            original = b"A" * length
            masked = bytes(p ^ m for p, m in zip(original, itertools.cycle(mask)))
            unmasked = unmask_payload(masked, mask)
            self.assertEqual(unmasked, original)

if __name__ == "__main__":
    unittest.main()
