importScripts("config.js", "platform.js", "drive.js", "store.js");

async function flash(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 1500);
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab.url || !/^https?:/.test(tab.url)) return flash(tab.id, "✖", "#d93025");
  await Store.init();
  await Store.sync();
  const exists = Store.hasUrl(tab.url);
  if (!exists) {
    await Store.add({ title: tab.title || tab.url, url: tab.url });
    await Store.sync();
  }
  flash(tab.id, exists ? "=" : "✓", exists ? "#5f6368" : "#188038");
});
