"""Inspect a deployed release and restore files omitted from an incremental upload."""

import argparse
import errno
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil


DELTA_MANIFEST = "lan-delta.json"
RELEASE_MARKER = "site/release.txt"


def digest(stream, copy=None):
    checksum = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        checksum.update(chunk)
        if copy is not None:
            copy.write(chunk)
    return checksum.hexdigest()


def file_digest(file):
    with file.open("rb") as stream:
        return digest(stream)


def current_manifest(root):
    marker = root / "current-release"
    if not marker.is_file():
        raise ValueError("No active release. Run a full deployment before using -Incremental.")
    release = marker.read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"[0-9]{14}-[0-9a-f]{8}", release):
        raise ValueError("Invalid current-release file")
    active = root / "releases" / release
    if not (active / "site/index.html").is_file():
        raise ValueError("The active release is missing its site")
    files = {}
    for file in (active / "site").rglob("*"):
        name = file.relative_to(active).as_posix()
        if file.is_file() and not file.is_symlink() and name != RELEASE_MARKER:
            files[name] = file_digest(file)
    return {"release": release, "files": files}


def restore_files(staged, active):
    delta = json.loads((staged / DELTA_MANIFEST).read_text(encoding="utf-8"))
    if delta["base"] != active.name:
        raise ValueError("The active release changed during upload. Run the incremental deployment again.")

    for name, expected in delta["reused"].items():
        path = PurePosixPath(name)
        if (len(path.parts) < 2 or path.parts[0] != "site" or path.as_posix() != name or
                ".." in path.parts or "\\" in name or name == RELEASE_MARKER):
            raise ValueError(f"Invalid reused path: {name}")
        source = active / name
        target = staged / name
        if source.resolve() != source or not source.is_file() or file_digest(source) != expected:
            raise ValueError(f"Base file changed: {name}. Run the incremental deployment again.")
        if target.resolve() != target:
            raise ValueError(f"Invalid destination for reused file: {name}")
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(source, target)
        except OSError as error:
            if error.errno != errno.EXDEV:
                raise
            with source.open("rb") as original, target.open("xb") as copy:
                shutil.copyfileobj(original, copy)
    print(f"Reused {len(delta['reused']):,} files from {active.name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("inventory").add_argument("root", type=Path)
    restore = commands.add_parser("restore")
    restore.add_argument("staged", type=Path)
    restore.add_argument("active", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "inventory":
            print(json.dumps(current_manifest(args.root), separators=(",", ":")))
        else:
            restore_files(args.staged, args.active)
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
