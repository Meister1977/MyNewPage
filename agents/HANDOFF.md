# MyNewPage – handoff notes for AI agents / new sessions

Read this first. It contains everything needed to continue the project in a fresh session.
(The conversation with the owner was in **Hungarian**; keep replies short and concrete. Repo docs are English.)

## What this is

MyNewPage = a custom "new tab" page with Google search on top and the user's own favorites below (multiple rows, **folders** like iPad,
drag & drop, context menu). Two targets from one shared code base:

1. **Chrome extension** (MV3) – overrides the new tab page, toolbar button adds the current tab.
2. **Web version** – static page used as the Chrome homepage on a phone. Same UI.

Favorites sync through the user's **Google Drive `appDataFolder`** (`favorites.json`). Every user only sees their own data.
No backend of our own. Owner/developer: **Ambrózy Lőrinc**. GitHub: `https://github.com/Meister1977/MyNewPage` (public, open source).

## Fixed facts

| Item | Value |
|---|---|
| Extension name | `MyNewPage` (fixed in `manifest.json`, **not** localized) |
| Version | 2.0 (v1.0 was a bookmarks-based prototype, never published, kept locally in `D:\LocalDev\MyNewPage v1.0`) |
| Site root (static description + privacy) | `https://mynewpage.as.hu` |
| Web app (QR code points here) | `https://mynewpage.as.hu/myhome/index.html` |
| Extension ID (fixed via manifest `key`) | `jgbaghbhfikcipnjokedafpodefeedmp` |
| Google Cloud project | `mynewpage2` |
| Web OAuth client ID | `362067408220-sio8klbkilb3vkv6rqv7jv8nftiga1f1.apps.googleusercontent.com` (in `shared/config.js`) |
| Extension OAuth client ID | `362067408220-56dnfp7ft7dpqusu8mtirpk3u49movon.apps.googleusercontent.com` (in `platform/extension/manifest.json`) |
| OAuth scope | `https://www.googleapis.com/auth/drive.appdata` only |
| Client secrets | **None are used or needed.** Never add one. |
| Web authorized JS origin | `https://mynewpage.as.hu` (origin only, no path) |

