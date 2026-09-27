import { DEFAULT_SETTINGS, validateSettings } from "./settings.mjs";
const $ = (id) => document.getElementById(id);
const fields = ["minRelevance", "minUsefulness", "maxBait"];
let currentTab;
let enabled = false,
  needsResume = false;
function state(nextEnabled = enabled) {
  enabled = nextEnabled;
  $("state").textContent = enabled
    ? needsResume
      ? "Check setup"
      : "Live"
    : "Paused";
  $("state").classList.toggle("active", enabled && !needsResume);
  $("state").classList.toggle("attention", enabled && needsResume);
  $("start-label").textContent = enabled ? "Apply lens" : "Start lens";
}
function message(value, isError = false) {
  $("status").textContent = value;
  $("status").classList.toggle("error", isError);
}
const presets = {
  engineering: {
    goal: DEFAULT_SETTINGS.goal,
    criteria: DEFAULT_SETTINGS.criteria,
  },
  research: {
    goal: "Machine learning research, model architectures, training methods and reproducible evaluations.",
    criteria:
      "Specific methods, study results with caveats, reproducible experiments or clearly explained research findings.",
  },
  practical: {
    goal: "Useful AI tools and practical ways to build AI applications.",
    criteria:
      "Concrete workflows, code, demos with explanations or firsthand lessons I can put into practice.",
  },
};
function updateControls() {
  for (const field of fields) {
    const value = Number($(field).value);
    $(`${field}-value`).value = String(value);
    $(field).style.setProperty("--range-fill", `${((value - 10) / 85) * 100}%`);
  }
  $("strictness-summary").textContent =
    Number($("minUsefulness").value) >= 80
      ? "Selective"
      : Number($("minUsefulness").value) < 55
        ? "Open-minded"
        : "Balanced";
  for (const button of document.querySelectorAll("[data-preset]")) {
    const preset = presets[button.dataset.preset];
    button.setAttribute(
      "aria-pressed",
      String(
        $("goal").value === preset.goal &&
          $("criteria").value === preset.criteria,
      ),
    );
  }
}
function updateStatus(status) {
  if (!status) return;
  needsResume = Boolean(status.needsResume);
  state();
  message(status.message, needsResume);
  $("remaining").textContent = Number.isInteger(status.remainingCalls)
    ? `${status.remainingCalls} analyses left in this local session.`
    : status.remainingCalls === "Unlimited" ? "No session post cap." : "";
}
async function init() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.runtime.sendMessage({ action: "readingStatus" });
  const config = result.settings || DEFAULT_SETTINGS;
  for (const field of ["goal", "criteria"]) $(field).value = config[field];
  for (const field of fields) {
    $(field).value = Math.round(config[field] * 100);
    $(`${field}-value`).value = $(field).value;
  }
  const { pairingCode = "" } = await chrome.storage.session.get("pairingCode");
  $("token").value = pairingCode;
  $("pairing").open = !pairingCode;
  $("pair-state").textContent = pairingCode ? "Paired" : "Set up";
  needsResume = Boolean(result.readingStatus?.needsResume);
  state(config.enabled);
  updateControls();
  updateStatus(result.readingStatus);
}
for (const field of [...fields, "goal", "criteria"])
  $(field).addEventListener("input", () => {
    updateControls();
    message("Apply your changes to update the feed.");
  });
for (const button of document.querySelectorAll("[data-preset]"))
  button.addEventListener("click", () => {
    const preset = presets[button.dataset.preset];
    $("goal").value = preset.goal;
    $("criteria").value = preset.criteria;
    updateControls();
    message("Apply your changes to update the feed.");
  });

$("lens-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const settings = validateSettings({
      goal: $("goal").value,
      criteria: $("criteria").value,
      ...Object.fromEntries(
        fields.map((field) => [field, Number($(field).value) / 100]),
      ),
    });
    if (!/^[a-f0-9]{48}$/.test($("token").value.trim())) {
      $("pairing").open = true;
      $("token").focus();
      throw new Error(
        "Paste the pairing code from your local app. This is not your API key.",
      );
    }
    // Request only LinkedIn, only from this explicit user gesture.
    if (
      currentTab?.url?.startsWith("https://www.linkedin.com/") &&
      !(await chrome.permissions.request({
        origins: ["https://www.linkedin.com/*"],
      }))
    )
      throw new Error(
        "LinkedIn access was not granted. Your lens is still paused.",
      );
    $("start").disabled = true;
    message("Connecting to your local Jev app…");
    await chrome.storage.session.set({ pairingCode: $("token").value.trim() });
    const result = await chrome.runtime.sendMessage({
      action: "readingStart",
      settings,
    });
    if (result.error) throw new Error(result.error);
    state(true);
    $("pairing").open = false;
    $("pair-state").textContent = "Paired";
    message("Your lens is on. Recommendations appear on the feed.");
  } catch (error) {
    message(
      error.message ||
        "Could not start the lens. Refresh the extension and retry.",
      true,
    );
  } finally {
    $("start").disabled = false;
  }
});
$("pause").addEventListener("click", async () => {
  try {
    const result = await chrome.runtime.sendMessage({ action: "readingPause" });
    state(false);
    message(result.message || result.error);
  } catch {
    message("Reload the extension to reconnect.");
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.readingStatus?.newValue)
    updateStatus(changes.readingStatus.newValue);
  if (area === "local" && changes.readingSettings?.newValue)
    state(changes.readingSettings.newValue.enabled);
});
init().catch(() =>
  message("Reload Feed Lens in chrome://extensions, then reopen it."),
);
