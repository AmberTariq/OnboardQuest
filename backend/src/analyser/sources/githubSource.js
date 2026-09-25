/**
 * @file githubSource.js
 * Resolves a GitHub repository URL to a set of local file paths.
 *
 * Strategy (tried in order):
 *  1. Clone via simple-git into a temp directory  (always works, needs git)
 *  2. Fallback: fetch the repo file tree via GitHub Contents API (no git needed,
 *     but only downloads individual files on-demand — used for small repos or
 *     when git is unavailable)
 *
 * Returns the same shape as localSource.walkLocal so the rest of the pipeline
 * does not care which source was used.
 */

"use strict";

const path   = require("path");
const fs     = require("fs");
const os     = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

// ── URL parsing helpers ──────────────────────────────────────────────────────

/**
 * Parse a GitHub URL into owner / repo / branch parts.
 * Accepts:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo/tree/branch-name
 *   git@github.com:owner/repo.git
 *
 * @param {string} url
 * @returns {{ owner: string, repo: string, branch: string|null, cloneUrl: string }}
 */
function parseGitHubUrl(url) {
  // SSH → HTTPS normalise
  const normalised = url
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");

  const match = normalised.match(
    /^https?:\/\/github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^?#]+))?(?:\/.*)?\/?(?:[?#].*)?$/i
  );

  if (!match) {
    throw new Error(
      `GITHUB_URL_PARSE_ERROR: Cannot extract owner/repo from "${url}". ` +
      `Expected format: https://github.com/owner/repo`
    );
  }

  const [, owner, repo, branchFromUrl] = match;
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("GITHUB_URL_PARSE_ERROR: Invalid GitHub owner or repository name");
  }
  return {
    owner,
    repo,
    branch: branchFromUrl || null,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
  };
}

// ── Git availability check ───────────────────────────────────────────────────

/** @returns {Promise<boolean>} */
async function isGitAvailable() {
  try {
    await execFileAsync("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

// ── Clone strategy ───────────────────────────────────────────────────────────

/**
 * Clone a GitHub repo into a temp directory using simple-git.
 * Returns the path to the cloned directory.
 *
 * @param {string}      cloneUrl
 * @param {string|null} branch
 * @param {string}      [token]   GitHub PAT for private repos
 * @returns {Promise<string>} absolute path to cloned dir
 */
async function cloneRepo(cloneUrl, branch, token) {
  const simpleGit = require("simple-git");

  // Inject PAT into URL for private repos
  const authenticatedUrl = token
    ? cloneUrl.replace("https://", `https://x-access-token:${encodeURIComponent(token)}@`)
    : cloneUrl;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "onboardquest-"));

  const git = simpleGit();
  const cloneArgs = ["--depth", "1"];
  if (branch) cloneArgs.push("--branch", branch);

  try {
    await git.clone(authenticatedUrl, tmpDir, cloneArgs);
  } catch (err) {
    // Clean up temp dir on failure
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`GIT_CLONE_FAILED: ${String(err.message || "Git clone failed").replace(authenticatedUrl, cloneUrl)}`);
  }

  return tmpDir;
}

// ── GitHub Contents API fallback ─────────────────────────────────────────────

/**
 * Fetch a file tree from the GitHub Contents API and download each file
 * into a temporary directory. Used when git is not available.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string|null} branch
 * @param {string} [token]
 * @returns {Promise<string>} absolute path to populated temp dir
 */
