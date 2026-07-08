// Rindless — Auto-reject cookie consent banners (lightweight)
// Runs on every http(s) page — keep work minimal to avoid slowing the browser.

const DEFAULT_SETTINGS = { rejectCookies: true };

const COOKIE_REJECT_SELECTORS = [
  "#onetrust-reject-all-handler",
  "#CybotCookiebotDialogBodyButtonDecline",
  "#reject-all-btn",
  "[data-testid='uc-deny-all-button']",
  "[aria-label*='Reject' i]",
  "[aria-label*='Decline' i]",
  "button[id*='reject' i]",
  "button[class*='reject' i]",
  "button[id*='decline' i]",
  "button[class*='decline' i]",
];

const REJECT_KEYWORDS = ["reject", "decline", "necessary", "essential", "only"];
const ACCEPT_KEYWORDS = ["accept all", "agree", "allow all", "accept cookies"];

const OBSERVE_MS = 5000;
const DEBOUNCE_MS = 600;
const FALLBACK_MAX_ATTEMPTS = 2;

function isVisible(element) {
  if (!element) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function clickElement(element) {
  if (!element || !isVisible(element)) {
    return false;
  }
  try {
    element.click();
    return true;
  } catch (_err) {
    return false;
  }
}

function tryKnownRejectSelectors() {
  for (const selector of COOKIE_REJECT_SELECTORS) {
    try {
      const el = document.querySelector(selector);
      if (el && clickElement(el)) {
        return true;
      }
    } catch (_err) {
      // skip bad selector
    }
  }
  return false;
}

function scoreButtonText(text) {
  const lower = text.toLowerCase().trim();
  if (!lower || lower.length > 48) {
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
      score -= 4;
    }
  }
  return score;
}

/** Expensive path — run sparingly, not on every DOM mutation */
function tryFallbackRejectByText() {
  const buttons = document.querySelectorAll("button, [role='button']");
  let bestButton = null;
  let bestScore = 0;
  const limit = Math.min(buttons.length, 80);

  for (let i = 0; i < limit; i++) {
    const button = buttons[i];
    if (!isVisible(button)) {
      continue;
    }
    const score = scoreButtonText(button.textContent || "");
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

function initAutoRejectCookies() {
  let done = false;
  let debounceTimer = null;
  let fallbackAttempts = 0;

  const finish = (observer) => {
    done = true;
    clearTimeout(debounceTimer);
    observer?.disconnect();
  };

  const tryCheap = () => {
    if (done) {
      return true;
    }
    return tryKnownRejectSelectors();
  };

  const tryWithOptionalFallback = () => {
    if (done) {
      return;
    }
    if (tryCheap()) {
      finish(observer);
      return;
    }
    if (fallbackAttempts < FALLBACK_MAX_ATTEMPTS) {
      fallbackAttempts += 1;
      if (tryFallbackRejectByText()) {
        finish(observer);
      }
    }
  };

  const scheduleCheapOnly = () => {
    if (done) {
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (tryCheap()) {
        finish(observer);
      }
    }, DEBOUNCE_MS);
  };

  let observer = null;

  // Immediate cheap attempt + one delayed fallback
  if (tryCheap()) {
    return;
  }
  setTimeout(tryWithOptionalFallback, 1200);

  observer = new MutationObserver((mutations) => {
    if (done) {
      return;
    }
    // Ignore tiny text-only churn; only react when elements appear
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        scheduleCheapOnly();
        return;
      }
    }
  });

  const root = document.documentElement;
  if (root) {
    observer.observe(root, { childList: true, subtree: true });
  }

  setTimeout(() => finish(observer), OBSERVE_MS);
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  if (chrome.runtime.lastError || !settings.rejectCookies) {
    return;
  }
  try {
    initAutoRejectCookies();
  } catch (err) {
    console.error("[Rindless] rejectCookies error:", err);
  }
});
