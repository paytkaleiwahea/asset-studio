# Asset Studio

Read the [practical user guide](USER-GUIDE.md) for the full create, save, export and share workflow.

**Downloaded the studio? Start here:** extract the folder and double-click
**Start Asset Studio.bat** on Windows. The launcher handles the first npm install,
starts the server and opens your browser. Requires Node.js 22+.
Keep its window open while working. [Mac/Linux and setup help → START-HERE.md](START-HERE.md)

**Your local creation studio.** Templates from GitHub can be copied into your
library and adapted to your brand. Sharing templates does not require hosting
the studio. See [importing and adapting templates](IMPORTING-TEMPLATES.md).

**Current access:** local-first, for agents with access to your checkout and running
server. A cloud chat cannot automatically reach your computer's `localhost`.
**Cloud access is planned for a future phase; no release date is set.** Advanced
users can self-host on a VPS today, with additional security and integration work.
See [cloud access and self-hosting](CLOUD-ACCESS.md) for the steps and current gaps.

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

For the guided launcher, run `node launch.mjs` from this folder. To reopen the
studio later, run the launcher again; a saved browser URL does not start the server.
Brand Settings includes a searchable Google Fonts catalog and suggested pairings.
Font names are bundled; font loading needs internet. The manual commands below
remain available.

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
2. **`templates/`** — keep the starters for seeding, and add your own. The folder decides the taxonomy:

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

Motion PNG exports and thumbnails use the timeline's final pose; the editor
preview continues playing. Draft edits are stored per browser tab for the current
session, including reloads and size changes. They are not a saved project shared
between tabs.

Give your agent [SKILL.md](SKILL.md) and [TEMPLATE-GUIDE.md](TEMPLATE-GUIDE.md). Claude Code reads CLAUDE.md, which points to the shared AGENTS.md instructions. Codex reads AGENTS.md when this checkout is its workspace. To register a project skill, copy SKILL.md to `.claude/skills/asset-studio/SKILL.md` (Claude Code) or `.agents/skills/asset-studio/SKILL.md` (Codex). Referenced documents are at the repository root.

Uploaded images live in gitignored `uploads/`. Builds copy them into each output size. Back up this folder with your templates. Rebuilding and cleaning generated files preserve it. Previously deleted uploads must be uploaded again.

## Make it your studio

On first launch, choose **Set up my brand** or **Skip for now**. You can always return through **Brand Settings** in the library or editor. Enter your name, handle, four hex colors, and heading/body fonts. The live starter preview updates before you save. Saving rebuilds brand-connected templates automatically and updates thumbnail cache keys. Existing asset drafts retain their overrides.

Font suggestions use Google Fonts and need internet access. Enter a Google Fonts family name, not a file path. Unknown or unavailable fonts use browser fallbacks; custom font uploads are not included. Background/text colors apply to the starters’ light theme; their dark theme is an explicit alternate palette. The shell keeps its light/dark interface theme and uses the brand accent colors.

The CLI setup and agent interview still use the same studio.config.json. Rebuild after editing the config directly. For the future media-library direction, see [ROADMAP.md](ROADMAP.md).

## Agent connection

The running local HTTP server is the connection for Claude Code or Codex. With filesystem and terminal access to this checkout, the agent can create templates, build them, inspect the API manifest, populate fields, and render assets. No Asset Studio MCP is bundled. A remote/cloud agent is not automatically connected to your local server.

Read [AGENT-WORKFLOW.md](AGENT-WORKFLOW.md) for the executable API example and Premiere/Resolve handoff. For use from another editing project, provide the absolute studio checkout path and its running URL. Exporting fills a template for that output; it does not create a saved editor draft.

## Lightweight editor preview

The editor defaults to a cached still with a maximum 640-pixel longest edge.
Use Play live preview for interactive HTML playback; switching tabs stops it.
PNG and video export settings are unchanged. Screenshots are serialized.
Startup thumbnail warming is off unless STUDIO_WARM_THUMBS=1.
New field values need a new still capture; cached previews live in .cache/ and
can be cleared with npm run clean. Live playback still uses the full template.


Editor changes are drafts until Save and preview is clicked. Downloads and live
playback use saved values. Saved values persist in this browser's local storage;
unsaved drafts remain per tab. Both are keyed by template, not output size.
Saving does not modify the source HTML or create a portable project file.


Repeated simultaneous requests for the same still preview share one capture.
The hidden screenshot browser closes after 60 idle seconds and relaunches on demand.
STUDIO_BROWSER_IDLE_MS can override that timeout (minimum 1000 milliseconds).
Video exports still use a separate renderer and can overlap screenshot work.

