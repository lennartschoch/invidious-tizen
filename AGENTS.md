# AGENTS.md

Guidance for agents working in this repo. Read [`README.md`](README.md) first for
what the module is and how it is installed.

## Hard rules

**Never run `git commit` or `git push`** unless explicitly asked in that message.
Write files, stage nothing, report what changed, and let the human commit.
"Put this in the repo" means *write the file*.

**Commit message format** (when asked to commit): Conventional Commits, title
line only, no body. `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`,
`build:`, `perf:`, `test:`. Imperative, lower case, no trailing period.

**Keep the maintainer's private instance out of the repo.** The E2E default is a
public instance; `websiteURL` points at the picker, not at any instance.

**Keep `dist/` committed and in sync.** `dist/userScript.js` and
`dist/index.html` are build output, but TizenBrew (jsDelivr) and GitHub Pages
serve them straight from the repo. Run `npm run build` after touching `src/`.

**No secrets ever.** Nothing here needs one.

## What this is

A **TizenBrew `mods` module** for Samsung TVs. Two artifacts:

| Artifact | Source | Served by |
|---|---|---|
| Instance picker | `src/picker/index.html` | GitHub Pages, branch root (`dist/index.html`) |
| Userscript | `src/userscript/*.ts` | jsDelivr (`dist/userScript.js`) |

`package.json` is the TizenBrew manifest (`websiteURL`, `main`, `keys`).

**Flow:** TizenBrew loads `websiteURL` (the Pages picker) and evaluates `main`
in every new execution context. The picker saves the chosen instance in
`localStorage` (Pages origin) and redirects; because injection is per context,
the userscript lands on the instance too — this is the whole mechanism.

## Toolchain

TypeScript 7 native `tsc` (type-check), **esbuild** (bundle, `target=chrome69`),
**oxlint** (lint), **oxfmt** (format). All commands live in `package.json`
scripts; use those. `typescript-eslint` cannot run on TS 7 (peer `<6.1.0`) —
oxlint is the linter; adding ESLint back means dropping TS 7.

## Caveats that look removable but are not

| Thing | Why it must stay |
|---|---|
| `websiteURL` = the Pages picker | TizenBrew fixes `websiteURL` per module but injects `main` per execution context, which is what lets the picker hop cross-origin. Pointing it at an instance removes the chooser. |
| `evaluateScriptOnDocumentStart` absent | For `mods`, that path calls `Page.addScriptToEvaluateOnNewDocument({ expression })` (note: `expression`, not `source`) and skips the current document. The default per-context `Runtime.evaluate` is the one that works, and the one TizenTube/TizenPortal use. |
| `keys` = media keys only | TizenBrew registers each key with `tizen.tvinputdevice.registerKey` in a loop with **no error handling**: an unsupported key throws and aborts the module launch. Colour keys are intentionally absent for this reason and for YouTube-TV parity. |
| Picker on GitHub Pages | jsDelivr and Statically serve `.html` as `text/plain`, so the picker would render as source. A real static host is required; GitHub Pages with the Pages source set to the **branch root** serves `dist/index.html` (same as TizenPortal). |
| Instance stored on the Pages origin | The userscript runs on the instance origin and cannot read the Pages origin, so the picker is the single source of truth for the selected instance. |
| Picker probes before connecting | A `no-cors` fetch with a 5s abort; on failure it stays on the picker instead of dumping the user on an error page. |
| Picker uses `location.href` (assign) | Keeps the picker in history so **Back** returns to it. `location.replace` would strand the user. |
| Player context is narrow | Arrows steer the player only when fullscreen or focus is inside `.video-js`. On a watch page with nothing focused they navigate, so the sidebar/comments stay reachable. Widening this traps the user in the player. |
| Text-input guard | While focus is in an input/textarea/`contenteditable`, only Back is handled, so the TV keyboard works. Intercepting arrows there breaks typing. |
| Number keys → percentage | YouTube TV parity: `0–9` jump to 0–90%. Up/Down/OK reveal the player controls; volume stays on the TV's own keys. |
| Back precedence | fullscreen → `history.back()` (only when `pathname !== '/'`) → Tizen exit. Keep the order. |
| `PICKER_URL` hardcoded in `src/userscript/constants.ts` | The userscript has no way to discover its own origin; a fork/rename must update it. |
| `esbuild` target `chrome69` | Tizen 5.5 is Chromium 69. Raise the target only after verifying on the TV. |

The `/preferences` section is injected next to `form[action^="/preferences"]`
via its `.h-box`; it is coupled to Invidious markup
(`src/invidious/views/user/preferences.ecr` upstream). If the section stops
appearing, suspect a markup change there, not this repo.

## Verifying

- **Unit:** `npm test` — drives the built userscript in jsdom (element geometry
  stubbed through a `data-box` attribute) and the picker.
- **E2E:** `scripts/chrome69.sh up` (Apple `container`, macOS), then
  `npm run test:e2e`, then `scripts/chrome69.sh down`. This runs the real
  instance in **Chromium 69 with H.264**. Open-source Chromium 69 builds lack
  H.264, so playback checks only pass on the vendored Electron 4 build
  (`test/browser69/`). Software decode under Rosetta is slow — the harness polls
  rather than asserting on a fixed delay.
- **TV-only:** the `tizen.tvinputdevice` registration path cannot be exercised
  off-device. Confirm key handling on the TV itself.

## Conventions

- `src/userscript/` is small, single-purpose modules in arrow-function style
  with early returns; keep new code that shape and keep the `media` adapter as
  the only place that branches on `window.player` vs `<video>`.
- Prefer positive phrasing in comments and docs; keep them explaining *why*.
- `inv.nadeko.net` runs a Go-away CAPTCHA — expect it to challenge the webview;
  it is not a bug in the module.
