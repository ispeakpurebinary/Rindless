<p align="center">
  <img src="Rindless/logo.png" width="72" alt="Rindless guava logo" />
</p>

<h1 align="center"><code>R I N D L E S S</code></h1>

<p align="center">A pixel-art Chrome extension for a cleaner web.</p>

---

## Features

Each feature can be turned on or off from the popup. Settings sync across Chrome.

### Hide AI Results

On Google Search, injects CSS and watches the page for AI Overview blocks as they load. Hides the summary so you see normal search results instead. Works on Google country domains and updates when you search without reloading the page.

### Reject Cookies

On sites you visit, looks for common cookie banner “Reject” / “Decline” buttons and clicks them automatically. If no known button is found, it scores visible buttons by text and clicks the best match. Runs for a few seconds after page load to catch late banners.

### Ad Blocker

Blocks network requests to known ad and tracker domains using bundled rules. On YouTube, also hides sponsored cards and skips or speeds through video ads when possible. **Reload the page** after toggling this on or off for network blocking to apply.

---

## Install (development)

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `Rindless` folder
5. Pin the extension from the puzzle icon

---

## Chrome Web Store

Download the latest release zip from the repo root (`rindless-v1.0.6.zip`) or install from the store once published.

---

## Privacy

Rindless does not collect or sell your data. See [PRIVACY.md](PRIVACY.md).

---

## Project structure

```
Rindless/
├── manifest.json
├── background.js
├── content-google.js    # Hide AI on Google Search
├── content-cookies.js   # Auto-reject cookie banners
├── content-youtube.js   # YouTube ad cleanup
├── popup.html / popup.js / popup.css
├── logo.png
└── rules/adblock_rules.json
```
