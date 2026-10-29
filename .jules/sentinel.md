## 2026-10-28 - Host Parsing Vulnerability in Custom Python WS Broker
**Vulnerability:** `urllib.parse.urlparse(origin).netloc.split(":")[0]` was used to validate `Origin` headers in `serve.py`. When an origin contains userinfo in authority (e.g. `http://localhost:pass@attacker.com`), `netloc.split(":")[0]` evaluates to `localhost`, bypassing origin checks.
**Learning:** `netloc` contains credentials if specified. Parsing hosts using `netloc.split(":")` is vulnerable to authority userinfo bypasses.
**Prevention:** Use `(urllib.parse.urlparse(url).hostname or "").lower()` to strictly extract the target host.