async function fetchViaApi(owner, repo, branch, token) {
  const { Octokit } = require("@octokit/rest");

  const octokit = new Octokit({ auth: token });

  // Resolve the default branch if none specified
  let ref = branch;
  if (!ref) {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    ref = repoData.default_branch;
  }

  // Get the full recursive file tree via the Git Trees API (much faster than
  // walking the Contents API directory-by-directory)
  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: ref,
    recursive: "1",
  });

  if (treeData.truncated) {
    // Very large repo — we'll still proceed with what we have
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "onboardquest-api-"));

  // Filter to blobs (files) only, skip large binaries
  const MAX_SIZE = 500 * 1024; // 500 KB per file
  const blobs = treeData.tree.filter(
    (node) => node.type === "blob" && (node.size || 0) <= MAX_SIZE
  );

  // Ignored path prefixes (mirrors localSource IGNORE_PATTERNS)
  const SKIP_PREFIXES = [
    "node_modules/", ".git/", "dist/", "build/", ".next/",
    "__pycache__/", "coverage/", ".nyc_output/", "vendor/",
  ];
  const SKIP_SUFFIXES = [".min.js", ".bundle.js", ".map", ".lock", ".pyc"];

  const eligible = blobs.filter((node) => {
    const p = node.path;
    if (SKIP_PREFIXES.some((pfx) => p.startsWith(pfx))) return false;
    if (SKIP_SUFFIXES.some((sfx) => p.endsWith(sfx))) return false;
    return true;
  });

  // Download up to 500 files (API rate-limit friendly)
  const toDownload = eligible.slice(0, 500);

  let downloaded = 0;
  let failed = 0;
  const workers = Array.from({ length: Math.min(8, toDownload.length) }, async () => {
    while (toDownload.length) {
      const node = toDownload.pop();
      if (!node) return;
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: node.path,
          ref,
          mediaType: { format: "raw" },
        });

        const dest = path.join(tmpDir, node.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, typeof data === "string" ? data : Buffer.from(data));
        downloaded += 1;
      } catch {
        failed += 1;
        // Skip individual download failures — the analyser will note missing files
      }
    }
  });
  await Promise.all(workers);

  if (downloaded === 0) {
    cleanup(tmpDir);
    throw new Error(`GITHUB_API_FETCH_FAILED: Could not download repository files${failed ? ` (${failed} requests failed)` : ""}`);
  }

  return tmpDir;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Given a GitHub URL, produce the same { rootPath, filePaths, repoName, warnings }
 * shape that localSource.walkLocal returns.
 *
 * @param {string} url      - GitHub repository URL
 * @param {string} [branch] - Override branch (falls back to URL branch, then default)
 * @param {string} [token]  - GitHub PAT
 * @returns {Promise<{
 *   rootPath:  string,
 *   filePaths: string[],
 *   repoName:  string,
 *   warnings:  string[],
 *   tmpDir:    string    — caller should clean this up after use
 * }>}
 */
async function fetchGitHub(url, branch, token) {
  const { walkLocal } = require("./localSource");
  const warnings = [];

  const { owner, repo, branch: urlBranch, cloneUrl } = parseGitHubUrl(url);
  const effectiveBranch = branch || urlBranch || null;

  let tmpDir;
  const gitAvailable = await isGitAvailable();

  if (gitAvailable) {
    try {
      tmpDir = await cloneRepo(cloneUrl, effectiveBranch, token);
    } catch (err) {
      warnings.push(`Git clone failed; using the GitHub API fallback. (${err.message})`);
    }
  }

  if (!tmpDir) {
    warnings.push(
      "git not found in PATH — falling back to GitHub Contents API (max 500 files)."
    );
    if (!token) {
      warnings.push(
        "No GITHUB_TOKEN provided. API fallback is rate-limited to 60 req/hr. " +
        "Set the token field or GITHUB_TOKEN env variable for better results."
      );
    }
    const effectiveToken = token || process.env.GITHUB_TOKEN;
    tmpDir = await fetchViaApi(owner, repo, effectiveBranch, effectiveToken);
  }

  // Reuse localSource walker on the temp directory
  const result = await walkLocal(tmpDir);

  return {
    ...result,
    repoName: `${owner}/${repo}`,
    warnings: [...warnings, ...result.warnings],
    tmpDir,
  };
}

/**
 * Release the temporary directory created by fetchGitHub.
 * Safe to call even if tmpDir is undefined.
 * @param {string} [tmpDir]
 */
function cleanup(tmpDir) {
  if (tmpDir && fs.existsSync(tmpDir)) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
}

module.exports = { fetchGitHub, parseGitHubUrl, cleanup };
