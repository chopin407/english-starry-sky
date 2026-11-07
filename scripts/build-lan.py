"""Test, build, and package English Starry Sky for LAN deployment."""

import argparse
import io
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import tempfile

from lan_delta import DELTA_MANIFEST, digest, file_digest


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
STAGING = ROOT / "scripts/build"
REQUIRED = ("index.html", "version.json", "atlas/index.json", "lessons/7a/starter-unit-1-a-2a.mp3")


def regular_entry(entry):
    if not (entry.isfile() or entry.isdir()):
        raise ValueError(f"Expected a regular build file or directory: {entry.name}")
    return entry


def build_site(site):
    npm = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.run([npm, "test"], cwd=ROOT, check=True)
    subprocess.run(
        [npm, "run", "build", "--", "--outDir", str(site.relative_to(ROOT))],
        cwd=ROOT,
        env={**os.environ, "ATLAS_BASE": "./"},
        check=True,
    )
    for name in REQUIRED:
        file = site / name
        if not file.is_file() or not file.stat().st_size:
            raise ValueError(f"Missing or empty build file: {name}")
    if not json.loads((site / "version.json").read_text(encoding="utf-8")).get("v"):
        raise ValueError("Build version is missing")


def add_built_site(package, site, base, reused):
    def select(entry):
        regular_entry(entry)
        expected = base.get(entry.name)
        if entry.isfile() and expected is not None and file_digest(site.parent / entry.name) == expected:
            reused[entry.name] = expected
            return None
        return entry

    package.add(ROOT / "scripts/serve-lan.py", arcname="serve-lan.py", filter=regular_entry)
    package.add(site, arcname="site", filter=select)


def add_existing_archive(package, source, base, reused):
    seen = set()
    required = {"serve-lan.py", *(f"site/{name}" for name in REQUIRED)}
    with tarfile.open(source, "r|gz") as full:
        for entry in full:
            regular_entry(entry)
            name = entry.name
            path = PurePosixPath(name)
            if ((name != "serve-lan.py" and (not path.parts or path.parts[0] != "site")) or
                    path.as_posix() != name or ".." in path.parts or "\\" in name or name in seen):
                raise ValueError(f"Unexpected path in full release archive: {name}")
            seen.add(name)
            if entry.isdir():
                package.addfile(entry)
                continue
            if entry.size:
                required.discard(name)
            with full.extractfile(entry) as stream:
                expected = base.get(name)
                if expected is None:
                    package.addfile(entry, stream)
                    continue
                with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024) as copy:
                    if digest(stream, copy) == expected:
                        reused[name] = expected
                    else:
                        copy.seek(0)
                        package.addfile(entry, copy)
    if required:
        raise ValueError(f"Missing or empty files in full release archive: {', '.join(sorted(required))}")


def write_archive(output, *, base, site=None, source=None):
    files = base["files"] if base else {}
    reused = {}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".tmp", delete=False) as file:
        temp = Path(file.name)
    try:
        with tarfile.open(temp, "w:gz", compresslevel=1) as package:
            if source is None:
                add_built_site(package, site, files, reused)
            else:
                add_existing_archive(package, source, files, reused)
            if base:
                data = json.dumps({"base": base["release"], "reused": reused}).encode("utf-8")
                entry = tarfile.TarInfo(DELTA_MANIFEST)
                entry.size = len(data)
                package.addfile(entry, io.BytesIO(data))
        temp.replace(output)
    finally:
        temp.unlink(missing_ok=True)
    if base:
        print(f"Incremental upload will reuse {len(reused):,} files from {base['release']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, nargs="?", default=DIST / "english-starry-sky.tar.gz")
    parser.add_argument("--base-manifest", type=Path)
    parser.add_argument("--from-archive", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    base = json.loads(args.base_manifest.read_text(encoding="utf-8")) if args.base_manifest else None
    if args.from_archive:
        if base is None or output == args.from_archive.resolve():
            parser.error("--from-archive requires a base manifest and a different output path")
        write_archive(output, base=base, source=args.from_archive)
    else:
        STAGING.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=STAGING, prefix="lan-") as stage:
            site = Path(stage) / "site"
            build_site(site)
            write_archive(output, base=base, site=site)
    print(f"Built {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
