(() => {
  if (globalThis.__ldsFeedLens || !globalThis.__ldsFeedLensUI) return;
  const ui = globalThis.__ldsFeedLensUI;
  const selector =
    '[data-feed-lens-post], .feed-shared-update-v2, [role="listitem"][componentkey^="update-card-focus"]';
  const records = new Map(),
    cards = new Set(),
    inView = new Set();
  const DWELL = 120,
    MAX_IN_FLIGHT = 2;
  let config = null,
    signature = "",
    revision = 0,
    timer = null,
    due = Infinity,
    inFlight = 0,
    blocked = false,
    toolbar = null,
    statusText = "",
    remaining,
    retryTimer = null;
  const onFeed = () =>
    location.origin === "http://127.0.0.1:3075" ||
    (location.origin === "https://www.linkedin.com" &&
      /^\/feed(?:\/|$)/.test(location.pathname));
  function textNode(card) {
    const classic = card.querySelector(
      "[data-feed-lens-text], .update-components-text, .feed-shared-update-v2__description",
    );
    if (classic) return classic;
    if (!card.matches('[role="listitem"][componentkey^="update-card-focus"]'))
      return null;
    const heading = [...card.querySelectorAll("h2")].find(
      (h) => h.closest('[role="listitem"]') === card,
    );
    const body =
      heading &&
      [...heading.parentElement.children].filter((el) => el.tagName === "P");
    return body?.length === 1 ? body[0] : null;
  }
  function textOf(el) {
    if (!el) return "";
    // Keep the complete DOM post text, while excluding LinkedIn's "more" controls.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement?.closest(
          "button,script,style,[data-lds-feed-lens-badge]",
        )
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    let n,
      value = "";
    while ((n = walker.nextNode())) value += n.textContent;
    return value.trim();
  }
  const visible = (card) => {
    const b = card.getBoundingClientRect();
    return (
      b.width > 0 && b.height > 0 && b.bottom > 64 && b.top < innerHeight - 16
    );
  };
  function remove(record) {
    record.host?.remove();
    record.host = null;
  }
  function clear() {
    for (const record of records.values()) remove(record);
    records.clear();
    cards.clear();
    inView.clear();
    viewport.disconnect();
    toolbar?.remove();
    toolbar = null;
  }
  function banner(message = statusText, error = false) {
    statusText = message;
    if (!config?.enabled || !onFeed()) return;
    if (!toolbar?.isConnected) {
      toolbar = ui.dock(() =>
        chrome.runtime
          .sendMessage({ action: "readingPause" })
          .catch(() => configure({ ...config, enabled: false })),
      );
      document.body.append(toolbar);
    }
    const count = [...records.values()].filter((r) => r.result).length;
    toolbar.shadowRoot.getElementById("count").textContent = count
      ? `${count} checked`
      : "Live on this feed";
    const status = toolbar.shadowRoot.getElementById("status");
    status.textContent = message;
    status.classList.toggle("error", error);
  }
  function paint(record, result, message) {
    record.host = ui.badge(record, result, config, message);
    if (result) {
      record.host.dataset.latencyMs = String(
        Math.round(performance.now() - record.visibleAt),
      );
      record.host.dataset.providerMs = String(
        result.cached ? 0 : result.durationMs,
      );
      record.host.dataset.cached = String(Boolean(result.cached));
    }
    record.textNode.before(record.host);
  }
  // Earliest-deadline scheduling: new scroll/mutation events cannot postpone work forever.
  function schedule(delay = 40) {
    if (!config?.enabled) return;
    const next = performance.now() + delay;
    if (timer && due <= next) return;
    clearTimeout(timer);
    due = next;
    timer = setTimeout(() => {
      timer = null;
      due = Infinity;
      scan();
    }, delay);
  }
  function discover(root) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.closest("[data-lds-feed-lens-badge],[data-lds-feed-lens-toolbar]"))
      return;
    const found = root.matches(selector)
      ? [root]
      : [...root.querySelectorAll(selector)];
    for (const card of found) {
      if (cards.has(card)) continue;
      cards.add(card);
      viewport.observe(card);
    }
  }
  function prune() {
    for (const card of cards) {
      if (card.isConnected) continue;
      viewport.unobserve(card);
      cards.delete(card);
      inView.delete(card);
      const record = records.get(card);
      if (record) remove(record);
      records.delete(card);
    }
    if (records.size > 80)
      for (const [card, record] of records) {
        if (records.size <= 80) break;
        if (!inView.has(card) && record.state !== "pending") {
          remove(record);
          records.delete(card);
        }
      }
  }
  function scan() {
    if (!config?.enabled) return;
    if (!onFeed()) {
      revision++;
      clear();
      return;
    }
    if (document.visibilityState !== "visible") return;
    if (!cards.size) discover(document.body);
    banner(statusText || "Checking only the posts in view.");
    prune();
    const ready = [];
    for (const card of inView) {
      if (!card.isConnected || !visible(card)) continue;
      const source = textNode(card),
        text = textOf(source);
      if (!source || text.length < 8) continue;
      let record = records.get(card);
      if (record && (record.text !== text || record.textNode !== source)) {
        remove(record);
        records.delete(card);
        record = null;
      }
      if (!record) {
        record = {
          card,
          textNode: source,
          text,
          visibleAt: performance.now(),
          seenAt: performance.now(),
          state: "waiting",
        };
        records.set(card, record);
      }
      if (record.result && !record.host?.isConnected)
        paint(record, record.result);
      if (record.state !== "waiting") continue;
      if (text.length > 5000) {
        record.state = "unsupported";
        paint(record, null, "Long post: not scored");
        continue;
      }
      if (!record.seenAt) record.seenAt = performance.now();
      const wait = DWELL - (performance.now() - record.seenAt);
      if (wait <= 0) ready.push(record);
      else schedule(wait + 1);
    }
    if (!cards.size && !blocked)
      banner("No supported posts here. Open LinkedIn Home.");
    if (blocked || inFlight >= MAX_IN_FLIGHT) return;
    ready.sort(
      (a, b) =>
        Math.abs(a.textNode.getBoundingClientRect().top - 180) -
        Math.abs(b.textNode.getBoundingClientRect().top - 180),
    );
    for (const record of ready.slice(0, MAX_IN_FLIGHT - inFlight))
      void analyze(record);
  }
  async function analyze(record) {
    const ticket = revision,
      requestSignature = signature;
    record.state = "pending";
    inFlight++;
    paint(record);
    banner("Finding the posts that fit your lens…");
    try {
      const result = await chrome.runtime.sendMessage({
        action: "readingPost",
        text: record.text,
        signature: requestSignature,
      });
      if (
        ticket !== revision ||
        records.get(record.card) !== record ||
        !record.card.isConnected ||
        textNode(record.card) !== record.textNode ||
        textOf(record.textNode) !== record.text
      )
        return;
      if (!result || result.error) {
        record.state = "waiting";
        remove(record);
        if (result?.code === "rate_limit") {
          blocked = true;
          const pauseRevision = revision;
          banner(
            `Taking a short breather. Resumes in ${Math.ceil((result.retryAfterMs || 1000) / 1000)}s.`,
          );
          clearTimeout(retryTimer);
          retryTimer = setTimeout(
            () => {
              if (pauseRevision === revision) {
                blocked = false;
                schedule(0);
              }
            },
            Math.max(250, result.retryAfterMs || 1000),
          );
        } else if (result?.code === "inactive") {
          banner("Ready when you return to this tab.");
        } else if (result?.code === "changed")
          configure(
            await chrome.runtime.sendMessage({ action: "readingConfig" }),
          );
        else {
          blocked = true;
          banner(
            result?.error || "Open Feed Lens and resume to reconnect.",
            true,
          );
        }
      } else {
        record.state = "done";
        record.result = result;
        remaining = result.remainingCalls;
        paint(record, result);
        if (!blocked)
          banner(
            remaining === "Unlimited"
              ? "No session post cap. Your posts stay yours to choose."
              : `${remaining} analyses left. Your posts stay yours to choose.`,
          );
      }
    } catch {
      blocked = true;
      banner("Refresh this feed to reconnect to Feed Lens.", true);
    } finally {
      inFlight--;
      if (config?.enabled && !blocked) schedule(0);
    }
  }
  const viewport = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!cards.has(entry.target)) continue;
        if (entry.isIntersecting) {
          inView.add(entry.target);
          const record = records.get(entry.target);
          if (record && !record.seenAt) {
            record.seenAt = performance.now();
            record.visibleAt = performance.now();
          }
        } else {
          inView.delete(entry.target);
          const record = records.get(entry.target);
          if (record?.state === "waiting") record.seenAt = 0;
        }
      }
      schedule(0);
    },
    { rootMargin: "-64px 0px -16px 0px", threshold: 0 },
  );
  const observer = new MutationObserver((changes) => {
    let relevant = false;
    for (const change of changes) {
      const element =
        change.target.nodeType === Node.ELEMENT_NODE
          ? change.target
          : change.target.parentElement;
      if (
        element?.closest(
          "[data-lds-feed-lens-badge],[data-lds-feed-lens-toolbar]",
        )
      )
        continue;
      if (change.type === "characterData") {
        if (element?.closest(selector)) relevant = true;
        continue;
      }
      for (const added of change.addedNodes) {
        if (added.nodeType === Node.ELEMENT_NODE) {
          if (
            added.matches(
              "[data-lds-feed-lens-badge],[data-lds-feed-lens-toolbar]",
            )
          )
            continue;
          discover(added);
        }
        relevant = true;
      }
      if (change.removedNodes.length) relevant = true;
    }
    if (relevant) schedule();
  });
  function configure(next) {
    if (!next || typeof next.enabled !== "boolean") return;
    const nextSignature = JSON.stringify(next);
    if (nextSignature === signature && config?.enabled && !blocked) return;
    revision++;
    signature = nextSignature;
    config = next;
    blocked = false;
    statusText = "";
    clearTimeout(timer);
    timer = null;
    due = Infinity;
    clearTimeout(retryTimer);
    observer.disconnect();
    clear();
    if (config.enabled) {
      discover(document.body);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      schedule(0);
    }
  }
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === chrome.runtime.id && message?.action === "configure")
      configure(message.settings);
  });
  // The observer handles position changes; these events cover SPA navigation and tab re-entry.
  addEventListener("resize", () => schedule(), { passive: true });
  addEventListener("popstate", () => {
    if (onFeed() && !cards.size) discover(document.body);
    schedule(0);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && onFeed() && !cards.size)
      discover(document.body);
    schedule(0);
  });
  globalThis.__ldsFeedLens = {
    configure,
    clear: () => configure({ ...config, enabled: false }),
  };
  chrome.runtime
    .sendMessage({ action: "readingConfig" })
    .then(configure)
    .catch(() => {});
})();
