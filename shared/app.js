const $ = id => document.getElementById(id);
const grid = $("grid"), folderGrid = $("folderGrid"), folderDlg = $("folderDlg"), folderName = $("folderName");
const ctx = $("ctx"), dlg = $("dlg"), fName = $("fName"), fUrl = $("fUrl");
const askDlg = $("askDlg"), askTitle = $("askTitle"), askMsg = $("askMsg"), askInput = $("askInput"), askOk = $("askOk"), askCancel = $("askCancel");
const settingsDlg = $("settingsDlg"), langSelect = $("langSelect");
let openFolderId = null;
let drag = null;
let uiLang = "auto";

const isFolder = b => Array.isArray(b.children);

function zone(e, el, canCombine) {
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  if (canCombine && x > 0.3 && x < 0.7) return "combine";
  return x < 0.5 ? "before" : "after";
}

function makeTile(b, folderId) {
  const inFolder = folderId !== null;
  const a = document.createElement("a");
  a.className = "tile" + (isFolder(b) ? " folder" : "");
  a.draggable = true;
  a.innerHTML = `<div class="icon"></div><div class="name"></div>`;
  a.querySelector(".name").textContent = b.title || b.url || t("folder");
  a.title = b.title;
  const icon = a.querySelector(".icon");
  const addImg = url => {
    const img = document.createElement("img");
    img.alt = "";
    img.src = Platform.favicon(url);
    icon.append(img);
  };
  if (isFolder(b)) {
    a.href = "#";
    b.children.filter(k => k.url).slice(0, 4).forEach(k => addImg(k.url));
  } else {
    a.href = b.url;
    addImg(b.url);
  }

  a.addEventListener("click", e => {
    if (isFolder(b)) { e.preventDefault(); if (!inFolder) openFolder(b.id); }
  });
  a.addEventListener("contextmenu", e => { e.preventDefault(); showMenu(e, b, folderId, a); });
  a.addEventListener("dragstart", e => {
    drag = { id: b.id, folder: isFolder(b) };
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => a.classList.add("dragging"), 0);
  });
  a.addEventListener("dragend", () => { drag = null; a.classList.remove("dragging"); });

  const clear = () => a.classList.remove("combine", "before", "after");
  a.addEventListener("dragover", e => {
    if (!drag || drag.id === b.id) return;
    e.preventDefault();
    clear();
    a.classList.add(zone(e, a, !inFolder && !drag.folder));
  });
  a.addEventListener("dragleave", clear);
  a.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();
    clear();
    if (!drag || drag.id === b.id) return;
    const d = drag;
    drag = null;
    const z = zone(e, a, !inFolder && !d.folder);
    if (z === "combine") {
      if (isFolder(b)) Store.moveToFolder(d.id, b.id);
      else Store.combine(d.id, b.id, t("folder"));
    } else {
      Store.placeRelative(d.id, b.id, z === "after");
    }
  });
  return a;
}

function addTile() {
  const add = document.createElement("a");
  add.className = "tile add";
  add.href = "#";
  add.innerHTML = `<div class="icon">+</div><div class="name"></div>`;
  add.querySelector(".name").textContent = t("add");
  add.addEventListener("click", e => { e.preventDefault(); openDialog(null); });
  return add;
}

function render() {
  const items = Store.data.items;
  grid.replaceChildren(...items.map(b => makeTile(b, null)), addTile());
  if (openFolderId) {
    const f = items.find(i => i.id === openFolderId);
    if (!f || !isFolder(f)) return closeFolder();
    folderGrid.replaceChildren(...f.children.map(k => makeTile(k, f.id)));
    if (document.activeElement !== folderName) folderName.value = f.title;
  }
  renderSyncBar();
}

function renderSyncBar() {
  const bar = $("syncBar"), s = Store.status;
  bar.hidden = !(s === "signedOut" || s === "error");
  $("syncText").textContent = t(s === "error" ? "syncError" : "signInPrompt");
  $("signInBtn").hidden = s === "error";
}

