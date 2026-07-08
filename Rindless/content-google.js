// Rindless — Google AI Overview / People Also Ask
// CSS-first where possible; PAA need a light JS find (heading text is the stable signal).

const DEFAULT_SETTINGS = {
  hideAI: true,
  hidePeopleAlsoAsk: false,
};

function isGoogleSearchPage() {
  if (window !== window.top) {
    return false;
  }
  const host = location.hostname;
  const isGoogleHost =
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host.startsWith("google.") ||
    /\.google\.[a-z.]+$/.test(host);
  return isGoogleHost && location.pathname.startsWith("/search");
}

const AI_HIDE_LIST = [
  'div[aria-label="AI Overview"]',
  'div[data-attrid="AIOverview"]',
  'div[data-async-type="aiOverview"]',
  'div[data-async-context*="ai_overview"]',
  'div[data-rl="ai_overview"]',
  "div#eKIzJc",
  "div.YzCcne[data-mcpr]",
  'div[data-mcp="18"]',
  ".AIOverview",
  "#abc_summary",
];

/** Top AI Overview only — used when PAA section is left visible */
function buildAiHideCss(allowPaaAiAnswers) {
  let css = `
  ${AI_HIDE_LIST.join(",\n  ")} {
    display: none !important;
  }
`;
  if (allowPaaAiAnswers) {
    css += `
  ${AI_HIDE_LIST.map(
    (sel) =>
      `[data-initq] ${sel},\n  [data-q] ${sel},\n  .related-question-pair ${sel}`
  ).join(",\n  ")} {
    display: revert !important;
  }
`;
  }
  return css;
}

const PAA_HIDE_CSS = `
  .related-question-pair,
  [data-initq],
  div[jsname="Cpkphb"] {
    display: none !important;
  }
`;

let currentSettings = { ...DEFAULT_SETTINGS };
let navHooked = false;
let observer = null;
let observerTimer = null;
let debounceTimer = null;
let timedPassTimers = [];

function setStyle(id, css) {
  let style = document.getElementById(id);
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    (document.head || document.documentElement)?.appendChild(style);
  }
  if (style.textContent !== css) {
    style.textContent = css;
  }
}

function applyStyles() {
  const allowPaaAi = currentSettings.hideAI && !currentSettings.hidePeopleAlsoAsk;
  setStyle(
    "rindless-ai-hide",
    currentSettings.hideAI ? buildAiHideCss(allowPaaAi) : ""
  );
  setStyle(
    "rindless-paa-hide",
    currentSettings.hidePeopleAlsoAsk ? PAA_HIDE_CSS : ""
  );
}

function anyFeatureOn() {
  return currentSettings.hideAI || currentSettings.hidePeopleAlsoAsk;
}

function clearPaaInlineHides() {
  document.querySelectorAll("[data-rindless-paa-hidden]").forEach((el) => {
    delete el.dataset.rindlessPaaHidden;
    el.style.removeProperty("display");
    el.style.removeProperty("visibility");
    el.style.removeProperty("height");
    el.style.removeProperty("overflow");
    el.style.removeProperty("margin");
    el.style.removeProperty("padding");
  });
}

function hideNode(el) {
  if (!el || el.dataset.rindlessPaaHidden) {
    return;
  }
  el.dataset.rindlessPaaHidden = "true";
  el.style.setProperty("display", "none", "important");
  el.style.setProperty("visibility", "hidden", "important");
  el.style.setProperty("height", "0", "important");
  el.style.setProperty("overflow", "hidden", "important");
  el.style.setProperty("margin", "0", "important");
  el.style.setProperty("padding", "0", "important");
}

/**
 * Find the outer People Also Ask block via the stable "People also ask" heading,
 * then hide that whole result card (not just inner rows).
 */
