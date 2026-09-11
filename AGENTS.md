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
| Picker has its own D-pad navigation | `window.__invidiousPicker` makes the userscript leave the picker's keys alone, so the picker's `moveFocus` (a copy of `src/userscript/navigation.ts`) is the only thing that moves focus there. Do not delete it as duplication. |
| Player context is narrow | Arrows steer the player only when fullscreen or focus is inside `.video-js`. `←/→` seek; `↑`/`↓` call `moveFocusOutside` to reach the page content above/below (otherwise the D-pad is trapped in the player). In fullscreen `↑`/`↓` both reveal controls since there is nowhere to go. |
| Player `tabindex` must be forced to 0 | video.js unconditionally sets `tabindex="-1"` on `.video-js` (and the inner `<video>`) to keep it out of the browser tab order. `ensurePlayerFocusable` promotes it to 0 so the D-pad can land on the player; "only set when absent" silently leaves it unreachable. |
| OK enters fullscreen from the watch page | `onEnter` enters fullscreen (`video.js` `requestFullscreen`, else the Fullscreen API) and plays, on the player and on the `.vjs-big-play-button` overlay; in fullscreen it toggles play/pause. Other player controls (control bar) are left to the browser. Do not go back to swallowing OK. |
| Leaving fullscreen returns focus to the page | `installFullscreenExitFocus` moves focus out of `.video-js` on `fullscreenchange` (`moveFocusOutside` down), so after Back the D-pad browses the page instead of seeking the video. |
| Text-input guard | Text fields are focused **read-only** so the TV keyboard only opens on demand (`installInputDeferral`): OK once starts editing (drop read-only, re-focus), OK again submits the form (`submit`). While focus is in a field only Back plus the input rules are handled. On a single-line `<input>` `↑`/`↓` always leave and `←`/`→` leave once the caret is at that edge; never intercept Left/Right mid-text or any arrow in a textarea. |
| `tabindex="-1"` is not a skip signal for interactive nodes | Invidious marks video thumbnails and some channel links `tabindex="-1"` to keep them out of the browser tab order. `navigation.ts` keeps them by only skipping `tabindex="-1"` on non-interactive nodes (`INTERACTIVE`). A blanket skip makes thumbnails unreachable; the e2e asserts reachability. |
| Theme is pinned light | `theme.ts` forces `body.light-theme` on load: the TV's Chromium 69 force-darkens pages, so Invidious' light theme renders as a usable dark while its dark theme goes near-black. Because the class and the painted theme can disagree, the focus ring is **two-tone** (white line + `#111` shadow) rather than switched by `.light-theme`; do not key the ring off the theme class. |
| One focus stop per video tile | A tile is the nearest ancestor holding **exactly one** `.thumbnail a`; `navigation.ts` skips the tile's title/channel/icon links so the D-pad moves tile to tile. Do not key this off `.h-box`: the related-videos rail is a single `.h-box` with many tiles, so that would collapse the whole rail to one stop. |
| Cross-axis overlap is required | `nearest` rejects candidates that do not genuinely overlap the current element on the cross axis. Without it, `→` at the end of a feed row picks the Popular/Trending tab that merely touches the row. Keep the cross-axis penalty gentle (`CROSS` in `geometry.ts`): with overlap already required, a heavy penalty makes `↓` skip the first row to a lower x-aligned link (e.g. a channel result's name instead of its thumbnail). |
| Player is one stop | `focusables` skips everything inside `.video-js` except the root, so the control bar and big play button are not D-pad stops; the whole player is the single stop, and OK enters fullscreen/plays (`keys.ts`). |
| Fullscreen control bar is a mode | `components/player.ts` tracks `watching`/`controls`/`scrub`/`menu`. In fullscreen `↓` opens the bar; it hides again after 2s of no input. Items come from `.vjs-control-bar` in **DOM order** (not a hardcoded list) so `←/→` runs left-to-right, and contained duplicates are dropped because some items repeat their class on a wrapper and its inner button (captions). Non-button items get `tabindex=-1` before focus. The volume item only mutes/unmutes (no slider); the progress item is a `scrub` mode where `←/→` skip and `OK`/`Back` return to the bar (the +10/-10 overlay is suppressed there). Share and playback-rate are excluded (share is pointless on TV; this build's rate menu never opens); captions is included but `menuItems` drops its `vjs-texttrack-settings` entry (the big settings dialog). The fullscreen item exits. `←/→` only seek in `watching`; `OK` there toggles play/pause. |
| Screens own default focus | `screens/<name>.ts` matches a pathname and returns the element to focus on load (`installScreenDefaultFocus` runs on `DOMContentLoaded`/`load`, only if the user has not focused something). Watch → the player; feed/search/channel → the first result (first D-pad stop in the results grid, whatever its type). Add a screen by dropping a module in `screens/` and listing it in `screens/index.ts` (order matters). |
| Comments are one stop | Each `.comments .pure-g` with a direct `.channel-profile` gets `tabindex=0` + `data-itv-comment`; its inner links are skipped and OK opens the author's channel (`keys.ts`). Coupled to Invidious markup. |
| Related-videos rail scopes Up/Down | When focus is on a thumbnail, `moveFocus` restricts `↑`/`↓` to the nearest ancestor with ≥2 thumbnails, so the rail walks item-to-item instead of jumping into the middle column. Falls back to global movement at the ends. |
| Focused card link needs `display:block` | A video thumbnail is an inline `<a>` whose only content is a block `<img>` (a channel-card avatar likewise wraps a block `<center>`), so a `:focus` outline on it paints nothing (no line box). `styles.ts` sets `.thumbnail a:focus` and `.h-box > a:focus` to `display:block` so the ring shows. The ring is a white line over an `#111` shadow. Remove it and the D-pad works but the user sees no highlight on those tiles. |
| Number keys → percentage | YouTube TV parity: `0–9` jump to 0–90%. Up/Down/OK reveal the player controls; volume stays on the TV's own keys. |
| Back precedence | fullscreen → `history.back()` whenever there is history (including at `/`) → Tizen exit only with no history. The old `pathname !== '/'` guard exited the app on Invidious' root; do not reintroduce it. |
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
  instance in **Chromium 69 with H.264**. Open-source Chromium 69 lacks H.264, so
  playback checks only pass on the vendored Electron 4 build (`test/browser69/`).
  It defaults to the host arch — on Apple Silicon that is native arm64 (Electron
  ships `linux-arm64` Chromium 69 + H.264), so video decodes without Rosetta;
  `ARCH=amd64` reproduces the slow Rosetta path. `/dev/shm` is tiny in the
  container, so `--disable-dev-shm-usage` is required or the renderer crashes
  mid-decode. There is no sound card; the ALSA errors are harmless (do not point
  ALSA at a `null` device — with no timing, Chromium's audio clock runs free and
  video plays at several times speed).
- **Playground:** `npm run playground --instance <host>` (after `chrome69.sh up`)
  streams that same Chromium 69 to `http://localhost:7331` and forwards
  keyboard-only CDP input, so navigation can be tried by hand on the real engine.
  `test/playground.mjs`.
- **TV-only:** the `tizen.tvinputdevice` registration path cannot be exercised
  off-device. Confirm key handling on the TV itself.

## Conventions

- `src/userscript/` is small, single-purpose modules in arrow-function style
  with early returns; keep new code that shape and keep the `media` adapter as
  the only place that branches on `window.player` vs `<video>`.
- Navigation is split: `registry.ts` (typed `Component`/`Screen`), `navigation/`
  (`geometry.ts` scoring/overlap, `focus.ts` the stop-set pipeline over
  components, `index.ts` `moveFocus` + installers), `components/<name>.ts` and
  `screens/<name>.ts`. A `Component` declares a `selector` plus optional
  `prepare`/`skip`/`scope`/`key` hooks; a `Screen` declares a `route` plus
  `defaultFocus`. The runtime finds a component with `querySelector(selector)`
  and checks focus with `activeElement.closest(selector)`; `keys.ts` dispatches
  to the matching component's `key` hook (order in `components/index.ts` is
  precedence) and otherwise falls back to base handling. Prefer adding a
  component/screen module over new branches in `keys.ts`.
- Prefer positive phrasing in comments and docs; keep them explaining *why*.
- `inv.nadeko.net` runs a Go-away CAPTCHA — expect it to challenge the webview;
  it is not a bug in the module.
