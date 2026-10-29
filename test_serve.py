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
