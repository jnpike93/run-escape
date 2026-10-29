import unittest
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
            "http://localhost.attacker.com",
            "http://cuteanimegirls.moe.attacker.com",
            "http://localhost:password@attacker.com",
            "http://localhost@attacker.com",
            "http://127.0.0.1:secret@attacker.com",
            "http://cuteanimegirls.moe@attacker.com",
            "invalid-url",
            "",
            None,
        ]
        for url in invalid:
            with self.subTest(url=url):
                self.assertFalse(is_allowed_origin(url))


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

    def test_encode_ws_frame(self):
        frame = encode_ws_frame("hello", opcode=1)
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
