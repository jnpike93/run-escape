import unittest
from serve import is_allowed_origin, encode_ws_frame

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

if __name__ == "__main__":
    unittest.main()
