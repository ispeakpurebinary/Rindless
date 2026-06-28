// Rindless content script — hide Google AI, auto-reject cookies (each feature isolated)

const DEFAULT_SETTINGS = {
  hideAI: true,
  rejectCookies: true,
  adblock: true,
};

// Read settings and run enabled features independently
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
  } else if (isGoogleSearchPage()) {
    try {
      removeAIHideStyles();
    } catch (err) {
      console.error("[Rindless] hideAI disable error:", err);
    }
  }

  if (settings.rejectCookies) {
    try {
      initAutoRejectCookies();
    } catch (err) {
      console.error("[Rindless] rejectCookies error:", err);
    }
  }
});

// ---------------------------------------------------------------------------
// Feature 1: Hide Google AI Results
// ---------------------------------------------------------------------------

/** Google search results only, top frame only (avoids work in every iframe) */
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

// CSS handles hiding — no repeated DOM walks needed for these selectors
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

/** Lightweight DOM fallback for headings/markers CSS cannot catch */
function hideAIOverviewFallback() {
  document.querySelectorAll('h1, h2, h3').forEach((heading) => {
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

  // A few timed passes for async AI injection — not a continuous poll
  setTimeout(runAIHidePass, 1000);
  setTimeout(runAIHidePass, 3000);
  setTimeout(runAIHidePass, 6000);
}

// Inject CSS immediately on search pages (before async storage read)
if (isGoogleSearchPage()) {
  try {
    injectAIHideStyles();
  } catch (_err) {
    // full init runs after storage resolves
  }
}

// ---------------------------------------------------------------------------
// Feature 2: Auto-Reject Cookie Consent Banners
// ---------------------------------------------------------------------------

const COOKIE_REJECT_SELECTORS = [
  "#onetrust-reject-all-handler",
  "#CybotCookiebotDialogBodyButtonDecline",
  '[aria-label*="Reject"]',
  'button[id*="reject"]',
  'button[class*="reject"]',
];

const REJECT_KEYWORDS = ["reject", "decline", "necessary", "essential"];
const ACCEPT_KEYWORDS = ["accept", "agree", "allow"];

function isVisible(element) {
  if (!element || element.offsetParent === null) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function scoreButtonText(text) {
  const lower = text.toLowerCase().trim();
  if (!lower) {
    return 0;
  }

  let score = 0;
  for (const keyword of REJECT_KEYWORDS) {
    if (lower.includes(keyword)) {
      score += 2;
    }
  }
  for (const keyword of ACCEPT_KEYWORDS) {
    if (lower.includes(keyword)) {
      score -= 3;
    }
  }
  return score;
}

function clickElement(element) {
  if (!element || !isVisible(element)) {
    return false;
  }
  try {
    element.click();
    return true;
  } catch (err) {
    console.error("[Rindless] click error:", err);
    return false;
  }
}

function tryKnownRejectSelectors() {
  for (const selector of COOKIE_REJECT_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (clickElement(el)) {
          return true;
        }
      }
    } catch (_err) {
      // skip invalid selector
    }
  }
  return false;
}

function tryFallbackRejectByText() {
  const buttons = Array.from(document.querySelectorAll("button")).filter(isVisible);
  let bestButton = null;
  let bestScore = 0;

  for (const button of buttons) {
    const score = scoreButtonText(button.textContent || button.innerText || "");
    if (score > bestScore) {
      bestScore = score;
      bestButton = button;
    }
  }

  if (bestButton && bestScore > 0) {
    return clickElement(bestButton);
  }
  return false;
}

function attemptCookieReject() {
  if (tryKnownRejectSelectors()) {
    return true;
  }
  return tryFallbackRejectByText();
}

function initAutoRejectCookies() {
  let cookieRejectDone = false;
  let cookieDebounceTimer = null;

  const runReject = () => {
    if (cookieRejectDone) {
      return;
    }
    try {
      if (attemptCookieReject()) {
        cookieRejectDone = true;
      }
    } catch (err) {
      console.error("[Rindless] cookie reject error:", err);
    }
  };

  const scheduleReject = () => {
    clearTimeout(cookieDebounceTimer);
    cookieDebounceTimer = setTimeout(runReject, 300);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runReject, { once: true });
  } else {
    runReject();
  }

  // Catch banners that appear after initial load (debounced, stops after success)
  const observer = new MutationObserver((mutations) => {
    if (cookieRejectDone) {
      return;
    }
    const hasNewNodes = mutations.some((m) =>
      [...m.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE)
    );
    if (hasNewNodes) {
      scheduleReject();
    }
  });

  const observeTarget = document.body || document.documentElement;
  if (observeTarget) {
    observer.observe(observeTarget, { childList: true, subtree: true });
  }

  // Disconnect after 8 seconds to avoid memory leaks
  setTimeout(() => observer.disconnect(), 8000);
}
