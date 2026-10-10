// Headless Chrome check of index.html via the DevTools protocol. Node built-ins only.
// Usage: node scripts/browser_check.mjs   (env CHROME=/path/to/chrome to override)
// Requests to monrer.fr are intercepted and failed: nothing is sent to monrer.fr.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8765;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CLX = { latitude: 48.861746, longitude: 2.346958 };
const AUU = { latitude: 48.872342, longitude: 2.329654 };
const LYON = { latitude: 45.7640, longitude: 4.8357 };

function startServer() {
  const p = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
  return p;
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${ORIGIN}/index.html`)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error("http.server did not start");
}

function startChrome(profile) {
  const p = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const ws = new Promise((resolve, reject) => {
    let buf = "";
    p.stderr.on("data", d => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    p.on("exit", code => reject(new Error(`Chrome exited (${code})`)));
  });
  return { proc: p, ws };
}

class Cdp {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    this.ws = new WebSocket(url);
    this.ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    };
    this.open = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject: e => reject(new Error(`${method}: ${e.message}`)) }));
  }
  on(fn) { this.listeners.push(fn); }
}

async function openPage(cdp, { position, permission }) {
  const { browserContextId } = await cdp.send("Target.createBrowserContext");
  await cdp.send("Browser.setPermission",
    { permission: { name: "geolocation" }, setting: permission, origin: ORIGIN, browserContextId });
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const page = { sessionId, monrer: [], errors: [], start: 0 };
  cdp.on(msg => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params;
    if (msg.method === "Fetch.requestPaused") {
      page.monrer.push({ url: p.request.url, ms: Date.now() - page.start });
      cdp.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" }, sessionId).catch(() => {});
    } else if (msg.method === "Runtime.exceptionThrown") {
      page.errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
    } else if (msg.method === "Runtime.consoleAPICalled" && p.type === "error") {
      page.errors.push(p.args.map(a => a.value ?? a.description).join(" "));
    } else if (msg.method === "Log.entryAdded" && p.entry.level === "error" && !String(p.entry.url).includes("monrer.fr")) {
      page.errors.push(`${p.entry.text} ${p.entry.url || ""}`);
    }
  });
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*monrer.fr*" }] }, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Log.enable", {}, sessionId);
  if (position) await cdp.send("Emulation.setGeolocationOverride", position, sessionId);
  page.eval = async expr => (await cdp.send("Runtime.evaluate",
    { expression: expr, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
  // Retries: the call fails while a cross-origin navigation is committing.
  page.history = async () => {
    for (let i = 0; ; i++) {
      try { return (await cdp.send("Page.getNavigationHistory", {}, sessionId)).entries.length; }
      catch (e) { if (i >= 20) throw e; await sleep(100); }
    }
  };
  page.close = () => cdp.send("Target.disposeBrowserContext", { browserContextId });
  page.start = Date.now();
  await cdp.send("Page.navigate", { url: `${ORIGIN}/index.html` }, sessionId);
  return page;
}

async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(100);
  }
  return null;
}

const scenarios = [
  ["a. CLX, accuracy 20 m → auto-redirect to ?s=CLX after ~2 s", async cdp => {
    const page = await openPage(cdp, { position: { ...CLX, accuracy: 20 }, permission: "granted" });
    await waitFor(() => page.eval("document.readyState === 'complete'"), 3000);
    const before = await page.history();
    await waitFor(() => page.monrer.length, 6000);
    const r = page.monrer[0];
    const entries = await page.history();
    await page.close();
    return [r?.url === "https://monrer.fr/?s=CLX" && r.ms >= 1900 && entries === before,
      `url=${r?.url} after ${r?.ms} ms, history entries ${before}→${entries}`, page];
  }],
  ["b+e. AUU, accuracy 1200 m → no redirect, 3 links, accuracy shown; tap uses replace", async cdp => {
    const page = await openPage(cdp, { position: { ...AUU, accuracy: 1200 }, permission: "granted" });
    await sleep(4000);
    const noRedirect = page.monrer.length === 0;
    const text = await page.eval("document.body.innerText");
    const links = await page.eval("[...document.querySelectorAll('#nearest a')].map(a => a.textContent)");
    const before = await page.history();
    await page.eval("document.querySelector('#nearest a').click()");
    await waitFor(() => page.monrer.length, 3000);
    const entries = await page.history();
    await page.close();
    const ok = noRedirect && text.includes("Précision : ~1,2 km") && links.length === 3
      && page.monrer[0]?.url === "https://monrer.fr/?s=AUU" && entries === before;
    return [ok, `noRedirect=${noRedirect} links=${JSON.stringify(links)} tap→${page.monrer[0]?.url} history entries ${before}→${entries}`, page];
  }],
  ["d. Lyon, accuracy 20 m → no redirect, 3 links with distances", async cdp => {
    const page = await openPage(cdp, { position: { ...LYON, accuracy: 20 }, permission: "granted" });
    await sleep(4000);
    const links = await page.eval("[...document.querySelectorAll('#nearest a')].map(a => a.textContent)");
    const status = await page.eval("document.getElementById('status').textContent");
    await page.close();
    return [page.monrer.length === 0 && links.length === 3 && links.every(l => / km$/.test(l)),
      `status="${status}" links=${JSON.stringify(links)}`, page];
  }],
  ["c. permission denied → search list, 'auber' finds Auber", async cdp => {
    const page = await openPage(cdp, { permission: "denied" });
    const shown = await waitFor(() => page.eval("!document.getElementById('search').hidden"), 5000);
    const total = await page.eval("document.querySelectorAll('#all a').length");
    const hits = await page.eval(`(() => { const q = document.getElementById('query'); q.value = 'auber';
      q.dispatchEvent(new Event('input')); return [...document.querySelectorAll('#all a span:first-child')].map(s => s.textContent); })()`);
    await page.close();
    return [shown && total > 400 && hits.includes("Auber") && page.monrer.length === 0,
      `search shown=${shown} total=${total} hits=${JSON.stringify(hits)}`, page];
  }],
];

const server = startServer();
const profile = mkdtempSync(join(tmpdir(), "monrer-nearby-chrome-"));
const chrome = startChrome(profile);
let failed = 0;
try {
  await waitForServer();
  const cdp = new Cdp(await chrome.ws);
  await cdp.open;
  for (const [name, run] of scenarios) {
    const [ok, detail, page] = await run(cdp);
    const pass = ok && page.errors.length === 0;
    if (!pass) failed++;
    console.log(`${pass ? "PASS" : "FAIL"} ${name}\n     ${detail}; console errors=${page.errors.length}`);
    for (const e of page.errors) console.log(`     error: ${e}`);
  }
} finally {
  chrome.proc.kill();
  server.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(`${scenarios.length - failed}/${scenarios.length} scenarios passed`);
process.exit(failed ? 1 : 0);
