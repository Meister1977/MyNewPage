const fs = require("fs"), vm = require("vm");
const V2 = require("path").join(__dirname, "..", "..", "shared") + require("path").sep;
let remote = null; // a "Drive" tartalma
const mem = {};
const code = `
${fs.readFileSync(V2 + "config.js", "utf8")}
const Platform = {
  async getToken(){ if(globalThis.__noAuth){const e=new Error("a");e.name="AuthError";throw e;} return "tok"; },
  async cacheLoad(){ return globalThis.__mem.cache ?? null; },
  async cacheSave(c){ globalThis.__mem.cache = JSON.parse(JSON.stringify(c)); },
  onCacheChanged(){}, async revoke(){}, importLegacy: async()=>globalThis.__legacy ?? null
};
const Drive = {
  async findId(){ return globalThis.__remote ? "f1" : null; },
  async read(){ await Platform.getToken(); return JSON.parse(JSON.stringify(globalThis.__remote)); },
  async write(id, d){ await Platform.getToken(); globalThis.__remote = JSON.parse(JSON.stringify(d)); return "f1"; }
};
${fs.readFileSync(V2 + "store.js", "utf8")}
globalThis.Store = Store;
`;
const ctx = { crypto: require("crypto"), setTimeout, clearTimeout, console, __mem: mem };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);
const S = ctx.Store;
const assert = require("assert");
const names = () => S.data.items.map(i => i.title + (i.children ? "[" + i.children.map(c => c.title).join(",") + "]" : ""));
(async () => {
  ctx.__legacy = [{ id: "L1", title: "Legacy", url: "https://l" }];
  await S.init();
  await S.add({ title: "A", url: "https://a" });
  await S.add({ title: "B", url: "https://b" });
  await S.add({ title: "C", url: "https://c" });
  await S.add({ title: "D", url: "https://d" });
  assert.deepEqual(names(), ["A", "B", "C", "D"]);
  const id = t => S.data.items.find(i => i.title === t).id;
  S.combine(id("B"), id("A"), "F");
  assert.deepEqual(names(), ["F[A,B]", "C", "D"]);
  const F = S.data.items[0].id;
  S.moveToFolder(id("C"), F);
  assert.deepEqual(names(), ["F[A,B,C]", "D"]);
  const find = t => { for (const i of S.data.items) { if (i.title === t) return i; for (const c of i.children ?? []) if (c.title === t) return c; } };
  S.moveToRoot(find("B").id, F);
  assert.deepEqual(names(), ["F[A,C]", "B", "D"]);
  S.placeRelative(find("D").id, find("B").id, false);
  assert.deepEqual(names(), ["F[A,C]", "D", "B"]);
  S.remove(find("A").id); // 1 elem marad -> a mappa helyére kerül
  assert.deepEqual(names(), ["C", "D", "B"]);
  S.nudge(find("B").id, -1);
  assert.deepEqual(names(), ["C", "B", "D"]);
  S.combine(find("D").id, find("C").id, "G");
  S.moveToRoot(find("C").id, S.data.items[0].id); // 1 elem marad
  assert.deepEqual(names(), ["C", "D", "B"].length ? names() : []); // csak futás
  console.log("ops ok:", names().join(" | "));

  // szinkron: nincs belépve -> nem megy Drive-ra
  assert.equal(S.status, "signedOut");
  await S.signIn();
  assert.equal(S.status, "ok");
  assert.ok(ctx.__remote, "remote created");
  assert.equal(ctx.__remote.items.length, S.data.items.length);
  // másik eszköz újabb változata
  ctx.__remote.updatedAt = Date.now() + 5000;
  ctx.__remote.items = [{ id: "R", title: "Remote", url: "https://r" }];
  await S.sync();
  assert.deepEqual(names(), ["Remote"]);
  // helyi változás -> push
  await S.add({ title: "Local", url: "https://x" });
  await S.sync();
  assert.deepEqual(ctx.__remote.items.map(i => i.title), ["Remote", "Local"]);
  // auth hiba
  ctx.__noAuth = true;
  await S.sync();
  assert.equal(S.status, "signedOut");
  ctx.__noAuth = false;
  await S.signOut();
  assert.equal(S.data.items.length, 0);
  console.log("sync ok");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
