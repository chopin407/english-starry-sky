"""Fill missing illustration and recording assets in the FLTRP year-nine atlas."""

import argparse
import csv
from pathlib import Path
import shutil

from import_7a_extension import DEST, HERE, lookup, read, write


ROOT = DEST / "fltrp9a"
PREFIX = "fltrp9a-"
JOBS = HERE / "build" / "fltrp9a-audio-jobs.json"


def manifest(name):
    with (HERE / f"fltrp9a-supplement-{name}.txt").open(encoding="utf-8-sig", newline="") as file:
        return {slug: fields for slug, *fields in csv.reader(file, delimiter="|", quoting=csv.QUOTE_NONE)}


def file_at(root, folder, wid, ext):
    return root / folder / f"{wid}.{ext}"


def copy_asset(source, target):
    if not target.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def supplement(word_atlas, scenes, audio_only):
    index = read(ROOT / "index.json")
    files = sorted((ROOT / "entries").glob("*.json"), key=lambda p: int(p.stem))
    chunks = [read(file) for file in files]
    entries = [entry for chunk in chunks for entry in chunk]
    examples = manifest("examples")
    art = manifest("art")
    jobs = []
    changed = False
    for row, entry in zip(index["words"], entries, strict=True):
        wid, word = row[:2]
        slug = wid.removeprefix(PREFIX)
        assert wid == entry["id"] and row[6] == entry["m"], wid
        mask = entry["m"]
        flags = mask
        us = entry["us"]
        sentences = entry["ex"]
        if not sentences:
            en, zh = examples[slug]
            sentences = [{"en": en, "zh": zh, "src": "拓展"}]

        if not (mask & 4):
            target = file_at(ROOT, "audio/us", wid, "mp3")
            match = lookup(word_atlas, word.casefold())
            if match and match[0][6] & 4:
                copy_asset(file_at(word_atlas, "audio/us", match[0][0], "mp3"), target)
                us = match[1].get("us", "")
            if target.is_file() and target.stat().st_size:
                flags |= 4
            else:
                jobs.append([word.replace("...", ",").strip(" ,"), str(target)])

        for sentence, folder, bit in zip(sentences, ("audio/ex", "audio/ex2"), (8, 16)):
            if mask & bit:
                continue
            target = file_at(ROOT, folder, wid, "mp3")
            if target.is_file() and target.stat().st_size:
                flags |= bit
            else:
                jobs.append([sentence["en"], str(target)])

        if not audio_only and not (mask & 1):
            [spec] = art[slug]
            if "/" in spec:
                book, source_id = spec.split("/", 1)
                root = word_atlas if book == "wa" else DEST if book == "7a" else DEST / book
            else:
                root, source_id = scenes, spec
            for folder in ("img", "thumb"):
                copy_asset(file_at(root, folder, source_id, "webp"), file_at(ROOT, folder, wid, "webp"))
            flags |= 1

        if mask != flags or sentences != entry["ex"]:
            changed = True
            row[6] = flags
            entry.update(m=flags, us=us, ex=sentences)

    JOBS.parent.mkdir(parents=True, exist_ok=True)
    write(JOBS, jobs)
    if jobs:
        print(f"{len(jobs)} recordings required. Run build_core_vocabulary_audio.ps1 -JobsPath {JOBS}")
    if audio_only or jobs:
        return
    if changed:
        for file, chunk in zip(files, chunks, strict=True):
            write(file, chunk)
        index.update(
            version=index.get("version", 1) + 1,
            illustrated=sum(bool(row[6] & 1) for row in index["words"]),
            examples=sum(len(entry["ex"]) for entry in entries),
        )
        write(ROOT / "index.json", index)
    print(f"{len(entries)} entries, {index['illustrated']} illustrated, {index['examples']} examples")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("word_atlas", type=Path)
    cli.add_argument("scenes", type=Path)
    cli.add_argument("--audio-only", action="store_true", help="Prepare recordings before illustration files are ready")
    args = cli.parse_args()
    supplement(args.word_atlas.resolve() / "public" / "atlas", args.scenes.resolve(), args.audio_only)
