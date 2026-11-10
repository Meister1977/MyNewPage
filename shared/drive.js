// Google Drive appDataFolder: minden felhasználó a saját, rejtett alkalmazásmappájába ír.
const Drive = (() => {
  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

  async function call(url, opts = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await Platform.getToken(false);
      const res = await fetch(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } });
      if (res.status === 401 && attempt === 0) { await Platform.invalidateToken(token); continue; }
      if (res.status === 401) { const e = new Error("auth"); e.name = "AuthError"; throw e; }
      if (!res.ok) throw new Error(`Drive ${res.status}`);
      return res;
    }
  }

  async function findId() {
    const q = encodeURIComponent(`name='${CONFIG.FILE_NAME}'`);
    const res = await call(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id)&pageSize=1`);
    return (await res.json()).files[0]?.id ?? null;
  }

  const read = async id => (await call(`${API}/files/${id}?alt=media`)).json();

  async function write(id, data) {
    if (id) {
      await call(`${UPLOAD}/files/${id}?uploadType=media`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      return id;
    }
    const boundary = "mnp" + Math.random().toString(36).slice(2);
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: CONFIG.FILE_NAME, parents: ["appDataFolder"] }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
    const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body
    });
    return (await res.json()).id;
  }

  return { findId, read, write };
})();
