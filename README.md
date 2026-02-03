# Social Media Saver

A Chrome extension that captures social media posts and either saves them locally or publishes them to your own blog or site. When you browse Facebook, Twitter/X, LinkedIn, or Instagram, a Save button appears on each post. One click captures the text, images, author info, and metadata. The content is stored in your browser's local IndexedDB and, if you have configured a publishing destination, automatically queued for posting to WordPress, Drupal, a Micropub endpoint, or any custom webhook. You can browse, search, and export your saved content at any time from the extension's built-in viewer.

## Why this extension exists

Social media algorithms decide which posts you see and which disappear. Good content gets buried, important voices get equal or less visibility regardless of quality, and once a post scrolls off the feed it is effectively gone. This extension puts you back in control: every post you want to keep is one click away from being saved permanently on your own device, and optionally republished to a platform you own — your WordPress blog, your Drupal site, your personal Micropub feed, or any endpoint that accepts a webhook. Your content, your terms.

## Supported Platforms

| Platform | Status |
|---|---|
| Facebook (feed + profile timelines) | Supported |
| Twitter / X | Supported |
| LinkedIn | Supported |
| Instagram | Supported |
| TikTok | Planned |
| Reddit | Planned |
| Pinterest | Planned |

## How It Works

1. The extension injects a content script into supported social media pages.
2. The content script detects posts using platform-specific DOM selectors and injects a Save button next to each post's action row.
3. When you click Save, the extractor pulls the post text, images, author details, and engagement metrics out of the DOM.
4. The extracted content is sent to the background service worker via Chrome message passing, which writes it to IndexedDB via Dexie.
5. If a default publishing destination is configured (WordPress, Drupal, Micropub, or a webhook), the post is automatically added to the publish queue. The queue manager retries on failure and updates the post status once it is live.
6. You view everything later through the Saved Content page in the extension options.

## Tech Stack

- **Runtime** — Chrome Extension Manifest V3 (service worker background)
- **Language** — TypeScript (strict)
- **UI** — React 18 (popup + options pages)
- **Styling** — Tailwind CSS
- **Storage** — Dexie.js (IndexedDB wrapper)
- **Build** — Webpack 5
- **HTML Sanitisation** — DOMPurify
- **Markdown conversion** — Turndown

## Project Structure

```
src/
├── background/          # MV3 service worker — message handling, save queue
├── content/
│   ├── extractors/      # Per-platform post detection + content extraction
│   │   ├── base-extractor.ts   # Abstract base: button injection, save flow, ID generation
│   │   ├── facebook.ts         # Facebook-specific selectors and comment filtering
│   │   ├── twitter.ts          # Twitter / X
│   │   ├── instagram.ts        # Instagram
│   │   └── linkedin.ts         # LinkedIn
│   ├── ui/              # Injected button styles (content.css)
│   └── utils/           # Shared content-script helpers
├── lib/
│   ├── storage/         # IndexedDB (Dexie) and chrome.storage wrappers
│   ├── queue/           # Save-queue manager with retry strategy
│   ├── publishers/      # Remote-destination publishers (WordPress, Drupal, Micropub, Webhook)
│   └── utils/           # Crypto, logging, message-passing, validators
├── options/             # Options page (React app)
│   ├── pages/           # Saved Content, Destinations, Platforms, Advanced, About
│   └── components/      # Shared option-page components
├── popup/               # Popup (React app) — status, recent saves, quick nav
├── types/               # Shared TypeScript interfaces
└── assets/              # Extension icons
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Google Chrome (or a Chromium-based browser)

### Install Dependencies

```bash
cd social-media-saver
npm install
```

### Build

```bash
npm run build
```

The compiled extension is output to `dist/`.

### Load in Chrome

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist/` folder inside the project.
5. The extension icon appears in the toolbar. Pin it if you like.

### Development (Watch Mode)

```bash
npm run dev
```

Webpack re-bundles on every file change. Reload the extension in `chrome://extensions` after each rebuild to pick up content-script changes. Popup and options pages hot-reload automatically because they run as extension pages.

### Lint & Format

```bash
npm run lint          # check
npm run lint:fix      # auto-fix
npm run format        # prettier
```

## Contributing

Contributions are welcome. Whether it is a new platform extractor, a bug fix, a UI improvement, or documentation — all are appreciated.

### Where to Start

