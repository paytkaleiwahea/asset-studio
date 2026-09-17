// Asset Studio server.  node server.mjs  →  http://127.0.0.1:4800
//
// Caching strategy (this is what keeps the dashboard fast):
//   1. manifest.json is read into memory once and re-read only when its mtime changes.
//   2. Dashboard cards show cached PNG thumbnails (<img>), never live <iframe>s.
//      Thumbs are keyed by template content hash, so an edit invalidates exactly one file.
//   3. Thumbs are warmed in the background at boot, so first paint is instant.
//   4. Hashed URLs are served immutable; the browser re-fetches only on a real change.
import express from "express";
import multer from "multer";
import puppeteer from "puppeteer-core";
import { validateBrand, brandTemplate, parseVariables } from "./brand.mjs";
import { resolveChrome } from "./chrome.mjs";
import {
  readFileSync, existsSync, mkdirSync, writeFileSync, statSync, rmSync, renameSync,
} from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(path.join(ROOT, "studio.config.json"), "utf8"));
const BUILD = path.join(ROOT, "build");
const MANIFEST = path.join(BUILD, "manifest.json");
const CACHE = path.join(ROOT, ".cache");
const OUT = path.join(ROOT, "exports");
const PORT = process.env.PORT || CONFIG.server.port;
const HOST = process.env.HOST || CONFIG.server.host;
const PREVIEW_HOST = HOST === '0.0.0.0' ? '127.0.0.1' : HOST === '::' ? '[::1]' : HOST.includes(':') && !HOST.startsWith('[') ? `[${HOST}]` : HOST;
const HF = path.join(ROOT, 'node_modules/hyperframes/bin/hyperframes.mjs');

mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const app = express();
app.get('/api/studio', (_req, res) => res.json({ name: 'Asset Studio', identity: createHash('sha256').update(ROOT).digest('hex') }));
app.use(express.json({ limit: "4mb" }));
const configFile = path.join(ROOT, 'studio.config.json');
const readConfig = () => JSON.parse(readFileSync(configFile, 'utf8'));
function saveConfig(config) {
  const temporary = configFile + '.tmp';
  writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n');
  renameSync(temporary, configFile);
}
app.get('/api/brand', (_req, res) => {
  const config = readConfig();
  res.json({ brand: config.brand, setup: config.brandSetup || 'new' });
});
app.use('/api/brand', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Open Brand Settings from this studio.' });
  next();
});
app.post('/api/brand/dismiss', (_req, res) => {
  const config = readConfig();
  if (!config.brandSetup) { config.brandSetup = 'skipped'; saveConfig(config); }
  res.json({ ok: true });
});
app.post('/api/brand/preview', (req, res) => {
  try {
    const brand = validateBrand(req.body, readConfig().brand);
    let html = brandTemplate(readFileSync(path.join(ROOT, 'templates/statics/posters/starter-poster.html'), 'utf8'), brand);
    html = html.replaceAll('{{WIDTH}}', '1080').replaceAll('{{HEIGHT}}', '1350').replaceAll('{{LABEL}}', 'Brand preview');
    const vars = Object.fromEntries(parseVariables(html).map(variable => [variable.id, variable.default]));
    vars.headline = 'Make it unmistakably yours';
    vars.kicker = brand.name;
    vars.caption = 'Your fonts. Your colors. Ready to create.';
    res.type('html').send(previewHtml(html, vars, 'templates/statics/posters', true));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/brand', (req, res) => {
  if (activeRender) return res.status(409).json({ error: 'Wait for the video export to finish, then save your brand.' });
  const previous = readConfig();
  let brand;
  try { brand = validateBrand(req.body, previous.brand); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  try {
    saveConfig({ ...previous, brand, brandSetup: 'complete' });
    execFileSync(process.execPath, [path.join(ROOT, 'generate.mjs')], { cwd: ROOT, windowsHide: true, timeout: 60000, stdio: 'pipe' });
    CONFIG.brand = brand;
    cachedManifest = null;
    res.json({ brand, setup: 'complete' });
  } catch (e) {
    saveConfig(previous);
    try { execFileSync(process.execPath, [path.join(ROOT, 'generate.mjs')], { cwd: ROOT, windowsHide: true, timeout: 60000, stdio: 'pipe' }); } catch {}
    cachedManifest = null;
    res.status(500).json({ error: 'Brand was not saved. Check your templates for build errors and try again.' });
  }
});

// ---------- manifest (in-memory, mtime-invalidated) ----------
let cachedManifest = null;
let manifestMtime = 0;
function manifest() {
  if (!existsSync(MANIFEST)) throw new Error("build/manifest.json missing — run: npm run build");
  const m = statSync(MANIFEST).mtimeMs;
  if (!cachedManifest || m !== manifestMtime) {
    cachedManifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
    manifestMtime = m;
  }
  return cachedManifest;
}
const findTemplate = (id) => manifest().templates.find((t) => t.id === id);
const findSize = (tpl, suffix) => tpl?.sizes.find((s) => s.suffix === suffix);
// Express 5 wildcards land as an array of path segments (or a string).
const segs = (v) => (Array.isArray(v) ? v : String(v ?? "").split("/")).filter(Boolean);

app.get("/api/manifest", (_req, res) => {
  try { res.json(manifest()); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- static assets ----------
app.use(express.static(path.join(ROOT, "public")));
// Built projects are content-addressed by the manifest hash; safe to cache hard.
app.use("/build", express.static(BUILD, { maxAge: "1h" }));
app.use("/exports", express.static(OUT));
app.use("/thumbs", express.static(CACHE, { immutable: true, maxAge: "365d" }));

// ---------- live preview (variables injected) ----------
// /preview/<media>/<category>/<name>/<suffix>
app.get("/preview/*rest", (req, res) => {
  const parts = segs(req.params.rest);
  const suffix = parts.pop();
  const tpl = findTemplate(parts.join("/"));
  const size = findSize(tpl, suffix);
  if (!size) return res.status(404).send("Template not found");

  const defaults = Object.fromEntries((tpl.variables ?? []).map((v) => [v.id, v.default]));
  const allowed = new Set(Object.keys(defaults));
  let overrides = {};
  try { overrides = JSON.parse(req.query.vars || "{}"); } catch { /* ignore */ }
  const vars = { ...defaults };
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const [k, val] of Object.entries(overrides)) {
      if (allowed.has(k) && ["string", "number", "boolean"].includes(typeof val)) vars[k] = val;
    }
  }
  const html = previewHtml(readFileSync(path.join(ROOT, size.dir, "index.html"), "utf8"), vars, size.dir, req.query.capture === "1");
  res.type("html").send(html);
});

function previewHtml(html, vars, baseDir, capture = false) {
  const json = JSON.stringify(vars)
    .replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");

  html = html
    .replace("</head>",
      `<base href="/${baseDir}/">` +
      `<script>window.__studio={getVariables:function(){return ${json};}};` +
      `window.__hyperframes=window.__studio;</script></head>`)
    .replace("</body>", `<script>(function(){
      var V=${json}, root=document.querySelector("[data-composition-id]"); if(!root) return;
      document.querySelectorAll("[data-var-text]").forEach(function(el){
        var k=el.getAttribute("data-var-text"); if(V[k]!=null) el.textContent=V[k];});
      document.querySelectorAll("[data-var-src]").forEach(function(el){
        var k=el.getAttribute("data-var-src"); if(V[k]!=null) el.setAttribute("src",V[k]);});
      Object.keys(V).forEach(function(k){ var v=V[k];
        if(typeof v==="string"||typeof v==="number") root.style.setProperty("--"+k,v);});
      var tl=window.__timelines&&window.__timelines[root.getAttribute("data-composition-id")];
      if(tl){
        if(${capture}) { tl.repeat(0); tl.pause(); tl.seek(tl.duration(), false); }
        else { tl.repeat(-1); tl.repeatDelay(0.4); tl.play(); }
      }
    })();</script></body>`);
  return html;
}

// ---------- headless chrome (one shared instance) ----------
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: resolveChrome(), headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb", "--hide-scrollbars"],
    }).catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}

