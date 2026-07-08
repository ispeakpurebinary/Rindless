// Rindless — YouTube cosmetic ads (lightweight)
// Prefer CSS. Only wake JS when the player enters an ad state.

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

const SKIP_SELECTORS = [
  ".ytp-ad-skip-button-modern",
  ".ytp-skip-ad-button",
  ".ytp-ad-skip-button",
];

let stylesInjected = false;
let playerObserver = null;
let adTickTimer = null;
let navHooked = false;

function injectStyles() {
  if (stylesInjected || document.getElementById("rindless-yt-ads")) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "rindless-yt-ads";
  style.textContent = YOUTUBE_AD_CSS;
  (document.head || document.documentElement)?.appendChild(style);
  stylesInjected = true;
}

function removeYouTubeAdblock() {
  document.getElementById("rindless-yt-ads")?.remove();
  stylesInjected = false;
  playerObserver?.disconnect();
  playerObserver = null;
  clearInterval(adTickTimer);
  adTickTimer = null;
}

function handleActiveAd() {
  const player = document.querySelector("#movie_player");
  if (!player?.classList.contains("ad-showing")) {
    clearInterval(adTickTimer);
    adTickTimer = null;
    return;
  }

  for (const selector of SKIP_SELECTORS) {
    const button = document.querySelector(selector);
    if (button) {
      button.click();
      return;
    }
  }

  const video = player.querySelector("video");
  if (video) {
    if (video.playbackRate < 16) {
      video.playbackRate = 16;
    }
    video.muted = true;
  }
}

function onPlayerClassChange() {
  const player = document.querySelector("#movie_player");
  if (!player?.classList.contains("ad-showing")) {
    clearInterval(adTickTimer);
    adTickTimer = null;
    return;
  }
  handleActiveAd();
  if (!adTickTimer) {
    // Poll gently only while an ad is showing
    adTickTimer = setInterval(handleActiveAd, 700);
  }
}

function watchPlayer() {
  playerObserver?.disconnect();
  const player = document.querySelector("#movie_player");
  if (!player) {
    return;
  }

  playerObserver = new MutationObserver(onPlayerClassChange);
  // Class only — not subtree. Subtree watching is what made YouTube laggy.
  playerObserver.observe(player, {
    attributes: true,
    attributeFilter: ["class"],
  });
  onPlayerClassChange();
}

function hookNavigation() {
  if (navHooked) {
    return;
  }
  navHooked = true;
  document.addEventListener("yt-navigate-finish", () => {
    injectStyles();
    setTimeout(watchPlayer, 300);
  });
}

function initYouTubeAdblock() {
  injectStyles();
  watchPlayer();
  hookNavigation();
  // One delayed attach if player wasn't ready yet
  setTimeout(watchPlayer, 1500);
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  if (chrome.runtime.lastError) {
    return;
  }
  if (settings.adblock) {
    try {
      initYouTubeAdblock();
    } catch (err) {
      console.error("[Rindless] youtube adblock error:", err);
    }
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.adblock) {
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
