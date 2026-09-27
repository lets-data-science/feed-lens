import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const [major, minor] = process.versions.node.split(".").map(Number);
let failed = false;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FIX "} ${label}`);
  if (!ok) failed = true;
}
check(
  major > 22 || (major === 22 && minor >= 9),
  `Node ${process.versions.node}; need 22.9 or newer`,
);
for (const file of [
  "server.mjs",
  "extension/manifest.json",
  "lib/reading-questions.mjs",
  "lib/reading-policy.mjs",
  "public/studio.html",
]) {
  try {
    await access(new URL("../" + file, import.meta.url));
    check(true, file);
  } catch {
    check(false, `Missing ${file}. Extract the complete archive.`);
  }
}
const manifest = JSON.parse(
  await readFile(
    new URL("../extension/manifest.json", import.meta.url),
    "utf8",
  ),
);
check(manifest.version === "1.0.0", "Feed Lens extension 1.0.0");
console.log(
  "No provider request was made. Run npm start, then open http://127.0.0.1:3075.",
);
console.log(
  "Next: npm run checkpoint -- questions (expected to fail in the starter until step 3).",
);
process.exitCode = failed ? 1 : 0;
