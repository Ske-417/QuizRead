#!/usr/bin/env python3
"""Serve QuizRead and synthesize Japanese speech with Open JTalk.

The browser cannot execute Open JTalk directly, so this small standard-library
server exposes a local-only /api/speak endpoint.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
HOST = os.environ.get("QUIZREAD_HOST", "127.0.0.1")
PORT = int(os.environ.get("QUIZREAD_PORT", "8000"))


def first_existing(*paths: str) -> str | None:
    for path in paths:
        if Path(path).exists():
            return path
    return None


def first_glob(*patterns: str) -> str | None:
    for pattern in patterns:
        matches = sorted(Path("/").glob(pattern.lstrip("/")))
        if matches:
            return str(matches[0])
    return None


def open_jtalk_config() -> tuple[str | None, str | None, str | None]:
    binary = os.environ.get("OPEN_JTALK_BIN") or shutil.which("open_jtalk")
    dictionary = os.environ.get("OPEN_JTALK_DIC") or first_existing(
        "/opt/homebrew/share/open_jtalk/dic",
        "/usr/local/share/open_jtalk/dic",
        "/usr/share/open_jtalk/dic",
    ) or first_glob(
        "/opt/homebrew/Cellar/open-jtalk/*/dic",
        "/usr/local/Cellar/open-jtalk/*/dic",
    )
    voice = os.environ.get("OPEN_JTALK_VOICE") or first_existing(
        "/opt/homebrew/share/hts-voice/mei/mei_normal.htsvoice",
        "/usr/local/share/hts-voice/mei/mei_normal.htsvoice",
        "/usr/share/hts-voice/mei/mei_normal.htsvoice",
    ) or first_glob(
        "/opt/homebrew/Cellar/open-jtalk/*/voice/mei/mei_normal.htsvoice",
        "/usr/local/Cellar/open-jtalk/*/voice/mei/mei_normal.htsvoice",
    )
    return binary, dictionary, voice


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print(f"[quizread] {self.address_string()} - {fmt % args}")

    def do_POST(self):
        if urlparse(self.path).path != "/api/speak":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            text = str(payload.get("text", "")).strip()
            if not text or len(text) > 2000:
                raise ValueError("text must contain between 1 and 2000 characters")
            wav = synthesize(text, payload)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(wav)
        except ValueError as exc:
            self.send_error(400, str(exc))
        except RuntimeError as exc:
            self.send_error(503, str(exc))
        except (OSError, subprocess.SubprocessError) as exc:
            self.send_error(500, f"Open JTalk failed: {exc}")

    def do_GET(self):
        if urlparse(self.path).path == "/api/status":
            binary, dictionary, voice = open_jtalk_config()
            body = json.dumps(
                {"available": bool(binary and dictionary and voice),
                 "binary": binary, "dictionary": dictionary, "voice": voice}
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def synthesize(text: str, payload: dict) -> bytes:
    binary, dictionary, voice = open_jtalk_config()
    if not binary or not dictionary or not voice:
        raise RuntimeError(
            "Open JTalk が見つかりません。OPEN_JTALK_BIN/DIC/VOICE を設定してください"
        )
    with tempfile.NamedTemporaryFile(suffix=".wav") as output:
        command = [binary, "-x", dictionary, "-m", voice, "-ow", output.name]
        subprocess.run(
            command, input=text.encode("utf-8"), stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, check=True, timeout=30,
        )
        return Path(output.name).read_bytes()


if __name__ == "__main__":
    print(f"QuizRead: http://{HOST}:{PORT}")
    print("Open JTalk の場所は /api/status または環境変数で確認できます。")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