function hidePeopleAlsoAskSections() {
  if (!currentSettings.hidePeopleAlsoAsk) {
    return;
  }

  const roots = document.querySelectorAll(
    "#rso > div, #rso div.MjjYud, #rso div.ULSxyf, #center_col div.MjjYud, #center_col div.ULSxyf"
  );

  roots.forEach((block) => {
    if (block.dataset.rindlessPaaHidden) {
      return;
    }
    // Only check a thin slice of text — full textContent of huge trees is expensive
    const probe = block.querySelector("h2, [role='heading'], span");
    const headingText = (probe?.textContent || "").trim().toLowerCase();
    if (
      headingText === "people also ask" ||
      headingText === "people also search for"
    ) {
      hideNode(block);
      return;
    }
    if (
      block.querySelector(
        ".related-question-pair, [data-initq], [jsname='Cpkphb']"
      )
    ) {
      // Prefer the outermost result card in #rso
      const card =
        block.closest("#rso > div") ||
        block.closest("div.MjjYud, div.ULSxyf") ||
        block;
      hideNode(card);
    }
  });

  // Heading-first fallback if Google wraps PAA differently
  document.querySelectorAll("h2, [role='heading']").forEach((heading) => {
    const text = (heading.textContent || "").trim().toLowerCase();
    if (text !== "people also ask" && text !== "people also search for") {
      return;
    }
    const card =
      heading.closest("#rso > div") ||
      heading.closest("div.MjjYud, div.ULSxyf") ||
      heading.parentElement?.parentElement;
    hideNode(card);
  });
}

function stopObserver() {
  observer?.disconnect();
  observer = null;
  clearTimeout(observerTimer);
  observerTimer = null;
  clearTimeout(debounceTimer);
  debounceTimer = null;
}

function clearTimedPasses() {
  timedPassTimers.forEach(clearTimeout);
  timedPassTimers = [];
}

function runHidePass() {
  applyStyles();
  if (currentSettings.hidePeopleAlsoAsk) {
    hidePeopleAlsoAskSections();
  } else {
    clearPaaInlineHides();
  }
}

function scheduleHidePass() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runHidePass, 400);
}

function startObserver() {
  stopObserver();
  if (!anyFeatureOn()) {
    return;
  }

  runHidePass();

  const root =
    document.querySelector("#rso") ||
    document.querySelector("#center_col") ||
    document.querySelector("#rcnt");
  if (!root) {
    timedPassTimers.push(setTimeout(startObserver, 400));
    return;
  }

  observer = new MutationObserver(() => {
    scheduleHidePass();
  });
  // childList on #rso is enough — PAA is injected as a sibling result block
  observer.observe(root, { childList: true, subtree: true });

  observerTimer = setTimeout(stopObserver, 10000);
}

function watchNavigation() {
  if (navHooked) {
    return;
  }
  navHooked = true;

  let lastUrl = location.href;
  const onNavigate = () => {
    if (location.href === lastUrl || !isGoogleSearchPage()) {
      return;
    }
    lastUrl = location.href;
    if (!anyFeatureOn()) {
      return;
    }
    clearTimedPasses();
    clearPaaInlineHides();
    startObserver();
    timedPassTimers.push(setTimeout(runHidePass, 800));
    timedPassTimers.push(setTimeout(runHidePass, 2500));
  };

  window.addEventListener("popstate", onNavigate);
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      onNavigate();
      return result;
    };
  }
}

function applyFeatureState() {
  if (!isGoogleSearchPage()) {
    return;
  }

  if (!anyFeatureOn()) {
    setStyle("rindless-ai-hide", "");
    setStyle("rindless-paa-hide", "");
    clearPaaInlineHides();
    stopObserver();
    clearTimedPasses();
    return;
  }

  startObserver();
  watchNavigation();
  clearTimedPasses();
  timedPassTimers.push(setTimeout(runHidePass, 800));
  timedPassTimers.push(setTimeout(runHidePass, 2500));
}

if (isGoogleSearchPage() && DEFAULT_SETTINGS.hidePeopleAlsoAsk) {
  try {
    applyStyles();
  } catch (_err) {
    // storage init below
  }
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  if (chrome.runtime.lastError) {
    return;
  }
  currentSettings = {
    hideAI: Boolean(settings.hideAI),
    hidePeopleAlsoAsk: Boolean(settings.hidePeopleAlsoAsk),
  };
  try {
    applyFeatureState();
  } catch (err) {
    console.error("[Rindless] google features error:", err);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !isGoogleSearchPage()) {
    return;
  }
  let changed = false;
  if (changes.hideAI) {
    currentSettings.hideAI = Boolean(changes.hideAI.newValue);
    changed = true;
  }
  if (changes.hidePeopleAlsoAsk) {
    currentSettings.hidePeopleAlsoAsk = Boolean(changes.hidePeopleAlsoAsk.newValue);
    changed = true;
  }
  if (changed) {
    try {
      applyFeatureState();
    } catch (err) {
      console.error("[Rindless] google features storage change error:", err);
    }
  }
});
