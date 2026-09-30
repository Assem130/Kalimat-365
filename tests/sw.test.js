const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadFetchHandler({ cached, network } = {}) {
    const handlers = {};
    const cacheContents = new Map();
    if (cached !== undefined) cacheContents.set("cached", cached);
    const puts = [];
    const cache = {
        match: async (request) => (cacheContents.get("cached") && request) ? cacheContents.get("cached") : undefined,
        put: async (request, response) => { puts.push({ request, response }); cacheContents.set("cached", response); }
    };
    const sandbox = {
        URL,
        Request: function (url) { this.url = url; },
        self: {
            location: { origin: "https://example.test", href: "https://example.test/sw.js" },
            addEventListener(type, handler) { handlers[type] = handler; },
            skipWaiting: async () => {},
            clients: { claim: async () => {} }
        },
        caches: {
            open: async () => cache,
            match: async () => cacheContents.get("cached"),
            keys: async () => [],
            delete: async () => true
        },
        fetch: async () => network
    };
    vm.runInNewContext(fs.readFileSync("sw.js", "utf8"), sandbox);
    return { handleFetch: handlers.fetch, puts };
}

function loadServiceWorker({ cacheKeys = [], scriptUrl = "https://example.test/sw.js", offline = false } = {}) {
    const handlers = {};
    const deleted = [];
    let precached = [];
    let skipWaitingCalls = 0;
    const contents = new Map();
    const cacheKey = request => new URL(typeof request === "string" ? request : request.url, scriptUrl).href;
    const cache = {
        addAll: async (assets) => {
            precached = assets;
            for (const asset of assets) contents.set(cacheKey(asset), { body: cacheKey(asset) });
        },
        match: async request => contents.get(cacheKey(request)),
        put: async (request, response) => { contents.set(cacheKey(request), response); }
    };
    const sandbox = {
        URL,
        Request: function (url) { this.url = url; },
        self: {
            location: { origin: new URL(scriptUrl).origin, href: scriptUrl },
            addEventListener(type, handler) { handlers[type] = handler; },
            skipWaiting: async () => { skipWaitingCalls += 1; },
            clients: { claim: async () => {} }
        },
        caches: {
            open: async () => cache,
            match: cache.match,
            keys: async () => cacheKeys,
            delete: async (key) => { deleted.push(key); return true; }
        },
        fetch: async request => {
            if (offline) throw new Error("offline");
            return { body: request.url, ok: true, clone() { return this; } };
        }
    };
    vm.runInNewContext(fs.readFileSync("sw.js", "utf8"), sandbox);
    return { handlers, deleted, getPrecached: () => precached, getSkipWaitingCalls: () => skipWaitingCalls, contents };
}

test("same-origin app assets serve from cache and revalidate in the background", async () => {
    const stale = { body: "stale" };
    const fresh = { body: "fresh", ok: true, type: "basic", clone() { return this; } };
    const { handleFetch, puts } = loadFetchHandler({ cached: stale, network: fresh });
    let response;
    handleFetch({
        request: {
            method: "GET",
            mode: "cors",
            url: "https://example.test/app.js",
            headers: { get: () => "application/javascript" }
        },
        respondWith(value) { response = value; }
    });

    assert.equal(await response, stale, "stale-while-revalidate must serve the cached copy immediately");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(puts.length, 1, "background revalidation must refresh the cache");
    assert.equal(puts[0].response, fresh);
});

test("same-origin app assets fall back to network when uncached", async () => {
    const fresh = { body: "fresh", ok: true, type: "basic", clone() { return this; } };
    const { handleFetch } = loadFetchHandler({ network: fresh });
    let response;
    handleFetch({
        request: {
            method: "GET",
            mode: "cors",
            url: "https://example.test/app.js",
            headers: { get: () => "application/javascript" }
        },
        respondWith(value) { response = value; }
    });

    assert.equal(await response, fresh);
});

