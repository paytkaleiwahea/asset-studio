# Asset Studio agent instructions

This repository is a reusable template library with a local HTTP rendering API.
Read AGENT-WORKFLOW.md when selecting, populating, rendering, or handing off an
asset. Read TEMPLATE-GUIDE.md before creating or changing a template.

## Choose the appropriate workflow

- **Import a shared template:** read IMPORTING-TEMPLATES.md. Stage the source
  outside the library, inspect it, then create a uniquely named local category
  containing selected templates and their dependencies. Never overlay a downloaded
  repository onto the checkout or replace local brand configuration. Adapt the
  local copy; record its source revision. Updates must be compared, not blindly copied.

- **Use an existing template:** inspect the running server's /api/manifest,
  select a real template ID and size suffix, send field overrides to its export
  endpoint, and verify the returned file. Do not create another template merely
  to change text for one export.
- **Create a reusable design:** author templates/<media>/<category>/<name>.html,
  run npm run build, and confirm the new template appears in the manifest.
  Name it after its reusable form, such as lower-third.html.
- **Place an asset in an edit:** render it, then use the user's separately
  connected Premiere or Resolve tools. Inspect their actual capabilities first;
  do not assume a particular MCP supports importing, track selection, or timing.

## Connection and environment

The agent needs access to this checkout and a terminal or HTTP client on the
same machine as the server. These instructions do not install an MCP, grant
filesystem permissions, or connect a remote agent to localhost.

Find the checkout by studio.config.json and generate.mjs. Read the configured
server address or the running server's startup output; do not assume that a
server on port 4800 is this checkout. Probe /api/manifest before using it. If it
is not running, run npm start from this checkout and use its printed URL.
Do not start a second server when the correct one is already running.

## Brand and template contract

- Use brandKey for inheritable variable defaults and data-brand-fonts for
  heading/body fonts, as documented in TEMPLATE-GUIDE.md. Preserve deliberate
  per-asset overrides and independent templates.
- Editable fields belong in data-composition-variables. Canvas tokens are
  {{WIDTH}}, {{HEIGHT}}, and {{LABEL}}. Motion templates follow HyperFrames.
- Use window.__hyperframes?.getVariables?.() ?? window.__studio?.getVariables?.()
  ?? {} for inline variable logic.
- On themed templates, avoid inline bgColor/textColor overrides that defeat
  theme CSS. The starters use brandPaper/brandInk for the light-theme defaults.
- Rendering fills templates deterministically; do not add an image-generation
  model to the rendering path.

## Verification and handling files

Building makes a new template discoverable; rendering produces an export.
Verify the appropriate result instead of reporting success after writing a file.
For motion changes, inspect a rendered frame as well as file metadata.
Only claim timeline placement after the editor tools confirm it.

Preserve user templates, uploaded files, and existing edits. Do not commit
build/, exports/, uploads/, .cache/, node_modules/, temporary builds, or private
client assets to the public starter kit. A build is not a request to publish.

Useful commands: npm start; npm run serve; npm run build; npm run doctor;
npm run setup. Brand Settings is available at /settings.html.
