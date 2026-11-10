// Adatmodell + helyi gyorsítótár + Google Drive szinkron. DOM-független (service workerben is fut).
// Elem: { id, title, url } vagy mappa: { id, title, children: [elem...] }
const Store = (() => {
  const uid = () => crypto.randomUUID();
  const fresh = () => ({ v: 1, updatedAt: 0, settings: { lang: "auto" }, items: [] });
  let state = { data: fresh(), dirty: false, signedIn: false, fileId: null, rev: "" };
  let status = "signedOut"; // signedOut | syncing | ok | error
  const listeners = new Set();
  let pushTimer = null;
  let chain = Promise.resolve();
  let lastSync = 0;

  const emit = what => listeners.forEach(fn => fn(what));
  const setStatus = s => { if (status !== s) { status = s; emit("status"); } };

  function normalize() {
    const d = state.data ??= fresh();
    d.items ??= [];
    d.settings ??= { lang: "auto" };
    d.settings.lang ??= "auto";
    d.updatedAt ??= 0;
  }

  async function persist() {
    state.rev = uid();
    await Platform.cacheSave({ data: state.data, dirty: state.dirty, signedIn: state.signedIn, fileId: state.fileId, rev: state.rev });
  }

  let hooked = false;

  async function init() {
    const cache = await Platform.cacheLoad();
    if (cache) state = { ...state, ...cache };
    normalize();
    status = state.signedIn ? "ok" : "signedOut";
    if (hooked) return;
    hooked = true;
    Platform.onCacheChanged(c => {
      if (c.rev === state.rev) return;
      state = { ...state, ...c };
      normalize();
      emit("data");
    });
  }

  function locate(id, list = state.data.items, parent = null) {
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (node.id === id) return { node, list, index: i, parent };
      if (node.children) {
        const r = locate(id, node.children, node);
        if (r) return r;
      }
    }
    return null;
  }

  function hasUrl(url, list = state.data.items) {
    return list.some(n => n.url === url || (n.children && hasUrl(url, n.children)));
  }

  // Ha a mappában 1 elem marad, az a mappa helyére kerül; üres mappa törlődik.
  function tidy(folder) {
    if (folder.children.length > 1) return;
    const loc = locate(folder.id);
    if (!loc) return;
    if (folder.children.length === 1) loc.list.splice(loc.index, 1, folder.children[0]);
    else loc.list.splice(loc.index, 1);
  }

  function commit() {
    state.data.updatedAt = Math.max(Date.now(), state.data.updatedAt + 1);
    state.dirty = true;
    emit("data");
    if (state.signedIn) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(sync, 600);
    }
    return persist();
  }

  const add = (item, folderId = null) => {
    const list = folderId ? locate(folderId)?.node.children : state.data.items;
    if (!list) return;
    list.push({ id: uid(), ...item });
    return commit();
  };

  const update = (id, fields) => {
    const loc = locate(id);
    if (!loc) return;
    Object.assign(loc.node, fields);
    return commit();
  };

  const remove = id => {
    const loc = locate(id);
    if (!loc) return;
    loc.list.splice(loc.index, 1);
    if (loc.parent) tidy(loc.parent);
    return commit();
  };

  function placeRelative(id, targetId, after) {
    const d = locate(id), tg = locate(targetId);
    if (!d || !tg || id === targetId) return;
    if (d.node.children && tg.parent) return;
    d.list.splice(d.index, 1);
    const t = locate(targetId);
    t.list.splice(t.index + (after ? 1 : 0), 0, d.node);
    if (d.parent && d.parent !== t.parent) tidy(d.parent);
    return commit();
  }

  function moveToFolder(id, folderId) {
    const d = locate(id), f = locate(folderId);
    if (!d || !f || d.node.children || !f.node.children || d.parent === f.node) return;
    d.list.splice(d.index, 1);
    f.node.children.push(d.node);
    if (d.parent) tidy(d.parent);
    return commit();
  }

  function moveToRoot(id, folderId) {
    const d = locate(id), f = locate(folderId);
    if (!d || !f) return;
    d.list.splice(d.index, 1);
    const fi = locate(folderId).index;
    state.data.items.splice(fi + 1, 0, d.node);
    if (d.parent) tidy(d.parent);
    return commit();
  }

  function combine(dragId, targetId, title) {
    const d = locate(dragId), tg = locate(targetId);
    if (!d || !tg || d.node.children || tg.node.children || tg.parent) return;
    d.list.splice(d.index, 1);
    const t = locate(targetId);
    t.list.splice(t.index, 1, { id: uid(), title, children: [t.node, d.node] });
    if (d.parent) tidy(d.parent);
    return commit();
  }

  function nudge(id, dir) {
    const loc = locate(id);
    if (!loc) return;
    const j = loc.index + dir;
    if (j < 0 || j >= loc.list.length) return;
    [loc.list[loc.index], loc.list[j]] = [loc.list[j], loc.list[loc.index]];
    return commit();
  }

  const setLanguage = lang => { state.data.settings.lang = lang; return commit(); };

  function sync() {
    clearTimeout(pushTimer);
    chain = chain.then(doSync, doSync);
    return chain;
  }

  async function doSync() {
    if (!state.signedIn) return;
    setStatus("syncing");
    try {
      if (!state.fileId) state.fileId = await Drive.findId();
      if (!state.fileId) {
        state.fileId = await Drive.write(null, state.data);
        state.dirty = false;
      } else {
        const remote = await Drive.read(state.fileId);
        const remoteTime = remote.updatedAt || 0;
        if (state.dirty && state.data.updatedAt >= remoteTime) {
          await Drive.write(state.fileId, state.data);
        } else if (remoteTime !== state.data.updatedAt) {
          state.data = remote;
          normalize();
          emit("data");
        }
        state.dirty = false;
      }
      lastSync = Date.now();
      await persist();
      setStatus("ok");
    } catch (e) {
      if (String(e.message).includes("404")) state.fileId = null;
      setStatus(e.name === "AuthError" ? "signedOut" : "error");
    }
  }

  async function signIn() {
    await Platform.getToken(true);
    state.signedIn = true;
    await persist();
    return sync();
  }

  async function signOut() {
    clearTimeout(pushTimer);
    if (state.signedIn && state.dirty) await sync();
    await Platform.revoke();
    state = { data: fresh(), dirty: false, signedIn: false, fileId: null, rev: "" };
    await persist();
    setStatus("signedOut");
    emit("data");
  }

  return {
    init, add, update, remove, placeRelative, moveToFolder, moveToRoot, combine, nudge, setLanguage,
    sync, signIn, signOut, locate, hasUrl,
    on: fn => listeners.add(fn),
    get data() { return state.data; },
    get status() { return status; },
    get signedIn() { return state.signedIn; },
    get lastSync() { return lastSync; }
  };
})();
