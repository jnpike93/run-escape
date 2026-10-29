import unittest
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

if __name__ == "__main__":
    unittest.main()
