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

/** Match google.com and country domains (google.co.uk, google.de, etc.) */
function isGoogleSearchPage() {
  const host = location.hostname;
  return (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host.startsWith("google.") ||
    /\.google\.[a-z.]+$/.test(host)
  );
}

// Selector battery — Google rotates these frequently; keep many fallbacks
const AI_OVERVIEW_SELECTORS = [
  'div[aria-label="AI Overview"]',
  'div[data-attrid="AIOverview"]',
  'div[data-attrid="overview"]',
  'div[data-async-type="aiOverview"]',
  'div[data-async-context*="ai_overview"]',
  'div[data-rl="ai_overview"]',
  "div#eKIzJc",
  "div.YzCcne[data-mcpr]",
  'div[data-mcp="18"]',
  '[data-attrid="wa:/description"]',
  'div[jsname="yEVEwb"]',
  'div[jsname="tJHJj"]',
  'div[jsname="N760b"]',
  ".AIOverview",
  "#abc_summary",
  "#m-x-content",
  ".YzCcne",
];

const AI_HIDE_CSS = [
  ...AI_OVERVIEW_SELECTORS.map(
    (sel) =>
      `${sel} { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }`
  ),
  '#rso div.ULSxyf:has(a[href*="ai_overviews"])',
  '#rso > div.MjjYud:has(a[href*="ai_overviews"])',
  '#rso > div.MjjYud:has(path[d^="M235.5 471"])',
  '#rcnt div[data-hveid] div:has(a[href*="ai_overviews"])',
  '#rcnt div[data-hveid] div:has([data-async-type="folsrch"])',
]
  .map((rule) => `${rule} { display: none !important; }`)
  .join("\n");

const AI_CONTAINER_CLOSEST =
  "div[data-mcpr], div.YzCcne, div#eKIzJc, div.MjjYud, div.ULSxyf, div[data-hveid], div[data-attrid]";

function injectAIHideStyles() {
  let style = document.getElementById("rindless-ai-hide");
  if (!style) {
    style = document.createElement("style");
    style.id = "rindless-ai-hide";
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(style);
    }
  }
  style.textContent = AI_HIDE_CSS;
}

function removeAIHideStyles() {
  document.getElementById("rindless-ai-hide")?.remove();
}

function hideElement(el) {
  if (!el || el.dataset.rindlessAiHidden) {
    return;
  }
  el.dataset.rindlessAiHidden = "true";
  el.style.setProperty("display", "none", "important");
  el.style.setProperty("visibility", "hidden", "important");
  el.style.setProperty("height", "0", "important");
  el.style.setProperty("overflow", "hidden", "important");
  el.style.setProperty("margin", "0", "important");
  el.style.setProperty("padding", "0", "important");
}

function hideByHeadingText() {
  document.querySelectorAll("h1, h2, h3").forEach((heading) => {
    const text = heading.textContent?.trim();
    if (!text || (!text.startsWith("AI Overview") && text !== "AI Overview")) {
      return;
    }
    const container =
      heading.closest(AI_CONTAINER_CLOSEST) ||
      heading.closest("div")?.parentElement?.closest("div");
    hideElement(container || heading);
  });
}

function hideByAIOverviewMarker() {
  document
    .querySelectorAll('a[href*="ai_overviews"], a[href*="p=ai_overviews"]')
    .forEach((link) => {
      const container =
        link.closest("#rso div.MjjYud, #rso div.ULSxyf, div[data-mcpr], div.YzCcne, div#eKIzJc") ||
        link.closest("div[data-hveid]")?.parentElement;
      hideElement(container || link.closest("div"));
    });
}

function hideAIOverviewElements() {
  for (const selector of AI_OVERVIEW_SELECTORS) {
    try {
      document.querySelectorAll(selector).forEach(hideElement);
    } catch (_err) {
      // skip invalid selector
    }
  }
  hideByHeadingText();
  hideByAIOverviewMarker();
}

let aiObserver = null;
let aiObserverDisconnectTimer = null;

function runAIHidePass() {
  injectAIHideStyles();
  hideAIOverviewElements();
}

function startAIHideObserver() {
  if (aiObserver) {
    aiObserver.disconnect();
    clearTimeout(aiObserverDisconnectTimer);
  }

  runAIHidePass();

  aiObserver = new MutationObserver(() => {
    try {
      runAIHidePass();
    } catch (err) {
      console.error("[Rindless] AI observer callback error:", err);
    }
  });

  const observeTarget = document.documentElement || document.body;
  if (observeTarget) {
    aiObserver.observe(observeTarget, { childList: true, subtree: true });
  }

  // Disconnect after 10 seconds to avoid memory leaks (restarted on SPA navigations)
  aiObserverDisconnectTimer = setTimeout(() => {
    aiObserver?.disconnect();
    aiObserver = null;
  }, 10000);
}

function scheduleDelayedAIHidePasses() {
  // AI Overview often loads asynchronously after the initial paint
  [300, 800, 1500, 3000, 5000, 8000, 12000, 18000].forEach((ms) => {
    setTimeout(runAIHidePass, ms);
  });
}

function watchGoogleSearchNavigation() {
  let lastUrl = location.href;

  const onNavigate = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      startAIHideObserver();
      scheduleDelayedAIHidePasses();
    }
  };

  window.addEventListener("popstate", onNavigate);

  const wrapHistory = (method) => {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      onNavigate();
      return result;
    };
  };

  wrapHistory("pushState");
  wrapHistory("replaceState");

  // Lightweight poll catches Google navigations that bypass history hooks
  const urlPoll = setInterval(onNavigate, 500);
  setTimeout(() => clearInterval(urlPoll), 120000);
}

function initHideGoogleAI() {
  if (!isGoogleSearchPage()) {
    return;
  }

  runAIHidePass();
  startAIHideObserver();
  scheduleDelayedAIHidePasses();
  watchGoogleSearchNavigation();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAIHidePass, { once: true });
  }
}

// Inject hide styles as early as possible on Google (before async storage read)
if (isGoogleSearchPage()) {
  try {
    injectAIHideStyles();
  } catch (_err) {
    // ignore — full init runs after storage resolves
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
  const runReject = () => {
    try {
      attemptCookieReject();
    } catch (err) {
      console.error("[Rindless] cookie reject error:", err);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runReject, { once: true });
  } else {
    runReject();
  }

  // Catch banners that appear after initial load
  const observer = new MutationObserver(() => {
    runReject();
  });

  const observeTarget = document.documentElement || document.body;
  if (observeTarget) {
    observer.observe(observeTarget, { childList: true, subtree: true });
  }

  // Disconnect after 8 seconds to avoid memory leaks
  setTimeout(() => observer.disconnect(), 8000);
}
