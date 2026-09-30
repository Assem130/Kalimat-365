"""Build local Chrome and Firefox packages using only Python 3's standard library."""
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import zipfile

EXTENSION_ROOT = Path(__file__).absolute().parent.parent
SOURCE_ALLOWLIST = (
    'assets/fonts/Amiri-Bold.woff2',
    'assets/fonts/Amiri-Regular.woff2',
    'assets/fonts/OFL.txt',
    'assets/fonts/Outfit-Regular.woff2',
    'atlas/atlas.css',
    'atlas/atlas.html',
    'atlas/atlas.js',
    'background.js',
    'data/vocabulary.json',
    'data/vocabulary-metadata.json',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-48.png',
    'icons/icon-128.png',
    'manifest.chrome.json',
    'manifest.firefox.json',
    'popup/popup.css',
    'popup/popup.html',
    'popup/popup.js',
    'PRIVACY.md',
    'shared/date.js',
    'shared/export.js',
    'shared/lookup.js',
    'shared/review-policy.js',
    'shared/review-session.js',
    'shared/speech.js',
    'shared/selector.js',
    'shared/state.js',
    'shared/streak.js',
    'shared/theme.css',
    'shared/theme-init.js',
    'shared/theme.js',
    'shared/vocabulary.js',
    'tests/background.test.js',
    'tests/export.test.js',
    'tests/package.test.js',
    'tests/review_sync.test.js',
    'tests/selector.test.js',
    'tests/speech.test.js',
    'tests/state.test.js',
    'tests/streak.test.js',
    'tests/theme.test.js',
    'tests/ui.test.js',
    'tests/vocabulary.test.js',
    'tools/convert-vocabulary.js',
    'tools/package.py',
)
RUNTIME_FILES = (
    'assets/fonts/Amiri-Bold.woff2',
    'assets/fonts/Amiri-Regular.woff2',
    'assets/fonts/OFL.txt',
    'assets/fonts/Outfit-Regular.woff2',
    'atlas/atlas.css',
    'atlas/atlas.html',
    'atlas/atlas.js',
    'background.js',
    'data/vocabulary.json',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-48.png',
    'icons/icon-128.png',
    'popup/popup.css',
    'popup/popup.html',
    'popup/popup.js',
    'shared/date.js',
    'shared/export.js',
    'shared/lookup.js',
    'shared/review-policy.js',
    'shared/review-session.js',
    'shared/speech.js',
    'shared/selector.js',
    'shared/state.js',
    'shared/streak.js',
    'shared/theme.css',
    'shared/theme-init.js',
    'shared/theme.js',
    'shared/vocabulary.js',
)


def reject_link(path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400):
        raise ValueError(f"Refusing unsafe symlink or reparse point: {path}")
    return info


def fail_scan(error):
    raise error


def scan_files(root, skip_dist=False):
    reject_link(root)
    files = set()
    for directory, dirs, names in os.walk(root, followlinks=False, onerror=fail_scan):
        base = Path(directory)
        if skip_dist and base == root and "dist" in dirs:
            dirs.remove("dist")
        for name in dirs + names:
            item = base / name
            info = reject_link(item)
            if name in names:
                if not stat.S_ISREG(info.st_mode):
                    raise ValueError(f"Refusing non-file source or target: {item}")
                files.add(item.relative_to(root).as_posix())
    return files


def validate_output(dist):
    if not os.path.lexists(dist):
        return
    if not stat.S_ISDIR(reject_link(dist).st_mode):
        raise ValueError(f"Refusing unsafe dist target: {dist}")
    for browser in ("chrome", "firefox"):
        target = dist / browser
        if os.path.lexists(target):
            if not stat.S_ISDIR(reject_link(target).st_mode):
                raise ValueError(f"Refusing unvalidated package target: {target}")
            scan_files(target)
        archive = dist / f"kalimat-{browser}-0.3.0.zip"
        if os.path.lexists(archive) and not stat.S_ISREG(reject_link(archive).st_mode):
            raise ValueError(f"Refusing unvalidated package archive: {archive}")


def package():
    dist = EXTENSION_ROOT / "dist"
    validate_output(dist)
    sources = scan_files(EXTENSION_ROOT, skip_dist=True)
    unexpected = sources - set(SOURCE_ALLOWLIST)
    missing = set(SOURCE_ALLOWLIST) - sources
    if unexpected:
        raise ValueError(f"Unexpected extension source file(s): {', '.join(sorted(unexpected))}")
    if missing:
        raise ValueError(f"Missing extension source file(s): {', '.join(sorted(missing))}")
    payloads = {relative: (EXTENSION_ROOT / relative).read_bytes() for relative in RUNTIME_FILES}
    manifests = {}
    for browser in ("chrome", "firefox"):
        content = (EXTENSION_ROOT / f"manifest.{browser}.json").read_bytes()
        manifest = json.loads(content)
        if manifest.get("manifest_version") != 3 or manifest.get("version") != "0.3.0" or not manifest.get("content_security_policy", {}).get("extension_pages"):
            raise ValueError(f"Invalid {browser} manifest.")
        if browser == "firefox":
            gecko = manifest.get("browser_specific_settings", {}).get("gecko", {})
            if gecko.get("id") != "kalimat@assem130.github.io" or gecko.get("data_collection_permissions", {}).get("required") != ["none"]:
                raise ValueError("Invalid Firefox store disclosure.")
        manifests[browser] = content
    vocabulary_bytes = len(payloads["data/vocabulary.json"])
    popup_bytes = sum(len(content) for name, content in payloads.items() if name.startswith("popup/"))
    if vocabulary_bytes >= 2097152 or popup_bytes >= 102400:
        raise ValueError(f"Release budget exceeded: vocabulary {vocabulary_bytes} bytes; popup {popup_bytes} bytes")
    dist.mkdir(exist_ok=True)
    for browser in ("chrome", "firefox"):
        target = dist / browser
        if target.exists():
            shutil.rmtree(target)
        target.mkdir()
        contents = dict(payloads, **{"manifest.json": manifests[browser]})
        for relative, content in contents.items():
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        archive = dist / f"kalimat-{browser}-0.3.0.zip"
        if archive.exists():
            archive.unlink()
        with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
            for relative, content in contents.items():
                entry = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
                entry.create_system = 3
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                entry.compress_type = zipfile.ZIP_DEFLATED
                output.writestr(entry, content, compresslevel=9)
        print(f"Packaged {browser}: {len(contents)} files, {sum(map(len, contents.values()))} bytes (archive {archive.stat().st_size} bytes; vocabulary {vocabulary_bytes} bytes; popup {popup_bytes} bytes).")


if __name__ == "__main__":
    try:
        package()
    except (OSError, ValueError) as error:
        print(f"Packaging failed: {error}", file=sys.stderr)
        sys.exit(1)
