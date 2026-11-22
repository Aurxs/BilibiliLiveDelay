async function inspect() {
  const results = [
    ["Manifest V3 模块后台已启动", chrome.runtime.getManifest().manifest_version === 3],
    ["标签页采集 · tabCapture", typeof chrome.tabCapture?.getMediaStreamId === "function"
      && typeof chrome.tabCapture.getCapturedTabs === "function" && !!chrome.tabCapture.onStatusChanged],
    ["扩展上下文 · runtime.getContexts", typeof chrome.runtime.getContexts === "function"],
    ["播放器定位 · scripting.executeScript", typeof chrome.scripting?.executeScript === "function"],
    ["本地与会话存储 · storage", !!chrome.storage?.local && !!chrome.storage?.session],
    ["区域截图 · tabs.captureVisibleTab", typeof chrome.tabs?.captureVisibleTab === "function"],
  ];
  let created = false;
  let found = false;
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html", reasons: ["USER_MEDIA"], justification: "验证后台文档创建能力",
    });
    created = true;
    found = (await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })).length === 1;
  } catch { /* A missing API or rejected permission is reported below. */ }
  finally { if (created) await chrome.offscreen.closeDocument(); }
  results.push(["后台文档 · offscreen / USER_MEDIA", found]);
  return results;
}

let pending;
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message !== "inspect" || sender.id !== chrome.runtime.id) return;
  pending ??= inspect().finally(() => { pending = undefined; });
  pending.then(results => respond({ results }), error => respond({ error: error.message }));
  return true;
});
