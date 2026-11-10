const Platform = {
  isExtension: false,

  async getToken(interactive) {
    const saved = JSON.parse(localStorage.getItem("mnp.token") || "null");
    if (saved && saved.exp > Date.now() + 60000) return saved.token;
    await loadGsi();
    return new Promise((resolve, reject) => {
      const fail = () => { const e = new Error("auth"); e.name = "AuthError"; reject(e); };
      const timer = setTimeout(fail, interactive ? 120000 : 10000);
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.WEB_CLIENT_ID,
        scope: CONFIG.SCOPE,
        callback: r => {
          clearTimeout(timer);
          if (!r.access_token) return fail();
          localStorage.setItem("mnp.token", JSON.stringify({ token: r.access_token, exp: Date.now() + r.expires_in * 1000 }));
          resolve(r.access_token);
        },
        error_callback: () => { clearTimeout(timer); fail(); }
      });
      client.requestAccessToken({ prompt: interactive ? "" : "none" });
    });
  },
  invalidateToken: async () => localStorage.removeItem("mnp.token"),
  async revoke() {
    const saved = JSON.parse(localStorage.getItem("mnp.token") || "null");
    localStorage.removeItem("mnp.token");
    if (saved && window.google?.accounts) google.accounts.oauth2.revoke(saved.token, () => {});
  },

  cacheLoad: async () => JSON.parse(localStorage.getItem("mnp.cache") || "null"),
  cacheSave: async cache => localStorage.setItem("mnp.cache", JSON.stringify(cache)),
  onCacheChanged(cb) {
    addEventListener("storage", e => { if (e.key === "mnp.cache" && e.newValue) cb(JSON.parse(e.newValue)); });
  },

  favicon(url) {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return ""; }
  },
  search: text => { location.href = `https://www.google.com/search?q=${encodeURIComponent(text)}`; }
};

let gsiPromise = null;
function loadGsi() {
  gsiPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = resolve;
    s.onerror = () => { gsiPromise = null; reject(new Error("gsi")); };
    document.head.append(s);
  });
  return gsiPromise;
}

// Előtöltés, hogy a bejelentkezési felugró ablak ne vesszen el a kattintás után.
loadGsi().catch(() => {});
