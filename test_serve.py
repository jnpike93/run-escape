import unittest
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

if __name__ == "__main__":
    unittest.main()
