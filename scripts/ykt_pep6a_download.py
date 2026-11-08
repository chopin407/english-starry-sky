#!/usr/bin/env python3
"""下载人教版 PEP 英语六年级上册 PDF 和出版社配套 MP3。"""

from __future__ import annotations

import argparse
import http.client
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

PEP_PAGE = "https://www.pep.com.cn/zslth/yyptzy/xypep/6s/"
PDF_VIEWER = "https://x-edu-pdfjs.ykt.eduyun.cn/generic/web/viewer.html"
PDF_ASSET_HOST = "r2-ndr-private.ykt.cbern.com.cn"
DEFAULT_OUT = Path(__file__).resolve().parent / "build" / "pep6a"
DOWNLOAD_ERRORS = (OSError, ValueError, http.client.HTTPException)


class DownloadError(ValueError):
    """可以直接显示给用户的错误。"""


class PdfViewer(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.link = ""

    def handle_starttag(self, tag, attrs) -> None:
        src = dict(attrs).get("src") or ""
        if tag == "iframe" and src.partition("?")[0] == PDF_VIEWER:
            self.link = src


class PublisherAudio(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.heading = ""
        self.heading_text: list[str] = []
        self.section = ""
        self.title = ""
        self.tracks: dict[str, str] = {}

    def handle_starttag(self, tag, attrs) -> None:
        if tag in ("h4", "h5"):
            self.heading = tag
            self.heading_text.clear()
        attrs = dict(attrs)
        if tag == "a" and "download" in attrs and attrs.get("href"):
            url = urljoin(PEP_PAGE, attrs["href"])
            parts = urlsplit(url)
            if (
                parts.scheme == "https"
                and parts.netloc == "www.pep.com.cn"
                and parts.path.startswith("/yyszptzy/")
                and parts.path.lower().endswith(".mp3")
                and self.section
                and self.title
            ):
                self.tracks[url] = f"{self.section} - {self.title}"

    def handle_data(self, data) -> None:
        if self.heading:
            self.heading_text.append(data)

    def handle_endtag(self, tag) -> None:
        if tag != self.heading:
            return
        title = " ".join("".join(self.heading_text).split())
        if tag == "h4":
            self.section = title
        else:
            self.title = re.sub(r"^\d+\s+", "", title)
        self.heading = ""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # 授权头只发送到教材文件本身的地址。
        return None


def parse_viewer_link(link: str) -> tuple[str, dict[str, str]]:
    # 查看器的签名包含字面量 +，不能按表单编码把它解成空格。
    query = {
        unquote(key): unquote(value)
        for part in urlsplit(link).query.split("&")
        for key, sep, value in [part.partition("=")]
        if sep
    }
    headers = json.loads(query.get("headers", "{}"))
    if "file" not in query or not isinstance(headers, dict):
        raise ValueError("查看器参数无效")
    return query["file"], headers


def pdf_request(source: Path) -> Request:
    html = source.read_text(encoding="utf-8-sig").strip()
    viewer = PdfViewer()
    viewer.feed(html)
    viewer.close()
    link = viewer.link or html
    if link.partition("?")[0] != PDF_VIEWER:
        raise DownloadError("找不到 PDF 查看器，请保存包含查看器 iframe 的 HTML 或完整查看器链接。")
    try:
        url, headers = parse_viewer_link(link)
    except (AttributeError, ValueError) as exc:
        raise DownloadError("查看器链接的文件地址或签名格式有误，请重新复制。") from exc
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.netloc != PDF_ASSET_HOST or not parts.path.lower().endswith(".pdf"):
        raise DownloadError("查看器中的 PDF 地址与智慧教育平台的教材地址格式不符。")
    auth = headers.get("X-ND-AUTH")
    if not auth:
        raise DownloadError("查看器链接缺少 X-ND-AUTH，请从打开的教材页面重新复制。")
    return Request(
        quote(url, safe=":/?#[]@!$&'()*+,;=%"),
        headers={"X-ND-AUTH": auth, "Referer": PDF_VIEWER},
    )


def valid_media(path: Path, suffix: str) -> bool:
    if not path.is_file():
        return False
    with path.open("rb") as file:
        head = file.read(10)
        if suffix == ".mp3":
            return len(head) == 10 and (
                head.startswith(b"ID3") or (head[0] == 0xFF and head[1] & 0xE0 == 0xE0)
            )
        if not head.startswith(b"%PDF-"):
            return False
        file.seek(max(0, path.stat().st_size - 1024))
        return file.read().rstrip().endswith(b"%%EOF")


def save(request: Request, destination: Path) -> bool:
    if valid_media(destination, destination.suffix):
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with build_opener(NoRedirect()).open(request, timeout=45) as response:
            if response.status != 200:
                raise DownloadError(f"预期完整文件，收到 HTTP {response.status}。")
            expected = response.headers.get("Content-Length")
            with NamedTemporaryFile(dir=destination.parent, suffix=".part", delete=False) as file:
                temporary = Path(file.name)
                while chunk := response.read(256 * 1024):
                    file.write(chunk)
        if expected is not None and temporary.stat().st_size != int(expected):
            raise DownloadError("文件长度与服务器返回值不符。")
        if not valid_media(temporary, destination.suffix):
            raise DownloadError(f"服务器返回的内容不是完整的 {destination.suffix} 文件。")
        temporary.replace(destination)
        return True
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def download_audio(out: Path) -> int:
    page = PublisherAudio()
    with build_opener(NoRedirect()).open(PEP_PAGE, timeout=45) as response:
        page.feed(response.read().decode("utf-8-sig"))
    page.close()
    if len(page.tracks) != 50:
        raise DownloadError(f"人教社页面解析到 {len(page.tracks)} 条 MP3，预期为 50 条。")

    failures = 0
    for number, (url, title) in enumerate(page.tracks.items(), 1):
        safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", title).rstrip(" .")
        name = f"{number:03d} - {safe_title}.mp3"
        try:
            saved = save(Request(url, headers={"Referer": PEP_PAGE}), out / name)
            print(f"{'已下载' if saved else '已存在'} {name}", flush=True)
        except DOWNLOAD_ERRORS as exc:
            failures += 1
            print(f"音频 {number:03d} 下载失败（{describe_error(exc)}）", file=sys.stderr)
    print(f"MP3 可用 {len(page.tracks) - failures}/{len(page.tracks)} 条。")
    return failures


def describe_error(exc: Exception) -> str:
    if isinstance(exc, HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, URLError):
        return f"网络连接失败（{type(exc.reason).__name__}）"
    if isinstance(exc, DownloadError):
        return str(exc)
    return type(exc).__name__


def main() -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("source", nargs="?", type=Path, help="保存为 UTF-8 的教材 HTML 或 PDF 查看器链接文本")
    cli.add_argument("--out", type=Path, default=DEFAULT_OUT, help="保存目录，默认 scripts/build/pep6a")
    mode = cli.add_mutually_exclusive_group()
    mode.add_argument("--pdf-only", action="store_true", help="只下载 PDF")
    mode.add_argument("--audio-only", action="store_true", help="只从人民教育出版社下载配套 MP3")
    args = cli.parse_args()

    pdf = args.out / "PEP6A.pdf"
    if not args.audio_only and args.source is None and not valid_media(pdf, ".pdf"):
        cli.error("下载 PDF 需要提供教材 HTML 或 PDF 查看器链接文本文件。")

    failures = 0
    if not args.audio_only:
        try:
            saved = not valid_media(pdf, ".pdf") and save(pdf_request(args.source), pdf)
            print(f"{'已下载' if saved else '已存在'} {pdf}", flush=True)
        except DOWNLOAD_ERRORS as exc:
            failures += 1
            print(f"PDF 下载失败（{describe_error(exc)}）", file=sys.stderr)
            if isinstance(exc, HTTPError) and exc.code in (401, 403):
                print("请重新打开教材页，保存含新签名的 HTML 或查看器链接后重试。", file=sys.stderr)
    if not args.pdf_only:
        try:
            failures += download_audio(args.out / "mp3")
        except DOWNLOAD_ERRORS as exc:
            failures += 1
            print(f"音频列表读取失败（{describe_error(exc)}）", file=sys.stderr)
    print(f"保存目录 {args.out.resolve()}")
    return int(failures > 0)


if __name__ == "__main__":
    raise SystemExit(main())
