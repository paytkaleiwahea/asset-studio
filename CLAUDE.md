# Asset Studio: rules for agents

You are working inside a template library, not a scratch folder.

## The one rule

**Every asset you make becomes a template in `templates/`.** Never write a
one-off HTML file to the repo root, to a temp folder, or into a chat message.
If a person asked for "a stat card," the deliverable is a reusable stat-card
template with variables, installed in the library, visible in the dashboard.

An asset that only exists in a conversation is a failed deliverable here. That
is the entire reason this repo exists.

## Where it goes

```
templates/<media>/<category>/<name>.html
```

`<media>` must match a `media[].dir` in `studio.config.json`. Today that is
`statics`, `carousels`, or `video`. `<category>` is any folder name you like;
creating a new folder adds a nav item automatically, with no code change.

Name files in kebab-case after what they do, not what they are for:
`stat-counter.html`, not `q4-launch-card.html`. Templates are reused; campaigns
are not.

## The required loop

Do all four steps. Stopping after step 2 leaves the library unchanged.

1. Read `TEMPLATE-GUIDE.md` if you have not already this session. It is the
   contract and it is not optional.
2. Write the template to the path above.
3. Run `npm run build`. This stamps the template once per output size into
   `build/` and rewrites `build/manifest.json`. **Until this runs, the template
   does not exist to the dashboard.**
4. Confirm the template appears in `build/manifest.json`, then tell the person
   its name and which category it landed in.

If the studio is already serving, `npm start` reruns the build and serves at
`http://127.0.0.1:4800`.

## The contract, in brief

Full details in `TEMPLATE-GUIDE.md`. The parts that are easy to forget:

- Declare variables in `data-composition-variables` on `<html>`. That JSON drives
  the whole editor UI. Types are `string`, `color`, `enum`.
- Root element carries `data-composition-id`, `data-width="{{WIDTH}}"`,
  `data-height="{{HEIGHT}}"`, `data-duration` (0 for stills, seconds for video).
- Use the stamped `{{WIDTH}}`, `{{HEIGHT}}`, `{{LABEL}}` tokens. Never hardcode
  canvas pixels.
- Bind with `data-var-text` and `data-var-src`. Read values in script through
  `window.__studio?.getVariables?.()`.
- Any variable id containing image, img, photo, logo, or shot gets an upload
  button for free.

## Traps that have already cost real hours

1. **Do not expose `bgColor` or `textColor` as variables on a themed template.**
   Declared variables are written as inline styles on `#root`, and inline styles
   beat class rules, so the theme toggle silently stops working. Expose only
   `accentColor`. Let the theme own the rest as plain custom properties.
2. **Do not put `data-var-text` on an element you parse at runtime.** The preview
   re-stamps those elements after your inline script runs and overwrites your
   child elements with the raw string. Read the value through `getVariables()`
   instead.
3. **Do not build SVG with `document.createElement`.** It produces an inert HTML
   element that never paints. Use
   `document.createElementNS("http://www.w3.org/2000/svg", tag)`. Also, text
   inside a `clip-path` shape gets cropped: put the clipped shape in one element
   and the text in an unclipped sibling above it.

## Brand and config

Never hardcode a color, font, or canvas size into a template. Everything comes
from `studio.config.json`, which is the one file a forker edits to rebrand the
whole studio. If you need a value that is not in there, add it to the config and
read it, rather than inlining it.

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | First-run wizard: name, color, categories |
| `npm run build` | Stamp templates into `build/`, rewrite the manifest |
| `npm start` | Build, then serve the dashboard on port 4800 |
| `npm run serve` | Serve without rebuilding |
| `npm run clean` | Drop `.cache/` and `build/` |

## Do not

- Commit anything from `build/`, `.cache/`, `exports/`, or `node_modules/`.
- Add an AI image model to the render path. Rendering is deliberately
  deterministic: same input, same output, every time.
- Put client or personal creative in `templates/`. Starter templates shipped
  here stay generic so the repo remains forkable.
