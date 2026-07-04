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

/** Map storage keys to checkbox elements and header health bars */
const TOGGLE_MAP = [
  { key: "hideAI", input: hideAIInput, health: document.getElementById("health-hideAI") },
  { key: "rejectCookies", input: rejectCookiesInput, health: document.getElementById("health-rejectCookies") },
  { key: "adblock", input: adblockInput, health: document.getElementById("health-adblock") },
];

function updateHealthBars() {
  for (const { input, health } of TOGGLE_MAP) {
    if (!health) {
      continue;
    }
    health.classList.toggle("is-on", input.checked);
    health.classList.toggle("is-off", !input.checked);
  }
}

function applySettings(settings) {
  for (const { key, input } of TOGGLE_MAP) {
    if (input) {
      input.checked = Boolean(settings[key]);
    }
  }
  updateHealthBars();
  document.body.classList.remove("loading");
}

function loadSettings() {
  try {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      if (chrome.runtime.lastError) {
        console.error("[Rindless] popup storage read error:", chrome.runtime.lastError);
        applySettings(DEFAULT_SETTINGS);
        return;
      }
      applySettings(settings);
    });
  } catch (err) {
    console.error("[Rindless] popup init error:", err);
    applySettings(DEFAULT_SETTINGS);
  }
}

// Run immediately — DOMContentLoaded can miss in extension popups
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadSettings, { once: true });
} else {
  loadSettings();
}

// Fallback if storage never responds
setTimeout(() => {
  if (document.body.classList.contains("loading")) {
    applySettings(DEFAULT_SETTINGS);
  }
}, 300);

// Persist each toggle change to chrome.storage.sync
for (const { key, input } of TOGGLE_MAP) {
  input.addEventListener("change", () => {
    const value = input.checked;
    updateHealthBars();

    chrome.storage.sync.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        console.error("[Rindless] popup storage write error:", chrome.runtime.lastError);
      }
    });

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
