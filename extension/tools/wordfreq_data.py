"""Read the pinned wordfreq Arabic data during catalog generation. No dependencies."""
import gzip
import hashlib
from pathlib import Path

SOURCE_COMMIT = "42233e6c36ce792031bcccfa17cdd0cec9af5fa7"
SOURCE_SHA256 = "aa12410764f1946f21d986a920c289c22accb069d9b287d71b61657005516eec"
SOURCE_BYTES = 3063585
MAX_UNCOMPRESSED_BYTES = 9000000


class _MessagePackReader:
    """Decode only the arrays, maps, strings, and integers used by cBpack v1."""

    def __init__(self, data):
        self.data = data
        self.offset = 0

    def take(self, count):
        end = self.offset + count
        if end > len(self.data):
            raise ValueError("Truncated wordfreq MessagePack data.")
        result = self.data[self.offset:end]
        self.offset = end
        return result

    def integer(self, count):
        return int.from_bytes(self.take(count), "big")

    def array(self, count, depth):
        if count > len(self.data) - self.offset:
            raise ValueError("Invalid wordfreq array length.")
        return [self.read(depth + 1) for _ in range(count)]

    def mapping(self, count, depth):
        result = {}
        for _ in range(count):
            key = self.read(depth + 1)
            if not isinstance(key, str) or key in result:
                raise ValueError("Invalid wordfreq header key.")
            result[key] = self.read(depth + 1)
        return result

    def read(self, depth=0):
        if depth > 3:
            raise ValueError("Invalid wordfreq MessagePack nesting.")
        tag = self.integer(1)
        if tag < 0x80:
            return tag
        if 0x80 <= tag <= 0x8f:
            return self.mapping(tag & 15, depth)
        if 0x90 <= tag <= 0x9f:
            return self.array(tag & 15, depth)
        if 0xa0 <= tag <= 0xbf:
            return self.take(tag & 31).decode("utf-8")
        if tag in (0xd9, 0xda, 0xdb):
            count = self.integer({0xd9: 1, 0xda: 2, 0xdb: 4}[tag])
            return self.take(count).decode("utf-8")
        if tag in (0xdc, 0xdd):
            return self.array(self.integer(2 if tag == 0xdc else 4), depth)
        raise ValueError(f"Unsupported wordfreq MessagePack type: {tag:#x}.")


def load_arabic_frequencies(source):
    """Validate and decode the official v3.2 large_ar.msgpack.gz snapshot."""
    source = Path(source)
    if source.stat().st_size != SOURCE_BYTES:
        raise ValueError("The wordfreq file size does not match the pinned Arabic snapshot.")
    with source.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != SOURCE_SHA256:
            raise ValueError("The wordfreq SHA-256 does not match the pinned Arabic snapshot.")
        stream.seek(0)
        with gzip.GzipFile(fileobj=stream) as compressed:
            data = compressed.read(MAX_UNCOMPRESSED_BYTES + 1)
    if len(data) > MAX_UNCOMPRESSED_BYTES:
        raise ValueError("The decompressed wordfreq file exceeds the size limit.")
    reader = _MessagePackReader(data)
    bins = reader.read()
    if reader.offset != len(data):
        raise ValueError("Unexpected bytes after wordfreq MessagePack data.")
    if not isinstance(bins, list) or not bins or bins[0] != {"format": "cB", "version": 1}:
        raise ValueError("Unexpected wordfreq cBpack header.")
    if len(bins) != 801:
        raise ValueError("Unexpected wordfreq Arabic frequency bin count.")
    frequencies = {}
    for index, words in enumerate(bins[1:]):
        if not isinstance(words, list) or any(not isinstance(word, str) for word in words):
            raise ValueError("Invalid wordfreq frequency bin.")
        for word in words:
            if word in frequencies:
                raise ValueError("Duplicate token in wordfreq data.")
            frequencies[word] = round(9 - index / 100, 2)
    return frequencies


def measured_frequency(key, frequencies):
    """Use measured surface forms only. This is not a proficiency estimate."""
    if not key or any(character.isspace() for character in key):
        return None
    forms = [key, "ال" + key]
    measured = [(frequencies[form], form) for form in forms if form in frequencies]
    if not measured:
        return None
    # Keep the exact key when scores tie. Do not merge hamza or ya variants.
    zipf, form = max(measured, key=lambda item: item[0])
    return {"zipf": zipf, "form": form}
