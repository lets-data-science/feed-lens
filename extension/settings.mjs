export const BASE = "http://127.0.0.1:3075";
export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  goal: "AI engineering, LLMs, agents, retrieval and evaluating AI applications.",
  criteria:
    "Concrete explanations, useful examples, reproducible methods, code, evidence or lessons I can apply. Avoid vague hype and sales pitches.",
  minRelevance: 0.7,
  minUsefulness: 0.65,
  maxBait: 0.7,
});
export function supportedPage(value) {
  try {
    const url = new URL(value);
    return (
      url.origin === BASE ||
      (url.origin === "https://www.linkedin.com" &&
        /^\/feed(?:\/|$)/.test(url.pathname))
    );
  } catch {
    return false;
  }
}
export function validateSettings(value) {
  const clean = { ...DEFAULT_SETTINGS };
  for (const key of ["goal", "criteria"]) {
    if (
      typeof value?.[key] !== "string" ||
      value[key].trim().length < 8 ||
      value[key].length > 300
    )
      throw new Error(
        "Describe your topic and helpfulness criteria in 8–300 characters each.",
      );
    clean[key] = value[key].trim();
  }
  for (const key of ["minRelevance", "minUsefulness", "maxBait"]) {
    const n = value[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0.1 || n > 0.95)
      throw new Error("Choose a cutoff between 10 and 95.");
    clean[key] = n;
  }
  return clean;
}
