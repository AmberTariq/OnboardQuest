/**
 * @file routes/mentor.js
 * AI Mentor endpoint — generates a retro "Quest Briefing" from a code layer.
 *
 * POST /api/mentor/brief
 *   Body: { levelId, title, kind, files[], snippet?, difficulty, xp }
 *   Response: Server-Sent Events stream, each event is a JSON token:
 *     { type: "token",   text: "..." }          — partial text chunk
 *     { type: "section", id: "objective"|"risks"|"reward" }  — section marker
 *     { type: "done",    briefing: { objective, risks, reward } }
 *     { type: "error",   message: "..." }
 *
 * LLM provider priority (first configured wins):
 *   1. IBM watsonx.ai  (WATSONX_API_KEY + WATSONX_PROJECT_ID + WATSONX_URL)
 *   2. OpenAI          (OPENAI_API_KEY)
 *   3. Offline fallback (deterministic template — no API key needed)
 */

"use strict";

const { Router } = require("express");
const router = Router();

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Build the system + user messages for the quest briefing.
 *
 * @param {{
 *   levelId:    string
 *   title:      string
 *   kind:       string
 *   files:      string[]
 *   snippet:    string
 *   difficulty: string
 *   xp:         number
 *   hint:       string
 *   desc:       string
 * }} level
 * @returns {{ system: string, user: string }}
 */
function buildPrompt(level) {
  const fileList = (level.files || []).slice(0, 8).join("\n  - ") || "(none provided)";
  const snippet  = (level.snippet || "").slice(0, 1800) || "(no snippet provided)";

  const system = `You are MENTOR-8, a cheerful retro 8-bit AI guide inside a game called OnboardQuest.
Your job is to brief a new developer on a section of a real codebase, framed as a video-game quest.
Always respond in the EXACT structured format below — no extra prose outside the tags.
Use plain, direct language. Sentences must be short (max 20 words each). No markdown headers.
Keep each section under 80 words. Be concrete and code-specific, not generic.

RESPONSE FORMAT (output exactly this, filling in content):
<objective>
One sentence mission. Then 2-3 bullet points starting with ► about what this layer does.
</objective>
<risks>
2-3 bullet points starting with ⚠ describing real bugs, security issues, or gotchas in this kind of layer.
</risks>
<reward>
★ XP: ${level.xp}
One key architectural insight a developer gains from understanding this layer.
</reward>`;

  const user = `Quest: ${level.title}
Layer type: ${level.kind}
Difficulty: ${level.difficulty}
Hint: ${level.hint || level.desc}

Key files:
  - ${fileList}

Code snippet:
\`\`\`
${snippet}
\`\`\`

Generate the quest briefing now.`;

  return { system, user };
}

// ─── Offline fallback ─────────────────────────────────────────────────────────

/** Deterministic briefing when no LLM is configured. */
function offlineBriefing(level) {
  const kindMap = {
    entry_point:       { obj: "Bootstrap the application server and mount all middleware.",    risk: "Missing error handlers or wrong middleware order." },
    config:            { obj: "Provide runtime configuration through environment variables.",   risk: "Secrets committed to version control." },
    auth_middleware:   { obj: "Verify identity before granting access to protected routes.",   risk: "Missing token expiry check or no rate-limiting." },
    api_route:         { obj: "Expose HTTP endpoints and handle request/response cycles.",      risk: "Unvalidated user input reaching business logic." },
    database_schema:   { obj: "Define the shape and constraints of stored data.",              risk: "Missing indexes on high-traffic query fields." },
    database_client:   { obj: "Manage database connections and execute queries.",              risk: "Connection pool exhaustion under load." },
    utility:           { obj: "Provide shared helper functions across the codebase.",          risk: "Circular dependencies causing boot-time errors." },
    frontend:          { obj: "Render the UI and manage client-side state.",                   risk: "Stale state or missing loading/error states." },
    test:              { obj: "Verify application correctness through automated checks.",      risk: "Tests that assert implementation, not behaviour." },
    ci_cd:             { obj: "Automate build, test, and deployment pipelines.",               risk: "Missing environment variable in CI, breaking deploys." },
    docs:              { obj: "Document architecture decisions and onboarding paths.",         risk: "Out-of-date docs that mislead new contributors." },
  };

  const meta = kindMap[level.kind] || { obj: "Understand this codebase layer.", risk: "Unknown unknowns — read carefully." };

  return {
    objective: `► ${meta.obj}\n► Files: ${(level.files || []).slice(0, 3).join(", ")}\n► Difficulty: ${level.difficulty}`,
    risks:     `⚠ ${meta.risk}\n⚠ Check for missing tests covering edge cases.\n⚠ Verify all imports are used and up to date.`,
    reward:    `★ XP: ${level.xp}\nUnderstanding this layer lets you safely extend or refactor it without breaking downstream consumers.`,
  };
}

