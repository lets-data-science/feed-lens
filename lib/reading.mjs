import { MODEL } from "./questions.mjs";
import { requestJev, FeedLensError } from "./jev.mjs";
import { readingQuestions } from "./reading-questions.mjs";
import { READING_DEFAULTS } from "./reading-policy.mjs";
export { readingQuestions } from "./reading-questions.mjs";
export { decideReading, READING_DEFAULTS } from "./reading-policy.mjs";
export const READING_RUBRIC = "reading-v1";

export function validateReading(value) {
  const valid = (n) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  const keys = ["relevance", "usefulness", "bait"];
  if (
    value?.model !== MODEL ||
    !value.answers ||
    Object.keys(value.answers).length !== 3 ||
    !keys.every(
      (key) =>
        value.answers[key]?.type === "noul" && valid(value.answers[key].noul),
    ) ||
    !["input_tokens", "output_tokens"].every(
      (key) =>
        Number.isInteger(value.usage?.[key]) &&
        value.usage[key] >= 0 &&
        value.usage[key] < 100000,
    )
  ) {
    throw new Error("Unexpected reading signals");
  }
  return {
    model: MODEL,
    answers: Object.fromEntries(
      keys.map((key) => [key, { type: "noul", noul: value.answers[key].noul }]),
    ),
    usage: {
      input_tokens: value.usage.input_tokens,
      output_tokens: value.usage.output_tokens,
    },
  };
}

export function askReadingJev(
  text,
  goal,
  { criteria = READING_DEFAULTS.criteria, ...options } = {},
) {
  const questions = readingQuestions();
  if (
    !["relevance", "usefulness", "bait"].every(
      (key) => questions[key]?.type === "noul" && questions[key].instructions,
    )
  )
    throw new FeedLensError(
      "Complete lib/reading-questions.mjs in step 3 before making a live call.",
    );
  return requestJev(
    { post_text: text, reading_goal: goal, helpful_criteria: criteria },
    questions,
    validateReading,
    options,
  );
}
