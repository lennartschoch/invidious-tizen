"use strict";
(() => {
  // src/userscript/constants.ts
  var KEYS = {
    ENTER: 13,
    ESCAPE: 27,
    SPACE: 32,
    BACK: 10009,
    NUM_0: 48,
    NUM_9: 57,
    PLAY_PAUSE: 10252,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    REWIND: 412,
    FAST_FORWARD: 417
  };
  var ARROW = {
    37: "left",
    38: "up",
    39: "right",
    40: "down"
  };
  var VERSION = "0.1.3";
  var PICKER_URL = "https://lennartschoch.github.io/invidious-tizen/dist/index.html";

  // src/userscript/components/comment.ts
  var tagComments = () => {
    const rows = document.querySelectorAll(".comments .pure-g");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.getAttribute("data-itv-comment") === "1") continue;
      const kids = row.children;
      let isComment = false;
      for (let j = 0; j < kids.length; j++) {
        if (kids[j].classList.contains("channel-profile")) {
          isComment = true;
          break;
        }
      }
      if (!isComment) continue;
      row.setAttribute("data-itv-comment", "1");
      row.setAttribute("tabindex", "0");
    }
  };
  var commentRule = {
    prepare: tagComments,
    skip: (el) => {
      const comment = el.closest("[data-itv-comment]");
      return !!comment && comment !== el;
    }
  };
  var commentAuthor = (el) => {
    const comment = el && el.closest ? el.closest("[data-itv-comment]") : null;
    if (!comment) return null;
    return comment.querySelector(
      'a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]'
    );
  };

  // src/userscript/components/input.ts
  var isTextInput = (el) => {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || el.isContentEditable === true;
  };
  var inputArrowAllowed = (el, dir) => {
    if (el.tagName !== "INPUT") return false;
    if (dir === "up" || dir === "down") return true;
    if (dir !== "left" && dir !== "right") return false;
    const input = el;
    try {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const len = (input.value || "").length;
      return dir === "left" ? start === 0 && end === 0 : start === len && end === len;
    } catch {
      return false;
    }
  };

  // src/userscript/hint.ts
  var hintEl = null;
  var hintTimer;
  var showHint = (text) => {
    if (!hintEl) {
      hintEl = document.createElement("div");
      hintEl.className = "itv-hint";
      (document.body || document.documentElement).appendChild(hintEl);
    }
    hintEl.textContent = text;
    hintEl.classList.add("itv-show");
    if (hintTimer !== void 0) clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      if (hintEl) hintEl.classList.remove("itv-show");
    }, 1500);
  };

  // src/userscript/media.ts
  var player = () => {
    const p = window.player;
    return p && typeof p.play === "function" ? p : null;
  };
  var video = () => document.querySelector("video");
  var nudgeMouse = () => {
    const el = document.querySelector(".video-js") || video();
    if (!el) return;
    try {
      el.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    } catch {
    }
  };
  var media = () => {
    const p = player();
    if (p) {
      return {
        isPaused: () => p.paused(),
        play: () => p.play(),
        pause: () => p.pause(),
        time: () => p.currentTime(),
        seekTo: (s) => p.currentTime(s < 0 ? 0 : s),
        duration: () => typeof p.duration === "function" ? p.duration() : NaN,
        revealControls: () => {
          if (typeof p.userActive === "function") p.userActive(true);
          if (typeof p.controls === "function") p.controls(true);
          nudgeMouse();
        }
      };
    }
    const v = video();
    if (!v) return null;
    return {
      isPaused: () => v.paused,
      play: () => {
        void v.play();
      },
      pause: () => v.pause(),
      time: () => v.currentTime || 0,
      seekTo: (s) => {
        v.currentTime = s < 0 ? 0 : s;
      },
      duration: () => v.duration,
      revealControls: nudgeMouse
    };
  };
  var hasMedia = () => media() !== null;
  var play = () => {
    const m = media();
    if (!m) return false;
    m.play();
    return true;
  };
  var togglePlay = () => {
    const m = media();
    if (!m) return false;
    if (m.isPaused()) m.play();
    else m.pause();
    return true;
  };
  var pausePlayback = () => {
    const m = media();
    if (!m) return false;
    m.pause();
    return true;
  };
  var seekBy = (delta) => {
    const m = media();
    if (!m) return false;
    m.seekTo(m.time() + delta);
    showHint((delta > 0 ? "+ " : "") + delta + "s");
    return true;
  };
  var seekPercent = (tenths) => {
    const m = media();
    if (!m) return false;
    const duration = m.duration();
    if (!duration || !isFinite(duration)) return false;
    m.seekTo(tenths / 10 * duration);
    showHint(Math.round(tenths * 10) + "%");
    return true;
  };
  var revealControls = () => {
    const m = media();
    if (!m) return false;
    m.revealControls();
    return true;
  };
  var inPlayerContext = () => {
    if (document.fullscreenElement) return true;
    const el = document.activeElement;
    return !!(el && el.closest && el.closest(".video-js"));
  };
  var isFullscreen = () => {
    const p = player();
    if (p && typeof p.isFullscreen === "function") return !!p.isFullscreen();
    return !!document.fullscreenElement;
  };
  var requestFs = (el) => {
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (typeof request !== "function") return false;
    try {
      const result = request.call(el);
      if (result && typeof result.catch === "function") result.catch(() => {
      });
      return true;
    } catch {
      return false;
    }
  };
  var enterFullscreen = () => {
    const p = player();
    if (p && typeof p.requestFullscreen === "function") {
      try {
        p.requestFullscreen();
        return true;
      } catch {
      }
    }
    const el = document.querySelector(".video-js") || video();
    return el ? requestFs(el) : false;
  };
  var exitFullscreen = () => {
    const p = player();
    if (p && typeof p.isFullscreen === "function" && p.isFullscreen() && typeof p.exitFullscreen === "function") {
      p.exitFullscreen();
      return true;
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen();
      return true;
    }
    return false;
  };
  var ensurePlayerFocusable = () => {
    const el = document.querySelector(".video-js");
    if (el && el.getAttribute("tabindex") !== "0") el.setAttribute("tabindex", "0");
  };
  var focusPlayer = () => {
    const el = document.querySelector(".video-js") || video();
    if (!el) return false;
    if (el.getAttribute("tabindex") !== "0") el.setAttribute("tabindex", "0");
    el.focus();
    return true;
  };

  // src/userscript/components/player.ts
  var playerRule = {
    skip: (el) => {
      const player2 = el.closest(".video-js");
      return !!player2 && player2 !== el;
    }
  };

  // src/userscript/components/rail.ts
  var railScope = {
    scope: (el) => {
      let node = el.parentElement;
      while (node && node !== document.body) {
        if (node.querySelectorAll(".thumbnail a").length >= 2) return node;
        node = node.parentElement;
      }
      return null;
    }
  };

  // src/userscript/components/tile.ts
  var isSecondaryLink = (el) => {
    if (el.tagName !== "A") return false;
    let tile = el.parentElement;
    while (tile && tile !== document.body) {
      const thumbs = tile.querySelectorAll(".thumbnail a[href]");
      if (thumbs.length === 1) return thumbs[0] !== el;
      if (thumbs.length > 1) return false;
      tile = tile.parentElement;
    }
    return false;
  };
  var tileRule = { skip: isSecondaryLink };

  // src/userscript/components/index.ts
  var focusRules = [playerRule, commentRule, tileRule];
  var scopeRules = [railScope];

  // src/userscript/navigation/focus.ts
  var FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex],[role="button"]';
  var INTERACTIVE = 'a[href],button,input,select,textarea,[role="button"]';
  var isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return !style || style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
  };
  var focusables = (rules) => {
    var _a, _b, _c, _d;
    for (let r = 0; r < rules.length; r++) (_b = (_a = rules[r]).prepare) == null ? void 0 : _b.call(_a);
    const found = document.querySelectorAll(FOCUSABLE);
    const out = [];
    for (let i = 0; i < found.length; i++) {
      const el = found[i];
      if (el.disabled) continue;
      if (el.getAttribute("tabindex") === "-1" && !el.matches(INTERACTIVE)) continue;
      let skip = false;
      for (let r = 0; r < rules.length; r++) {
        if ((_d = (_c = rules[r]).skip) == null ? void 0 : _d.call(_c, el)) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
      if (isVisible(el)) out.push(el);
    }
    return out;
  };

  // src/userscript/navigation/geometry.ts
  var CROSS = 0.5;
  var score = (from, to, dir) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const EPS = 4;
    if (dir === "left") return dx >= -EPS ? null : from.x - to.x + Math.abs(dy) * CROSS;
    if (dir === "right") return dx <= EPS ? null : to.x - from.x + Math.abs(dy) * CROSS;
    if (dir === "up") return dy >= -EPS ? null : from.y - to.y + Math.abs(dx) * CROSS;
    return dy <= EPS ? null : to.y - from.y + Math.abs(dx) * CROSS;
  };
  var crosses = (from, to, dir) => {
    if (dir === "left" || dir === "right") {
      return Math.min(from.bottom, to.bottom) > Math.max(from.top, to.top);
    }
    return Math.min(from.right, to.right) > Math.max(from.left, to.left);
  };
  var nearest = (from, exclude, els, dir) => {
    const origin = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    let best = null;
    let bestScore = Infinity;
    for (const el of els) {
      if (el === exclude) continue;
      const rect = el.getBoundingClientRect();
      if (!crosses(from, rect, dir)) continue;
      const s = score(origin, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, dir);
      if (s !== null && s < bestScore) {
        bestScore = s;
        best = el;
      }
    }
    return best;
  };

  // src/userscript/navigation/index.ts
  var resolveScope = (el) => {
    for (let i = 0; i < scopeRules.length; i++) {
      const scope = scopeRules[i].scope(el);
      if (scope) return scope;
    }
    return null;
  };
  var moveFocus = (dir) => {
    const els = focusables(focusRules);
    if (!els.length) return false;
    const active = document.activeElement;
    const current = active && active !== document.body && active !== document.documentElement ? active : null;
    if (!current) {
      els[0].focus();
      return true;
    }
    const pool = els.filter((el) => el !== current);
    if (dir === "up" || dir === "down") {
      const scope = resolveScope(current);
      if (scope) {
        const bestInScope = nearest(
          current.getBoundingClientRect(),
          current,
          pool.filter((el) => scope.contains(el)),
          dir
        );
        if (bestInScope) {
          bestInScope.focus();
          return true;
        }
      }
    }
    const best = nearest(current.getBoundingClientRect(), current, pool, dir);
    if (!best) return false;
    best.focus();
    return true;
  };
  var moveFocusOutside = (container, dir) => {
    const els = focusables(focusRules).filter((el) => !container.contains(el));
    const best = nearest(container.getBoundingClientRect(), null, els, dir);
    if (!best) return false;
    best.focus();
    return true;
  };
  var installFocusScrolling = () => {
    document.addEventListener(
      "focusin",
      (e) => {
        const target = e.target;
        if (!(target instanceof Element) || !target.scrollIntoView) return;
        try {
          target.scrollIntoView({ block: "center", inline: "center" });
        } catch {
        }
      },
      true
    );
  };
  var installFullscreenExitFocus = () => {
    const onExit = () => {
      if (document.fullscreenElement) return;
      const player2 = document.querySelector(".video-js");
      const active = document.activeElement;
      if (player2 && active && player2.contains(active)) {
        moveFocusOutside(player2, "down");
      }
    };
    document.addEventListener("fullscreenchange", onExit, false);
    document.addEventListener("webkitfullscreenchange", onExit, false);
  };

  // src/userscript/keys.ts
  var isActivatable = (el) => {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "a" || tag === "button" || tag === "input" || tag === "select" || tag === "textarea" || el.getAttribute("role") === "button";
  };
  var onEnter = () => {
    const active = document.activeElement;
    const author = commentAuthor(active);
    if (author) {
      author.click();
      return true;
    }
    if (active && active.closest && active.closest(".vjs-big-play-button")) {
      enterFullscreen();
      play();
      return true;
    }
    if (isActivatable(active)) return false;
    if (document.fullscreenElement || isFullscreen()) return togglePlay();
    if (!hasMedia()) return false;
    focusPlayer();
    enterFullscreen();
    play();
    return true;
  };
  var handleBack = () => {
    if (exitFullscreen()) return true;
    if (window.history && window.history.length > 1) {
      window.history.back();
      return true;
    }
    try {
      if (typeof tizen !== "undefined" && tizen && tizen.application) {
        tizen.application.getCurrentApplication().exit();
        return true;
      }
    } catch {
    }
    return false;
  };
  var onKeyDown = (e) => {
    if (window.__invidiousPicker) return;
    const code = e.keyCode;
    const dir = ARROW[code];
    const active = document.activeElement;
    if (isTextInput(active) && code !== KEYS.BACK && !inputArrowAllowed(active, dir)) {
      return;
    }
    let handled;
    if (dir) {
      if (inPlayerContext()) {
        const player2 = document.querySelector(".video-js");
        const vertical = dir === "up" || dir === "down";
        const leave = vertical && !document.fullscreenElement && player2 ? moveFocusOutside(player2, dir) : false;
        handled = dir === "left" ? seekBy(-10) : dir === "right" ? seekBy(10) : leave || revealControls();
      } else {
        handled = moveFocus(dir);
      }
    } else {
      switch (code) {
        case KEYS.ESCAPE:
        case KEYS.BACK:
          handled = handleBack();
          break;
        case KEYS.ENTER:
          handled = onEnter();
          break;
        case KEYS.SPACE:
        case KEYS.PLAY_PAUSE:
        case KEYS.PLAY:
          handled = togglePlay();
          break;
        case KEYS.PAUSE:
        case KEYS.STOP:
          handled = pausePlayback();
          break;
        case KEYS.REWIND:
          handled = seekBy(-10);
          break;
        case KEYS.FAST_FORWARD:
          handled = seekBy(10);
          break;
        default:
          handled = code >= KEYS.NUM_0 && code <= KEYS.NUM_9 ? seekPercent(code - KEYS.NUM_0) : false;
      }
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  var installKeyHandler = () => {
    document.addEventListener("keydown", onKeyDown, true);
  };

  // src/userscript/log.ts
  var PREFIX = "[invidious-tizen]";
  var log = (...args) => {
    try {
      console.log(PREFIX, ...args);
    } catch {
    }
  };

  // src/userscript/preferences.ts
  var SECTION_ID = "itv-prefs";
  var injectPreferencesSection = () => {
    if (window.__invidiousPicker) return;
    if (location.pathname !== "/preferences") return;
    if (document.getElementById(SECTION_ID)) return;
    const form = document.querySelector('form[action^="/preferences"]');
    const box = form ? form.closest(".h-box") || form.parentElement : null;
    if (!box || !box.parentElement) return;
    const section = document.createElement("div");
    section.className = "h-box";
    section.id = SECTION_ID;
    section.innerHTML = '<div class="pure-form pure-form-aligned"><fieldset><legend>Invidious Tizen</legend><div class="pure-controls"><button id="itv-picker-open" type="button" class="pure-button pure-button-primary">Open instance picker</button></div></fieldset></div>';
    box.parentElement.insertBefore(section, box.nextSibling);
    const button = section.querySelector("#itv-picker-open");
    button.addEventListener("click", () => {
      window.location.href = PICKER_URL + "?pick=1";
    });
  };
  var schedulePreferencesSection = () => {
    if (document.body) injectPreferencesSection();
    else document.addEventListener("DOMContentLoaded", injectPreferencesSection, false);
  };

  // src/userscript/styles.ts
  var STYLES = [
    ":focus{outline:3px solid #fff !important;outline-offset:2px;}",
    // Invidious puts the theme class on <body>; ring white on dark, near-black on
    // light so it stays visible either way. The picker is dark and unclassed.
    ".light-theme :focus{outline-color:#111 !important;}",
    // Invidious video thumbnails are inline links whose only content is a block
    // <img>. An inline box with no line box paints no outline, so the ring above
    // silently disappears; make the link a block while focused.
    ".thumbnail a:focus{display:block;}",
    ".video-js:focus{outline:3px solid #fff !important;outline-offset:0;}",
    ".light-theme .video-js:focus{outline-color:#111 !important;}",
    ".itv-hint{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;",
    "background:rgba(0,0,0,.82);color:#fff;font:600 18px/1.4 sans-serif;",
    "padding:10px 16px;text-align:center;pointer-events:none;opacity:0;",
    "transition:opacity .15s ease;}",
    ".itv-hint.itv-show{opacity:1;}"
  ].join("");
  var injectStyles = () => {
    const style = document.createElement("style");
    style.id = "itv-style";
    style.appendChild(document.createTextNode(STYLES));
    (document.head || document.documentElement).appendChild(style);
  };

  // src/userscript/index.ts
  var init = () => {
    if (document.getElementById("itv-style")) return;
    injectStyles();
    installKeyHandler();
    installFocusScrolling();
    installFullscreenExitFocus();
    ensurePlayerFocusable();
    document.addEventListener("DOMContentLoaded", ensurePlayerFocusable, false);
    schedulePreferencesSection();
    log(`v${VERSION} active on ${location.pathname}`);
  };
  if (!window.__invidiousTizen) {
    window.__invidiousTizen = true;
    if (document.documentElement) init();
    else document.addEventListener("DOMContentLoaded", init, false);
  }
})();
