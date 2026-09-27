import { MODEL, buildQuestions } from "./questions.mjs";
import { validateAnswer } from "./validate.mjs";
export class FeedLensError extends Error {}
export async function askJev(text, goal, { apiKey, fetcher = fetch } = {}) {
  if (
    !["kind", "bait", "generic", "specifics", "relevance"].every((name) =>
      Object.hasOwn(buildQuestions(), name),
    )
  )
    throw new FeedLensError(
      "Complete buildQuestions() in lib/questions.mjs before live analysis.",
    );
  return requestJev(
    { post_text: text, reading_goal: goal },
    buildQuestions(),
    validateAnswer,
    { apiKey, fetcher },
  );
}
export async function requestJev(
  state,
  questions,
  validate,
  { apiKey, fetcher = fetch } = {},
) {
  if (!apiKey?.trim())
    throw new FeedLensError(
      "Add your TypeSafe API key to .env.local and restart the server.",
    );
  let response;
  try {
    response = await fetcher("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        state,
        questions,
      }),
    });
  } catch {
    throw new FeedLensError(
      "Jev did not respond within the connection window. The post was left unchanged. Try again when ready.",
    );
  }
  if (!response.ok) {
    const errors = {
      401: "Your API key was rejected. Check .env.local, then restart.",
      403: "This key does not have access. Check your TypeSafe account.",
      422: "Jev rejected the question format. Check your question definitions.",
      429: "Jev is rate limiting requests. Wait a minute, then try again.",
      529: "Jev is busy. Try again later.",
    };
    throw new FeedLensError(
      errors[response.status] ||
        "Jev could not complete this request. The post was left unchanged.",
    );
  }
  try {
    const reader = response.body.getReader(),
      chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 64000) {
          await reader.cancel();
          throw new Error("Too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const payload = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
    return validate(JSON.parse(payload));
  } catch {
    throw new FeedLensError(
      "Jev returned an unexpected answer. The post was left unchanged.",
    );
  }
}