function openFolder(id) {
  const f = Store.locate(id)?.node;
  if (!f) return;
  openFolderId = id;
  folderName.value = f.title;
  if (!folderDlg.open) folderDlg.showModal();
  render();
}

function closeFolder() {
  if (folderDlg.open) folderDlg.close();
  openFolderId = null;
}

folderDlg.addEventListener("close", () => { openFolderId = null; });
folderName.addEventListener("change", () => {
  if (openFolderId) Store.update(openFolderId, { title: folderName.value.trim() || t("folder") });
});
folderName.addEventListener("keydown", e => { if (e.key === "Enter") folderName.blur(); });

// Elem kihúzása a mappából: a háttérre (::backdrop) ejtés a mappa mellé teszi.
folderDlg.addEventListener("dragover", e => { if (drag && e.target === folderDlg) e.preventDefault(); });
folderDlg.addEventListener("drop", e => {
  if (e.target !== folderDlg || !drag) return;
  e.preventDefault();
  const d = drag, folderId = openFolderId;
  drag = null;
  Store.moveToRoot(d.id, folderId);
});

// Natív <dialog> alapú prompt/confirm; null = megszakítva.
function ask({ title, message = "", value = null, okLabel = "OK", danger = false }) {
  return new Promise(resolve => {
    const hasInput = value !== null;
    askTitle.textContent = title;
    askMsg.textContent = message;
    askInput.hidden = !hasInput;
    askInput.required = hasInput;
    askInput.value = value ?? "";
    askOk.textContent = okLabel;
    askOk.className = danger ? "danger" : "primary";
    askDlg.addEventListener("close", () => {
      const ok = askDlg.returnValue === "ok";
      askDlg.returnValue = "";
      resolve(ok ? (hasInput ? askInput.value.trim() : true) : null);
    }, { once: true });
    askDlg.showModal();
    // Megerősítésnél a biztonságos (Mégse) gomb kapja a fókuszt.
    if (hasInput) { askInput.focus(); askInput.select(); } else askCancel.focus();
  });
}

function showMenu(e, b, folderId, tile) {
  const loc = Store.locate(b.id);
  const items = [];
  if (!isFolder(b)) items.push([t("openInNewTab"), () => window.open(b.url, "_blank")]);
  if (isFolder(b)) {
    items.push([t("open"), () => openFolder(b.id)]);
    items.push([t("rename"), async () => {
      const n = await ask({ title: t("renameFolderTitle"), value: b.title, okLabel: t("save") });
      if (n) Store.update(b.id, { title: n });
    }]);
  } else {
    items.push([t("edit"), () => openDialog(b)]);
  }
  if (loc && loc.index > 0) items.push([t("moveEarlier"), () => Store.nudge(b.id, -1)]);
  if (loc && loc.index < loc.list.length - 1) items.push([t("moveLater"), () => Store.nudge(b.id, 1)]);
  if (folderId) items.push([t("removeFromFolder"), () => Store.moveToRoot(b.id, folderId)]);
  if (isFolder(b)) {
    items.push([t("deleteFolder"), async () => {
      const ok = await ask({ title: t("deleteItemTitle", b.title), message: t("deleteFolderMessage"), okLabel: t("delete"), danger: true });
      if (ok) { if (openFolderId === b.id) closeFolder(); Store.remove(b.id); }
    }, true]);
  } else {
    items.push([t("delete"), () => Store.remove(b.id), true]);
  }

  const group = document.createElement("div");
  group.setAttribute("focusgroup", "menu nomemory");
  group.setAttribute("aria-label", t("actions"));
  const native = "focusGroup" in HTMLElement.prototype;
  if (!native) group.setAttribute("role", "menu");
  for (const [label, fn, danger] of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    if (danger) btn.className = "danger";
    if (!native) btn.setAttribute("role", "menuitem");
    btn.addEventListener("click", () => { ctx.hidePopover(); fn(); });
    group.append(btn);
  }
  ctx.replaceChildren(group);

  // Billentyűzetről (Menü gomb / Shift+F10) a csempéhez kötve nyílik, és az első elemre lép.
  const keyboard = e.pointerType === "" || (!e.clientX && !e.clientY);
  const r = tile.getBoundingClientRect();
  const x = keyboard ? r.left + r.width / 2 : e.clientX;
  const y = keyboard ? r.bottom : e.clientY;
  if (ctx.matches(":popover-open")) ctx.hidePopover();
  // A modális dialógus kívüli elemeket inertté tesz, ezért a menü a nyitott mappa-dialógusba költözik.
  (folderId ? folderDlg : document.body).append(ctx);
  ctx.showPopover();
  ctx.style.left = Math.max(0, Math.min(x, innerWidth - ctx.offsetWidth - 8)) + "px";
  ctx.style.top = Math.max(0, Math.min(y, innerHeight - ctx.offsetHeight - 8)) + "px";
  if (keyboard) group.querySelector("button").focus();
}

