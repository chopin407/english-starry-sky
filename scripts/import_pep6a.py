"""用六上 PDF、官网下载的 MP3 和本地词光工程构建网页资源。"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from difflib import SequenceMatcher
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
from segs import segs

PUBLIC = ROOT / "public"
BOOK = "6a"
TOPICS = [["key", "课标重点词"], ["basic", "一般词汇"], ["phrase", "短语"], ["name", "地名与专名"]]
TRACKS = (
    ("song", "Listen and sing"),
    ("a-talk", "A Let's talk"),
    ("a-learn", "A Let's learn"),
    ("b-talk", "B Let's talk"),
    ("b-learn", "B Let's learn"),
    ("read", "B Read and write"),
    ("project", "C Project · Listening"),
)
TOKEN = re.compile(r"[a-zA-Z0-9]+(?:['’][a-zA-Z]+)?")
IPA = re.compile(r"/[^/]+/")
# 每个词读两次。前两单元另读 be 和不规则过去式，跨过这些片段。
WORD_STARTS = {
    1: [2, 6, 8, 10, 12, 14, 18, 20, 22, 26, 28, 32, 34, 38, 40, 42, 44, 46, 48, 50, 52, 56, 58, 60, 62, 64],
    2: [1, 3, 5, 7, 9, 11, 13, 15, 19, 21, 23, 25, 29, 33, 37, 41, 43, 45, 49, 51, 53, 57, 61, 63, 65],
}
SEGMENT_COUNTS = (66, 67, 41, 35, 59, 55)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def vocab(pages):
    appendix = " ".join(
        re.sub(rf"\s+{i - 4}$", "", page.removeprefix("Appendix 2").split("仅供", 1)[0].rstrip())
        for i, page in enumerate(pages[85:89], 85)
    )
    units = re.split(r"\bUnit ([1-6])\s+", appendix)[1:]
    assert units[::2] == list("123456"), "课本单元词表页码需要核对"
    seen = set()
    for unit, text in zip(units[::2], units[1::2]):
        for row, page in re.findall(r"(.*?)p\.\s*(\d+)", text, re.S):
            row = " ".join(row.split())
            key = row.startswith("*")
            row = row.lstrip("*")
            head, zh = re.split(r"(?=[一-鿿（])", row, maxsplit=1)
            note = ""
            if zh.startswith(("（过去式", "（=km")):
                note, zh = re.match(r"^(（[^）]+）)\s*(.*)$", zh).groups()
            if zh.startswith("（be 的"):
                zh = zh.strip("（）")
            alias = re.search(r"\(also [^)]+\)", head)
            if alias:
                note = alias[0]
                head = head[:alias.start()]
            ipa = " ".join(IPA.findall(head)).replace("ːː", "ː")
            word = IPA.sub(" ", head).strip()
            word = re.sub(r"\s*-\s*", "-", " ".join(word.split()))
            zh = re.sub(r"(?<=[一-鿿；，）])\s+(?=[一-鿿（])", "", zh)
            slug = re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-")
            wid = slug if slug not in seen else f"{slug}-u{unit}"
            seen.add(wid)
            kind = 3 if word[:1].isupper() or word == "the Red Army" else 2 if " " in word else 0 if key else 1
            yield int(unit), wid, word, zh, ipa, int(page), key, kind, note


def gloss(text):
    return set(re.findall(r"[一-鿿]{2,}", re.sub(r"[（(][^）)]*[）)]", "", text)))


def copy_media(source, root, name):
    target = root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def word_atlas_assets(atlas, source, dest, wid, zh):
    if source is None:
        return {}
    folder, aid, meaning = source
    if not gloss(zh).intersection(gloss(meaning)):
        return {}
    detail = next(e for e in atlas[folder] if e["id"] == aid)
    media = 0
    if (atlas.root / "img" / f"{aid}.webp").is_file() and (atlas.root / "thumb" / f"{aid}.webp").is_file():
        for size in ("img", "thumb"):
            copy_media(atlas.root / size / f"{aid}.webp", dest, f"{size}/{wid}.webp")
        media |= 1
    us = atlas.root / "audio" / "us" / f"{aid}.mp3"
    if us.is_file():
        copy_media(us, dest, f"audio/us/{wid}.mp3")
        media |= 4
    # 例句优先采用有一致释义、且第一义项和课本相符的词光词条。
    examples = []
    if detail["senses"] and gloss(zh).intersection(gloss(detail["senses"][0]["zh"])):
        for i, example in enumerate(detail["ex"][:2]):
            examples.append({**example, "src": "词光 Word Atlas"})
            slot = ("ex", "ex2")[i]
            mp3 = atlas.root / "audio" / slot / f"{aid}.mp3"
            if mp3.is_file():
                copy_media(mp3, dest, f"audio/{slot}/{wid}.mp3")
                media |= 8 << i
    return {"m": media, "us": detail["us"] if media & 4 else "", "ex": examples}


class LocalAtlas(dict):
    def __init__(self, root):
        super().__init__()
        self.root = root
        index = read_json(root / "index.json")
        self.words = {
            row[1].casefold(): (i // index["chunk"], row[0], row[2])
            for i, row in enumerate(index["words"])
        }

    def __missing__(self, key):
        self[key] = read_json(self.root / "entries" / f"{key}.json")
        return self[key]


def tokens(text):
    return [m[0].lower().replace("’", "'") for m in TOKEN.finditer(text)]


def point_reading(words, book_text, duration):
    spans = list(TOKEN.finditer(book_text))
    reference = [m[0].lower().replace("’", "'") for m in spans]
    lines, phrase = [], []
    for i, (word, start, end) in enumerate(words):
        phrase.append((word, start, end))
        if i + 1 < len(words) and not word.endswith((".", "?", "!")) and words[i + 1][1] - end < 0.8:
            continue
        heard = tokens(" ".join(w[0] for w in phrase))
        if len(heard) >= 3:
            match = SequenceMatcher(None, reference, heard, autojunk=False).find_longest_match()
            if match.size >= 3 and match.size == len(heard):
                left = spans[match.a].start()
                right = spans[match.a + match.size - 1].end()
                tail = re.match(r"""[.!?,;:'"”]*""", book_text[right:])[0]
                text = " ".join((book_text[left:right] + tail).split())
                s, e = max(0, phrase[0][1]), min(duration, end)
                if s < e and (not lines or s >= lines[-1]["e"]):
                    lines.append({"t": text, "s": s, "e": e})
        phrase = []
    return lines if len(lines) >= 3 else []


def probe(path):
    return round(float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)
    ], text=True).strip()), 2)


