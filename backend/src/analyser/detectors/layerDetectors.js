/**
 * @file layerDetectors.js
 * Pattern-based classification of source files into architectural LayerKinds.
 *
 * Detection runs through an ordered list of rules. The first rule whose ALL
 * conditions match wins. Rules check:
 *   - file path / name (regex against relPath)
 *   - file content (substring or regex scan)
 *   - file extension
 *
 * Design principle: keep every rule explicit and auditable. Signal strings are
 * collected so the frontend can explain WHY a file ended up in a layer.
 */

"use strict";

const path = require("path");

// ─── Individual rule definitions ─────────────────────────────────────────────

/**
 * @typedef {Object} DetectorRule
 * @property {import('../schema').LayerKind} layer
 * @property {string}   signal     - Human-readable reason string
 * @property {RegExp[]} [pathMatches]    - relPath must match ALL of these
 * @property {RegExp[]} [pathNotMatches] - relPath must NOT match any of these
 * @property {string[]} [contentIncludes]  - content must include ALL of these substrings
 * @property {RegExp[]} [contentMatches]   - content must match ALL of these regexes
 * @property {string[]} [extensions]       - extension must be one of these
 */

/** @type {DetectorRule[]} */
const RULES = [
  // ── Tests ───────────────────────────────────────────────────────────────
  {
    layer: "test",
    signal: "file is inside a test/spec directory or has a .test/.spec suffix",
    pathMatches: [/(?:^|\/)(?:__tests?__|tests?|spec|e2e|cypress|jest|vitest)\//i],
  },
  {
    layer: "test",
    signal: "filename contains .test. or .spec.",
    pathMatches: [/\.(test|spec)\.(js|ts|jsx|tsx|py|rb|go|java|cs)$/i],
  },
  {
    layer: "test",
    signal: "file imports a testing framework",
    contentMatches: [
      /(?:import|require)\s*\(?['"](?:jest|mocha|chai|vitest|pytest|rspec|testing-library|supertest)['"]/,
    ],
  },

  // ── CI / CD ──────────────────────────────────────────────────────────────
  {
    layer: "ci_cd",
    signal: "file is a GitHub Actions workflow",
    pathMatches: [/^\.github\/workflows\//i],
  },
  {
    layer: "ci_cd",
    signal: "file is a CI/CD config (CircleCI, Travis, GitLab, Jenkinsfile…)",
    pathMatches: [/(?:^|\/)(?:\.circleci|\.travis\.yml|\.gitlab-ci\.yml|jenkinsfile|\.drone\.yml|bitbucket-pipelines\.yml)/i],
  },
  {
    layer: "ci_cd",
    signal: "Dockerfile / docker-compose detected",
    pathMatches: [/(?:^|\/)(?:dockerfile|docker-compose[^/]*\.ya?ml)$/i],
  },

  // ── Docs ─────────────────────────────────────────────────────────────────
  {
    layer: "docs",
    signal: "Markdown or documentation file",
    pathMatches: [/\.(md|mdx|rst|txt|adoc)$/i],
    pathNotMatches: [/(?:^|\/)(?:changelog|release)/i],
  },

  // ── Config ──────────────────────────────────────────────────────────────
  {
    layer: "config",
    signal: "package.json / manifest at repo root",
    pathMatches: [/^(?:package\.json|composer\.json|Cargo\.toml|go\.mod|requirements\.txt|Pipfile|pyproject\.toml|gemfile)$/i],
  },
  {
    layer: "config",
    signal: "recognised config file extension or name",
    pathMatches: [/(?:^|\/)(?:\.env(?:\.\w+)?|\.eslintrc[^/]*|\.babelrc|\.prettierrc[^/]*|tsconfig[^/]*\.json|vite\.config\.[jt]s|webpack\.config\.[jt]s|rollup\.config\.[jt]s|jest\.config\.[jt]s|vitest\.config\.[jt]s|tailwind\.config\.[jt]s|postcss\.config\.[jt]s|next\.config\.[jt]s|nuxt\.config\.[jt]s|\.stylelintrc[^/]*)$/i],
  },
  {
    layer: "config",
    signal: "YAML/TOML/INI at a config-like path",
    pathMatches: [/(?:^|\/)(?:config|settings|configuration)[^/]*\.(?:ya?ml|toml|ini|json)$/i],
  },

  // ── Database schemas ─────────────────────────────────────────────────────
  {
    layer: "database_schema",
    signal: "SQL migration or schema file",
    pathMatches: [/(?:^|\/)(?:migrations?|schema|db\/schema)[^/]*\.sql$/i],
  },
  {
    layer: "database_schema",
    signal: "Prisma schema file",
    pathMatches: [/\.prisma$/i],
  },
  {
    layer: "database_schema",
    signal: "file is in a models/schemas/entities directory",
    pathMatches: [/(?:^|\/)(?:models?|schemas?|entities|domain)[^/]*\//i],
    extensions: [".js", ".ts", ".py", ".java", ".cs", ".go", ".rb"],
  },
  {
    layer: "database_schema",
    signal: "file imports an ORM/ODM (Mongoose, Sequelize, TypeORM, SQLAlchemy…)",
    contentMatches: [
      /(?:import|require|from)\s*\(?['"](?:mongoose|sequelize|typeorm|prisma\/client|@prisma\/client|sqlalchemy|knex|objection|waterline|drizzle-orm)['"]/i,
    ],
  },
  {
    layer: "database_schema",
    signal: "file defines a Mongoose/Sequelize model or schema",
    contentMatches: [
      /(?:new\s+Schema\s*\(|mongoose\.model\s*\(|DataTypes\.|@Entity\(\)|@Table\(|class\s+\w+\s+extends\s+Model)/,
    ],
  },

  // ── Database client / connection ─────────────────────────────────────────
  {
    layer: "database_client",
    signal: "file is in a db/database/repository directory",
    pathMatches: [/(?:^|\/)(?:db|database|repositories?|data-access|dal)[^/]*\//i],
  },
  {
    layer: "database_client",
    signal: "file establishes a database connection",
    contentMatches: [
      /(?:createConnection|createPool|MongoClient\.connect|pg\.Pool|mysql\.createConnection|mongoose\.connect|redis\.createClient|new\s+PrismaClient)/,
    ],
  },

  // ── Auth middleware ───────────────────────────────────────────────────────
  {
    layer: "auth_middleware",
    signal: "file is in an auth/middleware directory",
    pathMatches: [/(?:^|\/)(?:auth|authentication|authorization|middleware|guards?)[^/]*\//i],
  },
  {
    layer: "auth_middleware",
    signal: "filename contains auth/middleware/guard/jwt/passport",
    pathMatches: [/(?:^|\/)(?:auth|middleware|guard|jwt|passport|verify|protect)[^.]*\.[jt]sx?$/i],
  },
  {
    layer: "auth_middleware",
    signal: "file uses a JWT/session/auth library",
    contentMatches: [
      /(?:import|require|from)\s*\(?['"](?:jsonwebtoken|passport|passport-jwt|passport-local|express-session|next-auth|@auth\/core|bcrypt|bcryptjs|argon2)['"]/i,
    ],
  },
  {
    layer: "auth_middleware",
    signal: "file verifies tokens or checks roles",
    contentMatches: [
      /(?:jwt\.verify|jwt\.sign|passport\.authenticate|req\.user|next\(\)|res\.locals\.user|verifyToken|isAuthenticated)/,
    ],
  },

  // ── API routes ───────────────────────────────────────────────────────────
  {
    layer: "api_route",
    signal: "file is in a routes/controllers/handlers/api directory",
    pathMatches: [/(?:^|\/)(?:routes?|controllers?|handlers?|api|endpoints?)[^/]*\//i],
  },
  {
    layer: "api_route",
    signal: "filename suggests a route/controller/handler",
    pathMatches: [/(?:^|\/)(?:[^/]+-?(?:route|controller|handler|router|endpoint)s?)\.[jt]sx?$/i],
  },
  {
    layer: "api_route",
    signal: "file registers HTTP method handlers (Express/Fastify/Koa/Hapi…)",
    contentMatches: [
      /(?:router|app|server|fastify)\s*\.(?:get|post|put|patch|delete|all|use)\s*\(\s*['"]/,
    ],
  },
  {
    layer: "api_route",
    signal: "file uses Next.js API handler export",
    contentMatches: [
      /export\s+(?:default\s+)?(?:async\s+)?function\s+handler\s*\(\s*req/,
    ],
  },
  {
    layer: "api_route",
    signal: "file uses FastAPI/Flask/Django route decorators",
    contentMatches: [
      /@(?:app|router|blueprint)\s*\.(?:get|post|put|patch|delete|route)\s*\(/,
    ],
  },

  // ── Frontend ──────────────────────────────────────────────────────────────
  {
    layer: "frontend",
    signal: "file is in a pages/views/components/screens directory",
    pathMatches: [/(?:^|\/)(?:pages?|views?|components?|screens?|ui|client|public)[^/]*\//i],
  },
  {
    layer: "frontend",
    signal: "file is a React/Vue/Svelte/Angular component",
    pathMatches: [/\.(jsx|tsx|vue|svelte)$/i],
  },
  {
    layer: "frontend",
    signal: "file imports React or a UI framework",
    contentMatches: [
      /(?:import|require)\s*\(?['"](?:react|vue|svelte|@angular\/core)['"]/,
    ],
  },

  // ── Entry point ───────────────────────────────────────────────────────────
  {
    layer: "entry_point",
    signal: "canonical entry-point filename",
    pathMatches: [/(?:^|\/)(?:index|main|app|server|boot|start|run|manage|wsgi|asgi|Program)\.[jt]sx?$/i],
  },
  {
    layer: "entry_point",
    signal: "Python application entry file",
    pathMatches: [/(?:^|\/)(?:main|app|manage|run|wsgi|asgi)\.py$/i],
  },
  {
    layer: "entry_point",
    signal: "Go main package file",
    pathMatches: [/(?:^|\/)main\.go$/i],
  },
  {
    layer: "entry_point",
    signal: "server bootstrap: calls app.listen, http.ListenAndServe, or equivalent",
    contentMatches: [
      /(?:app\.listen|server\.listen|http\.ListenAndServe|uvicorn\.run|app\.run\(|Thread\.start)/,
    ],
  },

  // ── Utility (catch-all before unknown) ───────────────────────────────────
  {
    layer: "utility",
    signal: "file is in a utils/helpers/lib/shared/common directory",
    pathMatches: [/(?:^|\/)(?:utils?|helpers?|lib|shared|common|core|services?)[^/]*\//i],
    extensions: [".js", ".ts", ".py", ".go", ".java", ".rb", ".cs"],
  },
];

// ─── Detection engine ─────────────────────────────────────────────────────────

/**
 * Detect the architectural layer of a single file.
 *
 * @param {string} relPath   - Path relative to repo root
 * @param {string} content   - File content (may be empty string if unreadable)
 * @returns {{ layer: import('../schema').LayerKind, signals: string[] }}
 */
function detectLayer(relPath, content) {
  const normalised = relPath.replace(/\\/g, "/");
  const ext = path.extname(normalised).toLowerCase();

  for (const rule of RULES) {
    // ── path MUST match all pathMatches regexes
    if (rule.pathMatches) {
      if (!rule.pathMatches.every((re) => re.test(normalised))) continue;
    }

    // ── path MUST NOT match any pathNotMatches regex
    if (rule.pathNotMatches) {
      if (rule.pathNotMatches.some((re) => re.test(normalised))) continue;
    }

    // ── extension must be in the allowed set (if specified)
    if (rule.extensions) {
      if (!rule.extensions.includes(ext)) continue;
    }

    // ── content must include all substrings
    if (rule.contentIncludes) {
      if (!rule.contentIncludes.every((s) => content.includes(s))) continue;
    }

    // ── content must match all regexes
    if (rule.contentMatches) {
      if (!rule.contentMatches.every((re) => re.test(content))) continue;
    }

    // All conditions matched → return this layer
    return { layer: rule.layer, signals: [rule.signal] };
  }

  return { layer: "unknown", signals: ["no pattern matched"] };
}

/**
 * Run all matching rules against a file and collect every signal that fired,
 * even if a higher-priority rule already won. Useful for the level mapper to
 * understand secondary characteristics (e.g. a route file that also does auth).
 *
 * @param {string} relPath
 * @param {string} content
 * @returns {{ primary: import('../schema').LayerKind, allSignals: string[], allLayers: import('../schema').LayerKind[] }}
 */
function detectLayerFull(relPath, content) {
  const normalised = relPath.replace(/\\/g, "/");
  const ext = path.extname(normalised).toLowerCase();

  const matched = [];

  for (const rule of RULES) {
    if (rule.pathMatches && !rule.pathMatches.every((re) => re.test(normalised))) continue;
    if (rule.pathNotMatches && rule.pathNotMatches.some((re) => re.test(normalised))) continue;
    if (rule.extensions && !rule.extensions.includes(ext)) continue;
    if (rule.contentIncludes && !rule.contentIncludes.every((s) => content.includes(s))) continue;
    if (rule.contentMatches && !rule.contentMatches.every((re) => re.test(content))) continue;

    matched.push({ layer: rule.layer, signal: rule.signal });
  }

  if (matched.length === 0) {
    return { primary: "unknown", allSignals: ["no pattern matched"], allLayers: ["unknown"] };
  }

  return {
    primary:    matched[0].layer,
    allSignals: matched.map((m) => m.signal),
    allLayers:  [...new Set(matched.map((m) => m.layer))],
  };
}

module.exports = { detectLayer, detectLayerFull, RULES };
