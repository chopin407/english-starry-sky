"""Serve the release's site directory with byte ranges for lesson audio."""

import argparse
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import re


class ReleaseHandler(SimpleHTTPRequestHandler):
    # Keep media seek requests out of the PM2 logs, but retain errors.
    def log_request(self, code="-", size="-"):
        if isinstance(code, int) and code >= 400:
            super().log_request(code, size)

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

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
    args = parser.parse_args()
    with ThreadingHTTPServer(("0.0.0.0", args.port), ReleaseHandler) as server:
        server.serve_forever()