// ─── LLM providers ───────────────────────────────────────────────────────────

/**
 * Stream a quest briefing via IBM watsonx.ai.
 * Yields token strings one-by-one.
 * @param {{ system: string, user: string }} prompt
 * @returns {AsyncGenerator<string>}
 */
async function* streamWatsonx(prompt) {
  const { WatsonXAI } = require("@ibm-cloud/watsonx-ai");
  const { IamAuthenticator } = require("ibm-cloud-sdk-core");

  const client = WatsonXAI.newInstance({
    authenticator: new IamAuthenticator({ apikey: process.env.WATSONX_API_KEY }),
    serviceUrl:    process.env.WATSONX_URL || "https://us-south.ml.cloud.ibm.com",
    version:       "2024-05-31",
  });

  const messages = [
    { role: "system", content: prompt.system },
    { role: "user",   content: prompt.user   },
  ];

  const stream = await client.textChatStream({
    modelId:   process.env.WATSONX_MODEL_ID || "ibm/granite-3-8b-instruct",
    projectId: process.env.WATSONX_PROJECT_ID,
    messages,
    parameters: { max_new_tokens: 600, temperature: 0.3 },
  });

  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * Stream a quest briefing via OpenAI-compatible API.
 * @param {{ system: string, user: string }} prompt
 * @returns {AsyncGenerator<string>}
 */
async function* streamOpenAI(prompt) {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stream = await client.chat.completions.create({
    model:    process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt.system },
      { role: "user",   content: prompt.user   },
    ],
    stream:      true,
    max_tokens:  600,
    temperature: 0.3,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// ─── Response parser ──────────────────────────────────────────────────────────

/**
 * Parse the LLM full text into { objective, risks, reward } sections.
 * Robust to slight formatting deviations.
 * @param {string} text
 * @returns {{ objective: string, risks: string, reward: string }}
 */
function parseSections(text) {
  const extract = (tag) => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m  = text.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    objective: extract("objective") || text.slice(0, 200),
    risks:     extract("risks")     || "",
    reward:    extract("reward")    || `★ XP: gained`,
  };
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * POST /api/mentor/brief
 *
 * Body:
 *   levelId, title, kind, files[], snippet?, difficulty, xp, hint?, desc?
 *
 * Streams Server-Sent Events. The client should open this with EventSource
 * (or fetch + ReadableStream) and reconstruct the full text.
 */
router.post("/brief", async (req, res) => {
  // ── SSE headers ──────────────────────────────────────────────────────────
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
  res.flushHeaders();

  const level = req.body || {};

  if (!level.levelId && !level.title) {
    sseWrite(res, { type: "error", message: "INVALID_REQUEST: levelId or title required" });
    return res.end();
  }

  const prompt = buildPrompt(level);

  // ── Provider selection ────────────────────────────────────────────────────
  const useWatsonx = !!(process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID);
  const useOpenAI  = !!(process.env.OPENAI_API_KEY);

  // Offline fallback path — no streaming needed
  if (!useWatsonx && !useOpenAI) {
    const briefing = offlineBriefing(level);
    // Simulate typing for offline mode by chunking the text
    const fullText = `<objective>\n${briefing.objective}\n</objective>\n<risks>\n${briefing.risks}\n</risks>\n<reward>\n${briefing.reward}\n</reward>`;
    const words    = fullText.split(" ");
    for (const word of words) {
      sseWrite(res, { type: "token", text: word + " " });
      // tiny yield so the event loop breathes; real typing feel handled client-side
      await new Promise((r) => setTimeout(r, 0));
    }
    sseWrite(res, { type: "done", briefing });
    return res.end();
  }

  // ── LLM streaming path ────────────────────────────────────────────────────
  let fullText = "";
  try {
    const tokenStream = useWatsonx
      ? streamWatsonx(prompt)
      : streamOpenAI(prompt);

    for await (const token of tokenStream) {
      fullText += token;
      sseWrite(res, { type: "token", text: token });
    }

    const briefing = parseSections(fullText);
    sseWrite(res, { type: "done", briefing });
  } catch (err) {
    console.error("[mentor] LLM stream error:", err.message);
    // On LLM failure, fall back to offline briefing
    const briefing = offlineBriefing(level);
    sseWrite(res, { type: "error", message: `LLM unavailable — showing offline briefing. (${err.message})` });
    sseWrite(res, { type: "done", briefing });
  }

  res.end();
});

module.exports = router;
