"""Append core phrases and exam vocabulary to the web atlases."""

import argparse
from collections import defaultdict
import csv
from pathlib import Path
import re
import shutil

from import_7a_extension import DEST, HERE, MEDIA, chunk, lookup, read, write


UNIT = "核心短语与词汇"


def key(word):
    word = word.casefold().replace("’", "'")
    word = re.sub(r"\b(sb|sth|adj)\.", r"\1", word)
    word = re.sub(r"\s*(?:\.{2,}|…+)\s*,?\s*", " ", word)
    word = " ".join(word.split())
    return {"remind of": "remind sb of", "not as/so as": "not as as"}.get(word, word)


def asset(root, folder, wid, ext):
    return root / folder / f"{wid}.{ext}"


def exists(path):
    return path.is_file() and path.stat().st_size > 0


def copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        shutil.copyfile(source, target)


def spoken_word(word):
    for mark, expansion in (("sb.", "somebody"), ("sth.", "something"), ("adj.", "adjective")):
        word = word.replace(mark, expansion)
    return word.replace("+", " ").replace("/", " or ").replace("…", ",")


def import_words(source, scenes):
    roots = {"7a": DEST}
    roots.update({path.parent.name: path.parent for path in DEST.glob("*/index.json")})
    indexes = {book: read(root / "index.json") for book, root in roots.items()}
    seen = {key(row[1]) for index in indexes.values() for row in index["words"]}
    used_ids = {row[0] for index in indexes.values() for row in index["words"]}
    additions = defaultdict(list)
    missing_audio = []
    with (HERE / "core-vocabulary.txt").open(encoding="utf-8-sig", newline="") as file:
        for book, word, zh, en, translation, scene in csv.reader(file, delimiter="|", quoting=csv.QUOTE_NONE):
            canonical = key(word)
            if canonical in seen:
                continue
            seen.add(canonical)
            root = roots[book]
            wid = re.sub(r"[^a-z0-9]+", "-", canonical).strip("-")
            if wid in used_ids:
                wid += f"-core-{book}"
            used_ids.add(wid)
            match = lookup(source, word.casefold())
            upstream = match[1] if match else {}
            source_id = upstream.get("id", wid)
            media = 0
            for bit, folder, ext in MEDIA:
                original = asset(source, folder, source_id, ext)
                target = asset(root, folder, wid, ext)
                if match and match[0][6] & bit and exists(original):
                    copy(original, target)
                elif bit == 1:
                    copy(asset(scenes, folder, scene, ext), target)
                if bit != 1 and exists(target):
                    media |= bit
            if all(exists(asset(root, folder, wid, "webp")) for folder in ("img", "thumb")):
                media |= 1

            examples = [{"en": en, "zh": translation, "src": "拓展"}]
            for n, example in enumerate(upstream.get("ex", [])[:1], 2):
                examples.append({**example, "src": "拓展"})
                original = asset(source, "audio/ex", source_id, "mp3")
                if upstream["m"] & 8 and exists(original):
                    copy(original, asset(root, f"audio/ex{n}", wid, "mp3"))
                    media |= 16
            if exists(asset(root, "audio/ex", wid, "mp3")):
                media |= 8
            if not media & 6:
                missing_audio.append([spoken_word(word), str(asset(root, "audio/us", wid, "mp3"))])
            if not media & 8:
                missing_audio.append([en, str(asset(root, "audio/ex", wid, "mp3"))])

            index = indexes[book]
            if UNIT not in index["cefr"]:
                index["cefr"].append(UNIT)
            level = index["cefr"].index(UNIT)
            kind = 2 if " " in word else 1
            uk, us = upstream.get("uk", ""), upstream.get("us", "")
            additions[book].append((
                [wid, word, zh, uk or us, level, kind, media],
                {"id": wid, "w": word, "uk": uk, "us": us,
                 "senses": [{"pos": "", "zh": zh, "en": ""}], "ex": examples,
                 "col": [], "fam": [], "syn": [], "ant": [], "tip": "",
                 "cefr": UNIT, "topic": index["topics"][kind][0], "m": media, "unit": UNIT},
            ))

    if missing_audio:
        # Keep the current catalog intact until recordings are available.
        write(HERE / "build" / "core-audio-jobs.json", missing_audio)
        print(f"{len(missing_audio)} recordings required. Run build_core_vocabulary_audio.ps1, then repeat this command.")
        return

    for book, records in additions.items():
        index = indexes[book]
        root = roots[book]
        size = index["chunk"]
        first_chunk, slot = divmod(len(index["words"]), size)
        entries = list(chunk(root, first_chunk)[:slot]) if slot else []
        entries.extend(entry for _, entry in records)
        for offset in range(0, len(entries), size):
            write(root / "entries" / f"{first_chunk + offset // size}.json", entries[offset:offset + size])
        index["words"].extend(row for row, _ in records)
        index["count"] = len(index["words"])
        index["examples"] += sum(len(entry["ex"]) for _, entry in records)
        index["illustrated"] = sum(bool(row[6] & 1) for row in index["words"])
        index["voiced"] = sum(bool(row[6] & 6) for row in index["words"])
        index["version"] = index.get("version", 1) + 1
        write(root / "index.json", index)
        print(f"{book}: added {len(records)}, {index['count']} total")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("word_atlas", type=Path)
    parser.add_argument("scenes", type=Path, help="Directory containing img/ and thumb/ WebP files")
    args = parser.parse_args()
    import_words(args.word_atlas.resolve() / "public" / "atlas", args.scenes.resolve())
