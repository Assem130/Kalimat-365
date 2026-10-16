"""Build a deterministic discovery catalog from a local XML .bz2 dump. No network."""
import argparse
import bz2
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unicodedata
import xml.etree.ElementTree as ET

import sys
sys.dont_write_bytecode = True

from wordfreq_data import SOURCE_SHA256, load_arabic_frequencies, measured_frequency

MARKS = re.compile(r"[\u064b-\u065f\u0670\u0640]")
ARABIC_TITLE = re.compile(r"[\u0621-\u063a\u0641-\u064a\u0671]+(?: [\u0621-\u063a\u0641-\u064a\u0671]+){0,2}\Z")


def normalized_key(title):
    return " ".join(MARKS.sub("", unicodedata.normalize("NFC", title)).split())


def build_titles(source):
    groups = {}
    rows = 0
    with gzip.open(source, "rt", encoding="utf-8") as titles:
        for line in titles:
            rows += 1
            title = line.rstrip("\r\n").replace("_", " ")
            key = normalized_key(title)
            if 3 <= len(key) <= 40 and ARABIC_TITLE.fullmatch(key):
                groups.setdefault(key, set()).add(title)
    return [[key, sorted(groups[key])] for key in sorted(groups)], rows


def xml_pages(source):
    """Stream pages without retaining the decompressed XML tree."""
    with bz2.open(source, "rb") as stream:
        events = ET.iterparse(stream, events=("start", "end"))
        _, root = next(events)
        namespace = root.tag.removesuffix("mediawiki")
        for event, element in events:
            if event != "end" or element.tag != namespace + "page":
                continue
            if element.findtext(namespace + "ns") == "0":
                revision = element.find(namespace + "revision")
                if revision is not None:
                    yield {
                        "title": element.findtext(namespace + "title", ""),
                        "pageid": int(element.findtext(namespace + "id", "0")),
                        "revision": int(revision.findtext(namespace + "id", "0")),
                        "text": revision.findtext(namespace + "text", ""),
                    }
            root.clear()


NODE_PARSE = r"""
const fs = require('node:fs');
const discovery = require(process.argv[1]);
const pages = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(pages.map(page => discovery.parseEntry(page)).filter(Boolean)));
"""


def build_catalog(source, frequencies):
    parser_path = Path(__file__).resolve().parents[1] / "shared" / "discovery.js"
    groups = {}
    rows = 0
    batch = []

    def parse_batch():
        result = subprocess.run(
            ["node", "-e", NODE_PARSE, str(parser_path)],
            input=json.dumps(batch, ensure_ascii=False), text=True,
            capture_output=True, check=True, encoding="utf-8",
        )
        for entry in json.loads(result.stdout):
            key = normalized_key(entry["title"])
            frequency = measured_frequency(key, frequencies)
            if frequency is not None:
                entry["frequency"] = frequency
            # The shared parser owns meaning and example quality rules.
            entry.setdefault("senses", [
                {"definition": definition, "examples": []}
                for definition in entry["definitions"]
            ])
            groups.setdefault(key, []).append(entry)
        batch.clear()

    for page in xml_pages(source):
        rows += 1
        key = normalized_key(page["title"])
        if 3 <= len(key) <= 40 and ARABIC_TITLE.fullmatch(key):
            batch.append(page)
        if len(batch) >= 512:
            parse_batch()
    if batch:
        parse_batch()
    index = []
    for key in sorted(groups):
        entries = sorted(groups[key], key=lambda entry: (entry["title"], entry["pageid"], entry["revisionId"]))
        index.append([key, sorted({entry["title"] for entry in entries}), entries])
    return index, rows


def build(source, output, frequency_source=None):
    if source.suffix == ".bz2":
        if frequency_source is None:
            raise ValueError("XML catalog generation requires --frequency.")
        frequencies = load_arabic_frequencies(frequency_source)
        index, rows = build_catalog(source, frequencies)
    elif source.suffix == ".gz":
        index, rows = build_titles(source)
    else:
        raise ValueError("Input must be an XML .bz2 dump or a legacy title .gz dump.")
    data = json.dumps(index, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    output.write_bytes(data)
    with source.open("rb") as stream:
        input_hash = hashlib.file_digest(stream, "sha256").hexdigest()
    print(json.dumps({"inputRows": rows, "keys": len(index), "titles": sum(len(row[1]) for row in index),
                      "entries": sum(len(row[2]) for row in index if len(row) > 2),
                      "bytes": len(data), "inputSha256": input_hash,
                      "frequencySha256": SOURCE_SHA256 if source.suffix == ".bz2" else None,
                      "measuredEntries": sum("frequency" in entry for row in index if len(row) > 2 for entry in row[2]),
                      "outputSha256": hashlib.sha256(data).hexdigest()}, sort_keys=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Local pages-articles XML .bz2 dump (or legacy all-titles .gz)")
    parser.add_argument("--output", required=True, type=Path, help="Destination compact UTF-8 JSON")
    parser.add_argument("--frequency", type=Path, help="Pinned local wordfreq v3.2 large_ar.msgpack.gz (required for XML)")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Input and output must differ.")
    if args.input.suffix == ".bz2" and args.frequency is None:
        parser.error("XML catalog generation requires --frequency.")
    if args.frequency is not None and args.frequency.resolve() == args.output.resolve():
        parser.error("Frequency input and output must differ.")
    build(args.input, args.output, args.frequency)
