function render(id, checks) {
  const list = document.getElementById(id);
  for (const [label, available] of checks) {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = label;
    value.textContent = available ? "支持" : "未通过";
    value.className = available ? "ok" : "missing";
    row.append(term, value);
    list.append(row);
  }
}

function supportsFormat(level) {
  return ["4200", "42E0"].some(profile => {
    const mime = `video/mp4;codecs=avc1.${profile}${level},mp4a.40.2`;
    return globalThis.MediaRecorder?.isTypeSupported?.(mime) && globalThis.MediaSource?.isTypeSupported?.(mime);
  });
}

render("media-results", [
  ["纯音频 · Web Audio 延迟", typeof globalThis.AudioContext?.prototype.createDelay === "function"],
  ["播放器裁剪与画布采集", !!globalThis.MediaStreamTrackProcessor && !!globalThis.VideoFrame
    && !!globalThis.HTMLCanvasElement?.prototype.captureStream && !!globalThis.CanvasCaptureMediaStreamTrack?.prototype.requestFrame],
  ["MP4 录制与播放 · 720p / 1080p30 所需格式", supportsFormat("28")],
  ["MP4 录制与播放 · 1080p60 所需格式", supportsFormat("2a")],
]);

if (location.protocol === "chrome-extension:") {
  document.body.classList.add("popup");
  document.getElementById("install").hidden = true;
  document.getElementById("intro").textContent = "以下结果来自当前浏览器的扩展环境。";
  const status = document.getElementById("framework");
  status.textContent = "正在检查扩展后台和权限…";
  chrome.runtime.sendMessage("inspect").then(reply => {
    if (!reply?.results) throw new Error(reply?.error || "检测后台未返回结果");
    render("extension-results", reply.results);
    status.textContent = reply.results.every(([, ok]) => ok) ? "所列扩展接口均通过检查。" : "部分扩展接口未通过检查。";
  }).catch(error => { status.textContent = "检测后台无法完成检查：" + error.message; });
}
