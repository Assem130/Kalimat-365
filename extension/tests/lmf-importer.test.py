"""Regression checks for source boundaries and attribution in the LMF importer."""
import hashlib
import importlib.util
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location("lmf_builder", TOOLS / "build-lmf-index.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

# Compact original source sense, including its XML quotation-framing defect.
INVEST = """<LexicalEntry id="استثمر">
<feat att="partOfSpeech" val="verb"/>
<Lemma><feat att="writtenForm" val="استثمر"/></Lemma>
<WordForm><feat att="wittenForm" val="استثمرَ"/></WordForm>
<Sense id="استثمرَD2">
<Definition><feat att="text" val="نمّاه، وظّفه في أعمال تُدِرّ عليه ربحًا وتحقق مزيدًا من الدخل"/></Definition>
<Context><feat att="text" val="استثمر المالَ ونحوه"/></Context>
<SenseExample><feat att="text" val="استثمر رأس ماله في التجارة&quot;."/></SenseExample>
</Sense></LexicalEntry>"""


def catalog(xml, frequencies=None, holds=None):
    document = ("<Lexicon>" + xml + "</Lexicon>").encode("utf-8")
    return builder.build_catalog(io.BytesIO(document), frequencies or {"استثمر": 3.2},
                                 hashlib.sha256(document).hexdigest(), holds or set())


class LmfImporterTests(unittest.TestCase):
    def test_original_sense_retains_real_ids_pos_and_raw_quote_framing(self):
        index, counts = catalog(INVEST)
        self.assertEqual(counts["entries"], 1)
        entry = index[0][2][0]
        self.assertEqual(entry["partOfSpeech"], "verb")
        self.assertEqual(entry["source"]["entryId"], "استثمر")
        self.assertEqual(entry["source"]["senseId"], "استثمرَD2")
        self.assertEqual(entry["source"]["contexts"], ["استثمر المالَ ونحوه"])
        self.assertEqual(entry["source"]["rawExamples"][0]["text"], 'استثمر رأس ماله في التجارة".')
        self.assertEqual(entry["senses"][0]["examples"], ["استثمر رأس ماله في التجارة."])
        self.assertNotIn("pageid", entry)
        self.assertNotIn("revisionId", entry)

    def test_noun_collocation_cannot_become_an_unqualified_word(self):
        xml = """<LexicalEntry id="تخزينية"><feat att="partOfSpeech" val="noun"/>
<Lemma><feat att="writtenForm" val="تخزينية"/></Lemma>
<Sense id="تخزينيَّةD2"><Definition><feat att="text" val="مقدار ما يمكن إيداعه أو حفظه في مساحة مُغلقة بغرض الاختزان"/></Definition>
<Context><feat att="text" val="السِّعة التَّخزينيَّة"/></Context>
<SenseExample><feat att="text" val="يحاول زيادة السعة التخزينية للجهاز بإضافة المزيد من بطاقات الذاكرة إليه&quot;."/></SenseExample>
</Sense></LexicalEntry>"""
        index, counts = catalog(xml, {"تخزينية": 2.8})
        self.assertEqual(index, [])
        self.assertEqual(counts["dependentNounContexts"], 1)

    def test_third_party_example_is_excluded_without_borrowing_another_sense(self):
        attributed = INVEST.replace("</SenseExample>", '<feat att="source" val="شعر"/></SenseExample>')
        self.assertEqual(catalog(attributed)[0], [])
        # A complete unqualified sentence in a neighboring sense is not evidence
        # for the first definition. Each source sense is processed separately.
        neighboring = attributed.replace("</LexicalEntry>", """<Sense id="استثمرَD3">
<Definition><feat att="text" val="استغلّه"/></Definition>
<SenseExample><feat att="text" val="تستثمر الدول المتقدِّمة وقتها أحسن استثمار&quot;."/></SenseExample>
</Sense></LexicalEntry>""")
        self.assertEqual(catalog(neighboring)[0], [])

    def test_rejected_quotes_do_not_leak_into_hidden_provenance(self):
        extra = '<SenseExample><feat att="text" val="استثمر رأس ماله في الصناعة&quot;."/><feat att="source" val="شعر"/></SenseExample>'
        index, _ = catalog(INVEST.replace("</Sense>", extra + "</Sense>"))
        entry = index[0][2][0]
        self.assertEqual(entry["senses"][0]["examples"], ["استثمر رأس ماله في التجارة."])
        self.assertEqual(len(entry["source"]["rawExamples"]), 1)
        self.assertNotIn("الصناعة", str(entry))

    def test_domain_label_is_not_silently_presented_as_general_arabic(self):
        labeled = INVEST.replace("</Definition>", '<feat att="domain" val="الاقتصاد"/></Definition>')
        index, counts = catalog(labeled)
        self.assertEqual(index, [])
        self.assertEqual(counts["specializedDomains"], 1)

    def test_named_organization_is_not_a_general_vocabulary_lesson(self):
        xml = """<LexicalEntry id="يونيسيف"><feat att="partOfSpeech" val="noun"/>
<Lemma><feat att="writtenForm" val="يونيسيف"/></Lemma>
<Sense id="يونيسيفD1"><Definition><feat att="text" val="اليونِسيف؛ صندوق الأمم المتّحدة الدوليّ لرعاية الطُّفولة"/></Definition>
<Context><feat att="text" val="اليونيسيف"/></Context>
<SenseExample><feat att="text" val="أقامت منظَّمة اليونِيسيف عِدَّة مشروعات خاصّة بالطُّفولة&quot;."/></SenseExample>
</Sense></LexicalEntry>"""
        index, counts = catalog(xml, {"يونيسيف": 3.0})
        self.assertEqual(index, [])
        self.assertEqual(counts["namedEntities"], 1)

    def test_missing_sentence_punctuation_is_not_invented(self):
        self.assertEqual(catalog(INVEST.replace('&quot;.', '&quot;'))[0], [])
        self.assertEqual(catalog(INVEST.replace('&quot;.', ''))[0], [])

    def test_duplicate_source_ids_do_not_merge_different_content(self):
        identical, counts = catalog(INVEST + INVEST)
        self.assertEqual(len(identical[0][2]), 1)
        self.assertEqual(counts["duplicateContent"], 1)
        different = INVEST.replace("في التجارة", "في الصناعة")
        index, _ = catalog(INVEST + different)
        entries = index[0][2]
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0]["source"]["senseId"], entries[1]["source"]["senseId"])
        self.assertNotEqual(entries[0]["source"]["recordId"], entries[1]["source"]["recordId"])
        self.assertEqual(index, catalog(INVEST + different)[0])

    def test_exact_source_hold_rejects_the_faulty_sense(self):
        self.assertEqual(catalog(INVEST, holds={("استثمر", "استثمرَD2")})[0], [])
        self.assertEqual(len(catalog(INVEST, holds={("استثمر", "استثمرَD3")})[0]), 1)

    def test_invalid_cli_source_cannot_replace_existing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.xml"
            output = Path(directory) / "index.json"
            source.write_text("<Lexicon/>", encoding="utf-8")
            output.write_text("preserve this output", encoding="utf-8")
            result = subprocess.run([sys.executable, str(TOOLS / "build-lmf-index.py"),
                                     "--input", str(source), "--frequency", str(source),
                                     "--output", str(output)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("pinned source", result.stderr)
            self.assertEqual(output.read_text(encoding="utf-8"), "preserve this output")

    def test_same_size_tampered_source_fails_hash_before_output_write(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.xml"
            output = Path(directory) / "index.json"
            with source.open("wb") as stream:
                stream.truncate(builder.SOURCE_BYTES)
            output.write_text("preserve this output", encoding="utf-8")
            result = subprocess.run([sys.executable, str(TOOLS / "build-lmf-index.py"),
                                     "--input", str(source), "--frequency", str(source),
                                     "--output", str(output)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("SHA-256", result.stderr)
            self.assertEqual(output.read_text(encoding="utf-8"), "preserve this output")


if __name__ == "__main__":
    unittest.main()
