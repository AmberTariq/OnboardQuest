/**
 * @file schema.js
 * Shared JSDoc typedefs for the OnboardQuest analyser module.
 * No runtime code — pure documentation types used across all analyser files.
 */

"use strict";

// ─── Source input ────────────────────────────────────────────────────────────

/**
 * @typedef {"github" | "local"} SourceType
 */

/**
 * The raw input handed to the analyser.
 * @typedef {Object} AnalyseRequest
 * @property {string}      target     - GitHub URL (https://github.com/owner/repo)
 *                                      or absolute/relative local path.
 * @property {string}      [branch]   - Branch to clone (default: "main" / "master").
 * @property {string}      [token]    - Optional GitHub PAT for private repos.
 */

// ─── Detected file / layer ───────────────────────────────────────────────────

/**
 * Canonical layer kinds the analyser can classify.
 * @typedef {"entry_point" | "api_route" | "auth_middleware" | "database_schema"
 *           | "database_client" | "config" | "utility" | "test"
 *           | "frontend" | "ci_cd" | "docs" | "unknown"} LayerKind
 */

/**
 * An HTTP route extracted from a source file via AST or regex.
 * @typedef {Object} ExtractedRoute
 * @property {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"|"ALL"|"USE"} method
 * @property {string} path        - Route path string (e.g. "/api/users/:id")
 * @property {number} line        - Line number in source file
 */

/**
 * An import/require statement found in a source file.
 * @typedef {Object} ExtractedImport
 * @property {string} specifier   - Module specifier string (e.g. "express", "./models/user")
 * @property {number} line
 */

/**
 * A named export found in a source file.
 * @typedef {Object} ExtractedExport
 * @property {string} name        - Exported identifier (e.g. "router", "User", "authenticate")
 * @property {number} line
 */

/**
 * All information extracted from a single source file.
 * @typedef {Object} AnalysedFile
 * @property {string}            relPath    - Path relative to repo root.
 * @property {string}            absPath    - Absolute path on disk.
 * @property {LayerKind}         layer      - Detected architectural layer.
 * @property {number}            sizeBytes
 * @property {number}            lineCount
 * @property {string}            language   - "js" | "ts" | "py" | "go" | "java" | etc.
 * @property {ExtractedRoute[]}  routes     - HTTP routes found inside this file.
 * @property {ExtractedImport[]} imports    - Top-level imports/requires.
 * @property {ExtractedExport[]} exports    - Named exports.
 * @property {string[]}          signals    - Human-readable reasons the layer was assigned.
 */

// ─── Game Level ──────────────────────────────────────────────────────────────

/**
 * Difficulty tier for a game level.
 * @typedef {"EASY" | "MEDIUM" | "HARD" | "BOSS"} Difficulty
 */

/**
 * A single node on the game Level Map.
 * @typedef {Object} Level
 * @property {string}        id           - Stable slug (e.g. "level_entry_point")
 * @property {number}        order        - 1-based rendering order on the map
 * @property {string}        title        - Retro .EXE title (e.g. "ENTRY_POINT.EXE")
 * @property {string}        description  - One-sentence explanation of this layer's role
 * @property {string}        hint         - Actionable onboarding tip for a new developer
 * @property {LayerKind}     kind         - Source layer kind
 * @property {Difficulty}    difficulty
 * @property {number}        xp           - XP awarded on completion
 * @property {string[]}      files        - Relative paths of files in this level
 * @property {string[]}      keySymbols   - Important function/class/route names discovered
 * @property {Object}        connections  - { next: string[], prev: string[] } level id edges
 * @property {string}        badge        - Short badge label (e.g. "BOOT", "GUARDIAN", "SCHEMA")
 * @property {string}        icon         - Single ASCII/emoji character for the map node
 */

/**
 * Full output of the analyser — the game map JSON.
 * @typedef {Object} AnalyseResult
 * @property {string}         repoName    - Human-readable repository name
 * @property {SourceType}     sourceType
 * @property {string}         analysedAt  - ISO timestamp
 * @property {string}         rootPath    - Absolute root path that was scanned
 * @property {Object}         stats       - { totalFiles, totalLines, totalSizeBytes, languageBreakdown }
 * @property {AnalysedFile[]} files       - All analysed files
 * @property {Level[]}        levels      - The game Level Map array
 * @property {string[]}       warnings    - Non-fatal issues during analysis
 */

module.exports = {}; // no runtime exports — types only
