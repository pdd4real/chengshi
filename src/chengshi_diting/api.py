from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .detector import detect
from .store import events, replay, summary


def write_json(handler: BaseHTTPRequestHandler, status: int, payload: dict | list) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "content-type")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class CityListenHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        write_json(self, 200, {"ok": True})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/events":
            write_json(self, 200, events())
            return
        if parsed.path == "/api/summary":
            write_json(self, 200, summary())
            return
        if parsed.path == "/api/replay":
            event_id = parse_qs(parsed.query).get("id", [""])[0]
            payload = replay(event_id)
            write_json(self, 200 if payload else 404, payload or {"error": "event not found"})
            return
        write_json(self, 404, {"error": "not found"})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/detect":
            write_json(self, 404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        features = json.loads(raw.decode("utf-8"))
        write_json(self, 200, detect(features).__dict__)

    def log_message(self, fmt: str, *args: object) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8088, type=int)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), CityListenHandler)
    print(f"CityListen API listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
