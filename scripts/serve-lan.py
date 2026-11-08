"""Serve the release's site directory with byte ranges for lesson audio."""

import argparse
import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import re
from urllib.parse import urlsplit

from lan_sync import ApiError, LanSync, MAX_BYTES


class ReleaseHandler(SimpleHTTPRequestHandler):
    sync = None

    # Keep media seek requests out of the PM2 logs, but retain errors.
    def log_request(self, code="-", size="-"):
        if isinstance(code, int) and code >= 400:
            super().log_request(code, size)

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)

    def end_headers(self):
        private = self.path in ("/lan-sync.json", "/api/progress", "/api/health")
        self.send_header("Cache-Control", "no-store" if private else "no-cache")
        super().end_headers()

    def send_json(self, status, result):
        data = json.dumps(result, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/lan-sync.json":
            self.send_json(200, {"enabled": self.sync is not None})
        elif self.path == "/api/health":
            self.sync_health()
        else:
            super().do_GET()

    def sync_health(self):
        try:
            if not self.sync:
                raise ApiError(404, "未启用局域网同步")
            self.sync.healthy()
        except ApiError as error:
            self.send_json(error.status, {"error": str(error)})
        except Exception as error:
            self.log_error("MySQL health check failed (%s)", type(error).__name__)
            self.send_json(503, {"error": "学习数据服务暂不可用"})
        else:
            self.send_json(200, {"ok": True})

    def do_POST(self):
        if self.path != "/api/progress" or not self.sync:
            self.send_json(404, {"error": "未启用局域网同步"})
            return
        try:
            origin = self.headers.get("Origin")
            if origin and urlsplit(origin).netloc.lower() != self.headers.get("Host", "").lower():
                raise ApiError(403, "请求来源无效")
            size = self.headers.get("Content-Length", "")
            if not re.fullmatch(r"[0-9]{1,8}", size) or not 0 < int(size) <= MAX_BYTES:
                raise ApiError(413, "学习存档超过大小限制")
            if self.headers.get_content_type() != "application/json":
                raise ApiError(415, "请求格式无效")
            self.connection.settimeout(10)
            body = json.loads(self.rfile.read(int(size)))
            result = self.sync.handle(body, self.client_address[0])
        except ApiError as error:
            self.send_json(error.status, {"error": str(error)})
        except (ValueError, RecursionError):
            self.send_json(400, {"error": "请求格式无效"})
        except Exception as error:
            self.log_error("Learning data request failed (%s)", type(error).__name__)
            self.send_json(503, {"error": "学习数据服务暂不可用"})
        else:
            self.send_json(200, result)

    def send_head(self):
        self.remaining = None
        match = re.fullmatch(r"bytes=([0-9]{0,20})-([0-9]{0,20})", self.headers.get("Range", ""))
        if self.command != "GET" or not match or self.headers.get("If-Range"):
            return super().send_head()

        first, last = match.groups()
        file = Path(self.translate_path(self.path))
        if not (first or last) or not file.is_file():
            return super().send_head()

        try:
            stream = file.open("rb")
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND)
            return None

        try:
            size = os.fstat(stream.fileno()).st_size
            if first:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            else:
                start, end = max(0, size - int(last)), size - 1

            if start > end:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                stream.close()
                return None

            stream.seek(start)
            self.remaining = end - start + 1
            self.send_response(HTTPStatus.PARTIAL_CONTENT)
            self.send_header("Content-Type", self.guess_type(str(file)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(self.remaining))
            self.end_headers()
            return stream
        except BaseException:
            stream.close()
            raise

    def copyfile(self, source, outputfile):
        if self.remaining is None:
            super().copyfile(source, outputfile)
            return
        while self.remaining:
            chunk = source.read(min(64 * 1024, self.remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            self.remaining -= len(chunk)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", type=int)
    parser.add_argument("--sync-config", type=Path)
    args = parser.parse_args()
    if args.sync_config:
        ReleaseHandler.sync = LanSync(json.loads(args.sync_config.read_text(encoding="utf-8")))
    with ThreadingHTTPServer(("0.0.0.0", args.port), ReleaseHandler) as server:
        server.serve_forever()
