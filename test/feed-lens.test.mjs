import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { createFeedLensServer } from "../server.mjs";
import { validateAnswer } from "../lib/validate.mjs";
import { fixtureResult, POSTS, GOALS } from "../lib/fixtures.mjs";
import { decidePost, DEFAULTS } from "../lib/policy.mjs";
import { buildQuestions } from "../lib/questions.mjs";
import { askJev } from "../lib/jev.mjs";
const sample = () => ({
  ...fixtureResult("post-01", GOALS.data),
  usage: { input_tokens: 100, output_tokens: 0 },
});
const body = (overrides = {}) => ({
  mode: "live",
  postId: "post-01",
  text: POSTS[0].text,
  goal: GOALS.data,
  ...overrides,
});
async function server(t, options = {}) {
  const app = createFeedLensServer({
    apiKey: "test-secret-never-ship",
    evaluate: async () => sample(),
    perMinute: 50,
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
  const config = await (await fetch(`${base}/api/config`)).json();
  const post = (value, headers = {}) =>
    fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Feed-Lens-Token": config.token,
        ...headers,
      },
      body: JSON.stringify(value),
    });
  return { base, config, post };
}
test("questions define every inspected dimension with explicit state references", () => {
  const questions = buildQuestions();
  assert.deepEqual(Object.keys(questions), [
    "kind",
    "bait",
    "generic",
    "specifics",
    "relevance",
  ]);
  for (const question of Object.values(questions))
    assert.ok(question.instructions.includes("post_text"));
  assert.ok(questions.relevance.instructions.includes("reading_goal"));
});
test("fixed examples reproduce visible rules, including a normal discussion question", () => {
  const decisions = POSTS.map((post) =>
    decidePost(fixtureResult(post.id, GOALS.data).answers),
  );
  assert.deepEqual(
    decisions.map((item) => item.fold),
    [false, true, false, true, true, false],
  );
  assert.equal(decisions[5].label, "Read with context");
  assert.equal(
    decidePost(fixtureResult("post-01", GOALS.product).answers).fold,
    true,
  );
  assert.equal(
    decidePost(fixtureResult("post-02", GOALS.data).answers, {
      ...DEFAULTS,
      maxBait: 1,
    }).fold,
    false,
  );
});
test("validator rejects shape, range and contradictory score changes and drops extra fields", () => {
  assert.equal(
    validateAnswer({ ...sample(), secret: "must-not-forward" }).secret,
    undefined,
  );
  for (const mutate of [
    (v) => (v.answers.bait.noul = NaN),
    (v) => (v.answers.bait.noul = 1.1),
    (v) => delete v.answers.specifics,
    (v) => (v.model = "other"),
    (v) => (v.answers.generic.score = 1.8),
    (v) => (v.usage.input_tokens = -1),
    (v) => (v.answers.kind.probabilities.opinion = 0.5),
    (v) => (v.answers.generic.legend["0"] = "changed"),
  ]) {
    const value = sample();
    mutate(value);
    assert.throws(() => validateAnswer(value));
  }
});
test("transport pins the endpoint and model, sends only text and goal, hides provider errors", async () => {
  let request;
  const result = await askJev(POSTS[0].text, GOALS.data, {
    apiKey: "test-key",
    fetcher: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify(sample()));
    },
  });
  assert.equal(result.answers.kind.choice, "educational");
  assert.equal(request.url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(request.init.redirect, "error");
  assert.deepEqual(Object.keys(JSON.parse(request.init.body).state), [
    "post_text",
    "reading_goal",
  ]);
  await assert.rejects(
    askJev("public text", GOALS.data, {
      apiKey: "test-key",
      fetcher: async () =>
        new Response("private provider body test-key", { status: 401 }),
    }),
    (error) =>
      !error.message.includes("test-key") && error.message.includes("rejected"),
  );
});
test("oversized provider streams are canceled before the full body is buffered", async () => {
  let consumed = 0,
    canceled = false;
  const stream = new ReadableStream({
    pull(controller) {
      consumed += 16000;
      controller.enqueue(new Uint8Array(16000));
      if (consumed >= 1024000) controller.close();
    },
    cancel() {
      canceled = true;
    },
  });
  await assert.rejects(
    askJev("public text", GOALS.data, {
      apiKey: "test-key",
      fetcher: async () => new Response(stream),
    }),
    /unexpected answer/,
  );
  assert.equal(canceled, true);
  assert.ok(consumed < 1024000);
});
test("offline app serves only allowlisted assets and never leaks its API key", async (t) => {
  const { base, config, post } = await server(t);
  assert.equal(config.liveAvailable, true);
  assert.ok(!JSON.stringify(config).includes("test-secret"));
  for (const path of [
    "/.env.local",
    "/server.mjs",
    "/lib/jev.mjs",
    "/extension/manifest.json",
  ])
    assert.equal((await fetch(base + path)).status, 404);
  const response = await post(body({ mode: "demo" }));
  const data = await response.json();
  assert.equal(data.mode, "demo");
  assert.equal(data.usage, undefined);
  assert.equal(data.remainingCalls, 40);
  assert.equal(
    (await post(body({ mode: "demo", text: "Changed public text" }))).status,
    400,
  );
});
test("local requests require a pairing code and reject cross-site origins and bad input", async (t) => {
  const { base, post } = await server(t);
  assert.equal((await post(body(), { "X-Feed-Lens-Token": "" })).status, 403);
  assert.equal(
    (await post(body(), { "X-Feed-Lens-Token": "é".repeat(48) })).status,
    403,
  );
  assert.equal(
    (await post(body(), { Origin: "https://example.com" })).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/config", {
        headers: { Origin: "chrome-extension://" + "a".repeat(32) },
      })
    ).status,
    403,
  );
  assert.equal(
    (await post(body(), { Origin: "chrome-extension://" + "a".repeat(32) }))
      .status,
    200,
  );
  assert.equal((await post(body({ preferences: { maxBait: 8 } }))).status, 400);
  assert.equal((await post(body({ text: "x".repeat(25000) }))).status, 413);
});
test("malformed request URLs return 400 and the server stays available", async (t) => {
  const { base } = await server(t);
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port: new URL(base).port,
        path: "//[",
        method: "GET",
      },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(status, 400);
  assert.equal((await fetch(base + "/api/config")).status, 200);
});
test("identical inputs deduplicate, rule changes reuse cache, goal changes spend a new call", async (t) => {
  let calls = 0;
  const { post } = await server(t, {
    evaluate: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return sample();
    },
  });
  const first = await Promise.all([post(body()), post(body())]);
  assert.ok(first.every((response) => response.ok));
  assert.equal(calls, 1);
  const cached = await (
    await post(body({ preferences: { minRelevance: 1, maxBait: 0.7 } }))
  ).json();
  assert.equal(cached.cached, true);
  assert.equal(cached.decision.fold, true);
  assert.equal(calls, 1);
  await post(body({ goal: GOALS.ai }));
  assert.equal(calls, 2);
});
test("cap bounds paid attempts, including errors; cached answers still work after the cap", async (t) => {
  const { post } = await server(t, { maxCalls: 1 });
  assert.equal((await post(body())).status, 200);
  assert.equal((await post(body({ goal: GOALS.ai }))).status, 429);
  assert.equal((await post(body())).status, 200);
});
test("unknown thrown errors cannot leak secrets and missing keys do not silently use fixtures", async (t) => {
  const bad = await server(t, {
    evaluate: async () => {
      throw new Error("test-secret-never-ship");
    },
  });
  const response = await bad.post(body());
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes("test-secret"));
  const empty = await server(t, { apiKey: "" });
  assert.equal((await empty.post(body())).status, 503);
  assert.equal((await empty.post(body({ mode: "demo" }))).status, 200);
});
