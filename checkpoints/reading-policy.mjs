export const READING_DEFAULTS = Object.freeze({
  goal: "AI engineering, LLMs, agents, retrieval and evaluating AI applications.",
  criteria:
    "Concrete explanations, useful examples, reproducible methods, code, evidence or lessons I can apply. Avoid vague hype and sales pitches.",
  minRelevance: 0.7,
  minUsefulness: 0.65,
  maxBait: 0.7,
});

export function decideReading(answers, preferences = READING_DEFAULTS) {
  const limits = { ...READING_DEFAULTS, ...preferences };
  const relevance = answers.relevance.noul,
    usefulness = answers.usefulness.noul,
    bait = answers.bait.noul;
  // A transparent bottleneck index, not a probability of accuracy or truth.
  const score = Math.round(100 * Math.min(relevance, usefulness, 1 - bait));
  const reasons = [];
  if (relevance < limits.minRelevance)
    reasons.push("Topic match is below your minimum.");
  if (usefulness < limits.minUsefulness)
    reasons.push("The text offers less practical value than you asked for.");
  if (bait >= limits.maxBait)
    reasons.push("The engagement-bait signal crosses your limit.");
  if (!reasons.length)
    return {
      verdict: "read",
      label: "Worth reading",
      score,
      reason:
        "Matches your topic and helpfulness criteria, with a low bait signal.",
    };
  // Keep marginal results separate from an unambiguous failure of a reading rule.
  // Honor decimal boundaries despite floating-point roundoff, e.g. 0.45 - 0.30.
  const epsilon = 1e-9;
  const clearMiss =
    limits.minRelevance - relevance > 0.15 + epsilon ||
    limits.minUsefulness - usefulness > 0.15 + epsilon ||
    bait >= Math.min(1, limits.maxBait + 0.1) - epsilon;
  return {
    verdict: clearMiss ? "skip" : "unsure",
    label: clearMiss ? "Skip for this lens" : "Worth a quick look",
    score,
    reason: reasons.join(" "),
  };
}