/** Screenshot one built size to a PNG file. scale may be fractional (thumbnails). */
async function shoot({ tpl, size, vars = {}, scale, file }) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: scale });
    const url = `http://${PREVIEW_HOST}:${PORT}/preview/${tpl.id}/${size.suffix}?vars=` +
      encodeURIComponent(JSON.stringify(vars)) + '&capture=1';
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await new Promise((r) => setTimeout(r, 200));
    const el = await page.$("[data-composition-id]");
    await (el || page).screenshot({ path: file, ...(el ? {} : { clip: { x: 0, y: 0, width: size.w, height: size.h } }) });
  } finally { await page.close().catch(() => {}); }
}

// ---------- thumbnails (disk cache keyed by content hash) ----------
const thumbFile = (tpl) => path.join(CACHE, `still-v3-${tpl.hash}-${tpl.name}.png`);
const thumbUrl = (tpl) => `/thumbs/still-v3-${tpl.hash}-${tpl.name}.png`;

const inflight = new Map();
async function ensureThumb(tpl) {
  const file = thumbFile(tpl);
  if (existsSync(file)) return thumbUrl(tpl);
  if (inflight.has(tpl.id)) return inflight.get(tpl.id);
  // Recreate defensively: `npm run clean` may have removed .cache while we run.
  mkdirSync(CACHE, { recursive: true });
  const size = tpl.sizes[0];
  const p = shoot({
    tpl, size, scale: Math.max(0.15, CONFIG.render.thumbWidth / size.w), file,
  }).then(() => thumbUrl(tpl)).finally(() => inflight.delete(tpl.id));
  inflight.set(tpl.id, p);
  return p;
}

