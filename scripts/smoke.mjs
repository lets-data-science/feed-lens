import { askReadingJev, READING_DEFAULTS } from "../lib/reading.mjs";
import { READING_CASES } from "../lib/reading-cases.mjs";
if (!process.argv.includes("--live")) {
  console.log(
    "No request made. npm run smoke -- --live sends ONE fictional post to TypeSafe using your .env.local key. Provider charges apply.",
  );
} else {
  try {
    const result = await askReadingJev(
      READING_CASES[0].text,
      READING_DEFAULTS.goal,
      { apiKey: process.env.TYPESAFE_API_KEY },
    );
    console.log(
      JSON.stringify(
        { model: result.model, answers: result.answers, usage: result.usage },
        null,
        2,
      ),
    );
    console.log(
      "Success means the connection and response contract worked. Exact signals can vary. This CLI call is separate from the web server session cap.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
