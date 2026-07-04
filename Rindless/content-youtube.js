// Rindless — YouTube cosmetic ad blocking (pairs with DNR rules)

const DEFAULT_SETTINGS = { adblock: true };

const YOUTUBE_AD_CSS = `
  ytd-display-ad-renderer,
  ytd-promoted-sparkles-web-renderer,
  ytd-ad-slot-renderer,
  ytd-banner-promo-renderer,
  ytd-in-feed-ad-layout-renderer,
  ytd-compact-promoted-video-renderer,
  ytd-promoted-video-renderer,
  ytd-rich-item-renderer:has(ytd-display-ad-renderer),
  #player-ads,
  .ytp-ad-module,
  .ytp-ad-overlay-slot,
  .ytp-ad-image-overlay,
  .ytp-ad-text-overlay,
  .ytp-ad-action-interstitial,
  .ytp-ad-preview-container {
    display: none !important;
  }
`;

const YOUTUBE_SKIP_SELECTORS = [
  ".ytp-ad-skip-button-modern",
  ".ytp-skip-ad-button",
  ".ytp-ad-skip-button",
  ".ytp-ad-skip-button-slot",
];

let ytStylesInjected = false;
let ytDebounceTimer = null;
let ytPlayerObserver = null;
let ytNavHooked = false;

function isYouTubePage() {
  return window === window.top && /(^|\.)youtube\.com$/.test(location.hostname);
}

function isVisible(element) {
  if (!element || element.offsetParent === null) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function injectYouTubeAdStyles() {
  if (ytStylesInjected || document.getElementById("rindless-yt-ads")) {
    ytStylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "rindless-yt-ads";
  style.textContent = YOUTUBE_AD_CSS;
  (document.head || document.documentElement)?.appendChild(style);
  ytStylesInjected = true;
}

function removeYouTubeAdblock() {
  document.getElementById("rindless-yt-ads")?.remove();
  ytStylesInjected = false;
  ytPlayerObserver?.disconnect();
  ytPlayerObserver = null;
}

function clickYouTubeSkipAd() {
  for (const selector of YOUTUBE_SKIP_SELECTORS) {
    const button = document.querySelector(selector);
    if (button && isVisible(button)) {
      button.click();
      return true;
    }
  }
  return false;
}

function speedThroughYouTubeAd() {
  const player = document.querySelector("#movie_player, .html5-video-player");
  if (!player?.classList.contains("ad-showing")) {
    return;
  }
  const video = player.querySelector("video");
  if (!video) {
    return;
  }
  if (video.playbackRate < 16) {
    video.playbackRate = 16;
  }
  video.muted = true;
}

function runYouTubeAdPass() {
  injectYouTubeAdStyles();
  clickYouTubeSkipAd();
  speedThroughYouTubeAd();
}

function scheduleYouTubeAdPass() {
  clearTimeout(ytDebounceTimer);
  ytDebounceTimer = setTimeout(runYouTubeAdPass, 400);
}

function watchYouTubePlayer() {
  ytPlayerObserver?.disconnect();
  const player = document.querySelector("#movie_player");
  if (!player) {
    return;
  }
  runYouTubeAdPass();
  ytPlayerObserver = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some((m) =>
      [...m.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE)
    );
    if (hasNewNodes || player.classList.contains("ad-showing")) {
      scheduleYouTubeAdPass();
    }
  });
  ytPlayerObserver.observe(player, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });
}

function hookYouTubeNavigation() {
  if (ytNavHooked) {
    return;
  }
  ytNavHooked = true;
  document.addEventListener("yt-navigate-finish", () => {
    injectYouTubeAdStyles();
    watchYouTubePlayer();
    setTimeout(runYouTubeAdPass, 500);
    setTimeout(runYouTubeAdPass, 2000);
  });
}

function initYouTubeAdblock() {
  if (!isYouTubePage()) {
    return;
  }
  injectYouTubeAdStyles();
  watchYouTubePlayer();
  hookYouTubeNavigation();
  setTimeout(runYouTubeAdPass, 1000);
  setTimeout(watchYouTubePlayer, 2000);
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  if (chrome.runtime.lastError) {
    console.error("[Rindless] storage read error:", chrome.runtime.lastError);
    return;
  }
  if (settings.adblock) {
    try {
      initYouTubeAdblock();
    } catch (err) {
      console.error("[Rindless] youtube adblock error:", err);
    }
  } else {
    try {
      removeYouTubeAdblock();
    } catch (err) {
      console.error("[Rindless] youtube adblock disable error:", err);
    }
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.adblock || !isYouTubePage()) {
    return;
  }
  try {
    if (changes.adblock.newValue) {
      initYouTubeAdblock();
    } else {
      removeYouTubeAdblock();
    }
  } catch (err) {
    console.error("[Rindless] youtube adblock storage change error:", err);
  }
});
