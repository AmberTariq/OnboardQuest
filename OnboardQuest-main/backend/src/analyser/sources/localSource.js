/**
 * @file localSource.js
 * Resolves a local directory path, validates it, and returns an array of
 * candidate file paths for the analyser to process.
 *
 * Responsibilities:
 *  - Validate the path exists and is a directory (or a single file)
 *  - Walk the tree with glob, applying default ignore patterns
 *  - Return { rootPath, filePaths[], repoName, warnings[] }
 */

"use strict";

const path = require("path");
const fs   = require("fs");
const { glob } = require("glob");

// ── Default ignore patterns ──────────────────────────────────────────────────
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/__pycache__/**",
  "**/*.pyc",
  "**/.DS_Store",
  "**/coverage/**",
  "**/.nyc_output/**",
  "**/vendor/**",
  "**/*.min.js",
  "**/*.bundle.js",
  "**/*.map",
  "**/*.lock",           // package-lock, yarn.lock, etc.
  "**/pnpm-lock.yaml",
];

// Extensions we can meaningfully parse or classify
const PARSEABLE_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".jsx",
  ".ts", ".tsx",
  ".py",
  ".go",
  ".java", ".kt",
  ".rb",
  ".php",
  ".cs",
  ".rs",
  ".json",
  ".yaml", ".yml",
  ".toml",
  ".env",              // not secret content — just existence for layer detection
  ".sql",
  ".graphql", ".gql",
  ".proto",
  ".md", ".mdx",
  ".html", ".ejs", ".hbs",
  ".sh", ".bash",
  ".dockerfile", "",   // Dockerfile has no extension
]);

/**
 * Walk a local path and collect file candidates.
 *
 * @param {string} inputPath  - Absolute or relative local path
 * @returns {Promise<{
 *   rootPath:  string,
 *   filePaths: string[],
 *   repoName:  string,
 *   warnings:  string[]
 * }>}
 */
async function walkLocal(inputPath) {
  const warnings = [];

  // Resolve to absolute
  const resolved = path.resolve(inputPath);

  // Must exist
  if (!fs.existsSync(resolved)) {
    throw new Error(`LOCAL_SOURCE_NOT_FOUND: "${resolved}" does not exist`);
  }

  const stat = fs.statSync(resolved);

  // ── Single-file shortcut ─────────────────────────────────────────────────
  if (stat.isFile()) {
    const ext = path.extname(resolved).toLowerCase();
    if (!PARSEABLE_EXTENSIONS.has(ext)) {
      warnings.push(`Single file "${resolved}" has an unparseable extension — results may be sparse.`);
    }
    return {
      rootPath:  path.dirname(resolved),
      filePaths: [resolved],
      repoName:  path.basename(path.dirname(resolved)),
      warnings,
    };
  }

  if (!stat.isDirectory()) {
    throw new Error(`LOCAL_SOURCE_INVALID: "${resolved}" is neither a file nor a directory`);
  }

  // ── Size guard — warn if the tree looks huge ─────────────────────────────
  const rootName = path.basename(resolved);

  // Glob all files under the root, respecting ignores
  const raw = await glob("**/*", {
    cwd:        resolved,
    ignore:     IGNORE_PATTERNS,
    dot:        true,        // include dotfiles (e.g. .env, .eslintrc)
    nodir:      true,        // files only
    absolute:   true,
    follow:     false,       // don't follow symlinks to avoid cycles
  });

  // Filter to parseable extensions only
  const filePaths = raw.filter((f) => {
    const ext  = path.extname(f).toLowerCase();
    const base = path.basename(f);
    // Accept files with no extension by name (Dockerfile, Makefile, Procfile…)
    if (ext === "") {
      return /^(dockerfile|makefile|procfile|gemfile|rakefile|jenkinsfile|vagrantfile)$/i.test(base);
    }
    return PARSEABLE_EXTENSIONS.has(ext);
  });

  if (filePaths.length === 0) {
    warnings.push("No parseable source files found. The directory may be empty or entirely ignored.");
  } else if (filePaths.length > 5000) {
    warnings.push(
      `Large repository: ${filePaths.length} files found. Analysis is capped at 5 000 files for performance.`
    );
  }

  return {
    rootPath:  resolved,
    filePaths: filePaths.slice(0, 5000),
    repoName:  rootName,
    warnings,
  };
}

module.exports = { walkLocal, IGNORE_PATTERNS, PARSEABLE_EXTENSIONS };
