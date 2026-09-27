# Feed Lens 1.0

A local Chrome extension that recommends **Worth reading**, **Skip this post** or **Take a quick look** while you scroll LinkedIn Home. You choose the topic and what useful means. Jev supplies three structured signals; ordinary JavaScript applies your reading rules. Posts stay visible and recommendations can be overridden.

This is a desktop learning project, not a Chrome Web Store release. Start on the included fictional practice feed. There is no TypeSafe sponsorship or partnership implied.

## Platform support

**Currently supported: LinkedIn Home in desktop Chrome**, plus the included local practice feed. Facebook, X, Reddit and other platforms are **not supported yet**.

You can extend this project to other platforms by reusing the Jev questions and reading policy. Each site needs its own post adapter, badge placement, narrowly scoped permissions and trusted-origin checks, followed by browser testing. Changing your reading preferences does not enable another site. Step 8 of the guide explains this extension path.

## Quick start

You need **Node.js 22.9 or newer**, desktop **Chrome**, an editor and a terminal. macOS, Windows and Linux can run the Node application; this release was tested on macOS. Mobile Chrome does not load desktop unpacked extensions.

Get the complete application from **[lets-data-science/feed-lens](https://github.com/lets-data-science/feed-lens)**. Choose **Code → Download ZIP**, or clone it:

```sh
git clone https://github.com/lets-data-science/feed-lens.git
cd feed-lens
```

To build the two teaching tasks yourself, download the **starter** from the [version 1.0 release](https://github.com/lets-data-science/feed-lens/releases/tag/v1.0.0). The repository and complete reference already contain the finished implementations. The [eight-step guide](LEARNER-GUIDE.md) is included, so you can follow it without an LDS account.

1. If you downloaded a ZIP, extract it. Open the extracted folder in your editor, with `package.json` at its root.
2. Run `npm run check`, then `npm start`. No package installation or runtime dependencies are needed.
3. Open **http://127.0.0.1:3075**. Keep the terminal running. Ctrl+C stops the server.
4. Follow **[LEARNER-GUIDE.md](LEARNER-GUIDE.md)**. In the starter, complete `lib/reading-questions.mjs` and `lib/reading-policy.mjs`. The reference already contains both implementations.
5. Run `npm run checkpoint -- questions`, `npm run checkpoint -- policy` and `npm test`. Starter checks intentionally fail until the two tasks are done.

The practice feed opens without a key. Its rule explorer uses clearly labeled authored signals. The extension and live-check button always use the live provider path. No authored signal is silently substituted when Jev fails.

## Connect your own key

Get a key using the [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart) and review [current model pricing](https://docs.typesafe.ai/models). This project pins `jev-1.13.0` at `https://api.typesafe.ai/v1/systemone`; there is no fallback model.

Copy `.env.example` to `.env.local`:

```sh
# macOS / Linux
cp .env.example .env.local
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

Fill `TYPESAFE_API_KEY=` privately in your editor. Restart `npm start` and refresh the workspace. Never put the key in browser code, a screenshot, chat, a repository or the extension popup. The key stays in the Node process.

Optional: `npm run smoke -- --live` sends **one** fictional post to TypeSafe. It prints only the validated answers, model and token usage. Exact answers can vary. Without `--live`, it makes no request. This separate CLI call is outside the web server's session counter.

## Load and use the extension

1. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder's **extension** directory. Confirm **version 1.0.0**. Keep this folder on disk.
2. Pin Feed Lens. In the local workspace, click **Connect extension → Copy code**.
3. Open the Feed Lens popup and paste the code under **Local connection**. This is a local pairing code, not your API key.
4. Set **Focus on** and **Make it useful with**, or choose a preset. **Reading strictness** contains optional cutoffs.
5. While the local practice feed is active, click **Start lens**. Scroll, inspect badge details, override a recommendation and try **Pause**.
6. Open **https://www.linkedin.com/feed/** and start there. Allow LinkedIn access when Chrome asks. Only supported Home-feed text posts in view are checked.
7. Use **Apply lens** after changing settings. Use **Pause** in the popup or floating dock to remove badges and stop new work.

After editing extension files, reload its card in `chrome://extensions`, refresh the feed, reopen the popup and start again. Updating a different folder does not update your installed extension. Reloading the extension or restarting Chrome may clear its session pairing. A normal server restart changes the code. Refresh the local app and copy the new one.

## Understand the recommendation

- **Topic match:** Jev's probability that the post's substance fits your topic, beyond a passing mention or hashtags.
- **Practical value:** Jev's probability that the available text meets your helpfulness criteria. It does not verify a linked resource or a factual claim.
- **Bait signal:** Jev's probability that promised value is withheld behind engagement. An ordinary discussion question is allowed.

Each is a `noul`, a probability of a yes answer, not a measurement of quality. The fit index is `round(100 × min(topic, usefulness, 1 − bait))`. It is **not** a calibrated probability that a post is helpful or true. Cutoffs and close-call margins are hand-chosen preferences, not optimized values. Reasons come from the rule that fired, not invented model rationales. A personal override changes your reading choice, not the model's signals.

The included `lib/reading-cases.mjs` has four fictional posts and **authored** signals for deterministic rule practice. At usefulness cutoffs 0.55, 0.65 and 0.80, Noor's fixed example changes from Read to Unsure to Skip; its fit stays 60. These are teaching examples, not model performance evidence.

## Files and recovery

| File | Responsibility |
|---|---|
| `lib/reading-questions.mjs` | Your three atomic model questions |
| `lib/reading-policy.mjs` | Your read/skip/unsure rules |
| `lib/reading.mjs` | Request assembly and response validation |
| `lib/jev.mjs` | Fixed provider endpoint, timeout and bounded response |
| `server.mjs` | Loopback boundary, pairing, request limits and cache |
| `extension/popup.*` | Settings, presets, pairing and start/pause |
| `extension/worker.mjs` | Permissions, trusted messages and local API calls |
| `extension/adapter.js` | Narrow post extraction, visible-post queue and stale results |
| `extension/view.js` | Isolated badges, details, overrides and status dock |
| `docs/ACCEPTANCE.md` | Observable manual verification checklist |

`npm run checkpoint -- questions --restore` or `npm run checkpoint -- policy --restore` restores one reference file **after backing up your current file** under `backups/`. Then rerun the checkpoint and restart the server. The complete reference ZIP is a second recovery path.

The older five-signal prototype remains at `/sandbox` for maintenance regression coverage. The 1.0 guide, practice workspace and extension all use the three-signal reading workflow.

## Data, permissions and limits

Only the available post body and your two reading criteria are sent to TypeSafe. Comments, messages and author/profile fields are excluded by the adapter. A post body can still contain personal information; use text you are comfortable sharing with the provider. Linked pages, images, video and truthfulness are not checked. Feed Lens does not detect AI authorship.

Chrome permissions are `activeTab`, `scripting`, `storage`, loopback access and optional **www.linkedin.com only**. LinkedIn access is requested on explicit start. It does not post, click engagement buttons, auto-scroll or request all websites. The adapter supports classic and inspected SDUI layouts, and fails closed when it cannot identify a body. A platform update can break extraction; do not fix it by scraping the whole page.

Only visible cards after a 120 ms dwell are eligible. Up to two are checked concurrently. Background tabs do not start new requests. The default web server cap is **40 attempted live calls per session**, with **60 reading requests/minute** and **two distinct calls in flight**. Provider failures count. The older sandbox retains a 12/minute limit. Server and worker caches each hold at most 50 results. Exact post/question/topic/helpfulness combinations can reuse signals; cutoff changes recompute the policy. Restarting the server clears its cache and counter. These count limits are not a guaranteed monetary budget.

For an uncapped session, add `FEED_LENS_MAX_CALLS=unlimited` to your private `.env.local` and restart the server. You can also set a positive whole number for a different cap. The default stays 40 when the setting is absent. Uncapped removes the total post limit; the per-minute limit, two-request concurrency and visible-only checks still apply. Live requests can incur provider charges.

Pause stops new work. An already accepted provider request can finish and incur a charge; stale responses are discarded. Post edits and recycled cards invalidate their badge. Fatal provider, pairing and budget errors stop further work until explicit resume. Never log or expose raw provider error bodies or credentials.

## Evaluate your own examples

Edit `examples/my-lens.json`: your topic, helpfulness criteria and six fictional posts, with expected read/skip/unsure labels. Keep four in `develop` and two in `check`. Validate without calling the provider:

```sh
npm run evaluate -- --file examples/my-lens.json --split develop
```

Add `--live` to send the four development cases with your own key. After revising your questions, use `--split check --live` for the two held-aside cases. Each result includes expected and actual labels plus raw signals. CLI evaluations are outside the web server counter; the file is limited to eight cases. Do not put private posts in a shared example file.

## Verify before sharing

Run `npm test` and follow [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md). Deterministic tests do not establish model accuracy. Label your own examples before making live calls and keep false reads and false skips separately. A few successful posts do not prove compatibility with every LinkedIn account or layout.

The LDS walkthroughs are screen recordings of the actual app and unpacked extension on **fictional local posts**. Recorded Jev answers are replayed for repeatable filming. They are not personal LinkedIn screen captures. Captions and transcripts accompany them.

When sharing your own build, exclude `.env.local`, `backups/`, personal data and account-specific evidence. Distribution through an extension store is a separate release with its own privacy and permissions review.

Primary sources: [TypeSafe API](https://docs.typesafe.ai/api), [Noul](https://docs.typesafe.ai/primitives/noul), [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).
