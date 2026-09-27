import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { askJev, FeedLensError } from "./lib/jev.mjs";
import { POSTS, GOALS, fixtureResult } from "./lib/fixtures.mjs";
import { MODEL, RUBRIC_VERSION, buildQuestions } from "./lib/questions.mjs";
import { decidePost, DEFAULTS } from "./lib/policy.mjs";
import {
  askReadingJev,
  decideReading,
  readingQuestions,
  READING_DEFAULTS,
  READING_RUBRIC,
} from "./lib/reading.mjs";

const assets = new Map([
  ["/", ["public/studio.html", "text/html; charset=utf-8"]],
  ["/sandbox", ["public/index.html", "text/html; charset=utf-8"]],
  ["/studio.css", ["public/studio.css", "text/css; charset=utf-8"]],
  ["/studio.mjs", ["public/studio.mjs", "text/javascript; charset=utf-8"]],
  ["/lds-logo.svg", ["public/lds-logo.svg", "image/svg+xml"]],
  ["/reading-policy.mjs", ["lib/reading-policy.mjs", "text/javascript; charset=utf-8"]],
  ["/reading-cases.mjs", ["lib/reading-cases.mjs", "text/javascript; charset=utf-8"]],
  ["/app.css", ["public/app.css", "text/css; charset=utf-8"]],
  ["/app.mjs", ["public/app.mjs", "text/javascript; charset=utf-8"]],
  ["/policy.mjs", ["lib/policy.mjs", "text/javascript; charset=utf-8"]],
]);
const root = new URL("./", import.meta.url);
const MAX_BODY = 24000;
const extensionOrigin = (value) =>
  /^chrome-extension:\/\/[a-p]{32}$/.test(value || "");
const equalToken = (value, expected) =>
  typeof value === "string" &&
  Buffer.byteLength(value) === Buffer.byteLength(expected) &&
  timingSafeEqual(Buffer.from(value), Buffer.from(expected));

export function sessionCallLimit(value) {
  if (value === undefined || value.trim() === "") return 40;
  if (value.trim().toLowerCase() === "unlimited") return null;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error("FEED_LENS_MAX_CALLS must be a positive whole number or unlimited.");
  return limit;
}

