"""Headless native Firefox smoke check. Python standard library only."""
import argparse, base64, hashlib, json, os, shutil, socket, subprocess, tempfile, time
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("package", nargs="?", default="extension/dist/firefox")
parser.add_argument("--output", default=os.environ.get("KALIMAT_FIREFOX_OUTPUT"))
parser.add_argument("--firefox", default=os.environ.get("KALIMAT_FIREFOX", "/usr/bin/firefox"))
options = parser.parse_args()
package = Path(options.package).resolve()
if not (package / "manifest.json").is_file(): parser.error("Build the Firefox package first.")
out = Path(options.output).resolve() if options.output else Path(tempfile.mkdtemp(prefix="kalimat-firefox-evidence-"))
out.mkdir(parents=True, exist_ok=True)
print("Evidence:", out, flush=True)
package_hash = hashlib.sha256()
for source in sorted(package.rglob("*")):
    if source.is_file():
        package_hash.update(str(source.relative_to(package)).encode())
        package_hash.update(source.read_bytes())
report = {"packageSha256": package_hash.hexdigest(), "package": str(package), "method": "native Firefox headless, Marionette protocol 3, temporary addon", "checks": []}
with socket.socket() as port_probe:
    port_probe.bind(("127.0.0.1", 0))
    port = port_probe.getsockname()[1]
profile = tempfile.mkdtemp(prefix="kalimat-firefox-")
Path(profile, "user.js").write_text(f'user_pref("marionette.port", {port});\nuser_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.startup.homepage", "about:blank");\nuser_pref("datareporting.policy.dataSubmissionEnabled", false);\n')
log = open(out / "firefox.log", "w")
process = None
connection = None
sequence = 0

def receive():
    prefix = b""
    while not prefix.endswith(b":"):
        piece = connection.recv(1)
        if not piece: raise RuntimeError("Marionette disconnected")
        prefix += piece
    size, raw = int(prefix[:-1]), b""
    while len(raw) < size:
        piece = connection.recv(size-len(raw))
        if not piece: raise RuntimeError("Marionette disconnected")
        raw += piece
    return json.loads(raw)

def command(name, arguments=None):
    global sequence
    sequence += 1
    raw = json.dumps([0, sequence, name, arguments or {}]).encode()
    connection.sendall(str(len(raw)).encode() + b":" + raw)
    response = receive()
    if response[2]: raise RuntimeError(response[2])
    return response[3]

def execute(script):
    return command("WebDriver:ExecuteScript", {"script": script, "args": [], "newSandbox": False, "sandbox": None})["value"]

def asynchronous(script, args=None):
    result = command("WebDriver:ExecuteAsyncScript", {"script": "const done=arguments[arguments.length-1]; (async()=>{" + script + "})().then(value=>done({value}),error=>done({error:String(error)}));", "args": args or [], "newSandbox": False, "sandbox": None})["value"]
    if "error" in result: raise RuntimeError(result["error"])
    return result.get("value")

def message(body):
    return asynchronous("return await browser.runtime.sendMessage(arguments[0]);", [body])

def check(name, condition):
    if not condition: raise AssertionError(name)
    report["checks"].append(name)
    print("PASS", name, flush=True)

def wait(expression):
    for _ in range(100):
        if execute("return Boolean(" + expression + ");"): return
        time.sleep(.05)
    raise AssertionError("Timed out: " + expression)

def screenshot(name):
    encoded = command("WebDriver:TakeScreenshot", {"id": None, "highlights": [], "full": False})["value"]
    (out / name).write_bytes(base64.b64decode(encoded))

