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
  var VERSION = "0.1.0";
  var PICKER_URL = "https://lennartschoch.github.io/invidious-tizen/dist/index.html";

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
  var ensurePlayerFocusable = () => {
    const el = document.querySelector(".video-js");
    if (el && !el.getAttribute("tabindex")) el.setAttribute("tabindex", "0");
  };
  var focusPlayer = () => {
    const el = document.querySelector(".video-js") || video();
    if (!el) return false;
    if (!el.getAttribute("tabindex")) el.setAttribute("tabindex", "0");
    el.focus();
    return true;
  };

  // src/userscript/navigation.ts
  var FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex],[role="button"]';
  var isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return !style || style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
  };
  var focusables = () => {
    const found = document.querySelectorAll(FOCUSABLE);
    const out = [];
    for (let i = 0; i < found.length; i++) {
      const el = found[i];
      if (el.disabled) continue;
      if (el.getAttribute("tabindex") === "-1") continue;
      if (isVisible(el)) out.push(el);
    }
    return out;
  };
  var centerOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  var score = (from, to, dir) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const EPS = 4;
    if (dir === "left") return dx >= -EPS ? null : from.x - to.x + Math.abs(dy) * 2;
    if (dir === "right") return dx <= EPS ? null : to.x - from.x + Math.abs(dy) * 2;
    if (dir === "up") return dy >= -EPS ? null : from.y - to.y + Math.abs(dx) * 2;
    return dy <= EPS ? null : to.y - from.y + Math.abs(dx) * 2;
  };
  var moveFocus = (dir) => {
    const els = focusables();
    if (!els.length) return false;
    const active = document.activeElement;
    const current = active && active !== document.body && active !== document.documentElement ? active : null;
    if (!current) {
      els[0].focus();
      return true;
    }
    const origin = centerOf(current);
    let best = null;
    let bestScore = Infinity;
    for (const el of els) {
      if (el === current) continue;
      const s = score(origin, centerOf(el), dir);
      if (s !== null && s < bestScore) {
        bestScore = s;
        best = el;
      }
    }
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

  // src/userscript/keys.ts
  var isTextInput = (el) => {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || el.isContentEditable === true;
  };
  var isActivatable = (el) => {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "a" || tag === "button" || tag === "input" || tag === "select" || tag === "textarea" || el.getAttribute("role") === "button";
  };
  var onEnter = () => {
    if (inPlayerContext()) return revealControls();
    if (isActivatable(document.activeElement)) return false;
    if (hasMedia()) {
      focusPlayer();
      return revealControls();
    }
    return false;
  };
  var handleBack = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen();
      return true;
    }
    if (window.history && window.history.length > 1 && location.pathname !== "/") {
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
    if (isTextInput(document.activeElement) && code !== KEYS.BACK) return;
    let handled;
    const dir = ARROW[code];
    if (dir) {
      if (inPlayerContext()) {
        handled = dir === "left" ? seekBy(-10) : dir === "right" ? seekBy(10) : revealControls();
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
    ":focus{outline:3px solid #ff3b30 !important;outline-offset:2px;}",
    ".video-js:focus{outline:3px solid #ff3b30 !important;outline-offset:0;}",
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
