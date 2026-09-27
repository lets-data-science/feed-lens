import assert from "node:assert/strict";
import { copyFile, mkdir } from "node:fs/promises";
import { READING_CASES } from "../lib/reading-cases.mjs";
const name = process.argv[2];
const files = {
  questions: "reading-questions.mjs",
  policy: "reading-policy.mjs",
};
if (!Object.hasOwn(files, name || "")) {
  console.error("Usage: npm run checkpoint -- questions|policy [--restore]");
  process.exitCode = 1;
} else if (process.argv.includes("--restore")) {
  // Explicit restore preserves the learner's current file, including unfinished work.
  const backup = new URL("../backups/", import.meta.url);
  await mkdir(backup, { recursive: true });
  const filename = `${Date.now()}-${files[name]}`;
  await copyFile(
    new URL("../lib/" + files[name], import.meta.url),
    new URL(filename, backup),
  );
  await copyFile(
    new URL("../checkpoints/" + files[name], import.meta.url),
    new URL("../lib/" + files[name], import.meta.url),
  );
  console.log(
    `Restored lib/${files[name]}. Your previous work is in backups/${filename}.`,
  );
  console.log(`Now run npm run checkpoint -- ${name}, then restart npm start.`);
} else {
  try {
    if (name === "questions") {
      const { readingQuestions } = await import("../lib/reading-questions.mjs");
      const questions = readingQuestions();
      assert.deepEqual(Object.keys(questions).sort(), [
        "bait",
        "relevance",
        "usefulness",
      ]);
      for (const [key, q] of Object.entries(questions)) {
        assert.equal(q.type, "noul");
        assert.equal(typeof q.instructions, "string");
        assert.ok(q.instructions.length > 80, `${key} needs explicit criteria`);
        assert.match(q.instructions, /post_text/);
        assert.match(q.instructions, /untrusted/);
      }
      assert.match(questions.relevance.instructions, /reading_goal/);
      assert.match(questions.usefulness.instructions, /helpful_criteria/);
      console.log(
        "PASS: three separate yes/no questions, explicit state references, untrusted-text boundary.",
      );
      console.log(
        "This verifies structure, not model quality. Compare live results with your own expected decisions.",
      );
    } else {
      const { decideReading, READING_DEFAULTS } =
        await import("../lib/reading-policy.mjs");
      for (const post of READING_CASES)
        assert.equal(
          decideReading(post.answers).verdict,
          post.expected,
          post.id,
        );
      const borderline = READING_CASES.find((p) => p.id === "thin-claim");
      assert.equal(
        decideReading(borderline.answers, { minUsefulness: 0.55 }).verdict,
        "read",
      );
      assert.equal(
        decideReading(borderline.answers, { minUsefulness: 0.8 }).verdict,
        "skip",
      );
      assert.equal(decideReading(READING_CASES[0].answers).score, 90);
      const boundary = {
        relevance: { noul: READING_DEFAULTS.minRelevance },
        usefulness: { noul: READING_DEFAULTS.minUsefulness },
        bait: { noul: READING_DEFAULTS.maxBait },
      };
      assert.equal(decideReading(boundary).verdict, "unsure");
      console.log(
        "PASS: four decisions, two cutoff changes, fit arithmetic and the exact bait boundary.",
      );
      console.log(
        "These are authored test signals. Passing is not evidence of Jev accuracy.",
      );
    }
  } catch (error) {
    console.error(`NOT READY: ${name}. ${error.message}`);
    console.error(
      `Complete lib/${files[name]} using the guide. Recovery: npm run checkpoint -- ${name} --restore`,
    );
    process.exitCode = 1;
  }
}