test("the offline shell pre-caches every same-origin page script", () => {
    const swSource = fs.readFileSync("sw.js", "utf8");
    const assetsBody = swSource.match(/const STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/)?.[1] || "";
    const staticAssets = [...assetsBody.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
    const scriptSources = ["index.html", "word.html"].flatMap((page) => {
        const html = fs.readFileSync(page, "utf8");
        return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
            .map((match) => match[1])
            .filter((src) => !/^(?:[a-z]+:)?\/\//i.test(src))
            .map((src) => `./${src.replace(/^\.\//, "")}`);
    });

    for (const source of new Set(scriptSources)) {
        assert.ok(staticAssets.includes(source), `${source} must be in STATIC_ASSETS`);
    }
    assert.ok(staticAssets.includes("./privacy.html"), "privacy.html must be in STATIC_ASSETS");
});

test("install invokes the complete offline precache and activates the worker", async () => {
    const worker = loadServiceWorker();
    let install;
    worker.handlers.install({ waitUntil(promise) { install = promise; } });
    await install;

    const swSource = fs.readFileSync("sw.js", "utf8");
    const expectedAssets = [...(swSource.match(/const STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/)?.[1] || "").matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
    assert.deepEqual(Array.from(worker.getPrecached()), expectedAssets, "install must pass the full STATIC_ASSETS list to cache.addAll");
    assert.equal(worker.getSkipWaitingCalls(), 1, "install must activate the new worker immediately");
});

test("activation removes only obsolete Kalimat caches", async () => {
    const swSource = fs.readFileSync("sw.js", "utf8");
    const activeCache = swSource.match(/const STATIC_CACHE_NAME\s*=\s*["']([^"']+)["']/)?.[1];
    assert.ok(activeCache, "service worker must declare an active static cache");
    const worker = loadServiceWorker({
        cacheKeys: [activeCache, "kalimat-static-old", "kalimat-audio-v1", "other-app-v1"]
    });
    let activation;
    worker.handlers.activate({ waitUntil(promise) { activation = promise; } });
    await activation;

    assert.deepEqual(worker.deleted, ["kalimat-static-old", "kalimat-audio-v1"]);
});

test("successful installation includes every CSS font for a first offline visit", async () => {
    const worker = loadServiceWorker();
    let installation;
    worker.handlers.install({ waitUntil(promise) { installation = promise; } });
    await installation;
    const css = fs.readFileSync("style.css", "utf8");
    const fonts = [...css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)].map(match => match[1]);
    assert.ok(fonts.length > 0, "website must declare its fonts");
    for (const font of fonts) {
        assert.ok(fs.existsSync(font), `${font} must exist locally`);
        assert.ok(worker.getPrecached().includes(`./${font}`), `${font} must be available without a prior online font request`);
    }
    for (const asset of worker.getPrecached()) {
        const url = new URL(asset, "https://example.test/Kalimat-365/sw.js");
        assert.equal(url.origin, "https://example.test", "precache must contain only same-origin resources");
        assert.ok(url.pathname.startsWith("/Kalimat-365/"), "precache must respect the deployment subpath");
    }
});

function requestFromWorker(worker, path, mode = "navigate") {
    let response;
    worker.handlers.fetch({
        request: { method: "GET", mode, url: path, headers: { get: () => mode === "navigate" ? "text/html" : "font/woff2" } },
        respondWith(promise) { response = promise; }
    });
    return response;
}

test("installed subpath shell serves deep links and every CSS font offline", async () => {
    const base = "https://example.test/Kalimat-365/";
    const worker = loadServiceWorker({ scriptUrl: `${base}sw.js`, offline: true });
    let installation;
    worker.handlers.install({ waitUntil(promise) { installation = promise; } });
    await installation;
    for (const page of ["index.html", "word.html", "privacy.html"]) {
        const response = await requestFromWorker(worker, `${base}${page}?id=23&date=2026-09-30`);
        assert.equal(response.body, `${base}${page}`, "deep links must use the matching page's queryless cached shell");
    }
    const fonts = [...fs.readFileSync("style.css", "utf8").matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)];
    for (const [, font] of fonts) {
        const response = await requestFromWorker(worker, `${base}${font}`, "cors");
        assert.equal(response.body, `${base}${font}`, "a first offline request must find the installed font");
    }
});

test("subpath navigation refreshes one canonical cache entry across deep links", async () => {
    const base = "https://example.test/Kalimat-365/";
    const worker = loadServiceWorker({ scriptUrl: `${base}sw.js` });
    await requestFromWorker(worker, `${base}word.html?id=23`);
    await requestFromWorker(worker, `${base}word.html?id=24`);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...worker.contents.keys()], [`${base}word.html`], "online deep links must refresh the canonical subpath shell, without query entries");
    assert.equal(worker.contents.get(`${base}word.html`).body, `${base}word.html?id=24`);
});

test("external resources are not intercepted or stored by the local-only worker", () => {
    const worker = loadServiceWorker();
    assert.equal(requestFromWorker(worker, "https://external.test/font.woff2", "cors"), undefined);
    assert.equal(requestFromWorker(worker, "https://external.test/page.html"), undefined);
    assert.equal(worker.contents.size, 0);
});
