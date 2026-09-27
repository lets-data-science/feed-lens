import { decidePost, DEFAULTS } from "/policy.mjs";
const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
let config,
  posts = [],
  mode = "demo",
  selected = null,
  busy = false,
  stopped = false,
  generation = 0,
  remaining = 0;
const results = new Map(),
  revealed = new Set();
let preferences = { ...DEFAULTS, focus: false, preset: "data" };
try {
  const saved = JSON.parse(
    localStorage.getItem("feed-lens-preferences") || "null",
  );
  if (
    saved &&
    ["minRelevance", "maxBait"].every(
      (key) =>
        Number.isFinite(saved[key]) && saved[key] >= 0 && saved[key] <= 1,
    )
  )
    preferences = {
      ...preferences,
      minRelevance: saved.minRelevance,
      maxBait: saved.maxBait,
      focus: saved.focus === true,
      preset: ["data", "ai", "product"].includes(saved.preset)
        ? saved.preset
        : "data",
    };
} catch {
  /* Storage is optional. The current tab still works. */
}
function save() {
  try {
    localStorage.setItem("feed-lens-preferences", JSON.stringify(preferences));
  } catch {
    status(
      "Preferences work in this tab, but your browser could not save them.",
    );
  }
}
function status(text, error = false) {
  $("status").textContent = text;
  $("status").className = `status${error ? " error" : ""}`;
}
function invalidate() {
  generation += 1;
  results.clear();
  revealed.clear();
  selected = null;
  render();
  inspect();
}
function setMode(next) {
  if (busy) return;
  mode = next;
  invalidate();
  $("demo-mode").setAttribute("aria-pressed", String(mode === "demo"));
  $("live-mode").setAttribute("aria-pressed", String(mode === "live"));
  $("mode-note").textContent =
    mode === "demo"
      ? "Demo uses authored signals. No AI request, no API key."
      : "Live sends each post and your goal to Jev. Cached results reuse the original response.";
  status(
    mode === "live" && !config.liveAvailable
      ? "To use Jev, add TYPESAFE_API_KEY to .env.local and restart. You can keep exploring in Demo mode."
      : "Analyze the feed with your selected mode.",
    mode === "live" && !config.liveAvailable,
  );
}
function render() {
  const feed = $("feed");
  feed.replaceChildren();
  let foldedCount = 0;
  posts.forEach((post) => {
    const result = results.get(post.id),
      decision = result && decidePost(result.answers, preferences);
    const folded = Boolean(
      preferences.focus && decision?.fold && !revealed.has(post.id),
    );
    if (folded) foldedCount += 1;
    const card = el(
      "article",
      `post${folded ? " folded" : ""}${selected === post.id ? " selected" : ""}`,
    );
    card.dataset.feedLensPost = post.id;
    const head = el("div", "post-head"),
      person = el("div", "post-person");
    person.append(el("strong", "", post.author), el("small", "", post.role));
    head.append(
      el("div", "avatar", post.initials),
      person,
      el("time", "", post.time),
    );
    const content = el("p", "post-text", post.text);
    content.dataset.feedLensText = "";
    card.append(head, content);
    const foot = el("div", "post-footer");
    if (decision) {
      const badge = el(
        "button",
        `signal-badge ${decision.tone}`,
        decision.label,
      );
      badge.type = "button";
      badge.setAttribute("aria-pressed", String(selected === post.id));
      badge.setAttribute(
        "aria-label",
        `Inspect ${post.author}: ${decision.label}`,
      );
      badge.addEventListener("click", () => {
        selected = post.id;
        render();
        inspect();
        const heading = $("inspector-content").querySelector("h2");
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        if (innerWidth < 1100)
          document
            .querySelector(".inspector")
            .scrollIntoView({
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
              block: "start",
            });
      });
      foot.append(
        badge,
        el(
          "span",
          "post-source",
          result.mode === "demo"
            ? "Authored demo"
            : result.cached
              ? "Jev · cached"
              : "Jev · live",
        ),
      );
    } else
      foot.append(
        el("span", "post-source", "Ready for a closer look"),
        el(
          "span",
          "post-source",
          post.id.startsWith("custom-") ? "Your text" : "Synthetic post",
        ),
      );
    card.append(foot);
    if (preferences.focus && decision?.fold) {
      const reveal = el(
        "button",
        "show-post",
        folded ? "Show this post anyway" : "Fold this post again",
      );
      reveal.type = "button";
      reveal.addEventListener("click", () => {
        revealed.has(post.id)
          ? revealed.delete(post.id)
          : revealed.add(post.id);
        render();
        document
          .querySelector(
            `[data-feed-lens-post="${CSS.escape(post.id)}"] .show-post`,
          )
          ?.focus({ preventScroll: true });
      });
      card.append(reveal);
    }
    feed.append(card);
  });
  $("count").textContent =
    `${posts.length - foldedCount} visible${foldedCount ? ` · ${foldedCount} folded` : ""} · ${results.size} analyzed`;
  $("call-count").textContent =
    mode === "live"
      ? `${remaining} live calls left this session`
      : "No API calls in Demo";
}
function inspect() {
  const post = posts.find((item) => item.id === selected),
    result = results.get(selected),
    panel = $("inspector-content");
  if (!post || !result) {
    panel.replaceChildren(
      el("h2", "", "Check the signal."),
      el(
        "p",
        "",
        "Analyze the feed, then select a badge to inspect its signals and the rule applied.",
      ),
      el(
        "div",
        "note",
        "These signals do not prove AI authorship or factual accuracy. You always choose what to read.",
      ),
    );
    return;
  }
  const decision = decidePost(result.answers, preferences),
    a = result.answers;
  panel.replaceChildren(
    el(
      "span",
      "source-label",
      result.mode === "demo"
        ? "AUTHORED DEMO · NOT MODEL OUTPUT"
        : `JEV · ${result.cached ? "CACHED RESPONSE" : "LIVE RESPONSE"}`,
    ),
    el("h2", "", decision.label),
    el("p", "", `${post.author} · ${a.kind.choice}`),
  );
  const values = [
    [
      "Relevance",
      a.relevance.noul,
      1,
      "Does the substance fit your reading goal?",
    ],
    [
      "Engagement bait",
      a.bait.noul,
      1,
      "Does it request engagement to unlock content, or rely on an empty curiosity hook?",
    ],
    [
      "Specifics present",
      a.specifics.noul,
      1,
      "Does it include an example, technique or actionable detail? This does not check truth.",
    ],
    [
      "Generic writing",
      a.generic.score,
      2,
      "0 = concrete, 1 = mixed, 2 = generic. Jev can return values between these levels.",
    ],
  ];
  values.forEach(([name, value, max, help]) => {
    const row = el("div", "signal-row"),
      label = el("div", "row"),
      bar = el("div", "meter"),
      fill = el("span");
    label.append(
      el("span", "", name),
      el("strong", "", `${value.toFixed(2)}${max === 2 ? " / 2" : ""}`),
    );
    fill.style.width = `${(value / max) * 100}%`;
    bar.append(fill);
    row.append(label, bar, el("p", "", help));
    panel.append(row);
  });
  panel.append(
    el(
      "div",
      "note",
      `Your rule: ${decision.reason} Minimum relevance ${preferences.minRelevance.toFixed(2)}; bait cutoff ${preferences.maxBait.toFixed(2)}. Signals are not calibrated accuracy percentages.`,
    ),
  );
  if (result.mode === "live")
    panel.append(
      el(
        "p",
        "hint",
        `${result.model} · ${result.durationMs} ms for the original local round trip · ${result.usage.input_tokens} input tokens. ${result.cached ? "No new model call for this cached result." : ""}`,
      ),
    );
  const raw = el("details"),
    summary = el("summary", "", "Inspect structured answers");
  raw.append(summary, el("pre", "", JSON.stringify(result.answers, null, 2)));
  panel.append(raw);
}
async function analyze() {
  if (!config) {
    status("The local app is still loading. Try again in a moment.");
    return;
  }
  if (busy) {
    stopped = true;
    $("analyze").disabled = true;
    status(
      "Stopping after the current post. Finished signals will stay visible.",
    );
    return;
  }
  if (mode === "live" && !config.liveAvailable) {
    status(
      "Live mode needs your key in .env.local. Use Demo or restart with a key.",
      true,
    );
    return;
  }
  if (
    mode === "demo" &&
    !Object.values(config.goals).includes($("goal").value.trim())
  ) {
    status(
      "Choose a preset goal for Demo, or switch to Live Jev for your own goal.",
      true,
    );
    return;
  }
  const goal = $("goal").value.trim();
  if (goal.length < 8) {
    status("Describe your reading goal in at least 8 characters.", true);
    return;
  }
  busy = true;
  stopped = false;
  $("analyze").textContent = "Stop after this post";
  $("demo-mode").disabled = true;
  $("live-mode").disabled = true;
  const version = generation;
  let done = 0,
    failures = 0,
    lastError = "";
  try {
    for (const post of [...posts]) {
      if (stopped || version !== generation) break;
      status(`Reading post ${done + failures + 1} of ${posts.length}…`);
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Feed-Lens-Token": config.token,
          },
          body: JSON.stringify({
            mode,
            text: post.text,
            goal,
            postId: post.id,
          }),
          signal: AbortSignal.timeout(20000),
        });
        const payload = await response.json();
        if (typeof payload.remainingCalls === "number")
          remaining = payload.remainingCalls;
        if (!response.ok)
          throw new Error(
            payload.error || "The local server could not analyze this post.",
          );
        if (version !== generation) break;
        results.set(post.id, payload);
        done += 1;
        selected ??= post.id;
        render();
        inspect();
      } catch (error) {
        failures += 1;
        lastError =
          error.name === "TimeoutError"
            ? "The local request timed out. Try again when ready."
            : error.message;
      }
    }
    if (version !== generation)
      status("Your goal changed. Analyze again to get signals for that goal.");
    else if (failures)
      status(`${done} analyzed; ${failures} unchanged. ${lastError}`, true);
    else
      status(
        `${stopped ? "Stopped. " : ""}${done} posts analyzed. Select a badge, or turn on Focus view.`,
      );
  } finally {
    busy = false;
    $("analyze").disabled = false;
    $("analyze").textContent = "Analyze the feed ↗";
    $("demo-mode").disabled = false;
    $("live-mode").disabled = false;
  }
}
$("analyze").addEventListener("click", analyze);
$("demo-mode").addEventListener("click", () => setMode("demo"));
$("live-mode").addEventListener("click", () => setMode("live"));
$("goal-preset").addEventListener("change", (event) => {
  preferences.preset = event.target.value;
  $("goal").value = config.goals[preferences.preset] || "";
  invalidate();
  save();
  status("Your focus changed. Analyze again to update relevance.");
  if (preferences.preset === "custom") $("goal").focus();
});
$("goal").addEventListener("input", () => {
  $("goal-preset").value = "custom";
  preferences.preset = "custom";
  invalidate();
  status("Goal changed. Custom goals need live analysis.");
});
for (const [id, key] of [
  ["relevance", "minRelevance"],
  ["bait", "maxBait"],
])
  $(id).addEventListener("input", (event) => {
    preferences[key] = Number(event.target.value);
    $(`${id}-value`).textContent = preferences[key].toFixed(2);
    revealed.clear();
    render();
    inspect();
    save();
  });
