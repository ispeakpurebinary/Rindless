// Rindless background service worker — manages install defaults and adblock ruleset toggling

const DEFAULT_SETTINGS = {
  hideAI: true,
  hidePeopleAlsoAsk: false,
  rejectCookies: true,
  adblock: true,
};

// On first install, set default storage and enable adblock ruleset
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === "install") {
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
      await syncAdblockRuleset(true);
    } else {
      // Keep ruleset aligned with saved preference after updates
      const { adblock } = await chrome.storage.sync.get({ adblock: true });
      await syncAdblockRuleset(adblock);
    }
  } catch (err) {
    console.error("[Rindless] onInstalled error:", err);
  }
});

// Re-sync adblock ruleset with storage when the browser starts
chrome.runtime.onStartup.addListener(async () => {
  try {
    const { adblock } = await chrome.storage.sync.get({ adblock: true });
    await syncAdblockRuleset(adblock);
  } catch (err) {
    console.error("[Rindless] onStartup error:", err);
  }
});

// Listen for messages from the popup (e.g. adblock toggle)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "toggleAdblock") {
    handleToggleAdblock(message.enabled)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error("[Rindless] toggleAdblock error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // keep channel open for async sendResponse
  }
});

/**
 * Enable or disable the adblock declarativeNetRequest ruleset.
 * @param {boolean} enabled
 */
async function syncAdblockRuleset(enabled) {
  if (enabled) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ["adblock_rules"],
    });
  } else {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ["adblock_rules"],
    });
  }
}

async function handleToggleAdblock(enabled) {
  await syncAdblockRuleset(enabled);
}
