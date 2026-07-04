// Rindless — Hide Google AI Overview (Google domains only)

const DEFAULT_SETTINGS = { hideAI: true };

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

const AI_HIDE_CSS = `
  div[aria-label="AI Overview"],
  div[data-attrid="AIOverview"],
  div[data-attrid="overview"],
  div[data-async-type="aiOverview"],
  div[data-async-context*="ai_overview"],
  div[data-rl="ai_overview"],
  div#eKIzJc,
  div.YzCcne[data-mcpr],
  div[data-mcp="18"],
  div[jsname="yEVEwb"],
  div[jsname="tJHJj"],
  div[jsname="N760b"],
  .AIOverview,
  #abc_summary,
  #m-x-content,
  #rso div.ULSxyf:has(a[href*="ai_overviews"]),
  #rso > div.MjjYud:has(a[href*="ai_overviews"]),
  #rcnt div[data-hveid] div:has(a[href*="ai_overviews"]),
  #rcnt div[data-hveid] div:has([data-async-type="folsrch"]) {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
  }
`;

let aiStylesInjected = false;
let aiDebounceTimer = null;
let aiObserver = null;
let aiObserverDisconnectTimer = null;
let aiNavHooked = false;

function injectAIHideStyles() {
  if (aiStylesInjected || document.getElementById("rindless-ai-hide")) {
    aiStylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "rindless-ai-hide";
  style.textContent = AI_HIDE_CSS;
  (document.head || document.documentElement)?.appendChild(style);
  aiStylesInjected = true;
}

function removeAIHideStyles() {
  document.getElementById("rindless-ai-hide")?.remove();
  aiStylesInjected = false;
}

function hideAIOverviewFallback() {
  document.querySelectorAll("h1, h2, h3").forEach((heading) => {
    const text = heading.textContent?.trim();
    if (text !== "AI Overview" && !text?.startsWith("AI Overview")) {
      return;
    }
    const container = heading.closest(
      "div[data-mcpr], div.YzCcne, div#eKIzJc, div.MjjYud, div.ULSxyf"
    );
    if (container) {
      container.style.setProperty("display", "none", "important");
    }
  });
}

function runAIHidePass() {
  injectAIHideStyles();
  hideAIOverviewFallback();
}

function scheduleAIHidePass() {
  clearTimeout(aiDebounceTimer);
  aiDebounceTimer = setTimeout(runAIHidePass, 300);
}

function getAISearchRoot() {
  return document.querySelector("#rcnt") || document.querySelector("#center_col") || document.body;
}

function startAIHideObserver() {
  if (aiObserver) {
    aiObserver.disconnect();
    clearTimeout(aiObserverDisconnectTimer);
  }
  runAIHidePass();
  aiObserver = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some((m) =>
      [...m.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE)
    );
    if (hasNewNodes) {
      scheduleAIHidePass();
    }
  });
  const root = getAISearchRoot();
  if (root) {
    aiObserver.observe(root, { childList: true, subtree: true });
  }
  aiObserverDisconnectTimer = setTimeout(() => {
    aiObserver?.disconnect();
    aiObserver = null;
  }, 10000);
}

function watchGoogleSearchNavigation() {
  if (aiNavHooked) {
    return;
  }
  aiNavHooked = true;
  let lastUrl = location.href;
  const onNavigate = () => {
    if (location.href !== lastUrl && isGoogleSearchPage()) {
      lastUrl = location.href;
      injectAIHideStyles();
      startAIHideObserver();
      setTimeout(runAIHidePass, 1000);
      setTimeout(runAIHidePass, 3000);
    }
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

function initHideGoogleAI() {
  if (!isGoogleSearchPage()) {
    return;
  }
  injectAIHideStyles();
  runAIHidePass();
  startAIHideObserver();
  watchGoogleSearchNavigation();
  setTimeout(runAIHidePass, 1000);
  setTimeout(runAIHidePass, 3000);
  setTimeout(runAIHidePass, 6000);
}

if (isGoogleSearchPage()) {
  try {
    injectAIHideStyles();
  } catch (_err) {
    // full init runs after storage resolves
  }
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  if (chrome.runtime.lastError) {
    console.error("[Rindless] storage read error:", chrome.runtime.lastError);
    return;
  }
  if (settings.hideAI) {
    try {
      initHideGoogleAI();
    } catch (err) {
      console.error("[Rindless] hideAI error:", err);
    }
  } else {
    try {
      removeAIHideStyles();
    } catch (err) {
      console.error("[Rindless] hideAI disable error:", err);
    }
  }
});
