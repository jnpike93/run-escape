import unittest
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

class TestStaticFileHandler(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.temp_dir, "assets"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, "caches"), exist_ok=True)

        with open(os.path.join(self.temp_dir, "index.html"), "w") as f:
            f.write("<html>Index</html>")
        with open(os.path.join(self.temp_dir, "favicon.ico"), "w") as f:
            f.write("ico")
        with open(os.path.join(self.temp_dir, "assets", "main.js"), "w") as f:
            f.write("console.log(1);")
        with open(os.path.join(self.temp_dir, "caches", "data.json"), "w") as f:
            f.write("{}")

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

if __name__ == "__main__":
    unittest.main()
