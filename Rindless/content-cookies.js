// Rindless — Auto-reject cookie consent banners

const DEFAULT_SETTINGS = { rejectCookies: true };

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

  runReject();

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

  setTimeout(() => observer.disconnect(), 8000);
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  if (chrome.runtime.lastError) {
    console.error("[Rindless] storage read error:", chrome.runtime.lastError);
    return;
  }
  if (settings.rejectCookies) {
    try {
      initAutoRejectCookies();
    } catch (err) {
      console.error("[Rindless] rejectCookies error:", err);
    }
  }
});
