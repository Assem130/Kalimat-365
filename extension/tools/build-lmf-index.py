"""Build the LMF supplement from pinned local source files. No network or packages."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
from wordfreq_data import SOURCE_SHA256 as FREQUENCY_SHA256, load_arabic_frequencies, measured_frequency

SOURCE_SHA256 = "776b902ade101446ef1c6f9f37a62791942d6bd30d19b3df8989e997955da9eb"
SOURCE_BYTES = 54015676
HOLDS_PATH = Path(__file__).resolve().parents[1] / "data" / "lmf-source-holds.json"
MARKS = re.compile(r"[\u064b-\u065f\u0670\u0640]")
ARABIC_TITLE = re.compile(r"[\u0621-\u063a\u0641-\u064a\u0671]+(?: [\u0621-\u063a\u0641-\u064a\u0671]+){0,2}\Z")
# LMF examples also contain phrase glosses and slash-separated alternatives.
# They are not complete usage sentences. Do not turn them into sentences.
UNSAFE_EXAMPLE = re.compile(r'[/：:\[\]{}<>"\\|\r\n]')
NAMED_ENTITY = re.compile(r"اسم\s+علم|اسم شخص|اسم مدينة|عاصمة|مقر وزارة|(?:صندوق|منظمة|هيئة) الأمم المت[ّ]?حدة")


def normalized_key(value):
    return " ".join(MARKS.sub("", unicodedata.normalize("NFC", value)).split())


def lexical_key(value):
    key = normalized_key(value)
    return key[2:] if key.startswith("ال") else key


def feature_values(element, path, attribute):
    return [feature.get("val", "") for feature in element.findall(path) if feature.get("att") == attribute]


def first_feature(element, path, attribute):
    return next(iter(feature_values(element, path, attribute)), "")


def complete_source_example(raw):
    text = raw.strip()
    # The XML serializes closing quotation framing as &quot;. after the text.
    # Remove that framing only. Keep the full stop already in the source.
    if text.endswith('".'):
        text = text[:-2] + "."
    if UNSAFE_EXAMPLE.search(text):
        return None
    return text


def load_holds(path=HOLDS_PATH):
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("sha256") != SOURCE_SHA256:
        raise ValueError("LMF source holds do not identify the pinned source.")
    return {(hold["entryId"], hold["senseId"]) for hold in data["holds"]}


def source_records(source):
    events = ET.iterparse(source, events=("start", "end"))
    _, root = next(events)
    if root.tag != "Lexicon":
        raise ValueError("Expected the LMF Lexicon root.")
    for event, element in events:
        if event == "end" and element.tag == "LexicalEntry":
            yield element
            root.clear()


NODE_FILTER = r"""
const fs = require('node:fs');
const d = require(process.argv[1]);
const records = JSON.parse(fs.readFileSync(0, 'utf8'));
const accepted = [];
for (const record of records) {
  // Use the existing definition rules. This temporary wrapper is not provenance.
  const text = '== عربية ==\n=== المعاني ===\n# ' + record.definitions[0];
  const parsed = d.parseEntry({title: record.title, text});
  if (!parsed || parsed.definitions.length !== 1) continue;
  const definition = parsed.definitions[0];
  // LMF text is already plain text. Rendering must not alter its wording.
  if (definition !== record.definitions[0]) continue;
  const entry = {...record, definitions: [definition], senses: [{definition, examples: []}]};
  if (!d.isUsefulEntry(entry)) continue;
  for (const example of record.senses[0].examples) {
    const selected = d.rankDictionaryExample({...entry, senses: [{definition, examples: [example]}]},
      {key: d.normalizeKey(record.title), passages: []});
    if (selected) entry.senses[0].examples.push(example);
  }
  if (entry.senses[0].examples.length) {
    // Preserve exact framing only for examples that are actually redistributed.
    // Rejected third-party quotations must not leak into bundled provenance.
    entry.source = {...record.source, rawExamples: record.source.rawExamples.filter(raw => {
      const rendered = raw.text.trim().replace(/"\.$/, '.');
      return !raw.sources.some(Boolean) && entry.senses[0].examples.includes(rendered);
    })};
    accepted.push(entry);
  }
}
process.stdout.write(JSON.stringify(accepted));
"""


def build_catalog(source, frequencies, source_sha256, holds):
    counts = Counter()
    candidates = {}
    for element in source_records(source):
        counts["inputEntries"] += 1
        lemma = first_feature(element, "Lemma/feat", "writtenForm")
        word_form = first_feature(element, "WordForm/feat", "wittenForm")
        title = word_form or lemma
        key = normalized_key(title)
        if not 3 <= len(key) <= 40 or not ARABIC_TITLE.fullmatch(key):
            continue
        pos = first_feature(element, "feat", "partOfSpeech")
        if pos not in {"noun", "verb", "adjective"}:
            continue
        frequency = measured_frequency(key, frequencies)
        if frequency is None or not 1.5 <= frequency["zipf"] <= 3.5:
            continue
        counts["frequencyEntries"] += 1
        for sense in element.findall("Sense"):
            counts["frequencySenses"] += 1
            entry_id, sense_id = element.get("id", ""), sense.get("id", "")
            if not entry_id or not sense_id:
                counts["missingSourceIds"] += 1
                continue
            if (entry_id, sense_id) in holds:
                counts["sourceQAHolds"] += 1
                continue
            definition = first_feature(sense, "Definition/feat", "text").strip()
            contexts = feature_values(sense, "Context/feat", "text")
            domains = feature_values(sense, "Definition/feat", "domain")
            # The current lesson model labels entries as general Arabic. Keep
            # domain-labeled meanings out until that model can retain the label.
            if any(domains):
                counts["specializedDomains"] += 1
                continue
            if pos == "noun" and any(lexical_key(context) != lexical_key(title) for context in contexts):
                counts["dependentNounContexts"] += 1
                continue
            if NAMED_ENTITY.search(normalized_key(definition)):
                counts["namedEntities"] += 1
                continue
            if not definition or re.search(r"[\r\n]", definition):
                continue
            raw_examples = []
            examples = []
            for example in sense.findall("SenseExample"):
                raw = first_feature(example, "feat", "text")
                attribution = feature_values(example, "feat", "source")
                raw_examples.append({"text": raw, "sources": attribution})
                if any(attribution):
                    counts["thirdPartyExamples"] += 1
                    continue
                rendered = complete_source_example(raw)
                if rendered and rendered not in examples:
                    examples.append(rendered)
            if not examples:
                continue
            canonical = {"lemma": lemma, "wordForm": word_form, "partOfSpeech": pos,
                         "definition": definition, "contexts": contexts,
                         "domains": domains, "rawExamples": raw_examples}
            digest = hashlib.sha256(json.dumps(canonical, ensure_ascii=False, sort_keys=True,
                                               separators=(",", ":")).encode("utf-8")).hexdigest()[:32]
            if digest in candidates:
                counts["duplicateContent"] += 1
                continue
            provenance = {"kind": "lmf", "sha256": source_sha256, "entryId": entry_id,
                          "senseId": sense_id, "recordId": digest, **canonical}
            candidates[digest] = {"title": title, "definitions": [definition],
                                  "senses": [{"definition": definition, "examples": examples}],
                                  "partOfSpeech": pos, "senseCount": 1,
                                  "frequency": frequency, "source": provenance}
    counts["candidateSenses"] = len(candidates)
    parser_path = Path(__file__).resolve().parents[1] / "shared" / "discovery.js"
    result = subprocess.run(["node", "-e", NODE_FILTER, str(parser_path)],
                            input=json.dumps(list(candidates.values()), ensure_ascii=False),
                            text=True, capture_output=True, check=True, encoding="utf-8")
    groups = {}
    for entry in json.loads(result.stdout):
        groups.setdefault(normalized_key(entry["title"]), []).append(entry)
    index = []
    for key in sorted(groups):
        entries = sorted(groups[key], key=lambda entry: (entry["title"], entry["source"]["recordId"]))
        index.append([key, sorted({entry["title"] for entry in entries}), entries])
    counts["keys"] = len(index)
    counts["entries"] = sum(len(row[2]) for row in index)
    return index, dict(counts)


def build(source, frequency_source, output):
    if source.stat().st_size != SOURCE_BYTES:
        raise ValueError("The LMF file size does not match the pinned source.")
    with source.open("rb") as stream:
        source_hash = hashlib.file_digest(stream, "sha256").hexdigest()
    if source_hash != SOURCE_SHA256:
        raise ValueError("The LMF SHA-256 does not match the pinned source.")
    frequencies = load_arabic_frequencies(frequency_source)
    index, counts = build_catalog(source, frequencies, source_hash, load_holds())
    data = json.dumps(index, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    output.write_bytes(data)
    print(json.dumps({**counts, "bytes": len(data), "inputSha256": source_hash,
                      "frequencySha256": FREQUENCY_SHA256,
                      "outputSha256": hashlib.sha256(data).hexdigest()}, sort_keys=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Pinned local LMF-Cont.xml")
    parser.add_argument("--frequency", required=True, type=Path, help="Pinned local wordfreq Arabic file")
    parser.add_argument("--output", required=True, type=Path, help="Destination compact UTF-8 JSON")
    args = parser.parse_args()
    if args.output.resolve() in {args.input.resolve(), args.frequency.resolve(), HOLDS_PATH.resolve()}:
        parser.error("Output must differ from source, frequency and source-hold files.")
    build(args.input, args.frequency, args.output)