Secrets (never commit, never print): the extension private key `MyNewPage-key.pem` (kept outside git; copies in `D:\LocalDev\` and the
v2.0 root, both git-ignored). It is not needed to run or build. The contact e-mail is deliberately obfuscated (`site/contact.js`); do not write it in plain text anywhere in the repo.

## Repository layout

```
shared/            code shared by both targets (source of truth)
  app.js           UI: tiles, folders dialog, context menu (popover + focusgroup), edit/ask dialogs, settings dialog + QR, sync bar
  store.js         data model + local cache + Drive sync (DOM-free, also runs in the service worker)
  drive.js         Drive v3 appDataFolder calls (find/read/write, 401 retry)
  i18n.js          own i18n loader (not chrome.i18n): language pick, t(), both(), applyI18n()
  config.js        SITE_URL, WEB_CLIENT_ID, scope, file name
  page.html        template -> newtab.html (extension) / index.html (web)
  newtab.css       all styles (light/dark via light-dark(), mobile @media)
  _locales/<code>/messages.json   33 languages (generated, see tools)
  languages.json   language list with native names (generated)
  icons/           16/48/128 house icons (generated)
platform/extension/  manifest.json, background.js (service worker), platform.js (chrome.identity/storage/search/favicon)
platform/web/        platform.js (Google Identity Services token flow, localStorage, google.com/s2/favicons)
site/              static root site: index.html (description + screenshots), privacy.html, contact.js, style.css, assets/
vendor/qrcode.js   qrcode-generator (MIT)
build.ps1          builds dist/extension, dist/web (site root) and dist/web/myhome (web app)
agents/            this handoff + tools/
dist/              build output (git-ignored)
```

Each platform provides a global `Platform` object with: `getToken(interactive)`, `invalidateToken`, `revoke`, `cacheLoad/cacheSave/onCacheChanged`, `favicon(url)`, `search(text)`.
`getToken` must throw an `Error` whose `name === "AuthError"` when no token is available.

## Data model and sync (shared/store.js)

```
{ v:1, updatedAt:<ms>, settings:{lang:"auto"|code}, items:[ {id,title,url} | {id,title,children:[{id,title,url}]} ] }
```
- Folders exist only at root level (one level). Items inside folders are links only.
- All mutations are synchronous on in-memory state then `commit()` (updatedAt = max(now, prev+1), dirty=true, emit, persist, debounce push 600 ms).
- Mutators: `add, update, remove, placeRelative, moveToFolder, moveToRoot, combine, nudge, setLanguage`.
  `tidy(folder)` dissolves a folder when ≤1 child remains (1 child replaces the folder, 0 removes it).
- `sync()` = pull+push, serialized via a promise chain. Last-writer-wins on `updatedAt`. Missing remote file -> create it. 404 -> forget fileId.
- Status: `signedOut | syncing | ok | error`. Not signed in = local only (cache in `chrome.storage.local` / `localStorage["mnp.cache"]`).
- `signOut()` pushes if dirty, revokes the token, **wipes the local data** (Drive copy stays).
- Language preference lives in `settings.lang` (synced); a change from another device triggers `location.reload()`.
- Extension `background.js`: on toolbar click adds the active tab (http/https only; badge ✓ / = already present / ✖ not allowed), syncs before and after.

## UI behaviours worth knowing (decisions made with the owner)

- Tile text: 13 px, wraps to **2 lines then ellipsis**; tiles are top-aligned.
- Drag onto the **middle (30–70 %)** of another link = make folder (iPad style); left/right edge = reorder.
  Dropping on the `::backdrop` of an open folder dialog takes the item out. Folders cannot be nested.
- Right click / long press / Menu key opens a context menu: open, edit/rename, move earlier/later (keyboard & touch alternative to drag), remove from folder, delete.
- Folder dialog and every other overlay are native `<dialog>`; the context menu is `popover="auto"` with `focusgroup="menu nomemory"` (JS fallback for arrow keys).
  **Gotcha:** a modal dialog makes everything outside it inert, so the context menu `<div id="ctx">` is moved *into* `#folderDlg` when opened from inside a folder.
- Edit dialog: Cancel is `type="button" command="close"`, Save is the only submit button so **Enter saves**; Esc closes natively. `returnValue` is reset after each close.
- `prompt()/confirm()` are replaced by the `ask()` dialog (confirm focuses the safe "Cancel" button).
- Search box uses `Platform.search`: extension -> `chrome.search.query` (user's **default search engine**), web -> Google. The Google wordmark is always shown (Chrome does not expose the provider logo) – owner was told, may want a neutral logo option later.
- Language: default = browser language (`navigator.language`) with **English fallback**; selectable in the settings dialog.
  Label of "Language", "Settings" and "Automatic" always show browser-language text, plus ` / chosen-language` text when different.
- Dark mode via `color-scheme: light dark` + `light-dark()` tokens.
- Mobile: layout shrinks under 600 px; HTML5 drag & drop is unreliable on touch, so on phones folders cannot be created by dragging (only moved with the menu).

## Build, test, regenerate

```powershell
powershell -File build.ps1                      # -> dist\extension, dist\web (site root), dist\web\myhome (web app)
node agents\tools\test_store.js                 # Store logic + sync test with a fake Drive (prints "ops ok" / "sync ok")
$env:PYTHONIOENCODING='utf-8'
python agents\tools\make_locales.py shared      # base 33 locales + languages.json (v1 keys)
python agents\tools\make_locales_v2.py shared   # adds v2 keys (sign-in, mobile text, description). Run AFTER make_locales.py
python agents\tools\make_icons.py shared\icons  # regenerates the 16/48/128 icons (needs Pillow)
```
Verified: running the two locale scripts into an empty dir reproduces `shared/_locales` byte-for-byte.
Syntax check any JS with `node --check <file>`. Quick browser smoke test: serve `dist\web\myhome` with `python -m http.server` and use headless Edge
(`msedge --headless=new --dump-dom` / `--screenshot`); seed `localStorage["mnp.cache"]` to render sample data (that is how the site screenshots were made).

Translation keys: add a key to **both** scripts' key lists, give a value for every one of the 33 languages (asserts check the counts),
then re-run the pipeline. Locale codes use Chrome's names (`pt_BR`, `zh_CN`, `zh_TW`, `no`, ...). Manifest strings (`extDescription`, `addCurrentTab`) use `__MSG_*__` with `default_locale: "en"`.

## Status

Done: v2.0 extension + web app (Drive sync, folders, i18n, settings with QR, sign-in/out), static site (description with screenshots, privacy policy, obfuscated contact), public README, tools, Store logic test, build script.
**Not verified in a real Chrome profile / on a real phone** (only syntax checks, the Node Store test with a fake Drive, and headless-Edge rendering of the web build). Test these first:
extension load, `getAuthToken` sign-in, Drive file creation/pull, toolbar "add tab", GIS popup sign-in on mobile Chrome, drag/folder flows.

## Open TODOs

1. **Add a `LICENSE`** (none yet; the repo is announced as open source). Ask the owner which one (MIT/Apache-2.0/GPL-3.0) and reference it in `README.md`.
2. Owner uploads `dist\web` to `https://mynewpage.as.hu` (HTTPS required); `dist\web\myhome\` = web app.
3. Google Cloud: while the OAuth consent screen is in *Testing*, only listed test users can sign in and tokens expire after ~7 days. Move to *In production*; provide the privacy policy URL `https://mynewpage.as.hu/privacy.html` and verify the domain.
4. Chrome Web Store (planned later): remove the manifest `key` before uploading; the store assigns a new extension ID -> update the extension OAuth client's Item ID in Google Cloud. Needs screenshots (1280x800), permission justifications (see `site/privacy.html`).
5. Translations were written by the AI without native review; rarer languages should be reviewed.
6. Optional ideas: neutral logo / hide Google wordmark when the default search engine is not Google; touch-friendly "add to folder" action; backups/export; remove the stale `v1.0` references if the owner archives it.

## Working agreements with the owner

- Conversation in Hungarian, short answers; explain only what is needed.
- Always say plainly what was *not* verified in a real browser.
- Do not claim things were pushed/published: the agent has no rights on the GitHub repo; the owner pushes.
- Consult the **modern-web-guidance** skill (`npx.cmd -y modern-web-guidance@latest search/retrieve`) before changing HTML/CSS/client JS patterns (dialog, popover/menu, dark mode were built from it).
- Make files with the editor tools; keep comments sparse (only where something is non-obvious).
- Never put the private key, a client secret or the plain contact e-mail into the repo.
