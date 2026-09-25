/**
 * @file routes/analyse.js
 * Express router for the repository analysis endpoints.
 *
 * Endpoints:
 *   POST /api/analyse          — analyse a repo, return full AnalyseResult
 *   POST /api/analyse/levels   — analyse a repo, return only the levels array
 *   GET  /api/analyse/demo     — return a pre-baked demo result (no I/O)
 */

"use strict";

const { Router } = require("express");
const path = require("path");
const { analyse } = require("../analyser");

const router = Router();

// ─── Input validation helper ─────────────────────────────────────────────────

/**
 * Validate that `target` looks like a GitHub URL or an existing local path.
 * Returns an error string, or null if valid.
 *
 * @param {string} target
 * @returns {string | null}
 */
function validateTarget(target) {
  if (!target || typeof target !== "string" || target.trim() === "") {
    return "`target` is required — provide a GitHub URL or absolute local path.";
  }
  const t = target.trim();
  const isGitHub = /^https?:\/\/github\.com\//i.test(t) || /^git@github\.com:/i.test(t);
  if (isGitHub) return null;

  const localRoot = process.env.ANALYSIS_LOCAL_ROOT;
  if (!localRoot) return "`target` must be a GitHub URL (https://github.com/owner/repo).";

  const root = path.resolve(localRoot);
  const candidate = path.resolve(t);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    return "Local paths must stay within ANALYSIS_LOCAL_ROOT.";
  }
  return null;
}

// ─── POST /api/analyse ────────────────────────────────────────────────────────
/**
 * Body (JSON):
 * {
 *   target:  string  — GitHub URL or local path  (required)
 *   branch:  string  — branch name               (optional)
 *   token:   string  — GitHub PAT                (optional, private repos)
 *   slim:    boolean — omit `files` from response to reduce payload (optional)
 * }
 *
 * Response: AnalyseResult JSON
 */
router.post("/", async (req, res) => {
  const { target, branch, token, slim = false } = req.body || {};

  const validationError = validateTarget(target);
  if (validationError) {
    return res.status(400).json({
      error: "INVALID_REQUEST",
      message: validationError,
    });
  }

  try {
    const result = await analyse({
      target: target.trim(),
      branch: branch || undefined,
      token:  token  || process.env.GITHUB_TOKEN || undefined,
    });

    // Slim mode: strip the per-file array to keep the response small
    if (slim) {
      const { files: _files, ...rest } = result;
      return res.json(rest);
    }

    return res.json(result);
  } catch (err) {
    // Distinguish user errors from internal errors
    const isUserError = /^(LOCAL_SOURCE_|GITHUB_URL_PARSE_ERROR|GIT_CLONE_FAILED|GITHUB_API_FETCH_FAILED|ANALYSE_ERROR)/.test(
      err.message || ""
    );

    return res.status(isUserError ? 400 : 500).json({
      error:   isUserError ? "INVALID_TARGET"    : "ANALYSIS_FAILED",
      message: isUserError ? err.message         : "An unexpected error occurred during analysis.",
      detail:  isUserError ? undefined           : err.message,
    });
  }
});

// ─── POST /api/analyse/levels ─────────────────────────────────────────────────
/**
 * Convenience endpoint — same as POST /api/analyse but returns only:
 * { repoName, analysedAt, stats, levels, warnings }
 * Omits the verbose `files` array entirely.
 */
router.post("/levels", async (req, res) => {
  // Reuse the main handler with slim forced on
  req.body = { ...req.body, slim: true };
  // Forward to the main handler by re-calling analyse directly
  const { target, branch, token } = req.body || {};

  const validationError = validateTarget(target);
  if (validationError) {
    return res.status(400).json({ error: "INVALID_REQUEST", message: validationError });
  }

  try {
    const result = await analyse({
      target: target.trim(),
      branch: branch || undefined,
      token:  token  || process.env.GITHUB_TOKEN || undefined,
    });

    const { files: _files, ...slim } = result;
    return res.json(slim);
  } catch (err) {
    const isUserError = /^(LOCAL_SOURCE_|GITHUB_URL_PARSE_ERROR|GIT_CLONE_FAILED|GITHUB_API_FETCH_FAILED|ANALYSE_ERROR)/.test(
      err.message || ""
    );
    return res.status(isUserError ? 400 : 500).json({
      error:   isUserError ? "INVALID_TARGET" : "ANALYSIS_FAILED",
      message: err.message,
    });
  }
});

