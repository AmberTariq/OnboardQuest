/**
 * @file levelMapper.js
 * Converts a flat array of AnalysedFile objects into an ordered array of
 * game Level objects that the frontend renders as the Level Map.
 *
 * Mapping logic:
 *  1. Group analysed files by LayerKind.
 *  2. Apply the LAYER_META table to turn each group into a Level.
 *  3. Sort levels by canonical play-order (entry → auth → routes → db → …).
 *  4. Collect key symbols (route paths, exported names) per level.
 *  5. Build connection edges (prev / next) to wire the map graph.
 *  6. Compute XP from file count and complexity signals.
 */

"use strict";

// ─── Layer metadata table ────────────────────────────────────────────────────
//
// Defines every canonical layer's game identity.
// Properties:
//   order      – canonical play order (lower = first)
//   title      – retro .EXE window title
//   description – one-sentence architectural role
//   hint        – actionable onboarding tip
//   difficulty  – base difficulty (may be promoted for large / complex groups)
//   badge       – short label shown in the difficulty chip
//   icon        – single character / emoji for the map node
//   baseXp      – XP before complexity multiplier
//
/** @type {Record<import('./schema').LayerKind, Object>} */
const LAYER_META = {
  entry_point: {
    order:       1,
    title:       "ENTRY_POINT.EXE",
    description: "The application bootstrap — where execution begins, middleware is mounted, and the server starts listening.",
    hint:        "Open this file first. Trace every app.use() and router.use() call to build your mental map of the request pipeline.",
    difficulty:  "EASY",
    badge:       "BOOT",
    icon:        "▶",
    baseXp:      100,
  },
  config: {
    order:       2,
    title:       "CONFIG_VAULT.EXE",
    description: "Environment variables, build configuration, and project manifests that control runtime behaviour.",
    hint:        "Check .env.example (or equivalent) to understand what external services this project depends on.",
    difficulty:  "EASY",
    badge:       "ENV",
    icon:        "⚙",
    baseXp:      80,
  },
  auth_middleware: {
    order:       3,
    title:       "GUARDIAN.EXE",
    description: "Authentication and authorisation middleware — the gatekeepers that protect every secured route.",
    hint:        "Find where tokens/sessions are validated. Look for req.user assignments — that's what downstream handlers trust.",
    difficulty:  "MEDIUM",
    badge:       "GUARDIAN",
    icon:        "🔐",
    baseXp:      200,
  },
  api_route: {
    order:       4,
    title:       "ROUTE_LABYRINTH.EXE",
    description: "HTTP route handlers that define the public API surface — the contract between client and server.",
    hint:        "Read the route list top-to-bottom. Group by resource (users, orders, products). Each group is one mini-quest.",
    difficulty:  "MEDIUM",
    badge:       "ROUTES",
    icon:        "⇝",
    baseXp:      250,
  },
  database_schema: {
    order:       5,
    title:       "SCHEMA_WORLD.EXE",
    description: "Data models, ORM schemas, and SQL migrations that describe what the application stores.",
    hint:        "Sketch the entity relationships. Every model that has a 'belongs to' or foreign key is a join you'll hit in queries.",
    difficulty:  "HARD",
    badge:       "SCHEMA",
    icon:        "🗄",
    baseXp:      300,
  },
  database_client: {
    order:       6,
    title:       "DB_GATEWAY.EXE",
    description: "Database connection setup, query builders, and repository classes that execute data operations.",
    hint:        "Find the connection string origin. Check for connection pooling — misconfigured pools are a common production footgun.",
    difficulty:  "HARD",
    badge:       "DB",
    icon:        "💾",
    baseXp:      250,
  },
  utility: {
    order:       7,
    title:       "UTILITY_BELT.EXE",
    description: "Shared helper functions, services, and libraries used across the codebase.",
    hint:        "These files are the 'invisible glue'. Understanding them prevents re-inventing wheels on your first PR.",
    difficulty:  "MEDIUM",
    badge:       "UTILS",
    icon:        "🔧",
    baseXp:      150,
  },
  frontend: {
    order:       8,
    title:       "UI_REALM.EXE",
    description: "Client-side pages, components, and views — the visual layer users interact with.",
    hint:        "Find the root component and the router. Understanding the page hierarchy helps you locate where to add new screens.",
    difficulty:  "MEDIUM",
    badge:       "UI",
    icon:        "🖥",
    baseXp:      200,
  },
  test: {
    order:       9,
    title:       "TEST_ARENA.EXE",
    description: "Unit, integration, and end-to-end tests that validate the application's correctness.",
    hint:        "Run the test suite before your first commit. Green tests = safe playground. Red tests = landmines to defuse.",
    difficulty:  "EASY",
    badge:       "TEST",
    icon:        "✓",
    baseXp:      120,
  },
  ci_cd: {
    order:       10,
    title:       "DEPLOY_PIPELINE.EXE",
    description: "CI/CD workflows, Dockerfiles, and deployment scripts that automate builds, tests, and releases.",
    hint:        "Read the pipeline YAML left-to-right — it tells you the exact steps needed to ship a change.",
    difficulty:  "MEDIUM",
    badge:       "DEVOPS",
    icon:        "🚀",
    baseXp:      150,
  },
  docs: {
    order:       11,
    title:       "LORE_ARCHIVE.EXE",
    description: "Documentation, READMEs, changelogs, and architectural decision records.",
    hint:        "Start with README.md. Then look for an ADR (Architecture Decision Record) folder — these explain *why* choices were made.",
    difficulty:  "EASY",
    badge:       "LORE",
    icon:        "📜",
    baseXp:      60,
  },
  unknown: {
    order:       12,
    title:       "MYSTERY_ZONE.EXE",
    description: "Files that could not be classified into a known architectural layer — worth investigating.",
    hint:        "These unclassified files sometimes hide important glue code. Open a few and see if a pattern emerges.",
    difficulty:  "MEDIUM",
    badge:       "???",
    icon:        "?",
    baseXp:      80,
  },
};

