# Rindless Privacy Policy

**Last updated:** July 4, 2026

Rindless ("the Extension") is a browser extension that helps you hide Google AI summaries, auto-reject cookie banners, and block ads and trackers. This policy explains what data the Extension accesses and how it is handled.

## Summary

Rindless does **not** collect, sell, or transmit your personal data to any server operated by the developer. All features run locally in your browser.

## Data the Extension Stores

Rindless saves three on/off preferences using Chrome's built-in `chrome.storage.sync` API:

- Hide AI Results (on/off)
- Reject Cookies (on/off)
- Ad Blocker (on/off)

These are boolean settings only. They may sync across your Chrome profile if you use Chrome Sync. Rindless does not store browsing history, search queries, page content, or personally identifiable information.

## Data the Extension Accesses

To provide its features, Rindless may access web pages you visit:

- **Hide AI Results** — modifies Google Search pages to hide AI Overview sections.
- **Reject Cookies** — reads page DOM to find and click cookie banner reject/decline buttons.
- **Ad Blocker** — blocks network requests to known ad and tracker domains using rules bundled with the Extension; on YouTube, it may hide sponsored content and speed through video ads.

This processing happens on your device. Page data is not sent to the developer.

## Third-Party Services

The Extension popup loads the "Press Start 2P" font from Google Fonts (`fonts.googleapis.com`). Google may receive your IP address when that font is fetched, subject to [Google's Privacy Policy](https://policies.google.com/privacy). No other third-party analytics or tracking services are used by Rindless.

## Permissions

Rindless requests permissions necessary for its features:

- **storage** — save your toggle preferences
- **declarativeNetRequest / declarativeNetRequestWithHostAccess** — ad and tracker blocking
- **Host access (`<all_urls>`)** — run content features on pages you visit when toggles are enabled

## Children's Privacy

Rindless is not directed at children under 13 and does not knowingly collect data from children.

## Changes

This policy may be updated when the Extension changes. The "Last updated" date at the top will reflect the latest version.

## Contact

For privacy questions about Rindless, open an issue at:  
https://github.com/ispeakpurebinary/Rindless/issues
