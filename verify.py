"""Run repository verification with Python 3, Node 22, and Git."""
from pathlib import Path
import py_compile
import subprocess
import sys
import tempfile

ROOT = Path(__file__).absolute().parent


def run(*command):
    subprocess.run(command, cwd=ROOT, check=True)


def verify():
    run("node", "test.js")
    tests = sorted(str(path.relative_to(ROOT)) for folder in ("tests", "extension/tests") for path in (ROOT / folder).glob("*.test.js"))
    if not tests:
        raise RuntimeError("No test files found")
    run("node", "--test", *tests)
    tracked = subprocess.check_output(["git", "ls-files", "-z", "*.js"], cwd=ROOT).decode().split("\0")
    scripts = [file for file in tracked if file and not file.startswith("extension/dist/")]
    if not scripts:
        raise RuntimeError("No tracked JavaScript files found")
    for file in scripts:
        run("node", "--check", file)
    print(f"Checked syntax: {len(scripts)} JavaScript files", flush=True)
    with tempfile.TemporaryDirectory(prefix="kalimat-compile-") as temporary:
        for index, file in enumerate(("server.py", "verify.py", "extension/tools/package.py")):
            py_compile.compile(str(ROOT / file), cfile=str(Path(temporary) / f"{index}.pyc"), doraise=True)
    run("node", "extension/tools/convert-vocabulary.js", "--check")
    run(sys.executable, "extension/tools/package.py")
    run("git", "diff", "--check")


if __name__ == "__main__":
    try:
        verify()
    except (OSError, RuntimeError, subprocess.CalledProcessError, py_compile.PyCompileError) as error:
        print(f"Verification failed: {error}", file=sys.stderr)
        sys.exit(1)
