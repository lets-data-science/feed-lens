// Fictional posts and authored signals for deterministic policy practice. No model accuracy claim.
const answers = (relevance, usefulness, bait) =>
  Object.fromEntries(
    Object.entries({ relevance, usefulness, bait }).map(([key, noul]) => [
      key,
      { type: "noul", noul },
    ]),
  );
export const READING_CASES = [
  {
    id: "evaluation",
    author: "Maya Chen",
    initials: "MC",
    role: "AI engineering · fictional example",
    title: "A retrieval change needs a fair comparison.",
    text: "Before changing your RAG retriever, save a held-out set of questions and the passages that should answer them. Run the same questions through both versions. Inspect retrieval misses separately from answers that ignore good context. If you tune on those examples, keep a second set for the final comparison.",
    answers: answers(0.95, 0.9, 0.03),
    expected: "read",
    why: "The available text gives a concrete evaluation method that fits the AI engineering goal.",
  },
  {
    id: "gated-guide",
    author: "Alex Morgan",
    initials: "AM",
    role: "Creator · fictional example",
    title: "The secret agent playbook.",
    text: "I built the AI agent playbook nobody wants you to see. It will change everything. Follow me and comment AGENT to unlock the secret framework. I only send the steps to people who comment. No methods or examples are included in this post.",
    answers: answers(0.92, 0.12, 0.97),
    expected: "skip",
    why: "The topic fits, but the substance is withheld behind engagement. A relevant keyword does not make a post useful.",
  },
  {
    id: "thin-claim",
    author: "Noor Patel",
    initials: "NP",
    role: "Builder · fictional example",
    title: "A result worth a closer look?",
    text: "We tried reranking in our RAG app and saw better answers. We compared results on our usual questions and liked the new ordering. I will share the test set and measurements later; for now this is an early observation, not a reproducible benchmark.",
    answers: answers(0.94, 0.6, 0.08),
    expected: "unsure",
    why: "A useful direction, but limited evidence in the text. Its usefulness signal is just below the chosen cutoff.",
  },
  {
    id: "off-topic",
    author: "Sam Rivera",
    initials: "SR",
    role: "Outdoor writer · fictional example",
    title: "A useful post for another reading session.",
    text: "For a day hike, pack water, a weather layer, a map and a charged phone. Tell someone your route and expected return time. Check local conditions before leaving. Turn around early if weather or daylight makes the return unsafe.",
    answers: answers(0.04, 0.15, 0.01),
    expected: "skip",
    why: "Helpful hiking advice can still miss an AI engineering reading goal. Skip describes fit for this lens, not a judgement of the author.",
  },
];
