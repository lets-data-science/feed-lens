import { MODEL, KINDS, GENERIC_LEVELS } from "./questions.mjs";
export const GOALS = {
  data: "Learn practical SQL, data quality and data engineering techniques.",
  ai: "Learn how to build and evaluate useful AI applications.",
  product: "Learn about product discovery and customer research.",
};
// Fictional people and posts. Every demo signal below is authored, not a Jev result.
export const POSTS = [
  {
    id: "post-01",
    author: "Maya Chen",
    initials: "MC",
    role: "Data engineer",
    time: "12 min",
    text: "A LEFT JOIN can quietly turn into an INNER JOIN.\n\nIf you put WHERE orders.status = 'paid' after the join, customers with no orders disappear. Put that condition in the ON clause when you need to keep every customer.\n\nI test it with three customers: one paid order, one unpaid order, and no orders. The result should still contain all three customers.",
    kind: "educational",
    bait: 0.04,
    generic: 0,
    specifics: 0.95,
    relevance: { data: 0.96, ai: 0.25, product: 0.12 },
  },
  {
    id: "post-02",
    author: "Alex Morgan",
    initials: "AM",
    role: "Building in public",
    time: "28 min",
    text: "99% of data professionals are doing this WRONG.\n\nI put the secret framework in a private guide. It will change everything about your career.\n\nLike this post, follow me and comment DATA below. I will send it to you. You cannot afford to miss this.",
    kind: "promotion",
    bait: 0.96,
    generic: 2,
    specifics: 0.08,
    relevance: { data: 0.65, ai: 0.12, product: 0.18 },
  },
  {
    id: "post-03",
    author: "Noor Patel",
    initials: "NP",
    role: "AI product engineer",
    time: "41 min",
    text: "Our support classifier looked great until we tested vague messages.\n\nWe added a needs-review route when the top two categories were close, then checked 30 ambiguous examples separately from clear ones. That exposed failures our single overall accuracy score had hidden.\n\nNext experiment: compare the review queue at two thresholds before changing the default.",
    kind: "educational",
    bait: 0.03,
    generic: 0,
    specifics: 0.93,
    relevance: { data: 0.78, ai: 0.97, product: 0.55 },
  },
  {
    id: "post-04",
    author: "Sam Rivera",
    initials: "SR",
    role: "Team lead",
    time: "1 hr",
    text: "The future belongs to people who embrace change.\n\nStay curious. Think bigger. Keep showing up. Success is a mindset and growth is a journey.\n\nWhat is one word that describes your week?",
    kind: "opinion",
    bait: 0.28,
    generic: 2,
    specifics: 0.05,
    relevance: { data: 0.12, ai: 0.1, product: 0.15 },
  },
  {
    id: "post-05",
    author: "Ellis Park",
    initials: "EP",
    role: "Product researcher",
    time: "2 hr",
    text: "We stopped asking customers, “Would you use this?”\n\nInstead: “Tell me about the last time you tried to solve this problem.” Then we asked to see the spreadsheet, message or workaround they actually used.\n\nThose concrete examples changed our interview notes from feature wish lists into a map of existing habits.",
    kind: "educational",
    bait: 0.02,
    generic: 0,
    specifics: 0.92,
    relevance: { data: 0.25, ai: 0.3, product: 0.96 },
  },
  {
    id: "post-06",
    author: "Robin Ellis",
    initials: "RE",
    role: "Analytics engineer",
    time: "3 hr",
    text: "Small data tests are underrated.\n\nOne check for duplicate order IDs would have caught our broken dashboard much earlier. We now run that check before publishing.\n\nWhich data check has saved your team the most time?",
    kind: "opinion",
    bait: 0.06,
    generic: 1,
    specifics: 0.76,
    relevance: { data: 0.94, ai: 0.45, product: 0.3 },
  },
];
export function fixtureResult(postId, goal) {
  const post = POSTS.find((item) => item.id === postId);
  const goalId = Object.keys(GOALS).find((key) => GOALS[key] === goal);
  if (!post || !goalId)
    throw new Error(
      "Demo mode needs an original sample post and a preset goal.",
    );
  return {
    model: MODEL,
    answers: {
      kind: {
        type: "choice",
        choice: post.kind,
        probabilities: Object.fromEntries(
          Object.keys(KINDS).map((key) => [key, key === post.kind ? 1 : 0]),
        ),
        confidence: 1,
      },
      bait: { type: "noul", noul: post.bait },
      generic: {
        type: "score",
        score: post.generic,
        probabilities: Object.fromEntries(
          GENERIC_LEVELS.map((_, index) => [
            String(index),
            index === post.generic ? 1 : 0,
          ]),
        ),
        legend: Object.fromEntries(
          GENERIC_LEVELS.map((text, index) => [String(index), text]),
        ),
        confidence: 1,
      },
      specifics: { type: "noul", noul: post.specifics },
      relevance: { type: "noul", noul: post.relevance[goalId] },
    },
  };
}
