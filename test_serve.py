import unittest
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