export function createFeedLensServer({
  apiKey = process.env.TYPESAFE_API_KEY,
  evaluate = askJev,
  evaluateReading = askReadingJev,
  maxCalls = 40,
  perMinute = 12,
  readingPerMinute = 60,
  pairingToken,
} = {}) {
  if (maxCalls !== null && (!Number.isSafeInteger(maxCalls) || maxCalls < 1))
    throw new Error("maxCalls must be a positive whole number or null for unlimited.");
  if (pairingToken !== undefined && !/^[a-f0-9]{48}$/.test(pairingToken))
    throw new Error("Invalid local pairing token");
  const token = pairingToken || randomBytes(24).toString("hex");
  const cache = new Map(),
    pending = new Map();
  let calls = 0,
    recent = [];
  const remainingCalls = () => maxCalls === null ? "Unlimited" : maxCalls - calls;
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    const send = (status, body) => {
      if (!response.destroyed) {
        response.writeHead(status, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify(body));
      }
    };
    const host = request.headers.host;
    const port = server.address()?.port;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host))
      return send(403, {
        error: "Use the loopback address printed by the server.",
      });
    const origin = request.headers.origin;
    const ownOrigin = !origin || origin === `http://${host}`;
    const extension = extensionOrigin(origin);
    let pathname;
    try {
      pathname = new URL(request.url, "http://127.0.0.1").pathname;
    } catch {
      return send(400, { error: "Invalid local request address." });
    }
    if (!ownOrigin && !extension)
      return send(403, {
        error: "This local app does not accept requests from that website.",
      });
    if (extension && ["/api/analyze", "/api/status"].includes(pathname)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader(
        "Access-Control-Allow-Headers",
        "content-type, x-feed-lens-token",
      );
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
    }
    try {
      if (request.method === "GET" && pathname === "/api/config") {
        if (!ownOrigin || request.headers["sec-fetch-site"] === "cross-site")
          return send(403, {
            error: "Open the local app to pair your extension.",
          });
        return send(200, {
          token,
          model: MODEL,
          rubric: RUBRIC_VERSION,
          liveAvailable: Boolean(apiKey?.trim()),
          remainingCalls: remainingCalls(),
          maxCalls,
          goals: GOALS,
          posts: POSTS.map(({ id, author, initials, role, time, text }) => ({
            id,
            author,
            initials,
            role,
            time,
            text,
          })),
        });
      }
      if (request.method === "GET" && assets.has(pathname)) {
        const [file, type] = assets.get(pathname);
        const content = await readFile(new URL(file, root));
        response.writeHead(200, { "Content-Type": type });
        response.end(content);
        return;
      }
      if (pathname === "/api/status" && request.method === "GET") {
        if (!equalToken(request.headers["x-feed-lens-token"], token))
          return send(403, {
            error:
              "Pair with the current local server. Its code changes after a restart.",
          });
        return send(200, {
          model: MODEL,
          liveAvailable: Boolean(apiKey?.trim()),
          remainingCalls: remainingCalls(),
          maxCalls,
          perMinute,
          readingPerMinute,
        });
      }
      if (pathname !== "/api/analyze")
        return send(404, { error: "Not found." });
      if (request.method !== "POST")
        return send(405, { error: "Use POST to analyze a post." });
      if (!equalToken(request.headers["x-feed-lens-token"], token))
        return send(403, {
          error:
            "Pair with the current local server. Its pairing code changes after a restart.",
        });
      if (request.headers["content-type"]?.split(";")[0] !== "application/json")
        return send(415, { error: "Send a JSON request." });
      if (Number(request.headers["content-length"]) > MAX_BODY)
        return send(413, {
          error: "A post can contain at most 5,000 characters.",
        });
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > MAX_BODY)
          return send(413, {
            error: "A post can contain at most 5,000 characters.",
          });
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        return send(400, { error: "The request is not valid JSON." });
      }
      if (
        !body ||
        Array.isArray(body) ||
        !["demo", "live"].includes(body.mode) ||
        typeof body.text !== "string" ||
        body.text.trim().length < 8 ||
        body.text.length > 5000 ||
        typeof body.goal !== "string" ||
        body.goal.trim().length < 8 ||
        body.goal.length > 300
      )
        return send(400, {
          error:
            "Choose a mode, a post of 8–5,000 characters, and a reading goal of 8–300 characters.",
        });
      const text = body.text.trim(),
        goal = body.goal.trim();
      const reading = body.product === "reading";
      const criteria = body.criteria ?? READING_DEFAULTS.criteria;
      if (
        reading &&
        (body.mode !== "live" ||
          typeof criteria !== "string" ||
          criteria.trim().length < 8 ||
          criteria.length > 300)
      )
        return send(400, {
          error:
            "Reading mode requires live Jev and helpfulness criteria of 8–300 characters.",
        });
      const preferences = {
        ...(reading ? READING_DEFAULTS : DEFAULTS),
        ...(body.preferences || {}),
      };
      const decide = reading ? decideReading : decidePost;
      if (
        !(
          reading
            ? ["minRelevance", "minUsefulness", "maxBait"]
            : ["minRelevance", "maxBait"]
        ).every(
          (key) =>
            typeof preferences[key] === "number" &&
            Number.isFinite(preferences[key]) &&
            preferences[key] >= 0 &&
            preferences[key] <= 1,
        )
      )
        return send(400, { error: "Set each cutoff between 0 and 1." });
      if (body.mode === "demo") {
        const original = POSTS.find(
          (post) => post.id === body.postId && post.text === text,
        );
        if (!original || !Object.values(GOALS).includes(goal))
          return send(400, {
            error:
              "Demo mode uses original sample posts and preset goals. Custom text needs live mode.",
          });
        const result = fixtureResult(original.id, goal);
        return send(200, {
          ...result,
          mode: "demo",
          cached: false,
          decision: decidePost(result.answers, preferences),
          remainingCalls: remainingCalls(),
        });
      }
      if (!apiKey?.trim())
        return send(503, {
          error:
            "Add your TypeSafe API key to .env.local and restart. Demo mode still works.",
        });
      const key = createHash("sha256")
        .update(
          JSON.stringify([
            MODEL,
            reading ? READING_RUBRIC : RUBRIC_VERSION,
            reading ? readingQuestions() : buildQuestions(),
            text,
            goal,
            reading ? criteria.trim() : "",
          ]),
        )
        .digest("hex");
      if (cache.has(key))
        return send(200, {
          ...cache.get(key),
          cached: true,
          decision: decide(cache.get(key).answers, preferences),
          remainingCalls: remainingCalls(),
        });
      let work = pending.get(key),
        reused = Boolean(work);
      if (!work) {
        recent = recent.filter((time) => Date.now() - time < 60000);
        if (maxCalls !== null && calls >= maxCalls)
          return send(429, {
            error:
              "This session reached its live-call cap. Restart deliberately to begin a new session.",
            remainingCalls: 0,
            code: "budget",
          });
        const rateLimit = reading ? readingPerMinute : perMinute;
        if (recent.length >= rateLimit || pending.size >= 2)
          return send(429, {
            error:
              "The local request limit is active. Wait a minute before trying again.",
            remainingCalls: remainingCalls(),
            code: "rate_limit",
            retryAfterMs:
              recent.length >= rateLimit
                ? Math.max(1000, 60000 - (Date.now() - recent[0]))
                : 250,
          });
        calls += 1;
        recent.push(Date.now());
        work = (async () => {
          const started = performance.now();
          const result = await (reading ? evaluateReading : evaluate)(
            text,
            goal,
            { apiKey, criteria: reading ? criteria.trim() : undefined },
          );
          const entry = {
            ...result,
            mode: "live",
            cached: false,
            durationMs: Math.round(performance.now() - started),
          };
          cache.set(key, entry);
          if (cache.size > 50) cache.delete(cache.keys().next().value);
          return entry;
        })();
        pending.set(key, work);
      }
      try {
        const result = await work;
        send(200, {
          ...result,
          cached: reused,
          decision: decide(result.answers, preferences),
          remainingCalls: remainingCalls(),
        });
      } catch (error) {
        send(502, {
          error:
            error instanceof FeedLensError
              ? error.message
              : "Analysis failed. The post was left unchanged. Try again when ready.",
          remainingCalls: remainingCalls(),
        });
      } finally {
        if (pending.get(key) === work) pending.delete(key);
      }
    } catch {
      send(500, {
        error:
          "The local server could not complete this request. The post was left unchanged.",
      });
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 5000;
  return server;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3075);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("PORT must be between 1024 and 65535.");
  const maxCalls = sessionCallLimit(process.env.FEED_LENS_MAX_CALLS);
  createFeedLensServer({ maxCalls }).listen(port, "127.0.0.1", () => {
    console.log(`Feed Lens is ready: http://127.0.0.1:${port}`);
    console.log(maxCalls === null ? "No session post cap. Live calls use your TypeSafe account." : `Session cap: ${maxCalls} attempted live calls.`);
    console.log(
      "The practice feed is free to open. Live analysis uses your own TypeSafe key.",
    );
  });
}
