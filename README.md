# Asset Studio

A local-first, forkable template studio. You author **HTML templates**, it gives you
a **browser UI** to fill them in and export **branded PNGs and video** — deterministically,
on your own machine, with no per-asset cost and no design SaaS.

The idea: when you work with an LLM (Claude, GPT, Hermes) the output usually evaporates
into a chat log. Here, every good asset you make becomes a **reusable template in a library**
you own.

---

## How it actually works

There is no AI image model in the render path. It's deliberately boring and repeatable:

1. A template is an **HTML page** with blanks (`data-var-text`, `data-var-src`) and a
   declared list of variables.
2. `generate.mjs` stamps each template once per output size into `build/`, and writes
   `build/manifest.json`.
3. `server.mjs` serves a dashboard. When you export, it opens the page in **headless Chrome**
   and screenshots it (PNG) or renders it frame-by-frame (video).

Same input → same output, every time.

---

## Quick start

Requires Node.js 22 or newer. PNG export uses Chrome; video export also requires
HyperFrames, FFmpeg, and FFprobe.

```bash
npm install
npm run setup      # name it, pick your color, create your categories
npm start          # builds templates, then serves http://127.0.0.1:4800
```

Open the URL. Click a size chip to open the editor, change the text, hit **Download PNG**.

Prefer to have an LLM interview you and configure it? See **[ONBOARDING.md](ONBOARDING.md)**
— paste one prompt into Claude/GPT, then `npm run setup -- --paste`.

You can also skip setup entirely and just run `npm start` to poke at the three starter
templates first.

**Chrome**: the exporter needs a Chrome binary. It looks for one in this order —
`CHROME_PATH` env var → the Chrome that `hyperframes` caches → common system install paths.
If none is found, set it explicitly:

```bash
CHROME_PATH="/path/to/chrome" npm start
```

**Video export** is optional and needs `hyperframes` + `ffmpeg` installed. PNG export
(statics + carousels) needs neither beyond Chrome.

### Video export setup

`npm install` installs the optional HyperFrames package. FFmpeg and FFprobe are native
programs, so they should not be committed to this repository. Install the official or
package-manager build for your operating system, then restart the studio:

```powershell
# Windows (Windows Package Manager)
winget install --id Gyan.FFmpeg -e
```

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt update && sudo apt install -y ffmpeg
```

Verify the complete local setup with:

```bash
npm run doctor
```

HyperFrames is the renderer used by this studio's HTML video templates. Remotion is not
required. Add Remotion only in a separate React-based template workflow; installing it here
would add a second rendering system without improving these templates.

---

## Fork it in three steps

1. **`studio.config.json`** — set your brand name, handle, accent color, and fonts.
   Everything (dashboard, nav, templates) reads from here.
2. **`templates/`** — delete the starters, add your own. The folder decides the taxonomy:

   ```
   templates/<media>/<category>/<name>.html
             │       │
             │       └─ becomes a nav item under that media type
             └───────── must match a `media[].dir` in studio.config.json
   ```

   Add a folder → it appears in the sidebar. No code change.
3. `npm run build` → refresh.

---

## Commands

| Command | What it does |
|---|---|
| `npm run doctor` | Check Chrome launch and video dependencies |
| `npm run setup` | Configure your studio and seed categories |
| `npm run build` | Stamp templates into `build/` + write the manifest |
| `npm start` | Build, then serve |
| `npm run serve` | Serve without rebuilding |
| `npm run clean` | Drop `build/` and the thumbnail cache |

---

## Why it stays fast

The first version of this was clunky: the library page rendered a **live iframe per card**,
so opening it booted dozens of browsers-within-a-browser. Fixes now baked in:

- **Cards show cached PNG thumbnails**, not iframes. Live rendering happens only in the editor.
- **Thumbnails are keyed by template content hash** — edit one template and exactly one
  thumbnail regenerates. Served `immutable`, so repeat visits are free.
- **Thumbnails warm in the background at boot**, so the first real visit is instant.
- **The manifest is parsed once at build time** and held in memory (re-read only when its
  mtime changes). No HTML parsing per request.
- **One shared headless Chrome** for all exports, not one per render.
- **Lazy loading** — thumbnails fetch as cards scroll into view.

## Light + dark

The sun/moon switch sits top-right on both the dashboard and the editor. It follows your
**OS preference** until you pick a side, then remembers your choice (`localStorage`). The
theme is applied in `<head>` before first paint, so there's no flash of the wrong theme.

This is the **UI** theme only — it's independent of a template's own `theme` variable, so you
can design a dark poster while working in a light interface.

---

## Layout

```
studio.config.json     ← fork point: brand, nav taxonomy, sizes
generate.mjs           ← build step → build/ + manifest.json
server.mjs             ← dashboard, preview, export, caching
templates/
  _shared/             ← assets copied into every build (placeholder, logos)
  statics/posters/     ← media / category / template.html
  carousels/slides/
  video/overlays/
public/                ← dashboard + editor UI
build/                 ← generated (gitignored)
.cache/                ← thumbnails (gitignored)
exports/               ← your finished files (gitignored)
```

- **[ONBOARDING.md](ONBOARDING.md)** — set up your fork, by wizard or by LLM interview.
- **[TEMPLATE-GUIDE.md](TEMPLATE-GUIDE.md)** — how to author a template. Paste it to an LLM
  and it will write compliant templates for you.
- **[DEPLOY.md](DEPLOY.md)** — checklist for hosting this on a VPS instead of locally.

## Agent instructions and saved uploads

Give your agent [SKILL.md](SKILL.md) and [TEMPLATE-GUIDE.md](TEMPLATE-GUIDE.md). Claude Code also reads CLAUDE.md automatically. To register a project skill, copy SKILL.md to `.claude/skills/asset-studio/SKILL.md` (Claude Code) or `.agents/skills/asset-studio/SKILL.md` (Codex). Referenced documents are at the repository root.

Uploaded images live in gitignored `uploads/`. Builds copy them into each output size. Back up this folder with your templates. Rebuilding and cleaning generated files preserve it. Previously deleted uploads must be uploaded again.
