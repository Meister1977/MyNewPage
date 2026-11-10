const Platform = {
  isExtension: true,

  async getToken(interactive) {
    try {
      const r = await chrome.identity.getAuthToken({ interactive });
      const token = r?.token ?? r;
      if (!token) throw new Error("no token");
      return token;
    } catch {
      const e = new Error("auth");
      e.name = "AuthError";
      throw e;
    }
  },
  invalidateToken: token => chrome.identity.removeCachedAuthToken({ token }),
  async revoke() {
    try {
      const r = await chrome.identity.getAuthToken({ interactive: false });
      const token = r?.token ?? r;
      if (!token) return;
      await chrome.identity.removeCachedAuthToken({ token });
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: "POST" });
    } catch { /* már kijelentkezett */ }
  },

  cacheLoad: async () => (await chrome.storage.local.get("cache")).cache ?? null,
  cacheSave: cache => chrome.storage.local.set({ cache }),
  onCacheChanged(cb) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.cache?.newValue) cb(changes.cache.newValue);
    });
  },

  favicon: url => `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`,
  search: text => chrome.search.query({ text, disposition: "CURRENT_TAB" })
};
