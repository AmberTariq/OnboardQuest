/**
 * @file analyser/index.js
 * Public entry-point for the OnboardQuest repository analyser.
 *
 * Usage:
 *   const { analyse } = require('./analyser');
 *   const result = await analyse({ target: 'https://github.com/owner/repo' });
 *   const result = await analyse({ target: '/absolute/local/path' });
 *
 * Returns a fully-typed AnalyseResult (see schema.js) ready for the frontend.
 */

"use strict";

const path = require("path");

const { walkLocal }             = require("./sources/localSource");
const { fetchGitHub, cleanup }  = require("./sources/githubSource");
const { detectLayerFull }       = require("./detectors/layerDetectors");
const { parseFile }             = require("./detectors/fileParser");
const { mapLevels }             = require("./levelMapper");

// ─── Source type detection ────────────────────────────────────────────────────

/** @param {string} target @returns {"github" | "local"} */
function resolveSourceType(target) {
  if (/^https?:\/\/github\.com\//i.test(target)) return "github";
  if (/^git@github\.com:/i.test(target))          return "github";
  return "local";
}

// ─── Per-file processing ──────────────────────────────────────────────────────

/**
 * Read + parse + classify a single file.
 *
 * @param {string} absPath
 * @param {string} rootPath
 * @returns {import('./schema').AnalysedFile}
 */
function processFile(absPath, rootPath) {
  const relPath = path.relative(rootPath, absPath).replace(/\\/g, "/");

  // Parse the file (routes, imports, exports, language, size)
  const parsed = parseFile(absPath, relPath);

  // Detect architectural layer (use content for signal-rich detection)
  let content = "";
  try {
    content = require("fs").readFileSync(absPath, "utf8");
  } catch {
    // already warned inside parseFile
  }
  const { primary: layer, allSignals: signals } = detectLayerFull(relPath, content);

  return {
    relPath,
    absPath,
    layer,
    sizeBytes:  parsed.sizeBytes,
    lineCount:  parsed.lineCount,
    language:   parsed.language,
    routes:     parsed.routes,
    imports:    parsed.imports,
    exports:    parsed.exports,
    signals,
  };
}

// ─── Aggregate stats ──────────────────────────────────────────────────────────

/**
 * @param {import('./schema').AnalysedFile[]} files
 * @returns {import('./schema').AnalyseResult['stats']}
 */
function buildStats(files) {
  const languageBreakdown = {};
  let totalLines = 0;
  let totalSizeBytes = 0;

  for (const f of files) {
    totalLines     += f.lineCount;
    totalSizeBytes += f.sizeBytes;
    languageBreakdown[f.language] = (languageBreakdown[f.language] || 0) + 1;
  }

  return {
    totalFiles:        files.length,
    totalLines,
    totalSizeBytes,
    languageBreakdown,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse a GitHub repository or local directory and return the game map JSON.
 *
 * @param {import('./schema').AnalyseRequest} request
 * @returns {Promise<import('./schema').AnalyseResult>}
 */
async function analyse(request) {
  const { target, branch, token } = request;

  if (!target || typeof target !== "string") {
    throw new Error("ANALYSE_ERROR: `target` must be a non-empty string (URL or path)");
  }

  const sourceType = resolveSourceType(target.trim());
  const warnings   = [];
  let tmpDir;

  // ── Step 1: Resolve source to a set of local file paths ────────────────
  let rootPath, filePaths, repoName;

  if (sourceType === "github") {
    const result = await fetchGitHub(target.trim(), branch, token);
    rootPath  = result.rootPath;
    filePaths = result.filePaths;
    repoName  = result.repoName;
    tmpDir    = result.tmpDir;
    warnings.push(...result.warnings);
  } else {
    const result = await walkLocal(target.trim());
    rootPath  = result.rootPath;
    filePaths = result.filePaths;
    repoName  = result.repoName;
    warnings.push(...result.warnings);
  }

  // ── Step 2: Parse + classify every file ────────────────────────────────
  try {
    const analysedFiles = [];

  for (const absPath of filePaths) {
    try {
      const analysed = processFile(absPath, rootPath);
      analysedFiles.push(analysed);
    } catch (err) {
      warnings.push(`Skipped "${absPath}": ${err.message}`);
    }
  }

  // ── Step 3: Map analysed files to game levels ───────────────────────────
  const levels = mapLevels(analysedFiles);

  // ── Step 4: Build aggregate stats ──────────────────────────────────────
  const stats = buildStats(analysedFiles);

  // ── Step 5: Clean up temp directory (GitHub only) ──────────────────────
  // ── Step 6: Build and return the full result object ────────────────────
  /** @type {import('./schema').AnalyseResult} */
  const result = {
    repoName:    repoName,
    sourceType,
    analysedAt:  new Date().toISOString(),
    rootPath:    sourceType === "local" ? rootPath : "(cloned — temp dir cleaned up)",
    stats,
    files:       analysedFiles,
    levels,
    warnings,
  };

    return result;
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
}

module.exports = { analyse };