app.get("/api/thumb/*rest", async (req, res) => {
  const tpl = findTemplate(segs(req.params.rest).join("/"));
  if (!tpl) return res.status(404).json({ error: "Template not found" });
  try { res.json({ url: await ensureThumb(tpl) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/** Warm the thumbnail cache in the background so first load is instant. */
async function warmThumbs() {
  let list;
  try { list = manifest().templates; } catch { return; }
  const cold = list.filter((t) => !existsSync(thumbFile(t)));
  if (!cold.length) return;
  process.stdout.write(`  warming ${cold.length} thumbnail(s)`);
  for (const tpl of cold) {
    try { await ensureThumb(tpl); process.stdout.write("."); }
    catch { process.stdout.write("x"); }
  }
  process.stdout.write(" done\n");
}

// ---------- image upload (mirrored into every size of a template) ----------
const IMAGE_EXT = new Map([
  ["image/png", ".png"], ["image/jpeg", ".jpg"], ["image/webp", ".webp"],
  ["image/gif", ".gif"], ["image/svg+xml", ".svg"],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => cb(null, IMAGE_EXT.has(f.mimetype)),
});
app.post("/api/upload/*rest", upload.single("file"), (req, res) => {
  const tpl = findTemplate(segs(req.params.rest).join("/"));
  if (!tpl) return res.status(404).json({ error: "Template not found" });
  if (!req.file) return res.status(400).json({ error: "Upload a PNG, JPEG, WebP, GIF, or SVG" });
  const name = randomUUID() + IMAGE_EXT.get(req.file.mimetype);
  const persistent = path.join(ROOT, 'uploads', tpl.id);
  mkdirSync(persistent, { recursive: true });
  writeFileSync(path.join(persistent, name), req.file.buffer);
  // Write into every size so the same relative path resolves at any ratio.
  for (const size of tpl.sizes) {
    const dest = path.join(ROOT, size.dir, "assets");
    mkdirSync(dest, { recursive: true });
    writeFileSync(path.join(dest, name), req.file.buffer);
  }
  res.json({ path: "assets/" + name });
});

// ---------- export: PNG ----------
app.post("/api/export/png", async (req, res) => {
  const { id, suffix, variables = {}, scale } = req.body || {};
  const tpl = findTemplate(id); const size = findSize(tpl, suffix);
  if (!size) return res.status(404).json({ error: "Template not found" });
  const dsf = Math.min(Math.max(Number(scale) || CONFIG.render.scale, 1), 4);
  const rel = `exports/${tpl.name}-${suffix}-${randomUUID().slice(0, 8)}.png`;
  try {
    mkdirSync(OUT, { recursive: true });
    await shoot({ tpl, size, vars: variables, scale: dsf, file: path.join(ROOT, rel) });
    res.json({ url: "/" + rel });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- export: video (optional, needs hyperframes + ffmpeg) ----------
let activeRender = false;
app.post("/api/export/video", (req, res) => {
  const { id, suffix, variables = {}, transparent = false } = req.body || {};
  const tpl = findTemplate(id); const size = findSize(tpl, suffix);
  if (!size) return res.status(404).json({ error: "Template not found" });
  if (activeRender) return res.status(429).json({ error: "A render is already running." });
  activeRender = true;

  const stamp = randomUUID().slice(0, 8);
  const rel = `exports/${tpl.name}-${suffix}-${stamp}.${transparent ? "mov" : "mp4"}`;
  const varsFile = path.join(OUT, `vars-${stamp}.json`);
  writeFileSync(varsFile, JSON.stringify(transparent
    ? { ...variables, backgroundImage: "", backgroundTreatment: "none", bgColor: "transparent", gridOpacity: 0 } : variables));

  const args = ["hyperframes", "render", size.dir, "--variables-file", varsFile,
    "--output", rel, "--quality", CONFIG.render.quality, "--quiet"];
  if (transparent) args.push("--format", "mov");

  let child, timer, log = "", settled = false;
  const finish = (code, err) => {
    if (settled) return; settled = true;
    clearTimeout(timer); activeRender = false; rmSync(varsFile, { force: true });
    if (err) return res.status(500).json({ error: `${err.message}\n\nVideo export needs hyperframes + ffmpeg (see README).` });
    if (code === 0 && existsSync(path.join(ROOT, rel))) return res.json({ url: "/" + rel });
    res.status(500).json({ error: log.slice(-1500) || `exit ${code}` });
  };
  try {
    // Invoke the installed CLI through Node so spaces remain literal arguments.
    child = spawn(process.execPath, [HF, ...args.slice(1)], { cwd: ROOT, windowsHide: true });
  } catch (e) { return finish(null, e); }
  child.stdout.on("data", (d) => { log = (log + d).slice(-20000); });
  child.stderr.on("data", (d) => { log = (log + d).slice(-20000); });
  child.once("error", (e) => finish(null, e));
  child.once("close", (c) => finish(c));
  timer = setTimeout(() => { child.kill(); finish(null, new Error("Render timed out after 10 min")); }, 600000);
});

app.use((err, _req, res, _next) => res.status(400).json({ error: err.message || "Request failed" }));

app.listen(PORT, HOST, async () => {
  let n = 0; try { n = manifest().templates.length; } catch { /* not built yet */ }
  console.log(`\n  ${CONFIG.brand.name} → http://${HOST}:${PORT}`);
  console.log(`  ${n} template(s) loaded${n ? "" : "  (run: npm run build)"}\n`);
  await warmThumbs();
});
