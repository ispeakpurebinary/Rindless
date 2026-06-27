// Rindless popup — load settings before interaction, persist toggle changes

const DEFAULT_SETTINGS = {
  hideAI: true,
  rejectCookies: true,
  adblock: true,
};

const hideAIInput = document.getElementById("hideAI");
const rejectCookiesInput = document.getElementById("rejectCookies");
const adblockInput = document.getElementById("adblock");
const togglesContainer = document.getElementById("toggles");

/** Map storage keys to checkbox elements */
const TOGGLE_MAP = [
  { key: "hideAI", input: hideAIInput },
  { key: "rejectCookies", input: rejectCookiesInput },
  { key: "adblock", input: adblockInput },
];

// Prevent flicker: keep body.loading until storage is read and checkboxes are set
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (chrome.runtime.lastError) {
      console.error("[Rindless] popup storage read error:", chrome.runtime.lastError);
      settings = DEFAULT_SETTINGS;
    }

    for (const { key, input } of TOGGLE_MAP) {
      input.checked = Boolean(settings[key]);
    }

    togglesContainer.hidden = false;
    document.body.classList.remove("loading");
  });
});

// Persist each toggle change to chrome.storage.sync
for (const { key, input } of TOGGLE_MAP) {
  input.addEventListener("change", () => {
    const value = input.checked;
    chrome.storage.sync.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        console.error("[Rindless] popup storage write error:", chrome.runtime.lastError);
      }
    });

    // Notify background when adblock toggle changes
    if (key === "adblock") {
      chrome.runtime.sendMessage(
        { action: "toggleAdblock", enabled: value },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Rindless] toggleAdblock message error:", chrome.runtime.lastError);
            return;
          }
          if (response && !response.success) {
            console.error("[Rindless] toggleAdblock failed:", response.error);
          }
        }
      );
    }
  });
}
