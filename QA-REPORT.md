# Asset Studio regression QA

Tested 2026-09-11 on Windows, Node 24.14.0, HyperFrames 0.8.34,
FFmpeg/FFprobe 8.1 and Headless Chrome 152.0.7977.30.

## Passed

- PNG, MP4 and transparent MOV exports from a repository directory containing
  spaces, using a template filename that also contains a space. The export
  regression sequence, including rebuild and upload checks, took 45.069 seconds.
- Inspected extracted video frames at two seconds: filled Line 2 and Caption
  appear; blank Line 2 and Caption disappear; the uploaded purple background
  appears in MP4. Transparent MOV excludes the background and grid.
- Decoded MOV alpha values span 0 to 255, with 2,025,056 fully transparent pixels
  out of 2,073,600 pixels at the inspected frame.
- Uploaded image survives rebuilding and exists at every output size. A legacy
  upload stored only in build/ migrates into uploads/ and survives rebuilding.
- PNG export with the server bound to HOST=0.0.0.0 uses loopback successfully.
- Encoded apostrophe in a variable label parses correctly. An unescaped
  apostrophe fails the build with the template path and encoding guidance.
- Setup with no starter examples preserves originals and hides them in the
  build. Running setup again seeds a new category. Paste mode defaults dir to id;
  invalid directory input fails without changing the config.
- Doctor launches Chrome, reports all installed dependencies, and exits with
  failure for a missing explicit CHROME_PATH.
- HyperFrames check of the wide motion starter: no runtime, layout, motion or
  contrast failures. One existing warning: the stage has no editable element ID.

## Reviewed in source

Dashboard cards use their first output size's aspect ratio. Category count says
"in this view". README and CLAUDE command tables include doctor; README includes
setup and instructions for discovering/registering the root skill. Starter and
authoring documents use the HyperFrames variable API with a studio fallback.
MIT LICENSE added. Uploaded images remain gitignored and need separate backups.

## Not verified

Interactive browser QA was blocked by automatic approval review reporting an
account usage limit. Size-switch draft persistence was reviewed in existing code,
but was not interactively re-tested in this round. Docker itself and IPv6 binding
were not tested; the wildcard IPv4 binding was tested locally.

Malformed templates now fail loudly, but the build still regenerates build/
in place. Fix the reported template and rebuild before using the studio again.

## Repeat setup check

Run `node tests/setup-regression.mjs` from the repository root. This creates an
isolated fixture in the operating system temporary directory and does not change
your studio configuration or templates.
