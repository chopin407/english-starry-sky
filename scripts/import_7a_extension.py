"""Import the 7a extension vocabulary and media from a local Word Atlas checkout."""

import argparse
import csv
from functools import cache
import json
from pathlib import Path
import re
import shutil


HERE = Path(__file__).resolve().parent
DEST = HERE.parent / "public" / "atlas"
UNIT = "拓展词汇"
MEDIA = (
    (1, "img", "webp"),
    (1, "thumb", "webp"),
    (2, "audio/uk", "mp3"),
    (4, "audio/us", "mp3"),
)
PREFER_CUSTOM_EXAMPLE = {"active", "close", "expect", "peace", "practice", "respect", "share", "tie"}
NOTES = {
    "close": "表示“亲近的”时，末尾读 /s/；表示“关闭”时，末尾读 /z/。词头录音为动词读音。",
    "held out one's hand": "one's 要换成与主语相应的所有格，如 held out his hand。",
    "too … to": "too + 形容词或副词 + (for sb.) + to + 动词原形。",
}


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    if path.exists() and read(path) == value:
        return False
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return True


@cache
def catalog(root):
    index = read(root / "index.json")
    words = {}
    for order, row in enumerate(index["words"]):
        words.setdefault(row[1].casefold(), (order, row))
    return index, words


@cache
def chunk(root, number):
    return read(root / "entries" / f"{number}.json")


def lookup(root, word):
    index, words = catalog(root)
    if word not in words:
        return None
    order, row = words[word]
    group, slot = divmod(order, index["chunk"])
    entry = chunk(root, group)[slot]
    if entry["id"] != row[0]:
        raise ValueError(f"{root}: wrong entry at row {order}")
    return row, entry


def copy_media(root, folder, source_id, target_id, ext, target_folder=None):
    src = root / folder / f"{source_id}.{ext}"
    dst = DEST / (target_folder or folder) / f"{target_id}.{ext}"
    if not src.is_file() or not src.stat().st_size:
        raise ValueError(f"Missing Word Atlas media: {src}")
    if not dst.exists() or src.read_bytes() != dst.read_bytes():
        shutil.copyfile(src, dst)


def import_words(source):
    index = read(DEST / "index.json")
    old_index = index.copy()
    levels = index["cefr"]
    if UNIT not in levels:
        index["cefr"] = levels = [*levels, UNIT]
    level = levels.index(UNIT)
    recordings_path = HERE / "7a-extension-recordings.json"
    recordings = read(recordings_path) if recordings_path.exists() else {}
    # Keep textbook rows, IDs and positions intact. The extension is appended as a group.
    first = next((i for i, row in enumerate(index["words"]) if row[4] == level), len(index["words"]))
    base_rows = index["words"][:first]
    later = [
        (row, chunk(DEST, i // index["chunk"])[i % index["chunk"]])
        for i, row in enumerate(index["words"][first:], first)
        if row[4] != level
    ]
    base_count = len(base_rows)
    first_chunk, first_slot = divmod(base_count, index["chunk"])
    entries = chunk(DEST, first_chunk)[:first_slot] if first_slot else []
    rows = list(base_rows)
    used_ids = {row[0] for row in base_rows} | {row[0] for row, _ in later}
    base_words = {row[1].casefold() for row in base_rows} | {row[1].casefold() for row, _ in later}
    books = sorted(path.parent for path in DEST.glob("*/index.json"))
    media_sources = [source, *books]
    with (HERE / "vocab-7a-extension.tsv").open(encoding="utf-8", newline="") as file:
        for word, pos, zh, en, translation in csv.reader(file, delimiter="\t"):
            if word.casefold() in base_words:
                continue
            matches = [(root, lookup(root, word.casefold())) for root in media_sources]
            matches = [(root, match) for root, match in matches if match is not None]
            upstream = matches[0][1][1] if matches and matches[0][0] == source else {}
            local_id = next((row[0] for root, (row, _) in matches if root != source), None)
            wid = local_id or upstream.get("id") or re.sub(r"[^a-z0-9]+", "-", word.casefold()).strip("-")
            if wid in used_ids:
                raise ValueError(f"Duplicate word ID: {wid}")
            used_ids.add(wid)
            kind = 2 if " " in word else 1
            media = 0
            pronunciation = {}
            for bit, folder, ext in MEDIA:
                for root, (row, entry) in matches:
                    if not row[6] & bit:
                        continue
                    copy_media(root, folder, row[0], wid, ext)
                    media |= bit
                    if folder.startswith("audio/"):
                        accent = folder.split("/")[-1]
                        pronunciation[accent] = entry.get(accent, "")
                    break

            authored = {"en": en, "zh": translation, "src": "拓展"}
            examples = [authored]
            if upstream.get("ex"):
                atlas_example = {**upstream["ex"][0], "src": "拓展"}
                custom_first = word in PREFER_CUSTOM_EXAMPLE
                examples = [authored, atlas_example] if custom_first else [atlas_example]
                if upstream["m"] & 8:
                    copy_media(source, "audio/ex", upstream["id"], wid, "mp3", "audio/ex2" if custom_first else None)
                    media |= 16 if custom_first else 8

            # Custom illustrations and recordings live alongside the copied Word Atlas assets.
            def has_media(folder, ext):
                path = DEST / folder / f"{wid}.{ext}"
                return path.is_file() and path.stat().st_size > 0

            if has_media("img", "webp") and has_media("thumb", "webp"):
                media |= 1
            if has_media("audio/us", "mp3"):
                media |= 4
            if recordings.get(wid) == examples[0]["en"] and has_media("audio/ex", "mp3"):
                media |= 8

            senses = [{"pos": p, "zh": s, "en": ""} for p, s in zip(pos.split("；"), zh.split("|"), strict=True)]
            uk, us = (pronunciation.get(accent) or upstream.get(accent, "") for accent in ("uk", "us"))
            display = "；".join(f"{sense['pos']} {sense['zh']}".strip() for sense in senses)
            rows.append([wid, word, display, uk or us, level, kind, media])
            entries.append({
                "id": wid, "w": word, "uk": uk, "us": us, "senses": senses, "ex": examples,
                "col": [], "fam": [], "syn": [], "ant": [], "tip": NOTES.get(word, ""),
                "cefr": UNIT, "topic": index["topics"][kind][0], "m": media, "unit": UNIT,
            })

    extension_count = len(rows) - base_count
    rows.extend(row for row, _ in later)
    entries.extend(entry for _, entry in later)
    size = index["chunk"]
    changed = False
    for offset in range(0, len(entries), size):
        changed |= write(DEST / "entries" / f"{first_chunk + offset // size}.json", entries[offset:offset + size])
    all_entries = [entry for n in range(first_chunk) for entry in chunk(DEST, n)] + entries
    index.update(
        words=rows, count=len(rows), examples=sum(len(e["ex"]) for e in all_entries),
        illustrated=sum(bool(r[6] & 1) for r in rows), voiced=sum(bool(r[6] & 6) for r in rows),
    )
    if changed or index != old_index:
        index["version"] += 1
        write(DEST / "index.json", index)
    print(f"{extension_count} extension entries, {len(rows)} words total")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("word_atlas", type=Path, help="Path to the Word Atlas checkout")
    import_words(parser.parse_args().word_atlas.resolve() / "public" / "atlas")
