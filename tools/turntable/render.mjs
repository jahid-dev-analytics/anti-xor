/* Render the hero car as a turntable: N frames around a full 360°, written as
 * WebP with an alpha channel so they sit over the skyline the way the live
 * canvas does.
 *
 *   node tools/turntable/render.mjs [frames]
 *
 * Why this is driven over the DevTools Protocol rather than `chrome
 * --screenshot`:
 *   - the CLI screenshot flag cannot produce WebP, and PNG with alpha is
 *     roughly four times the size for the same picture
 *   - it paints NOTHING after a programmatic scroll, so poses could not be
 *     set that way
 *   - CDP lets the page hand back an already-encoded frame, so the car can be
 *     drawn at 2x and downscaled in-page — real supersampling, which is the
 *     one quality win an offline render has over the live canvas
 *
 * The car lives in car.js next to this file. It is build-time source only —
 * the page ships pre-rendered frames, not WebGL — so this is its one home.
 */
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9444;

const FRAMES = Number(process.argv[2] || 24);
const SIZES = [
  { dir: "public/assets/car", w: 1200, h: 720 },
  { dir: "public/assets/car/sm", w: 600, h: 360 },
];
const SS = 2;          /* supersample factor */
const QUALITY = 0.78;

/* ---------- build the harness out of the real scene.js ---------- */
const carBlock = await readFile(join(HERE, "car.js"), "utf8");

const harness = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}
  canvas{display:block}
</style></head><body>
<canvas id="gl"></canvas>
<script>
(function(){
  'use strict';
  /* the few helpers the car block expects from the rest of scene.js */
  var clamp = function(v,a,b){ return v<a?a:v>b?b:v; };
  var smooth = function(t){ t=clamp(t,0,1); return t*t*(3-2*t); };
  var mobileQ = { matches:false };

${carBlock}

  /* Draw one pose and hand it back already encoded. drawImage does the
     downscale, which is what turns the 2x buffer into a clean frame; it has to
     happen in this same task because the WebGL drawing buffer is not preserved
     across one. */
  var flat = document.createElement('canvas');
  window.__frame = function(ang, outW, outH, q){
    car.x = 0;    cur.x = 0;
    car.ang = ang; cur.ang = ang;
    car.camY = 1.02;
    car.camZ = 6.75; cur.camZ = 6.75;
    car.tgtY = 0.56; cur.tgtY = 0.56;
    car.head = 0.85; cur.head = 0.85;
    car.studio = 1;
    draw();
    flat.width = outW; flat.height = outH;
    var c = flat.getContext('2d');
    c.clearRect(0,0,outW,outH);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(canvas, 0, 0, outW, outH);
    return flat.toDataURL('image/webp', q);
  };
  window.__ready = !!(window.__frame && document.getElementById('gl'));
})();
</script></body></html>`;

const hp = join(HERE, "_harness.html");
await writeFile(hp, harness);

/* ---------- a minimal CDP client on Node's built-in WebSocket ---------- */
function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const waiting = new Map();
  const open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) {
      const { res, rej } = waiting.get(m.id); waiting.delete(m.id);
      m.error ? rej(new Error(m.method + ": " + m.error.message)) : res(m.result);
    }
  };
  return {
    ready: open,
    send(method, params = {}) {
      return new Promise((res, rej) => { waiting.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
    },
    close(){ ws.close(); },
  };
}

const profile = join(HERE, "_profile");
await rm(profile, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + profile,
  "about:blank",
], { stdio: "ignore" });

async function targetUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await r.json();
      const page = list.find(t => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("chrome never came up on port " + PORT);
}

const client = cdp(await targetUrl());
await client.ready;
await client.send("Page.enable");
await client.send("Runtime.enable");

try {
  for (const size of SIZES) {
    await mkdir(join(ROOT, size.dir), { recursive: true });
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: size.w, height: size.h, deviceScaleFactor: SS, mobile: false,
    });
    /* reload so the canvas is sized for this emulation */
    await client.send("Page.navigate", { url: "file:///" + hp.replace(/\\/g, "/") });
    await new Promise(r => setTimeout(r, 1200));

    for (let i = 0; i < FRAMES; i++) {
      const ang = -0.6 + (i / FRAMES) * Math.PI * 2;
      const { result, exceptionDetails } = await client.send("Runtime.evaluate", {
        expression: `window.__frame(${ang}, ${size.w}, ${size.h}, ${QUALITY})`,
        returnByValue: true, awaitPromise: false,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.text + " " + (exceptionDetails.exception?.description || ""));
      const dataUrl = result.value;
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/webp")) {
        throw new Error("frame " + i + " did not come back as webp: " + String(dataUrl).slice(0, 60));
      }
      const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
      const name = "f" + String(i).padStart(2, "0") + ".webp";
      await writeFile(join(ROOT, size.dir, name), buf);
      process.stdout.write(`${size.dir} ${i + 1}/${FRAMES} ${(buf.length / 1024).toFixed(0)}KB   \r`);
    }
    console.log();
  }
} finally {
  client.close();
  chrome.kill();
  /* Chrome keeps a lock on its crashpad file for a moment after exit; the
     profile is disposable, so a failure to remove it must not fail a render
     that has already written every frame. */
  await rm(profile, { recursive: true, force: true }).catch(function(){});
}
console.log("done");
