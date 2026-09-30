(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.KalimatTheme = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const VALID_THEMES = Object.freeze(["paper", "emerald", "midnight"]);
  const DEFAULT_THEME = "paper";
  const PRIMARY_STORAGE_KEY = "kalimat.theme";
  const LEGACY_STORAGE_KEY = "kalimat_theme";

  /**
   * Normalizes theme input against the valid theme whitelist.
   * Falls back to "paper" for invalid or corrupt inputs.
   *
   * @param {*} theme
   * @returns {"paper"|"emerald"|"midnight"}
   */
  function normalizeTheme(theme) {
    if (typeof theme !== "string") return DEFAULT_THEME;
    const trimmed = theme.trim().toLowerCase();
    return VALID_THEMES.includes(trimmed) ? trimmed : DEFAULT_THEME;
  }

  /**
   * Applies the theme attribute to the document element (e.g. <html data-theme="...">).
   *
   * @param {string} theme
   * @param {Document} [targetDoc]
   * @returns {string} The normalized applied theme
   */
  function applyTheme(theme, targetDoc) {
    const normalized = normalizeTheme(theme);
    const doc = targetDoc || (typeof document !== "undefined" ? document : null);
    if (doc && doc.documentElement && typeof doc.documentElement.setAttribute === "function") {
      doc.documentElement.setAttribute("data-theme", normalized);
    }
    return normalized;
  }

  function markThemeReady(targetDoc) {
    const doc = targetDoc || (typeof document !== "undefined" ? document : null);
    if (doc && doc.documentElement && typeof doc.documentElement.setAttribute === "function") {
      doc.documentElement.setAttribute("data-theme-ready", "true");
    }
  }

  /**
   * Resolves the extension storage local area.
   * @param {*} [storageArea]
   * @returns {*}
   */
  function resolveStorageArea(storageArea) {
    if (storageArea) return storageArea;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    return null;
  }

  /**
   * Reads the active theme from storage asynchronously.
   *
   * @param {*} [storageArea]
   * @returns {Promise<string>}
   */
  async function getStoredTheme(storageArea) {
    const area = resolveStorageArea(storageArea);

    if (area && typeof area.get === "function") {
      try {
        let result;
        if (area.get.length >= 2) {
          result = await new Promise((resolve) => {
            try {
              const ret = area.get([PRIMARY_STORAGE_KEY, LEGACY_STORAGE_KEY], (data) => resolve(data));
              if (ret && typeof ret.then === "function") {
                ret.then(resolve).catch(() => resolve(null));
              }
            } catch {
              resolve(null);
            }
          });
        } else {
          const ret = area.get([PRIMARY_STORAGE_KEY, LEGACY_STORAGE_KEY]);
          result = ret && typeof ret.then === "function" ? await ret : ret;
        }

        if (result && typeof result === "object") {
          const raw = result[PRIMARY_STORAGE_KEY] ?? result[LEGACY_STORAGE_KEY];
          if (raw !== undefined && raw !== null) {
            return normalizeTheme(raw);
          }
        }
      } catch {
        // Fallback on storage errors
      }
    }

    try {
      if (typeof localStorage !== "undefined") {
        const local = localStorage.getItem(PRIMARY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (local) return normalizeTheme(local);
      }
    } catch {}

    return DEFAULT_THEME;
  }

  /**
   * Persists the selected theme to storage and applies it to the DOM.
   *
   * @param {string} theme
   * @param {*} [storageArea]
   * @param {Document} [targetDoc]
   * @returns {Promise<string>}
   */
  async function setStoredTheme(theme, storageArea, targetDoc) {
    const normalized = normalizeTheme(theme);
    applyTheme(normalized, targetDoc);

    const area = resolveStorageArea(storageArea);
    if (area && typeof area.set === "function") {
      try {
        const payload = {
          [PRIMARY_STORAGE_KEY]: normalized,
          [LEGACY_STORAGE_KEY]: normalized,
        };
        if (area.set.length >= 2) {
          await new Promise((resolve) => {
            try {
              const ret = area.set(payload, () => resolve());
              if (ret && typeof ret.then === "function") {
                ret.then(resolve).catch(() => resolve());
              }
            } catch {
              resolve();
            }
          });
        } else {
          const ret = area.set(payload);
          if (ret && typeof ret.then === "function") {
            await ret;
          }
        }
      } catch {
        // Storage failure fallback
      }
    }

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(PRIMARY_STORAGE_KEY, normalized);
        localStorage.setItem(LEGACY_STORAGE_KEY, normalized);
      }
    } catch {}

    return normalized;
  }

  /**
   * Initializes the theme controller, hydrating the active theme immediately to prevent FOUC,
   * binding UI select dropdowns, and subscribing to storage changes for cross-view synchronization.
   *
   * @param {object} [options]
   * @param {*} [options.storageArea]
   * @param {Document} [options.targetDoc]
   * @param {HTMLSelectElement} [options.selectElement]
   * @param {Function} [options.onChange]
   * @returns {object} Controller instance with getTheme, setTheme, and cleanup methods.
   */
  function initThemeController(options = {}) {
    const { storageArea, targetDoc, selectElement, onChange } = options;
    const doc = targetDoc || (typeof document !== "undefined" ? document : null);
    let select = selectElement;
    if (!select && doc && typeof doc.getElementById === "function") {
      select = doc.getElementById("theme-select");
    }

    let currentTheme = DEFAULT_THEME;
    let themeRevision = 0;
    const initRevision = ++themeRevision;

    // 1. Immediate anti-FOUC DOM hydration from synchronous localStorage or document attribute
    try {
      if (typeof localStorage !== "undefined") {
        const local = localStorage.getItem(PRIMARY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (local) currentTheme = normalizeTheme(local);
      }
    } catch {}
    if (doc && doc.documentElement && typeof doc.documentElement.getAttribute === "function") {
      const existingAttr = doc.documentElement.getAttribute("data-theme");
      if (existingAttr && VALID_THEMES.includes(existingAttr)) {
        currentTheme = existingAttr;
      }
    }
    applyTheme(currentTheme, doc);
    if (select) {
      select.value = currentTheme;
    }

    // 2. Asynchronous storage hydration (discard if user/external action occurred)
    getStoredTheme(storageArea)
      .then((stored) => {
        if (themeRevision === initRevision && stored && stored !== currentTheme) {
          currentTheme = stored;
          applyTheme(stored, doc);
          if (select) select.value = stored;
          if (typeof onChange === "function") onChange(stored);
        }
        markThemeReady(doc);
      })
      .catch(() => markThemeReady(doc));

    // 3. UI select change handler
    const handleSelectChange = (event) => {
      ++themeRevision;
      const val =
        event && event.target && event.target.value !== undefined
          ? event.target.value
          : select
            ? select.value
            : "";
      const normalized = normalizeTheme(val);
      currentTheme = normalized;
      if (select) select.value = normalized;
      setStoredTheme(normalized, storageArea, doc);
      if (typeof onChange === "function") onChange(normalized);
    };

    if (select && typeof select.addEventListener === "function") {
      select.addEventListener("change", handleSelectChange);
    }

    // 4. Storage change listener for live cross-view synchronization
    const handleStorageChange = (changes, areaName) => {
      if (areaName && areaName !== "local") return;
      if (changes && (changes[PRIMARY_STORAGE_KEY] || changes[LEGACY_STORAGE_KEY])) {
        const change = changes[PRIMARY_STORAGE_KEY] || changes[LEGACY_STORAGE_KEY];
        if (change && change.newValue !== undefined) {
          const newTheme = normalizeTheme(change.newValue);
          if (newTheme !== currentTheme) {
            ++themeRevision;
            currentTheme = newTheme;
            applyTheme(newTheme, doc);
            if (select) select.value = newTheme;
            if (typeof onChange === "function") onChange(newTheme);
          }
        }
      }
    };

    let storageSource = null;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      storageSource = chrome.storage.onChanged;
    } else if (typeof browser !== "undefined" && browser.storage && browser.storage.onChanged) {
      storageSource = browser.storage.onChanged;
    } else if (storageArea && storageArea.onChanged) {
      storageSource = storageArea.onChanged;
    }

    if (storageSource && typeof storageSource.addListener === "function") {
      storageSource.addListener(handleStorageChange);
    }

    return {
      getTheme() {
        return currentTheme;
      },
      async setTheme(theme) {
        ++themeRevision;
        const normalized = normalizeTheme(theme);
        currentTheme = normalized;
        if (select) select.value = normalized;
        await setStoredTheme(normalized, storageArea, doc);
        if (typeof onChange === "function") onChange(normalized);
        return normalized;
      },
      cleanup() {
        if (select && typeof select.removeEventListener === "function") {
          select.removeEventListener("change", handleSelectChange);
        }
        if (storageSource && typeof storageSource.removeListener === "function") {
          storageSource.removeListener(handleStorageChange);
        }
      },
    };
  }


  return {
    VALID_THEMES,
    DEFAULT_THEME,
    PRIMARY_STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    normalizeTheme,
    applyTheme,
    getStoredTheme,
    setStoredTheme,
    initThemeController,
  };
});