// ─── Difficulty promotion rules ───────────────────────────────────────────────

/**
 * Promote the difficulty of a level based on complexity signals.
 * @param {"EASY"|"MEDIUM"|"HARD"|"BOSS"} base
 * @param {number} fileCount
 * @param {number} totalRoutes
 * @returns {"EASY"|"MEDIUM"|"HARD"|"BOSS"}
 */
function promoteDifficulty(base, fileCount, totalRoutes) {
  const TIERS = ["EASY", "MEDIUM", "HARD", "BOSS"];
  let tier = TIERS.indexOf(base);

  if (fileCount > 20)      tier = Math.min(tier + 1, 3);
  if (fileCount > 50)      tier = Math.min(tier + 1, 3);
  if (totalRoutes > 30)    tier = Math.min(tier + 1, 3);
  if (totalRoutes > 60)    tier = 3; // always BOSS

  return TIERS[tier];
}

// ─── Key symbol extraction ────────────────────────────────────────────────────

/**
 * Pick the most meaningful identifiers from a group of AnalysedFiles to
 * surface on the level card.
 *
 * @param {import('./schema').AnalysedFile[]} files
 * @param {import('./schema').LayerKind}      kind
 * @returns {string[]}  up to 10 key symbols
 */
function extractKeySymbols(files, kind) {
  const symbols = new Set();

  for (const f of files) {
    // Route paths are the most useful symbols for route layers
    if (kind === "api_route" || kind === "entry_point") {
      f.routes.forEach((r) => symbols.add(`${r.method} ${r.path}`));
    }
    // Export names for schema / auth / utility layers
    f.exports
      .filter((e) => e.name && e.name !== "default")
      .forEach((e) => symbols.add(e.name));
  }

  return [...symbols].slice(0, 10);
}

// ─── XP computation ───────────────────────────────────────────────────────────

/**
 * Compute XP award for a level.
 * Base XP × (1 + 0.1 per file beyond the first, capped at 3×).
 *
 * @param {number} baseXp
 * @param {number} fileCount
 * @returns {number} rounded to nearest 25
 */
function computeXp(baseXp, fileCount) {
  const multiplier = Math.min(1 + (fileCount - 1) * 0.1, 3);
  const raw = baseXp * multiplier;
  return Math.round(raw / 25) * 25;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert an array of AnalysedFiles into an ordered array of game Levels.
 *
 * @param {import('./schema').AnalysedFile[]} analysedFiles
 * @returns {import('./schema').Level[]}
 */
function mapLevels(analysedFiles) {
  // 1. Group files by layer kind
  /** @type {Map<import('./schema').LayerKind, import('./schema').AnalysedFile[]>} */
  const groups = new Map();

  for (const file of analysedFiles) {
    const kind = file.layer;
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(file);
  }

  // 2. Build one Level per group present in this repo
  const levels = [];

  for (const [kind, files] of groups.entries()) {
    const meta       = LAYER_META[kind] || LAYER_META.unknown;
    const totalRoutes = files.reduce((sum, f) => sum + f.routes.length, 0);
    const fileCount   = files.length;
    const totalLines  = files.reduce((sum, f) => sum + f.lineCount, 0);
    const difficulty  = promoteDifficulty(meta.difficulty, fileCount, totalRoutes);
    const xp          = computeXp(meta.baseXp, fileCount);
    const keySymbols  = extractKeySymbols(files, kind);

    // Language breakdown for this level
    const langCount = {};
    files.forEach((f) => {
      langCount[f.language] = (langCount[f.language] || 0) + 1;
    });
    const dominantLanguage = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";

    levels.push({
      id:          `level_${kind}`,
      order:       meta.order,
      title:       meta.title,
      description: meta.description,
      hint:        meta.hint,
      kind,
      difficulty,
      xp,
      files:       files.map((f) => f.relPath),
      keySymbols,
      badge:       meta.badge,
      icon:        meta.icon,
      // Rich stats exposed so the frontend can render detail panels
      stats: {
        fileCount,
        totalLines,
        totalRoutes,
        dominantLanguage,
        languageBreakdown: langCount,
      },
      connections: { prev: [], next: [] }, // wired in next step
    });
  }

  // 3. Sort by canonical order
  levels.sort((a, b) => a.order - b.order);

  // 4. Wire linear connections (simple chain; frontend can render as branching graph)
  for (let i = 0; i < levels.length; i++) {
    if (i > 0)                  levels[i].connections.prev.push(levels[i - 1].id);
    if (i < levels.length - 1)  levels[i].connections.next.push(levels[i + 1].id);
  }

  // 5. Add cross-layer conceptual edges (always present when both layers exist)
  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]));
  const CROSS_EDGES = [
    // auth middleware feeds into api routes
    ["level_auth_middleware", "level_api_route"],
    // entry point directly connects to routes
    ["level_entry_point",     "level_api_route"],
    // routes depend on db
    ["level_api_route",       "level_database_schema"],
    ["level_api_route",       "level_database_client"],
    // db schema and client are siblings
    ["level_database_schema", "level_database_client"],
  ];

  for (const [fromId, toId] of CROSS_EDGES) {
    const from = levelById[fromId];
    const to   = levelById[toId];
    if (!from || !to) continue;
    if (!from.connections.next.includes(toId)) from.connections.next.push(toId);
    if (!to.connections.prev.includes(fromId)) to.connections.prev.push(fromId);
  }

  return levels;
}

module.exports = { mapLevels, LAYER_META };
