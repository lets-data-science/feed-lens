import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createFeedLensServer, sessionCallLimit } from "../server.mjs";
import { MODEL } from "../lib/questions.mjs";
import {
  askReadingJev,
  validateReading,
  decideReading,
  READING_DEFAULTS,
  readingQuestions,
} from "../lib/reading.mjs";
import {
  supportedPage,
  validateSettings,
  DEFAULT_SETTINGS,
} from "../extension/settings.mjs";
const signals = (relevance = 0.95, usefulness = 0.9, bait = 0.03) => ({
  model: MODEL,
  answers: Object.fromEntries(
    Object.entries({ relevance, usefulness, bait }).map(([k, noul]) => [
      k,
      { type: "noul", noul },
    ]),
  ),
  usage: { input_tokens: 250, output_tokens: 0 },
});
const input = (changes) => ({
  product: "reading",
  mode: "live",
  text: "Here is a concrete lesson about evaluating a retrieval system with an independent labelled set.",
  goal: READING_DEFAULTS.goal,
  criteria: READING_DEFAULTS.criteria,
  ...changes,
});
async function setup(t, options = {}) {
  const app = createFeedLensServer({
    apiKey: "test-key-never-ship",
    evaluateReading: async () => signals(),
    ...options,
  });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  t.after(
    () =>
      new Promise((resolve) => {
        app.closeAllConnections();
        app.close(resolve);
      }),
  );
  const base = `http://127.0.0.1:${app.address().port}`;
  const config = await (await fetch(base + "/api/config")).json();
  const headers = {
    "Content-Type": "application/json",
    "X-Feed-Lens-Token": config.token,
  };
  return {
    base,
    headers,
    post: (body = input()) =>
      fetch(base + "/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
  };
}
test("session caps require an explicit valid setting; unlimited is opt-in", () => {
  assert.equal(sessionCallLimit(undefined), 40);
  assert.equal(sessionCallLimit(""), 40);
  assert.equal(sessionCallLimit("10"), 10);
  assert.equal(sessionCallLimit("unlimited"), null);
  for (const value of ["0", "-1", "NaN", "Infinity", "1.5", "typo"])
    assert.throws(() => sessionCallLimit(value));
  for (const maxCalls of [0, -1, Infinity, NaN])
    assert.throws(() => createFeedLensServer({ maxCalls }));
});
test("uncapped sessions pass 40 posts while preserving authentication and the rate limit", async (t) => {
  let calls = 0;
  const { base, headers, post } = await setup(t, {
    maxCalls: null,
    readingPerMinute: 42,
    evaluateReading: async () => { calls++; return signals(); },
  });
  assert.equal((await fetch(base + "/api/status")).status, 403);
  for (let i = 0; i < 42; i++) {
    const response = await post(input({ text: `Example ${i}: compare retrieval results on a held-out set of questions.` }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).remainingCalls, "Unlimited");
  }
  const status = await (await fetch(base + "/api/status", { headers })).json();
  assert.equal(status.maxCalls, null);
  assert.equal(status.remainingCalls, "Unlimited");
  const limited = await post(input({ text: "A new post should still respect the per-minute request boundary." }));
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "rate_limit");
  assert.equal(calls, 42);
});
test("reading policy requires topic AND usefulness, isolates bait and distinguishes borderline uncertainty", () => {
  assert.equal(decideReading(signals().answers).verdict, "read");
  assert.equal(decideReading(signals(0.98, 0.05).answers).verdict, "skip");
  assert.equal(decideReading(signals(0.05, 0.98).answers).verdict, "skip");
  assert.equal(
    decideReading(signals(0.99, 0.99, 0.98).answers).verdict,
    "skip",
  );
  assert.equal(decideReading(signals(0.67, 0.8).answers).verdict, "unsure");
  assert.equal(decideReading(signals(0.95, 0.8, 0.1).answers).score, 80);
  assert.equal(decideReading(signals(0.7, 0.65, 0.69).answers).verdict, "read");
});
test("decimal margins remain inclusive at exactly 0.15, and bait includes its clear-miss boundary", () => {
  for (const dimension of ["relevance", "usefulness"]) {
    const answers = signals().answers;
    answers[dimension].noul = 0.3;
    const preferences = {
      [dimension === "relevance" ? "minRelevance" : "minUsefulness"]: 0.45,
    };
    assert.equal(decideReading(answers, preferences).verdict, "unsure");
    answers[dimension].noul = 0.299999;
    assert.equal(decideReading(answers, preferences).verdict, "skip");
  }
  assert.equal(
    decideReading(signals(0.9, 0.9, 0.8).answers, { maxBait: 0.7 }).verdict,
    "skip",
  );
  assert.equal(
    decideReading(signals(0.9, 0.9, 0.799999).answers, { maxBait: 0.7 })
      .verdict,
    "unsure",
  );
});
test("reading transport sends only text and two criteria, with exactly three atomic questions", async () => {
  const result = await askReadingJev(input().text, input().goal, {
    apiKey: "private-key",
    criteria: input().criteria,
    fetcher: async (url, init) => {
      const data = JSON.parse(init.body);
      assert.equal(url, "https://api.typesafe.ai/v1/systemone");
      assert.deepEqual(Object.keys(data.state), [
        "post_text",
        "reading_goal",
        "helpful_criteria",
      ]);
      assert.deepEqual(Object.keys(data.questions).sort(), [
        "bait",
        "relevance",
        "usefulness",
      ]);
      return new Response(JSON.stringify(signals()));
    },
  });
  assert.equal(result.model, MODEL);
  for (const question of Object.values(readingQuestions()))
    assert.match(question.instructions, /untrusted/);
});
test("reading response validation rejects missing dimensions, non-finite numbers and wrong models", () => {
  for (const mutate of [
    (v) => delete v.answers.usefulness,
    (v) => (v.answers.relevance.noul = NaN),
    (v) => (v.answers.bait.noul = 5),
    (v) => (v.answers.relevance.type = "choice"),
    (v) => (v.model = "unknown"),
    (v) => (v.usage.input_tokens = -1),
  ]) {
    const v = signals();
    mutate(v);
    assert.throws(() => validateReading(v));
  }
  assert.equal(
    validateReading({ ...signals(), apiKey: "never-echo" }).apiKey,
    undefined,
  );
});
test("only feed paths and the exact local server are supported, with bounded saved preferences", () => {
  assert.ok(supportedPage("https://www.linkedin.com/feed/"));
  assert.ok(
    supportedPage("https://www.linkedin.com/feed/update/urn:li:activity:1"),
  );
  for (const url of [
    "https://www.linkedin.com/messaging/",
    "https://www.linkedin.com/feedback",
    "https://linkedin.com.evil.test/feed/",
    "http://127.0.0.1:9999/",
    "https://example.com",
  ])
    assert.equal(supportedPage(url), false);
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  assert.throws(() =>
    validateSettings({ ...DEFAULT_SETTINGS, minUsefulness: "0.6" }),
  );
  assert.throws(() =>
    validateSettings({ ...DEFAULT_SETTINGS, criteria: "x".repeat(301) }),
  );
});
test("local health is authenticated, excludes credentials, and is available to paired extensions", async (t) => {
  const { base, headers } = await setup(t);
  assert.equal((await fetch(base + "/api/status")).status, 403);
  const response = await fetch(base + "/api/status", {
    headers: { ...headers, Origin: "chrome-extension://" + "a".repeat(32) },
  });
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.liveAvailable, true);
  assert.equal(value.remainingCalls, 40);
  assert.ok(!JSON.stringify(value).includes("test-key"));
});
test("reading criteria affect cache identity; thresholds reuse the same underlying signals", async (t) => {
  let calls = 0;
  const { post } = await setup(t, {
    evaluateReading: async () => {
      calls++;
      return signals();
    },
  });
  const first = await (await post()).json();
  assert.equal(first.decision.verdict, "read");
  const cached = await (
    await post(input({ preferences: { minUsefulness: 0.95 } }))
  ).json();
  assert.equal(cached.cached, true);
  assert.equal(cached.decision.verdict, "unsure");
  assert.equal(calls, 1);
  await post(
    input({
      criteria:
        "Only detailed reproducible benchmarks with published evaluation examples.",
    }),
  );
  assert.equal(calls, 2);
});
test("simultaneous reading requests are deduplicated and cap errors are explicit", async (t) => {
  let calls = 0;
  const { post } = await setup(t, {
    maxCalls: 1,
    evaluateReading: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return signals();
    },
  });
  const result = await Promise.all([post(), post()]);
  assert.ok(result.every((r) => r.ok));
  assert.equal(calls, 1);
  const limited = await post(
    input({ text: "A different post with another independent example." }),
  );
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "budget");
});
test("rate limits expose a bounded wait and malformed reading requests cannot trigger calls", async (t) => {
  const { post } = await setup(t, { readingPerMinute: 1 });
  for (const changes of [
    { criteria: "" },
    { mode: "demo" },
    { preferences: { minUsefulness: -1 } },
  ])
    assert.equal((await post(input(changes))).status, 400);
  assert.equal((await post()).status, 200);
  const limited = await post(
    input({ text: "Another distinct post to evaluate on the feed." }),
  );
  const value = await limited.json();
  assert.equal(value.code, "rate_limit");
  assert.ok(value.retryAfterMs > 0 && value.retryAfterMs <= 60000);
});

test("reading bursts do not inherit the legacy sample-feed rate, while the session cap still bounds calls", async (t) => {
  const { post } = await setup(t, {
    perMinute: 1,
    readingPerMinute: 60,
    maxCalls: 14,
  });
  for (let i = 0; i < 14; i++)
    assert.equal(
      (
        await post(
          input({
            text: `Distinct AI reading example number ${i}: hold evaluation data out of training.`,
          }),
        )
      ).status,
      200,
    );
  const stopped = await post(
    input({ text: "One extra new post beyond the configured session cap." }),
  );
  assert.equal(stopped.status, 429);
  assert.equal((await stopped.json()).code, "budget");
});

test("an explicit local restart token is validated and never exposed through status", async (t) => {
  assert.throws(() => createFeedLensServer({ pairingToken: "weak" }));
  const token = "b".repeat(48);
  const { base, headers } = await setup(t, { pairingToken: token });
  assert.equal(headers["X-Feed-Lens-Token"], token);
  const status = await (await fetch(base + "/api/status", { headers })).json();
  assert.ok(!JSON.stringify(status).includes(token));
});
