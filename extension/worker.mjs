import {
  BASE,
  DEFAULT_SETTINGS,
  supportedPage,
  validateSettings,
} from "./settings.mjs";

const CONTENT_ID = "feed-lens-linkedin";
const running = new Map();
const resultCache = new Map();
let blockedError = null,
  lastRemaining;
function remember(key, value) {
  resultCache.delete(key);
  resultCache.set(key, value);
  if (resultCache.size > 50)
    resultCache.delete(resultCache.keys().next().value);
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.pairingCode) {
    resultCache.clear();
    lastRemaining = undefined;
  }
});
// Refresh an existing registration after an unpacked-extension update. No new access is requested.
const scriptReady = (async () => {
  const registered = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_ID],
  });
  if (registered.length)
    await chrome.scripting.updateContentScripts([
      { id: CONTENT_ID, js: ["view.js", "adapter.js"] },
    ]);
})().catch(() => {});
async function settings() {
  const { readingSettings } = await chrome.storage.local.get("readingSettings");
  return { ...DEFAULT_SETTINGS, ...readingSettings };
}
async function localRequest(path, init = {}) {
  const { pairingCode } = await chrome.storage.session.get("pairingCode");
  if (!/^[a-f0-9]{48}$/.test(pairingCode || ""))
    return {
      error: "Pair with the local app first. Copy its code into Feed Lens.",
      code: "pairing",
    };
  try {
    const response = await fetch(BASE + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Feed-Lens-Token": pairingCode,
      },
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    const payload = await response.json();
    if (!response.ok)
      return {
        error: payload.error || "The local app could not score this post.",
        code:
          payload.code || (response.status === 403 ? "pairing" : "provider"),
        retryAfterMs: payload.retryAfterMs,
        remainingCalls: payload.remainingCalls,
      };
    return payload;
  } catch {
    return {
      error:
        "Local app unavailable. Keep npm start running on port 3075, then resume.",
      code: "connection",
    };
  }
}
async function notifyTabs(config) {
  const tabs = await chrome.tabs.query({
    url: ["https://www.linkedin.com/*", "http://127.0.0.1/*"],
  });
  await Promise.allSettled(
    tabs.map((tab) =>
      chrome.tabs.sendMessage(tab.id, {
        action: "configure",
        settings: config,
      }),
    ),
  );
}
async function start(message) {
  await scriptReady;
  const config = validateSettings(message.settings);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !supportedPage(tab.url))
    return {
      error:
        "Open LinkedIn Home (/feed/) or the local sample feed, then start your lens.",
    };
  const status = await localRequest("/api/status");
  if (status.error) return status;
  if (!status.liveAvailable)
    return {
      error:
        "Add your own TypeSafe key to .env.local and restart the local app.",
    };
  if (Number.isInteger(status.remainingCalls) && status.remainingCalls <= 0)
    return {
      error:
        "The local session budget is used. Restart the local app and pair again to continue.",
    };
  if (tab.url.startsWith("https://www.linkedin.com/")) {
    if (
      !(await chrome.permissions.contains({
        origins: ["https://www.linkedin.com/*"],
      }))
    )
      return {
        error:
          "Allow Feed Lens on LinkedIn when Chrome asks, then start again.",
      };
    const registered = await chrome.scripting.getRegisteredContentScripts({
      ids: [CONTENT_ID],
    });
    if (!registered.length)
      await chrome.scripting.registerContentScripts([
        {
          id: CONTENT_ID,
          matches: ["https://www.linkedin.com/*"],
          js: ["view.js", "adapter.js"],
          runAt: "document_idle",
          persistAcrossSessions: true,
        },
      ]);
  }
  blockedError = null;
  lastRemaining = status.remainingCalls;
  config.enabled = true;
  await chrome.storage.local.set({ readingSettings: config });
  await chrome.storage.session.set({
    readingStatus: {
      message: "Running while you read. Pause anytime.",
      remainingCalls: status.remainingCalls,
    },
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["view.js", "adapter.js"],
  });
  await notifyTabs(config);
  return {
    message:
      "Your lens is on. Scroll normally; posts are checked as they enter view.",
    remainingCalls: status.remainingCalls,
  };
}
async function pause() {
  blockedError = null;
  const config = { ...(await settings()), enabled: false };
  await chrome.storage.local.set({ readingSettings: config });
  await notifyTabs(config);
  await chrome.storage.session.set({
    readingStatus: { message: "Paused. No new posts are sent." },
  });
  return { message: "Paused. Badges removed and posts left unchanged." };
}
async function analyze(message, sender) {
  if (!sender.tab?.id || sender.frameId !== 0 || !supportedPage(sender.tab.url))
    return { error: "Unsupported feed.", code: "disabled" };
  const config = await settings();
  if (!config.enabled)
    return { error: "Feed Lens is paused.", code: "disabled" };
  if (blockedError) return blockedError;
  const tab = await chrome.tabs.get(sender.tab.id);
  if (!tab.active || !supportedPage(tab.url))
    return {
      error: "Waiting for this feed to become active.",
      code: "inactive",
    };
  if (
    typeof message.text !== "string" ||
    message.text.length < 8 ||
    message.text.length > 5000
  )
    return {
      error:
        "This post has no supported text, or is longer than 5,000 characters.",
      code: "text",
    };
  if ((running.get(tab.id) || 0) >= 2)
    return {
      error: "Another post is being checked.",
      code: "rate_limit",
      retryAfterMs: 250,
    };
  if (message.signature !== JSON.stringify(config))
    return { error: "Your lens changed. Rescanning.", code: "changed" };
  const cacheKey = JSON.stringify([message.text.trim(), config]);
  if (resultCache.has(cacheKey)) {
    const cached = resultCache.get(cacheKey);
    remember(cacheKey, cached);
    return {
      ...cached,
      cached: true,
      remainingCalls: lastRemaining ?? cached.remainingCalls,
    };
  }
  running.set(tab.id, (running.get(tab.id) || 0) + 1);
  try {
    const payload = await localRequest("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        product: "reading",
        mode: "live",
        text: message.text,
        goal: config.goal,
        criteria: config.criteria,
        preferences: {
          minRelevance: config.minRelevance,
          minUsefulness: config.minUsefulness,
          maxBait: config.maxBait,
        },
      }),
    });
    if (Number.isInteger(payload.remainingCalls)) {
      lastRemaining = Math.min(
        lastRemaining ?? payload.remainingCalls,
        payload.remainingCalls,
      );
      payload.remainingCalls = lastRemaining;
    }
    const fatal = Boolean(
      payload.error && !["rate_limit", "inactive"].includes(payload.code),
    );
    if (fatal) blockedError = payload;
    if (!payload.error) remember(cacheKey, payload);
    await chrome.storage.session.set({
      readingStatus: {
        message:
          blockedError?.error ||
          payload.error ||
          "Live recommendations are on your feed.",
        remainingCalls: payload.remainingCalls,
        needsResume: Boolean(blockedError),
      },
    });
    return payload;
  } finally {
    const count = (running.get(tab.id) || 1) - 1;
    if (count) running.set(tab.id, count);
    else running.delete(tab.id);
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  const isPopup = sender.url === chrome.runtime.getURL("popup.html");
  let task;
  if (
    message?.action === "readingConfig" &&
    sender.tab &&
    (supportedPage(sender.tab.url) ||
      sender.tab.url?.startsWith("https://www.linkedin.com/"))
  )
    task = settings();
  else if (message?.action === "readingPost") task = analyze(message, sender);
  else if (
    message?.action === "readingPause" &&
    (isPopup || (sender.frameId === 0 && supportedPage(sender.tab?.url)))
  )
    task = pause();
  else if (isPopup && message?.action === "readingStart") task = start(message);
  else if (isPopup && message?.action === "readingStatus")
    task = (async () => ({
      settings: await settings(),
      ...(await chrome.storage.session.get("readingStatus")),
    }))();
  else return;
  Promise.resolve(task).then(respond, (error) =>
    respond({
      error:
        error instanceof Error
          ? error.message
          : "Feed Lens could not complete this action.",
    }),
  );
  return true;
});