// Fallback, ahol nincs natív focusgroup.
if (!("focusGroup" in HTMLElement.prototype)) {
  ctx.addEventListener("keydown", e => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = [...ctx.querySelectorAll("button")];
    const cur = items.indexOf(document.activeElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1
      : cur < 0 ? (e.key === "ArrowUp" ? items.length - 1 : 0)
      : (cur + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    e.preventDefault();
    items[next].focus();
  });
}

function openDialog(item) {
  $("dlgTitle").textContent = item ? t("editFavorite") : t("newFavorite");
  fName.value = item?.title ?? "";
  fUrl.value = item?.url ?? "";
  dlg.dataset.id = item?.id ?? "";
  dlg.showModal();
}

dlg.addEventListener("close", () => {
  const saved = dlg.returnValue === "ok";
  dlg.returnValue = "";
  if (!saved) return;
  const data = { title: fName.value.trim(), url: fUrl.value.trim() };
  if (dlg.dataset.id) Store.update(dlg.dataset.id, data);
  else Store.add(data);
});

function openSettings() {
  $("settingsTitle").textContent = both("settings");
  $("langLabel").textContent = both("language");
  langSelect.replaceChildren(new Option(both("languageAuto"), "auto"), ...languages.map(l => new Option(l.name, l.code)));
  langSelect.value = Store.data.settings.lang;
  $("siteLink").textContent = $("siteLink").href = CONFIG.SITE_URL;
  const qr = qrcode(0, "M");
  qr.addData(CONFIG.SITE_URL);
  qr.make();
  $("qr").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  $("accountSection").hidden = !Store.signedIn;
  settingsDlg.showModal();
}

langSelect.addEventListener("change", async () => {
  await Store.setLanguage(langSelect.value);
  location.reload();
});
$("settingsBtn").addEventListener("click", openSettings);
$("signInBtn").addEventListener("click", async () => {
  try { await Store.signIn(); } catch { /* a felhasználó megszakította */ }
  render();
});
$("signOutBtn").addEventListener("click", async () => {
  settingsDlg.close();
  await Store.signOut();
  render();
});

// A Chrome alapértelmezett keresőjével (weben a Google-lel) keres.
$("search").addEventListener("submit", e => {
  e.preventDefault();
  const text = e.target.elements.q.value.trim();
  if (text) Platform.search(text);
});

(async () => {
  await Store.init();
  uiLang = Store.data.settings.lang;
  await initI18n(uiLang);
  Store.on(what => {
    if (what === "status") return renderSyncBar();
    if (Store.data.settings.lang !== uiLang) return location.reload();
    render();
  });
  render();
  if (Store.signedIn) Store.sync();
  // Másik eszközön végzett változások átvétele.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Store.signedIn && Date.now() - Store.lastSync > 20000) Store.sync();
  });
})();