$("focus").addEventListener("change", (event) => {
  preferences.focus = event.target.checked;
  revealed.clear();
  render();
  save();
});
$("reset").addEventListener("click", () => {
  preferences = { ...DEFAULTS, focus: false, preset: "data" };
  applyPreferences();
  invalidate();
  save();
  status("Your lens is reset. Analyze the sample feed again.");
});
function applyPreferences() {
  $("goal-preset").value = preferences.preset;
  $("goal").value = config.goals[preferences.preset];
  $("relevance").value = preferences.minRelevance;
  $("relevance-value").textContent = preferences.minRelevance.toFixed(2);
  $("bait").value = preferences.maxBait;
  $("bait-value").textContent = preferences.maxBait.toFixed(2);
  $("focus").checked = preferences.focus;
}
$("pair-button").addEventListener("click", () => $("pair-dialog").showModal());
$("copy-pair").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(config.token);
    $("copy-pair").textContent = "Copied";
  } catch {
    $("pair-code").select();
    $("copy-pair").textContent = "Select & copy";
  }
});
$("add-post").addEventListener("click", () => {
  const text = $("custom-text").value.trim();
  if (text.length < 8 || text.length > 5000) {
    status("Use 8–5,000 characters for your post.", true);
    return;
  }
  if (posts.length >= 10) {
    status(
      "This local feed holds 10 posts. Refresh to remove custom posts.",
      true,
    );
    return;
  }
  posts.unshift({
    id: `custom-${Date.now()}`,
    author: "Your public example",
    initials: "YOU",
    role: "Only stored in this tab",
    time: "Now",
    text,
  });
  $("custom-text").value = "";
  render();
  status("Post added. Switch to Live Jev to analyze custom text.");
  $("feed").scrollIntoView({ block: "start" });
});
try {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("Could not load local configuration.");
  config = await response.json();
  posts = config.posts;
  remaining = config.remainingCalls;
  $("pair-code").value = config.token;
  applyPreferences();
  render();
} catch {
  status(
    "Cannot reach the local server. Start it with npm start, then refresh this page.",
    true,
  );
  $("analyze").disabled = true;
  $("pair-button").disabled = true;
}

const mobileLayout = matchMedia("(max-width: 650px)");
function setPreferencesLayout() {
  $("preferences-panel").open = !mobileLayout.matches;
}
setPreferencesLayout();
mobileLayout.addEventListener("change", setPreferencesLayout);
