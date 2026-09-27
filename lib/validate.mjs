import { MODEL, KINDS, GENERIC_LEVELS } from "./questions.mjs";
const object = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
const probability = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;
const keysMatch = (value, keys) =>
  object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
function distribution(value, keys) {
  return (
    keysMatch(value, keys) &&
    Object.values(value).every(probability) &&
    Math.abs(Object.values(value).reduce((sum, item) => sum + item, 0) - 1) <=
      0.005
  );
}
export function validateAnswer(value) {
  const reject = () => {
    throw new Error(
      "Jev returned an unexpected answer. The post was left unchanged.",
    );
  };
  if (
    !object(value) ||
    value.model !== MODEL ||
    !keysMatch(value.answers, [
      "kind",
      "bait",
      "generic",
      "specifics",
      "relevance",
    ])
  )
    reject();
  const { kind, generic } = value.answers;
  const kinds = Object.keys(KINDS),
    levels = GENERIC_LEVELS.map((_, index) => String(index));
  if (
    !object(kind) ||
    kind.type !== "choice" ||
    !kinds.includes(kind.choice) ||
    !probability(kind.confidence) ||
    !distribution(kind.probabilities, kinds)
  )
    reject();
  if (
    kind.probabilities[kind.choice] + 0.0001 <
    Math.max(...Object.values(kind.probabilities))
  )
    reject();
  if (
    !object(generic) ||
    generic.type !== "score" ||
    !probability(generic.confidence) ||
    !distribution(generic.probabilities, levels) ||
    !keysMatch(generic.legend, levels) ||
    !levels.every(
      (level) => generic.legend[level] === GENERIC_LEVELS[Number(level)],
    )
  )
    reject();
  const weighted = levels.reduce(
    (sum, level) => sum + Number(level) * generic.probabilities[level],
    0,
  );
  if (
    typeof generic.score !== "number" ||
    !Number.isFinite(generic.score) ||
    generic.score < 0 ||
    generic.score > 2 ||
    Math.abs(generic.score - weighted) > 0.015
  )
    reject();
  for (const name of ["bait", "specifics", "relevance"])
    if (
      !object(value.answers[name]) ||
      value.answers[name].type !== "noul" ||
      !probability(value.answers[name].noul)
    )
      reject();
  if (
    !object(value.usage) ||
    !["input_tokens", "output_tokens"].every(
      (key) =>
        Number.isInteger(value.usage[key]) &&
        value.usage[key] >= 0 &&
        value.usage[key] < 100000,
    )
  )
    reject();
  // Only known fields cross back to the browser; provider payloads and errors stay private.
  return {
    model: MODEL,
    answers: {
      kind: {
        type: "choice",
        choice: kind.choice,
        confidence: kind.confidence,
        probabilities: Object.fromEntries(
          kinds.map((key) => [key, kind.probabilities[key]]),
        ),
      },
      generic: {
        type: "score",
        score: generic.score,
        confidence: generic.confidence,
        probabilities: Object.fromEntries(
          levels.map((key) => [key, generic.probabilities[key]]),
        ),
        legend: Object.fromEntries(
          levels.map((key) => [key, generic.legend[key]]),
        ),
      },
      ...Object.fromEntries(
        ["bait", "specifics", "relevance"].map((key) => [
          key,
          { type: "noul", noul: value.answers[key].noul },
        ]),
      ),
    },
    usage: {
      input_tokens: value.usage.input_tokens,
      output_tokens: value.usage.output_tokens,
    },
  };
}
