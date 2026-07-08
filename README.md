<p align="center">
  <img src="Rindless/logo.png" width="72" alt="Rindless guava logo" />
</p>

<h1 align="center"><code>R I N D L E S S</code></h1>

<p align="center">A pixel-art chrome extension for a less bothersome search experience</p>

---

Each feature can be turned on or off from the pop-up. Settings sync across Chrome.

### 1. Hide AI Results 

On Google Search, injects CSS and watches the page for AI Overview blocks as they load. Hides the summary so you see normal search results instead. Works on Google country domains and updates when you search without reloading the page.

<<<<<<< HEAD
### 2. Reject Cookies
=======
### Hide People Also Ask

Optional. Google’s “People also ask” section often embeds AI Overviews as answers. Leave this off to keep PAA visible; turn it on to hide the whole section.

### Reject Cookies
>>>>>>> 1b98267 (fixed slow loading)

On sites you visit, it looks for common cookie banner “Reject” / “Decline” buttons and clicks them automatically. If no known button is found, it scores visible buttons by text and clicks the best match. Runs for a few seconds after page load to catch late banners.

### 3. Ad Blocker

Blocks network requests to known ad and tracker domains using bundled rules. **Reload the page** after toggling this on or off for network blocking to apply.

---

## Chrome Web Store

Rindless is currently under review; the link will be added here when it's published.

---

## Privacy

Rindless does not collect or sell your data. See [PRIVACY.md](PRIVACY.md).

