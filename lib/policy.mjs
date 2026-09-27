/** @type {Readonly<{minRelevance: number, maxBait: number}>} */
export const DEFAULTS = Object.freeze({ minRelevance: 0.55, maxBait: 0.7 });

// The model supplies signals. These visible, editable rules decide what is folded.
export function decidePost(answers, preferences = DEFAULTS) {
  if (answers.bait.noul >= preferences.maxBait) {
    return {
      tone: "amber",
      fold: true,
      label: "Possible engagement bait",
      reason: "Bait signal meets your cutoff.",
    };
  }
  if (answers.relevance.noul < preferences.minRelevance) {
    return {
      tone: "muted",
      fold: true,
      label: "Outside your focus",
      reason: "Relevance signal is below your minimum.",
    };
  }
  if (answers.specifics.noul >= 0.6 && answers.generic.score < 1) {
    return {
      tone: "green",
      fold: false,
      label: "Worth a closer look",
      reason:
        "Fits your goal and includes specifics. Check the claims yourself.",
    };
  }
  return {
    tone: "blue",
    fold: false,
    label: "Read with context",
    reason: "Fits your goal. The available detail may be limited.",
  };
}
