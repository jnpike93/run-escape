import unittest
from serve import is_allowed_origin

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
