"""从已核对的外研九上词表、平台 MP3 和本地词光工程生成网页资源。"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path

from import_pep6a import (
    PUBLIC, TOPICS, LocalAtlas, copy_media, point_reading, probe, read_json, segs,
    word_atlas_assets, write_json,
)

BOOK = "fltrp9a"
TITLE = "外研版九年级"
READINGS = (
    ("Art in safe hands", "Liang Qichao and ‘The Young China’"),
    ("A dog called Money", "A love worth more than gold"),
    ("Putting the pieces together", "Living history"),
    ("What was she like?", "The dreamer of plenty"),
    ("When the earth stands still", "No longer ‘in danger’"),
    ("Plastic: good or bad?", "Hey! Come on out!"),
)


def vocabulary():
    units = []
    for line in Path(__file__).with_name("fltrp9a_vocab.tsv").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        if line.startswith("["):
            units.append([])
            continue
        word, ipa, pos, zh, page = line.split("|")
        key = word.startswith("*")
        units[-1].append((word.removeprefix("*"), f"/{ipa}/" if ipa else "", pos, zh, int(page), key))
    if len(units) != 6 or any(not unit for unit in units):
        raise ValueError("预期六个单元的词表。")
    return units


def checked_tracks(source):
    paths = sorted((source / "mp3").glob("*.mp3"))
    manifest = read_json(source / "relation_audios.json")
    if len(paths) != 50 or len(manifest) != 50:
        raise ValueError("需要平台清单及全部 50 条 MP3。")
    for i, (item, path) in enumerate(zip(manifest, paths), 1):
        original = next(t for t in item["ti_items"] if t["ti_format"] == "mp3" and t["ti_file_flag"] == "href")
        with path.open("rb") as file:
            checksum = hashlib.file_digest(file, "md5").hexdigest()
        if not path.name.startswith(f"{i:03d} ") or checksum != original["ti_md5"]:
            raise ValueError(f"音频 {i:03d} 与平台完整 MP3 不匹配。")
        yield path, item["global_title"]["zh-CN"]


def build_atlas(units, tracks, local):
    out = PUBLIC / "atlas" / BOOK
    recordings = [p for p, t in tracks if "Words and expressions" in t]
    intervals = [segs("ffmpeg", str(p), "-38dB", "0.35") for p in recordings]
    if len(intervals) != 6 or any(len(clip) != len(words) + 2 for words, clip in zip(units, intervals)):
        raise ValueError("词表与录音段数不符。每单元录音应为两段报幕和逐词原声。")

    rows, entries, ids = [], [], set()
    for unit, (words, audio, clips) in enumerate(zip(units, recordings, intervals), 1):
        for (word, ipa, pos, zh, page, key), (s, e) in zip(words, clips[2:]):
            slug = re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-")
            wid = f"{BOOK}-{slug}"
            if wid in ids:
                wid += f"-u{unit}"
            ids.add(wid)
            kind = 3 if word[0].isupper() and not pos else 2 if " " in word else 0 if key else 1
            media = {"m": 0, "us": "", "ex": []}
            media.update(word_atlas_assets(local, local.words.get(word.casefold()), out, wid, zh))
            target = out / "audio" / "uk" / f"{wid}.mp3"
            target.parent.mkdir(parents=True, exist_ok=True)
            start = max(0, s - 0.07)
            subprocess.run([
                "ffmpeg", "-v", "error", "-y", "-ss", str(start), "-i", str(audio),
                "-t", str(e + 0.09 - start), "-ac", "1", "-b:a", "64k", str(target),
            ], check=True)
            media["m"] |= 2
            rows.append([wid, word, f"{pos} {zh}".strip(), ipa, unit - 1, kind, media["m"]])
            entries.append({
                "id": wid, "w": word, "uk": ipa, **media,
                "senses": [{"pos": pos, "zh": zh, "en": ""}],
                "col": [], "fam": [], "syn": [], "ant": [], "tip": "", "cefr": f"Unit {unit}",
                "topic": TOPICS[kind][0], "page": page, "key": key, "unit": f"unit-{unit}",
            })
    for i in range(0, len(entries), 100):
        write_json(out / "entries" / f"{i // 100}.json", entries[i:i + 100])
    write_json(out / "index.json", {
        "id": BOOK, "version": 1, "name": TITLE, "count": len(rows), "voiced": len(rows),
        "license": "教材内容版权归外语教学与研究出版社；词光素材 CC BY 4.0 Word Atlas contributors",
        "examples": sum(len(e["ex"]) for e in entries),
        "illustrated": sum(bool(e["m"] & 1) for e in entries),
        "chunk": 100, "topics": TOPICS, "cefr": [f"Unit {i}" for i in range(1, 7)],
        "fields": ["id", "word", "zh", "ipa", "unit", "kind", "media"], "words": rows,
    })
    print(f"{len(rows)} 个词条，{len(rows)} 条单词原声", flush=True)


def build_lessons(tracks, transcript, ocr):
    groups = defaultdict(list)
    for i, (path, name) in enumerate(tracks, 1):
        match = re.match(r"Unit ([1-6])_(.*)", name)
        uid = f"unit-{match[1]}" if match else "appendix"
        title = " · ".join(p.strip() for p in match[2].split("_")) if match else name
        duration = probe(path)
        lines = []
        if match:
            unit = int(match[1]) - 1
            part = next((j for j, prefix in enumerate(("Understanding ideas_2 ", "Developing ideas _Reading for writing_2 "))
                         if match[2].startswith(prefix)), None)
            if part is not None:
                title = ("Understanding ideas" if part == 0 else "Reading for writing") + " · " + READINGS[unit][part]
                page = 9 + 16 * unit + 8 * part
                book_text = " ".join(line["text"] for p in (page, page + 1) for line in ocr.get(f"lesson-{p:03}", []))
                lines = point_reading(transcript.get(f"{i:03}", []), book_text, duration, segment_timestamps=True)
        lid = f"{uid}-{i:03}"
        audio = f"lessons/{BOOK}/{lid}.mp3"
        copy_media(path, PUBLIC, audio)
        groups[uid].append({"id": lid, "title": title, "audio": audio, "duration": duration, "lines": lines})
    write_json(PUBLIC / "data" / f"{BOOK}-lessons.json", {
        "book": BOOK, "units": [{"unit": uid, "lessons": lessons} for uid, lessons in groups.items()],
    })
    print(f"{len(tracks)} 条课本录音，{sum(bool(l['lines']) for ls in groups.values() for l in ls)} 条可点读", flush=True)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("source", type=Path, help="含 relation_audios.json 和 mp3/ 的下载目录")
    cli.add_argument("word_atlas", type=Path, help="本地词光工程根目录")
    args = cli.parse_args()
    tracks = list(checked_tracks(args.source))
    # 可从扫描页 OCR 与本地音频识别结果生成点读，缺失时保留整段原声。
    transcript_path = args.source / "transcript.json"
    ocr_path = args.source / "ocr-lessons.json"
    transcript = read_json(transcript_path) if transcript_path.is_file() else {}
    ocr = json.loads(ocr_path.read_text(encoding="utf-8-sig")) if ocr_path.is_file() else {}
    build_atlas(vocabulary(), tracks, LocalAtlas(args.word_atlas / "public" / "atlas"))
    build_lessons(tracks, transcript, ocr)


if __name__ == "__main__":
    main()
