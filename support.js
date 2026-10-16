(() => {
  'use strict';

  function redirectLegacyAnchor() {
    if (location.hash !== '#lexicon-explorer') return false;
    location.replace(new URL('legacy.html#lexicon-explorer', location.href).href);
    return true;
  }
  if (redirectLegacyAnchor()) return;
  window.addEventListener('hashchange', redirectLegacyAnchor);

  const themeKey = 'kalimat-support-theme';
  const toggle = document.getElementById('theme-toggle');
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  let savedTheme = null;
  try {
    const value = localStorage.getItem(themeKey);
    if (value === 'dark' || value === 'light') savedTheme = value;
  } catch (_) { /* The page also works when storage is unavailable. */ }

  function applyTheme() {
    const dark = savedTheme ? savedTheme === 'dark' : preference.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.setAttribute('aria-label', dark ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن');
      toggle.textContent = dark ? 'المظهر الفاتح' : 'المظهر الداكن';
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#102b26' : '#f7f4eb');
  }
  applyTheme();
  preference.addEventListener('change', applyTheme);
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      savedTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(themeKey, savedTheme); } catch (_) { /* Use this visit's choice. */ }
      applyTheme();
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Installation and support links remain available without offline caching.
    });
  }
})();