def word_times(words, tracks):
    timing = {}
    for unit, track in enumerate(tracks, 1):
        ids = [word[1] for word in words if word[0] == unit]
        intervals = segs("ffmpeg", str(track), "-38dB", "0.35")
        starts = WORD_STARTS.get(unit, range(1, len(intervals), 2))
        if len(intervals) != SEGMENT_COUNTS[unit - 1] or len(starts) != len(ids):
            raise ValueError(f"Unit {unit} 的词表与录音片段数不符，请核对音源。")
        for wid, index in zip(ids, starts):
            s, e = intervals[index]
            timing[wid] = (max(0, s - 0.07), e + 0.09)
    return timing


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("source", type=Path, help="含 PEP6A.pdf 和 mp3/ 的下载目录")
    cli.add_argument("word_atlas", type=Path, help="词光工程根目录")
    cli.add_argument("--transcript", type=Path, help="逐词识别 JSON，由 pipeline/transcribe_book_audio.py 生成")
    args = cli.parse_args()
    pages = [page.extract_text() for page in PdfReader(args.source / "PEP6A.pdf").pages]
    transcripts = read_json(args.transcript) if args.transcript else {}
    files = sorted((args.source / "mp3").glob("*.mp3"))
    if [int(f.name[:3]) for f in files] != list(range(1, 51)):
        cli.error("需要按顺序编号 001–050 的 50 条出版社配套音频。")
    words = list(vocab(pages))
    timing = word_times(words, files[44:])
    atlas = LocalAtlas(args.word_atlas / "public" / "atlas")
    rows, entries = [], []
    out = PUBLIC / "atlas" / BOOK
    for unit, wid, word, zh, ipa, page, key, kind, note in words:
        info = {"m": 0, "us": "", "ex": []}
        info.update(word_atlas_assets(atlas, atlas.words.get(word.casefold()), out, wid, zh))
        start, end = timing[wid]
        target = out / "audio" / "uk" / f"{wid}.mp3"
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-ss", str(start), "-i", str(files[43 + unit]),
            "-t", str(end - start), "-ac", "1", "-b:a", "64k", str(target)
        ], check=True)
        info["m"] |= 2
        rows.append([wid, word, zh, ipa, unit - 1, kind, info["m"]])
        entries.append({
            "id": wid, "w": word, "uk": ipa, **info,
            "senses": [{"pos": "", "zh": zh, "en": ""}],
            "col": [], "fam": [], "syn": [], "ant": [], "tip": note, "cefr": f"Unit {unit}",
            "topic": TOPICS[kind][0], "page": page, "key": key, "unit": f"unit-{unit}",
        })
    for i in range(0, len(entries), 100):
        write_json(out / "entries" / f"{i // 100}.json", entries[i:i + 100])
    write_json(out / "index.json", {
        "id": "pep-6a", "version": 1, "name": "人教版 PEP 英语六年级上册",
        "license": "课本词表与录音仅供学习；词光素材 CC BY 4.0 Word Atlas contributors",
        "count": len(rows), "examples": sum(len(e["ex"]) for e in entries),
        "illustrated": sum(bool(e["m"] & 1) for e in entries), "voiced": sum(bool(e["m"] & 2) for e in entries),
        "chunk": 100, "topics": TOPICS, "cefr": [f"Unit {i}" for i in range(1, 7)],
        "fields": ["id", "word", "zh", "ipa", "unit", "kind", "media"], "words": rows,
    })

    def lesson(track, uid, lid, title, reference=""):
        audio = f"lessons/{BOOK}/{uid}-{lid}.mp3"
        source = files[track - 1]
        duration = probe(source)
        lines = point_reading(transcripts.get(source.name, []), reference, duration)
        copy_media(source, PUBLIC, audio)
        return {"id": f"{uid}-{lid}", "title": title, "audio": audio, "duration": duration, "lines": lines}

    units = []
    for i in range(6):
        uid = f"unit-{i + 1}"
        page = 6 + 12 * i
        references = [pages[82] + pages[83] + pages[84], *pages[page + 2:page + 7], pages[page + 8]]
        lessons = [
            lesson(i * 7 + j + 1, uid, lid, title, references[j])
            for j, (lid, title) in enumerate(TRACKS)
        ]
        lessons.append(lesson(45 + i, uid, "words", "Words in each unit"))
        units.append({"unit": uid, "lessons": lessons})
    units.append({"unit": "revision", "lessons": [
        lesson(43, "revision", "play", "Read and give an ending to the play", pages[80]),
        lesson(44, "revision", "listen", "Listen and fill in the blanks", pages[80]),
    ]})
    write_json(PUBLIC / "data" / "6a-lessons.json", {"book": BOOK, "units": units})
    print(f"{len(entries)} 个词条，{sum(bool(e['m'] & 2) for e in entries)} 条单词原声，50 条教材录音")


if __name__ == "__main__":
    main()
