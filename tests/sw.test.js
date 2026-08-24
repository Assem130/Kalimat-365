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
            location: { origin: "https://example.test" },
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

function loadServiceWorker({ cacheKeys = [] } = {}) {
    const handlers = {};
    const deleted = [];
    let precached = [];
    let skipWaitingCalls = 0;
    const cache = {
        addAll: async (assets) => { precached = assets; },
        match: async () => undefined,
        put: async () => {}
    };
    const sandbox = {
        URL,
        self: {
            location: { origin: "https://example.test" },
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
        fetch: async () => ({ ok: true, clone() { return this; } })
    };
    vm.runInNewContext(fs.readFileSync("sw.js", "utf8"), sandbox);
    return { handlers, deleted, getPrecached: () => precached, getSkipWaitingCalls: () => skipWaitingCalls };
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

test("the worker has no special audio or cross-origin caching", () => {
    const source = fs.readFileSync("sw.js", "utf8");
    assert.doesNotMatch(source, /AUDIO_CACHE|isAudioRequest|trimAudioCache/);

    const { handleFetch } = loadFetchHandler({ network: { ok: true } });
    let intercepted = false;
    handleFetch({
        request: {
            method: "GET",
            mode: "cors",
            url: "https://fonts.example.test/font.woff2",
            headers: { get: () => "font/woff2" }
        },
        respondWith() { intercepted = true; }
    });
    assert.equal(intercepted, false, "cross-origin requests must stay browser-managed");

    intercepted = false;
    handleFetch({
        request: {
            method: "GET",
            mode: "cors",
            destination: "audio",
            url: "https://example.test/assets/audio/word.mp3",
            headers: { get: () => "audio/mpeg" }
        },
        respondWith() { intercepted = true; }
    });
    assert.equal(intercepted, false, "audio requests must stay browser-managed");
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
    for (const font of ["Amiri-Regular", "Amiri-Bold", "Outfit-Regular", "Outfit-Medium", "Outfit-SemiBold"]) {
        assert.ok(staticAssets.includes(`./assets/fonts/${font}.woff2`), `${font} must work offline`);
    }
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
