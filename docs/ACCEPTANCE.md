# Feed Lens acceptance checklist

Run these on your own build. Record date, OS, Chrome version, model version, question edits and observed outcomes in NOTES.md. Do not record keys, pairing codes or personal feed text.

## Offline checks

- `npm run check`: supported Node and complete files.
- `npm run checkpoint -- questions`: three explicit yes/no questions and state boundary.
- `npm run checkpoint -- policy`: authored read/skip/unsure examples and exact boundary behavior.
- `npm test`: all deterministic tests pass in a fresh extraction of your finished build.
- Run `npm start` without a key: workspace and rule explorer work, live checks explain missing key.
- Restore a checkpoint in a disposable copy and confirm your previous file is saved under backups/.

## Real browser loop

1. Start with the fictional local feed. Load extension 1.0.0, pair and explicitly start.
2. A visible text post gets a badge. Offscreen posts are checked as they enter view, not prefetched.
3. Open a badge. Its three signals and your active criteria are readable, including at browser zoom.
4. Use I want to read this, then Use the lens recommendation. The model scores stay unchanged.
5. Change only a cutoff and Apply lens. A cached response can be reused. Change helpfulness text and confirm a fresh request is used for previously scored text.
6. Pause. Badges disappear; posts stay intact. Requests already in flight can finish, but must not repaint stale badges.
7. Switch to another tab. The background feed stops starting requests. Return and check that it resumes only while enabled.
8. Stop your own Node server. A new post must show connection failure without a fabricated success result. Restart, refresh the local app, copy the new pairing code and resume explicitly.
9. Go to your own LinkedIn Home, grant its optional permission and test supported text posts. Check read, skip, borderline results and disagreements. Do not assume every account/layout is supported.
10. Reload the page; verify no duplicate badges. When changing extension source, reload its exact installed card and refresh the feed. Confirm version 1.0.0.

## Input isolation

On the local practice page, inspect the POST /api/analyze request in browser developer tools if you know how. It should contain the selected/visible post text, topic, helpfulness and preferences. It must not contain an API key, comments, messages or author profile fields. Do not share raw headers or pairing tokens from those tools. Provider transport is server-side.

## Evaluation, separate from software tests

Write expectations before calling Jev. Include substantive AI guidance, thin AI claims, gated advice, normal discussion, helpful off-topic text and hostile instructions embedded in a post. Keep a few cases aside while revising prompts. Track false reads and false skips rather than a single flattering number. Live scores are not fixed answer keys. The four authored practice cases are not a model benchmark.

## Report a failure

Write the failing action, expected behavior, actual behavior, browser/model version and a fictional minimal reproduction. Exclude credentials and private LinkedIn content. Diagnose extraction first, then model judgement, then policy, then rendering. A missing badge can be an unsupported layout; do not broaden access or scrape the whole card to hide the failure.
