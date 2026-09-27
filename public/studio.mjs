import { READING_CASES } from "/reading-cases.mjs";
import { decideReading, READING_DEFAULTS } from "/reading-policy.mjs";
const $ = (id) => document.getElementById(id);
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
let selected = READING_CASES[0].id,
  config;
$("goal").value = READING_DEFAULTS.goal;
$("criteria").value = READING_DEFAULTS.criteria;
for (const post of READING_CASES) {
  const article = node("article", null, "post");
  article.dataset.feedLensPost = post.id;
  article.id = post.id;
  const content = node("div", null, "post-content");
  const header = node("header");
  header.append(node("span", post.initials, "avatar"));
  const author = node("span", post.author, "author");
  author.append(node("span", post.role, "role"));
  header.append(author);
  const body = node("p", post.text);
  body.dataset.feedLensText = "";
  const footer = node("footer");
  const choose = node("button", "Select for live check", "select-post");
  choose.type = "button";
  choose.addEventListener("click", () => {
    selected = post.id;
    updateSelection();
  });
  footer.append(choose);
  content.append(header, node("h3", post.title), body, footer);
  article.append(content);
  $("posts").append(article);
  const option = node("option", post.title);
  option.value = post.id;
  $("policy-post").append(option);
}
function updateSelection() {
  for (const post of READING_CASES) {
    const article = $(post.id);
    const active = post.id === selected;
    article.classList.toggle("selected", active);
    const button = article.querySelector(".select-post");
    button.textContent = active
      ? "Selected for live check"
      : "Select for live check";
    button.setAttribute("aria-pressed", String(active));
  }
}
function policy() {
  const example = READING_CASES.find((p) => p.id === $("policy-post").value);
  const cutoff = Number($("minimum").value);
  $("minimum-value").value = cutoff;
  const decision = decideReading(example.answers, {
    minUsefulness: cutoff / 100,
  });
  $("policy-result").replaceChildren(
    node("strong", `${decision.label} · ${decision.score} fit`),
    node("p", decision.reason),
  );
}
updateSelection();
policy();
$("policy-post").addEventListener("change", policy);
$("minimum").addEventListener("input", policy);
$("pair").addEventListener("click", () => {
  $("connection").hidden = !$("connection").hidden;
  $("pair").setAttribute("aria-expanded", String(!$("connection").hidden));
});
$("pair").setAttribute("aria-expanded", "false");
$("pair").setAttribute("aria-controls", "connection");
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(config.token);
    $("copy-status").textContent =
      "Copied. Paste under Local connection in the Feed Lens popup.";
  } catch {
    $("pair-code").type = "text";
    $("pair-code").select();
    $("copy-status").textContent = "Select and copy this code manually.";
  }
});
$("analyze").addEventListener("click", async () => {
  if (!config) return;
  const post = READING_CASES.find((p) => p.id === selected);
  const goal = $("goal").value.trim(),
    criteria = $("criteria").value.trim();
  if (goal.length < 8 || criteria.length < 8) {
    $("live-status").textContent =
      "Use 8–300 characters for both your topic and helpfulness criteria.";
    return;
  }
  $("analyze").disabled = true;
  $("live-status").textContent =
    "Checking the selected fictional post with live Jev…";
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Feed-Lens-Token": config.token,
      },
      body: JSON.stringify({
        product: "reading",
        mode: "live",
        text: post.text,
        goal,
        criteria,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "The request failed. Try again when ready.",
      );
    const result = node("div", null, "live-result");
    result.dataset.tone = data.decision.verdict;
    result.append(
      node(
        "span",
        `${data.cached ? "Cached Jev result" : "Live Jev result"} · ${data.model}`,
        "live-label",
      ),
      node("strong", `${data.decision.label} · ${data.decision.score} fit`),
      node("p", data.decision.reason),
    );
    const signals = node("div", null, "signals");
    for (const [key, label] of [
      ["relevance", "Topic match"],
      ["usefulness", "Practical value"],
      ["bait", "Bait signal"],
    ]) {
      const row = node("span", label);
      row.append(node("b", String(Math.round(data.answers[key].noul * 100))));
      signals.append(row);
    }
    result.append(signals);
    result.append(
      node(
        "p",
        "These are model judgements of the available text. The fit index and recommendation come from your code.",
      ),
    );
    $(post.id).querySelector(".live-result")?.remove();
    $(post.id).append(result);
    $("live-status").textContent =
      `${data.remainingCalls === "Unlimited" ? "No session post cap." : `${data.remainingCalls} live calls left in this server session.`} ${data.cached ? "Reused the cached signals." : "One request completed."}`;
  } catch (error) {
    $("live-status").textContent = error.message;
  } finally {
    $("analyze").disabled = false;
  }
});
try {
  config = await (await fetch("/api/config")).json();
  $("pair-code").value = config.token;
  $("health").textContent = config.liveAvailable
    ? config.maxCalls === null
      ? "API key configured · No session post cap."
      : `API key configured · ${config.remainingCalls} of ${config.maxCalls} live calls left in this session.`
    : "No API key yet. The practice feed and rule explorer still work.";
} catch {
  $("health").textContent =
    "Local server unavailable. Keep npm start running, then refresh.";
  $("pair").disabled = true;
  $("analyze").disabled = true;
}
