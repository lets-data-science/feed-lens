(() => {
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  function icon(name, size = 20) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    }))
      svg.setAttribute(key, String(value));
    const paths = {
      read: "m6 12 4 4 8-8",
      skip: "m8 8 8 8M16 8l-8 8",
      unsure: "M9.5 8.5a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 16h.01",
      chevron: "m9 5 7 7-7 7",
      pause: "M8 6v12M16 6v12",
      lens: "M8 3H6a3 3 0 0 0-3 3v2m13-5h2a3 3 0 0 1 3 3v2M3 16v2a3 3 0 0 0 3 3h2m8 0h2a3 3 0 0 0 3-3v-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
      pending: "M12 5a7 7 0 0 1 7 7",
    };
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", paths[name] || paths.lens);
    svg.append(path);
    return svg;
  }
  const badgeCss = `
    :host{display:block!important;margin:10px 12px!important;max-width:100%!important;min-width:0!important;color:#242424!important;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;contain:style}
    *{box-sizing:border-box}details{--accent:#167447;--tint:#f4faf6;--edge:#dcebe1;background:#fff;border:1px solid var(--edge);border-radius:10px;overflow:hidden;box-shadow:0 1px 2px #00000003}
    details.skip{--accent:#a8353a;--tint:#fff8f7;--edge:#f0dfdd}details.unsure{--accent:#805b13;--tint:#fffbf1;--edge:#eee5ca}details.pending{--accent:#77776d;--tint:#fafaf7;--edge:#e5e5df}
    summary{display:flex;align-items:center;gap:10px;min-height:65px;padding:11px 12px;background:var(--tint);cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}.mark{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;color:var(--accent);background:#fff;border:1px solid var(--edge)}.copy{flex:1;min-width:0}.label{display:block;font-size:14px;font-weight:650;letter-spacing:-.22px;color:#242424;line-height:1.2}.reason{display:block;font-size:11px;line-height:1.4;color:#686860;margin-top:4px;overflow-wrap:anywhere}
    .score{display:grid;grid-template-columns:auto auto;align-items:baseline;gap:1px;flex-shrink:0;font-variant-numeric:tabular-nums;margin-left:7px}.score b{font-size:21px;line-height:1;letter-spacing:-.8px;font-weight:600;color:var(--accent)}.score small{font-size:9px;color:#66665f}.score em{grid-column:1/-1;font-style:normal;font-size:9px;color:#65655e;margin-top:3px;line-height:1}.arrow{color:#87877e;margin-left:2px;flex-shrink:0;transition:transform .15s}details[open] .arrow{transform:rotate(90deg)}.body{padding:15px 16px 13px;border-top:1px solid var(--edge)}.explanation{font-size:12px;line-height:1.5;margin:0;color:#55554e}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:16px 0}.metric{min-width:0}.metric dt{font-size:10px;color:#686860;margin-bottom:5px;white-space:nowrap}.metric dd{margin:0;font-weight:600;font-size:16px;color:#242424;font-variant-numeric:tabular-nums}.metric dd small{font-size:10px;color:#66665f;font-weight:400}.track{height:3px;border-radius:5px;background:#edede9;margin-top:7px;overflow:hidden}.fill{display:block;height:100%;background:var(--accent);width:var(--value);border-radius:5px}.criteria{font-size:11px;color:#66665e;line-height:1.5;border-top:1px solid #eee;padding-top:12px}.criteria strong{display:block;color:#3c3c35;font-size:11px;font-weight:600;margin-bottom:3px}.criteria p{margin:0 0 8px;overflow-wrap:anywhere}.foot{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-top:11px}.stamp{display:flex;align-items:center;gap:5px;color:#707066;font-size:10px}.override{font:inherit;font-size:11px;color:#44443d;background:#fff;border:1px solid #d9d9d1;padding:6px 9px;border-radius:6px;cursor:pointer}.override:hover{background:#f7f7f3}.fine{font-size:10px;color:#66665f;line-height:1.5;margin:11px 0 0}.pending .mark svg{animation:spin .8s linear infinite}.pending .label{font-weight:500;color:#65655c}
    summary:focus-visible,button:focus-visible{outline:2px solid #ad7600;outline-offset:-3px}details{animation:arrive .16s ease-out}@keyframes arrive{from{opacity:.85}to{opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}
    @media(max-width:500px){:host{margin:8px!important}summary{padding:10px;gap:8px}.label{font-size:13px}.reason{font-size:10px}.score b{font-size:18px}.mark{width:26px;height:26px}.metrics{gap:8px}.foot{flex-wrap:wrap}}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;
  function hint(result, config) {
    if (!result) return "Matching your topics and standards";
    if (result.decision.verdict === "read")
      return "Matches your focus and standards";
    if (result.answers.relevance.noul < config.minRelevance - 0.15)
      return "Outside your chosen focus";
    if (result.answers.bait.noul >= config.maxBait)
      return "High engagement-bait signal";
    if (result.decision.verdict === "unsure")
      return "A close call. You decide.";
    return "Less useful detail than you asked for";
  }
  function badge(record, result, config, message) {
    const wasOpen = Boolean(
      record.host?.shadowRoot?.querySelector("details")?.open,
    );
    record.host?.remove();
    const host = node("div");
    host.dataset.ldsFeedLensBadge = "";
    host.dataset.feedLensVersion = "1.0.0";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.append(node("style", badgeCss));
    const verdict = result?.decision.verdict || "pending";
    host.dataset.verdict = verdict;
    const details = node(
      "details",
      undefined,
      record.override ? "read" : verdict,
    );
    details.open = wasOpen;
    const summary = node("summary"),
      mark = node("span", undefined, "mark");
    mark.append(icon(record.override ? "read" : verdict));
    const copy = node("span", undefined, "copy"),
      title = node(
        "strong",
        record.override
          ? "Your choice: read"
          : {
              read: "Worth reading",
              skip: "Skip this post",
              unsure: "Take a quick look",
            }[verdict] ||
              message ||
              "Checking this post",
        "label",
      );
    copy.append(
      title,
      node(
        "span",
        record.override ? "Saved as your reading choice" : hint(result, config),
        "reason",
      ),
    );
    summary.append(mark, copy);
    if (result) {
      const score = node("span", undefined, "score");
      score.append(
        node("b", String(result.decision.score)),
        node("small", "/100"),
        node("em", "personal fit"),
      );
      summary.append(score);
    }
    const arrow = icon("chevron", 13);
    arrow.classList.add("arrow");
    summary.append(arrow);
    details.append(summary);
    const body = node("div", undefined, "body");
    if (result) {
      body.append(
        node(
          "p",
          result.decision.verdict === "read"
            ? "Meets your topic, useful-detail and bait cutoffs."
            : result.decision.reason,
          "explanation",
        ),
      );
      const metrics = node("dl", undefined, "metrics");
      for (const [label, key] of [
        ["Topic match", "relevance"],
        ["Useful detail", "usefulness"],
        ["Bait signal", "bait"],
      ]) {
        const value = Math.round(result.answers[key].noul * 100),
          column = node("div", undefined, "metric"),
          dd = node("dd", String(value));
        dd.append(node("small", " / 100"));
        const track = node("div", undefined, "track"),
          fill = node("span", undefined, "fill");
        fill.style.setProperty("--value", `${value}%`);
        track.setAttribute("aria-hidden", "true");
        track.append(fill);
        column.append(node("dt", label), dd, track);
        metrics.append(column);
      }
      body.append(metrics);
      const criteria = node("div", undefined, "criteria");
      criteria.append(
        node("strong", "Your focus"),
        node("p", config.goal),
        node("strong", "What makes it useful"),
        node("p", config.criteria),
      );
      body.append(criteria);
      const foot = node("div", undefined, "foot"),
        stamp = node("span", undefined, "stamp");
      stamp.append(
        icon("lens", 13),
        node("span", result.cached ? "Feed Lens · cached" : "Feed Lens · Jev"),
      );
      const override = node(
        "button",
        record.override ? "Use the lens recommendation" : "I want to read this",
        "override",
      );
      override.type = "button";
      override.addEventListener("click", () => {
        record.override = !record.override;
        const next = badge(record, result, config);
        record.textNode.before(next);
        record.host = next;
      });
      foot.append(stamp, override);
      body.append(
        foot,
        node(
          "p",
          "Based on the post text, not linked pages or images. Fit is a reading signal, not an accuracy percentage. Lower bait is better.",
          "fine",
        ),
      );
    } else
      body.append(
        node(
          "p",
          message || "A live Jev check against your reading criteria.",
          "explanation",
        ),
      );
    details.append(body);
    shadow.append(details);
    return host;
  }
  const dockCss = `:host{position:fixed!important;bottom:18px!important;left:18px!important;z-index:2147483600!important;width:265px!important;max-width:calc(100vw - 36px)!important;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;color:#fff!important}*{box-sizing:border-box}section{background:#000;border:1px solid #333;border-radius:12px;padding:11px 13px;box-shadow:0 4px 16px #0002}header{display:flex;align-items:center;gap:8px}header>svg{color:#ffcb32}b{font-size:12px;font-weight:600;letter-spacing:-.15px}small{font-size:10px;color:#b6b6ac}button{margin-left:auto;width:28px;height:28px;display:grid;place-items:center;border:1px solid #444;background:#171717;color:#eee;border-radius:7px;cursor:pointer}button:hover{border-color:#b48e24;color:#ffcb32}button:focus-visible{outline:2px solid #ffcb32;outline-offset:2px}p{margin:6px 0 0;font-size:10px;line-height:1.4;color:#c3c3b8;overflow-wrap:anywhere}.error{color:#ffb6af}`;
  function dock(pause) {
    const host = node("div");
    host.dataset.ldsFeedLensToolbar = "";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.append(node("style", dockCss));
    const section = node("section"),
      header = node("header"),
      count = node("small", "Live on this feed");
    count.id = "count";
    const button = node("button");
    button.type = "button";
    button.setAttribute("aria-label", "Pause Feed Lens");
    button.title = "Pause Feed Lens";
    button.append(icon("pause", 13));
    button.addEventListener("click", pause);
    header.append(icon("lens", 19), node("b", "Feed Lens"), count, button);
    const status = node("p");
    status.id = "status";
    status.setAttribute("role", "status");
    section.append(header, status);
    shadow.append(section);
    return host;
  }
  globalThis.__ldsFeedLensUI = { badge, dock };
})();
