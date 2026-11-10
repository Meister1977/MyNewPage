let messages = {};
let browserMessages = {};
let fallbackMessages = {};
let languages = [];
let currentCode = "en";

const readJson = async path => (await fetch(path)).json();

// A böngésző nyelvéből választ támogatott nyelvet; ha nincs, angol.
function pickLanguage(pref, codes) {
  if (pref !== "auto" && codes.includes(pref)) return pref;
  const [base, region = ""] = navigator.language.replace("-", "_").split("_");
  const candidates = [`${base}_${region}`];
  if (base === "zh") candidates.push(["TW", "HK", "MO", "Hant"].includes(region) ? "zh_TW" : "zh_CN");
  if (base === "pt") candidates.push("pt_BR");
  if (base === "nb" || base === "nn") candidates.push("no");
  candidates.push(base);
  return candidates.find(c => codes.includes(c)) ?? "en";
}

const lookup = (src, key) => (src[key] ?? fallbackMessages[key])?.message ?? key;
const fill = (msg, subs) => subs.reduce((m, s, i) => m.replaceAll(`{${i}}`, s), msg);

const t = (key, ...subs) => fill(lookup(messages, key), subs);

// A böngésző nyelvén (vagy angolul), mellette a választott nyelven, ha az eltér.
function both(key) {
  const native = fill(lookup(browserMessages, key), []);
  const chosen = t(key);
  return chosen === native ? native : `${native} / ${chosen}`;
}

function applyI18n() {
  for (const el of document.querySelectorAll("*")) {
    for (const attr of el.getAttributeNames()) {
      if (!attr.startsWith("data-i18n")) continue;
      const msg = t(el.getAttribute(attr));
      if (attr === "data-i18n") el.textContent = msg;
      else el.setAttribute(attr.slice("data-i18n-".length), msg);
    }
  }
}

async function initI18n(pref = "auto") {
  languages = await readJson("languages.json");
  const codes = languages.map(l => l.code);
  currentCode = pickLanguage(pref, codes);
  const browserCode = pickLanguage("auto", codes);
  fallbackMessages = await readJson("_locales/en/messages.json");
  const load = code => code === "en" ? fallbackMessages : readJson(`_locales/${code}/messages.json`);
  messages = await load(currentCode);
  browserMessages = browserCode === currentCode ? messages : await load(browserCode);
  document.documentElement.lang = currentCode.replace("_", "-");
  applyI18n();
}