// ─── GET /api/analyse/demo ────────────────────────────────────────────────────
/**
 * Returns a pre-baked AnalyseResult for the OnboardQuest repo itself.
 * Useful for frontend dev / demos without needing a real target.
 */
router.get("/demo", (_req, res) => {
  res.json({
    repoName:    "demo/onboardquest",
    sourceType:  "local",
    analysedAt:  new Date().toISOString(),
    rootPath:    "(demo)",
    stats: {
      totalFiles:        18,
      totalLines:        1420,
      totalSizeBytes:    48200,
      languageBreakdown: { js: 12, json: 3, markdown: 1, yaml: 2 },
    },
    files: [],   // omitted in demo
    warnings: [],
    levels: [
      {
        id:          "level_entry_point",
        order:       1,
        title:       "ENTRY_POINT.EXE",
        description: "The application bootstrap — where execution begins, middleware is mounted, and the server starts listening.",
        hint:        "Open this file first. Trace every app.use() and router.use() call to build your mental map of the request pipeline.",
        kind:        "entry_point",
        difficulty:  "EASY",
        xp:          100,
        files:       ["backend/src/index.js"],
        keySymbols:  ["app.listen", "app.use"],
        badge:       "BOOT",
        icon:        "▶",
        stats:       { fileCount: 1, totalLines: 33, totalRoutes: 1, dominantLanguage: "js", languageBreakdown: { js: 1 } },
        connections: { prev: [], next: ["level_config", "level_api_route"] },
      },
      {
        id:          "level_config",
        order:       2,
        title:       "CONFIG_VAULT.EXE",
        description: "Environment variables, build configuration, and project manifests that control runtime behaviour.",
        hint:        "Check .env.example (or equivalent) to understand what external services this project depends on.",
        kind:        "config",
        difficulty:  "EASY",
        xp:          80,
        files:       ["backend/package.json", "frontend/vite.config.js", "frontend/tailwind.config.js"],
        keySymbols:  [],
        badge:       "ENV",
        icon:        "⚙",
        stats:       { fileCount: 3, totalLines: 55, totalRoutes: 0, dominantLanguage: "json", languageBreakdown: { json: 2, js: 1 } },
        connections: { prev: ["level_entry_point"], next: ["level_api_route"] },
      },
      {
        id:          "level_api_route",
        order:       4,
        title:       "ROUTE_LABYRINTH.EXE",
        description: "HTTP route handlers that define the public API surface — the contract between client and server.",
        hint:        "Read the route list top-to-bottom. Group by resource (users, orders, products). Each group is one mini-quest.",
        kind:        "api_route",
        difficulty:  "MEDIUM",
        xp:          250,
        files:       ["backend/src/routes/quests.js", "backend/src/routes/players.js", "backend/src/routes/analyse.js"],
        keySymbols:  ["GET /", "GET /:id", "POST /:id/complete", "GET /:id", "PATCH /:id/xp", "POST /", "POST /levels", "GET /demo"],
        badge:       "ROUTES",
        icon:        "⇝",
        stats:       { fileCount: 3, totalLines: 160, totalRoutes: 8, dominantLanguage: "js", languageBreakdown: { js: 3 } },
        connections: { prev: ["level_config"], next: ["level_utility"] },
      },
      {
        id:          "level_utility",
        order:       7,
        title:       "UTILITY_BELT.EXE",
        description: "Shared helper functions, services, and libraries used across the codebase.",
        hint:        "These files are the 'invisible glue'. Understanding them prevents re-inventing wheels on your first PR.",
        kind:        "utility",
        difficulty:  "MEDIUM",
        xp:          200,
        files:       [
          "backend/src/analyser/index.js",
          "backend/src/analyser/levelMapper.js",
          "backend/src/analyser/detectors/layerDetectors.js",
          "backend/src/analyser/detectors/fileParser.js",
          "backend/src/analyser/sources/localSource.js",
          "backend/src/analyser/sources/githubSource.js",
        ],
        keySymbols:  ["analyse", "mapLevels", "detectLayer", "parseFile", "walkLocal", "fetchGitHub"],
        badge:       "UTILS",
        icon:        "🔧",
        stats:       { fileCount: 6, totalLines: 900, totalRoutes: 0, dominantLanguage: "js", languageBreakdown: { js: 6 } },
        connections: { prev: ["level_api_route"], next: [] },
      },
    ],
  });
});

module.exports = router;