| Area | What to look at |
|---|---|
| New platform support | Copy an existing extractor in `src/content/extractors/`, extend `BaseExtractor`, register it in `extractors/index.ts` |
| Facebook / timeline fixes | `src/content/extractors/facebook.ts` — selectors change frequently; sample HTML files in the repo root help with testing |
| Saved-content viewer | `src/options/pages/SavedContent.tsx` |
| Storage / export | `src/lib/storage/indexeddb.ts` |
| Save queue / retry logic | `src/lib/queue/` |
| Publishing destinations | `src/lib/publishers/` — each file is one destination type; extend `BasePublisher` for a new one |

### Contribution Guidelines

1. **Fork and branch.** Create a feature or fix branch off `main`. Use a short descriptive name, e.g. `fix/facebook-timeline-comments` or `feat/reddit-extractor`.

2. **Keep changes focused.** One logical change per pull request. A bug fix does not need surrounding refactors; a new feature does not need unrelated cleanups.

3. **Follow existing patterns.** New extractors should extend `BaseExtractor` and override only the methods they need. Match the coding style of the file you are editing rather than reformatting it.

4. **Run the checks before pushing.**
   ```bash
   npm run lint
   npm run format
   npm run build     # make sure it compiles cleanly
   ```

5. **Test manually.** Platform DOMs change constantly and automated selectors break. Load the extension in Chrome, visit the relevant platform, and confirm the Save button appears and content is captured correctly. If the repo contains a sample HTML for that platform, use it to verify your selectors in Node with jsdom before submitting.

6. **Document what changed and why.** A clear PR description is more useful than a long commit message. Include the platform, the symptom you observed, and a brief explanation of why your fix works.

7. **No new dependencies without justification.** The bundle is already shipped inside a browser extension. If a small utility can be written in a few lines, prefer that over adding a package.

### Reporting Bugs

Open an issue with:
- The platform and page type (e.g. Facebook main feed, Facebook profile timeline).
- What you expected to happen and what actually happened.
- If possible, the relevant console output from the extension (open DevTools > Extensions > Social Media Saver).

## Publishing to the Chrome Web Store

The workflow in `.github/workflows/publish.yml` builds the extension, zips `dist/`, and uploads it to the Chrome Web Store using the official Publishing API. It can also publish the new version automatically.

### One-time setup

**1. Create the extension on the Chrome Web Store Developer Dashboard.**

Go to [developer.chrome.com/distribution](https://developer.chrome.com/distribution/), sign in, and click **Add new item**. Upload any valid zip for now — you just need the Extension ID that appears on the item's dashboard page afterwards.

**2. Enable the Chrome Web Store API and create an OAuth client.**

- Open [Google Cloud Console](https://console.cloud.google.com/apis/library), create or select a project.
- Search for **Chrome Web Store API** and enable it.
- Go to **Credentials > Create credentials > OAuth 2.0 Client ID**.  Set the application type to **Desktop App**.
- Download (or copy) the **Client ID** and **Client Secret**.

**3. Obtain a refresh token.**

Open this URL in your browser (replace `YOUR_CLIENT_ID`):

```text
https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/chromewebstore&response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&access_type=offline
```

Grant consent and copy the **authorisation code** shown on the confirmation page. Exchange it for a refresh token:

```bash
curl -s -X POST https://accounts.google.com/o/oauth2/token \
  -d "code=AUTH_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" \
  -d "grant_type=authorization_code"
```

The JSON response contains `"refresh_token"` — save it.

**4. Add secrets to the GitHub repository.**

Go to **Settings > Secrets and variables > Actions** and create these four secrets:

| Secret name | Value |
| --- | --- |
| `CHROME_EXTENSION_ID` | The Extension ID from the Developer Dashboard |
| `CHROME_CLIENT_ID` | OAuth Client ID from step 2 |
| `CHROME_CLIENT_SECRET` | OAuth Client Secret from step 2 |
| `CHROME_REFRESH_TOKEN` | The refresh token from step 3 |

### How to publish

| Method | What happens |
| --- | --- |
| Push a tag (`v1.0.0`) | Builds, uploads, and publishes to **trusted testers** automatically |
| Run the workflow manually | Go to **Actions > Publish to Chrome Web Store > Run workflow**. Choose whether to upload only (draft) or also publish, and who should see it (trusted testers or everyone) |

The workflow logs the full API response at every step, so failures are easy to diagnose.

## License

This project is provided as-is for personal use. See the repository root for the full licence terms.
