import unittest
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

class TestEncodeWsFrame(unittest.TestCase):
    def test_short_payload_string(self):
        msg = "hello"
        frame = encode_ws_frame(msg, opcode=1)
        # FIN bit (0x80) | text opcode (1) = 0x81
        self.assertEqual(frame[0], 0x81)
        self.assertEqual(frame[1], 5)
        self.assertEqual(frame[2:], b"hello")

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
