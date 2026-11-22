const releases = "https://github.com/Aurxs/BilibiliLiveDelay/releases";
const downloadPath = "/BilibiliLiveDelay.zip";

async function refreshPackage(env) {
  const latest = await fetch(releases + "/latest", {
    method: "HEAD",
    redirect: "manual",
    headers: { "User-Agent": "BilibiliLiveDelay-Pages" },
  });
  const location = latest.headers.get("Location");
  const tagPrefix = releases + "/tag/";
  if (!location?.startsWith(tagPrefix)) throw new Error("Missing latest release");
  const tag = location.slice(tagPrefix.length);
  if (!/^v\d+(\.\d+){1,3}$/.test(tag)) throw new Error("Invalid release tag");

  const filename = "BilibiliLiveDelay-" + tag + ".zip";
  const base = releases + "/download/" + tag + "/";
  const [asset, sums] = await Promise.all([fetch(base + filename), fetch(base + "SHA256SUMS")]);
  if (!asset.ok || !sums.ok) throw new Error("Incomplete release");
  const bytes = await asset.arrayBuffer();
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const digest = Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
  const verified = (await sums.text()).split(/\r?\n/).some(line => {
    const [checksum, file] = line.trim().split(/\s+/);
    return checksum === digest && file === filename;
  });
  if (!verified) throw new Error("Checksum mismatch");
  await env.RELEASES.put("latest", bytes, { metadata: { tag, filename, digest, size: bytes.byteLength } });
  return tag;
}

async function handleWebhook(request, env) {
  const signature = request.headers.get("X-Hub-Signature-256") || "";
  if (!/^sha256=[a-f0-9]{64}$/.test(signature)) return new Response(null, { status: 401 });
  const body = await request.arrayBuffer();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const mac = Uint8Array.from(signature.slice(7).match(/../g), pair => parseInt(pair, 16));
  if (!await crypto.subtle.verify("HMAC", key, mac, body)) return new Response(null, { status: 401 });
  const payload = JSON.parse(new TextDecoder().decode(body));
  const event = request.headers.get("X-GitHub-Event");
  if (payload.repository?.id !== 1413979318 || !["release", "ping"].includes(event)) {
    return new Response(null, { status: 204 });
  }
  return new Response(await refreshPackage(env));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/hooks/github" && request.method === "POST") return handleWebhook(request, env);
    if (url.pathname !== downloadPath && url.pathname !== "/") return new Response("Not found", { status: 404 });
    if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });

    const cacheKey = new Request(new URL("/cached/verified-zip", url.origin));
    let response = await caches.default.match(cacheKey);
    if (!response) {
      const { value, metadata } = await env.RELEASES.getWithMetadata("latest", "arrayBuffer");
      if (!value) return new Response("Release unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
      response = new Response(value, { headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="' + metadata.filename + '"',
        "Cache-Control": "public, max-age=120",
        "Content-Length": String(metadata.size),
        "X-Release-Tag": metadata.tag,
        ETag: '"' + metadata.digest + '"',
      } });
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    }
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(request.method === "HEAD" ? null : response.body, { headers });
  },
};