try:
    process = subprocess.Popen([options.firefox, "--headless", "--no-remote", "--profile", profile, "--marionette", "--remote-allow-system-access", "about:blank"], stdout=log, stderr=log)
    for _ in range(150):
        try:
            connection = socket.create_connection(("127.0.0.1", port), timeout=1)
            break
        except OSError: time.sleep(.1)
    if connection is None: raise RuntimeError("Marionette unavailable")
    connection.settimeout(30)
    report["protocol"] = receive()
    report["capabilities"] = command("WebDriver:NewSession", {"capabilities": {}})["capabilities"]
    check("temporary packaged addon installs", command("Addon:Install", {"path": str(package), "temporary": True})["value"] == "kalimat@assem130.github.io")
    command("Marionette:SetContext", {"value": "chrome"})
    uuids = command("WebDriver:ExecuteScript", {"script": "return Services.prefs.getStringPref('extensions.webextensions.uuids');", "args": [], "newSandbox": True, "sandbox": "default"})["value"]
    origin = "moz-extension://" + json.loads(uuids)["kalimat@assem130.github.io"]
    command("Marionette:SetContext", {"value": "content"})
    command("WebDriver:Navigate", {"url": origin + "/popup/popup.html"})
    wait("!document.querySelector('#assigned').hidden && document.querySelector('#word').textContent")
    daily = message({"type": "assignment.get"})
    report["daily"] = {key: daily.get(key) for key in ["kind", "wordId", "dateKey", "pilot", "dismissed"]}
    check("native Firefox background returns current pilot", daily["kind"] == "assigned" and daily["pilot"] and daily["wordId"].startswith("pilot_"))
    check("popup renders actual daily word", execute("return document.querySelector('#word').textContent;") == daily["word"]["word"])
    screenshot("popup.png")
    execute("document.querySelector('#save').click();")
    wait("document.querySelector('#save').getAttribute('aria-pressed') === 'true'")
    check("popup save persists through real storage API", message({"type": "assignment.get"}).get("saved") is True)
    reader = execute("return document.querySelector('a[href*=\"newtab\"]').href;")
    command("WebDriver:Navigate", {"url": reader})
    wait("!document.querySelector('#encounter').hidden && document.querySelector('main').getAttribute('aria-busy') === 'false'")
    execute("document.querySelector('#dismiss').click();")
    wait("document.querySelector('#encounter').classList.contains('compact')")
    command("WebDriver:Refresh")
    wait("document.querySelector('#encounter').classList.contains('compact')")
    check("reader dismissal survives page reload", message({"type": "assignment.get"}).get("dismissed") is True)
    command("WebDriver:Navigate", {"url": origin + "/atlas/atlas.html?view=settings"})
    wait("document.querySelector('#settings-view') && !document.querySelector('#settings-view').hidden")
    check("Atlas renders without error or recovery screen", execute("return !document.querySelector('#settings-view').hidden;"))
    screenshot("atlas.png")
    command("WebDriver:Navigate", {"url": origin + "/atlas/atlas.html?view=history"})
    wait("!document.querySelector('#history-view').hidden")
    check("history deep link opens history", execute("return document.querySelector('#history').getAttribute('aria-pressed') === 'true';"))
    screenshot("history.png")
    command("WebDriver:Navigate", {"url": origin + "/atlas/atlas.html?view=explore&q=" + "%D9%85%D9%86%D9%88%D8%A7%D9%84"})
    wait("document.querySelector('#search-results button') && !document.querySelector('#explore-view').hidden")
    query = execute("return document.querySelector('#atlas-search').value;")
    execute("document.querySelector('#search-results button').click();")
    wait("!document.querySelector('#explore-card').hidden && document.activeElement === document.querySelector('#explore-card h3')")
    check("Explore result focuses its visible heading", execute("const h=document.activeElement,r=h.getBoundingClientRect(); return h.tagName==='H3' && r.height>0 && !h.closest('[hidden]');"))
    screenshot("explore-detail.png")
    execute("document.querySelector('#explore-back').click();")
    check("Explore Back preserves query and result focus", execute("return document.querySelector('#atlas-search').value;") == query and execute("return !document.querySelector('#explore-results-view').hidden && document.activeElement.parentElement.id === 'search-results';"))
    report["themes"] = {}
    for theme, preference, dark in [("paper",1,False),("paper",0,True),("emerald",0,True),("midnight",1,False)]:
        asynchronous("await browser.storage.local.set({'kalimat.theme':arguments[0]}); return true;", [theme])
        command("Marionette:SetContext", {"value":"chrome"})
        command("WebDriver:ExecuteScript", {"script":f"Services.prefs.setIntPref('layout.css.prefers-color-scheme.content-override', {preference});", "args":[], "newSandbox":True,"sandbox":"default"})
        command("Marionette:SetContext", {"value":"content"})
        palette = []
        key = theme + ("-dark" if dark else "-light")
        for surface, route, ready in [("popup","/popup/popup.html","!document.querySelector('#assigned').hidden"),("reader","/newtab/newtab.html","!document.querySelector('#encounter').hidden"),("atlas","/atlas/atlas.html?view=settings","!document.querySelector('#settings-view').hidden")]:
            command("WebDriver:Navigate", {"url":origin+route})
            wait(ready + " && document.documentElement.dataset.theme === '"+theme+"'")
            wait("matchMedia('(prefers-color-scheme: dark)').matches === " + str(dark).lower())
            colors = execute("return {theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor,token:getComputedStyle(document.documentElement).getPropertyValue('--daily-bg').trim(),ink:getComputedStyle(document.body).color};")
            palette.append(colors)
            screenshot(key+"-"+surface+".png")
        check(key + " palette is consistent across popup reader Atlas", len({item['bg'] for item in palette}) == 1 and len({item['token'] for item in palette}) == 1 and all(item['bg'] != item['ink'] for item in palette))
        report["themes"][key] = palette
    check("Paper responds to light and dark preference", report["themes"]["paper-light"][0]["bg"] != report["themes"]["paper-dark"][0]["bg"])
    exported = message({"type": "state.export"})
    backup = json.loads(exported["text"])
    check("extension backup contains saved pilot and dismissal", backup["favorites"][daily["wordId"]] and backup["pilot"]["dismissedDate"] == daily["dateKey"])
    check("clear confirms profile deletion", message({"type": "state.clear"}).get("profilePersisted") is True)
    cleared = json.loads(message({"type": "state.export"})["text"])
    check("clear removes favorites and pilot encounter state", not cleared["favorites"] and not cleared.get("pilot", {}).get("encounters"))
    check("backup import succeeds", message({"type": "state.import", "text": exported["text"]})["kind"] == "ok")
    restored = message({"type": "assignment.get"})
    check("backup import restores saved and dismissed state", restored.get("saved") and restored.get("dismissed"))
    command("WebDriver:Navigate", {"url": "about:blank"})
    command("Marionette:SetContext", {"value": "chrome"})
    reload_result = command("WebDriver:ExecuteAsyncScript", {"script": "const done=arguments[arguments.length-1]; const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs'); AddonManager.getAddonByID('kalimat@assem130.github.io').then(addon=>addon.reload()).then(()=>done(true), error=>done(String(error)));", "args": [], "newSandbox": True, "sandbox": "default"})
    command("Marionette:SetContext", {"value": "content"})
    command("WebDriver:Navigate", {"url": origin + "/popup/popup.html"})
    wait("!document.querySelector('#assigned').hidden")
    restored = message({"type": "assignment.get"})
    check("actual addon reload preserves word save and dismissal", reload_result["value"] is True and restored["wordId"] == daily["wordId"] and restored.get("saved") and restored.get("dismissed"))
    report["status"] = "passed"
except Exception as error:
    report["status"] = "failed"
    report["error"] = repr(error)
    raise
finally:
    if connection: connection.close()
    if process is not None:
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill(); process.wait()
    report["processExited"] = process is None or process.poll() is not None
    log.close()
    shutil.rmtree(profile, ignore_errors=True)
    report["profileRemoved"] = not Path(profile).exists()
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
