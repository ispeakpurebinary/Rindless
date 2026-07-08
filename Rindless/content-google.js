// Rindless — Google AI Overview / People Also Ask
// CSS-first. Avoid repeated full-DOM walks — those tank search page performance.

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

const AI_HIDE_CSS = `
  ${AI_HIDE_LIST.join(",\n  ")} {
    display: none !important;
  }
  ${AI_HIDE_LIST.map(
    (sel) =>
      `[data-initq] ${sel},\n  [data-q] ${sel},\n  .related-question-pair ${sel}`
  ).join(",\n  ")} {
    display: revert !important;
  }
`;

const PAA_HIDE_CSS = `
  .related-question-pair,
  [data-initq] {
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
  setStyle("rindless-ai-hide", currentSettings.hideAI ? AI_HIDE_CSS : "");
  setStyle(
    "rindless-paa-hide",
    currentSettings.hidePeopleAlsoAsk ? PAA_HIDE_CSS : ""
  );
}

function anyFeatureOn() {
  return currentSettings.hideAI || currentSettings.hidePeopleAlsoAsk;
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

/** Cheap pass: styles only. Google injects AI late — CSS still catches nodes. */
function runStylePass() {
  applyStyles();
}

function scheduleStylePass() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runStylePass, 500);
}

function startObserver() {
  stopObserver();
  if (!anyFeatureOn()) {
    return;
  }

  runStylePass();

  const root = document.querySelector("#center_col") || document.querySelector("#rcnt");
  if (!root) {
    // Body not ready yet — retry once
    timedPassTimers.push(setTimeout(startObserver, 400));
    return;
  }

  observer = new MutationObserver(() => {
    // Don't re-query the whole document — styles already hide matching nodes.
    // Only ensure our <style> tags still exist after SPA swaps.
    scheduleStylePass();
  });
  observer.observe(root, { childList: true, subtree: false });

  observerTimer = setTimeout(stopObserver, 8000);
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
    startObserver();
    timedPassTimers.push(setTimeout(runStylePass, 800));
    timedPassTimers.push(setTimeout(runStylePass, 2500));
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

  applyStyles();

  if (!anyFeatureOn()) {
    stopObserver();
    clearTimedPasses();
    return;
  }

  startObserver();
  watchNavigation();
  clearTimedPasses();
  timedPassTimers.push(setTimeout(runStylePass, 800));
  timedPassTimers.push(setTimeout(runStylePass, 2500));
}

if (isGoogleSearchPage()) {
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
