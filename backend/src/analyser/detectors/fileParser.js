/**
 * @file fileParser.js
 * Extracts structured information from a single source file:
 *   - HTTP route registrations  (method + path + line)
 *   - Import / require statements
 *   - Named exports
 *   - Line count, size, language
 *
 * Strategy per language:
 *   JS/TS  → try Acorn AST first, fall back to regex on parse failure
 *   Python → regex only (no Python parser in Node ecosystem without a native dep)
 *   Others → regex only
 *
 * The parser is intentionally best-effort: a parse failure returns partial
 * results plus a warning rather than throwing.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ─── Language detection ───────────────────────────────────────────────────────

/** @param {string} filePath @returns {string} */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  const MAP = {
    ".js": "js", ".mjs": "js", ".cjs": "js", ".jsx": "js",
    ".ts": "ts", ".tsx": "ts",
    ".py": "python",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".rs": "rust",
    ".json": "json",
    ".yaml": "yaml", ".yml": "yaml",
    ".toml": "toml",
    ".sql": "sql",
    ".graphql": "graphql", ".gql": "graphql",
    ".proto": "protobuf",
    ".md": "markdown", ".mdx": "markdown",
    ".html": "html", ".ejs": "html", ".hbs": "html",
    ".sh": "shell", ".bash": "shell",
    ".prisma": "prisma",
  };

  if (MAP[ext]) return MAP[ext];
  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile")   return "makefile";
  return "unknown";
}

// ─── Regex-based extractors (language-agnostic fallbacks) ────────────────────

/** HTTP method names we recognise */
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "all", "use"];

/**
 * Extract route registrations via regex.
 * Works for Express, Koa, Fastify, Flask, FastAPI, Django-style patterns.
 * @param {string} content
 * @param {string} language
 * @returns {import('../schema').ExtractedRoute[]}
 */
function extractRoutesRegex(content, language) {
  const routes = [];
  const lines  = content.split("\n");

  if (language === "js" || language === "ts") {
    // Express / Fastify / Koa: router.get('/path', ...) or app.post('/path', ...)
    const JS_ROUTE = /(?:router|app|server|fastify|route|api)\s*\.\s*(get|post|put|patch|delete|head|options|all|use)\s*\(\s*(['"`])([^'"`]*)\2/gi;
    let m;
    while ((m = JS_ROUTE.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split("\n").length;
      routes.push({
        method: m[1].toUpperCase(),
        path:   m[3],
        line:   lineNum,
      });
    }
  }

  if (language === "python") {
    // Flask: @app.route('/path', methods=['GET','POST'])
    // FastAPI: @router.get('/path'), @app.post('/path')
    const PY_DECORATOR = /@(?:app|router|blueprint|api_router)\s*\.\s*(get|post|put|patch|delete|route)\s*\(\s*['"]([^'"]+)['"]/gi;
    let m;
    while ((m = PY_DECORATOR.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split("\n").length;
      routes.push({
        method: m[1].toUpperCase() === "ROUTE" ? "GET" : m[1].toUpperCase(),
        path:   m[2],
        line:   lineNum,
      });
    }
  }

  if (language === "go") {
    // Gin: router.GET("/path", ...)
    const GO_ROUTE = /\.\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|Handle)\s*\(\s*"([^"]+)"/g;
    let m;
    while ((m = GO_ROUTE.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split("\n").length;
      routes.push({
        method: m[1],
        path:   m[2],
        line:   lineNum,
      });
    }
  }

  if (language === "java") {
    // Spring: @GetMapping("/path"), @RequestMapping(value="/path", method=RequestMethod.POST)
    const SPRING_ROUTE = /@(?:Get|Post|Put|Patch|Delete|Request)Mapping\s*(?:\(\s*(?:value\s*=\s*)?["']([^"']+)["'])?/g;
    let m;
    while ((m = SPRING_ROUTE.exec(content)) !== null) {
      if (!m[1]) continue;
      const methodMatch = /@(Get|Post|Put|Patch|Delete)Mapping/.exec(m[0]);
      const lineNum = content.slice(0, m.index).split("\n").length;
      routes.push({
        method: methodMatch ? methodMatch[1].toUpperCase() : "ALL",
        path:   m[1],
        line:   lineNum,
      });
    }
  }

  return routes;
}

/**
 * Extract import/require statements via regex.
 * @param {string} content
 * @param {string} language
 * @returns {import('../schema').ExtractedImport[]}
 */
function extractImportsRegex(content, language) {
  const imports = [];

  if (language === "js" || language === "ts") {
    // CJS: require('...')
    const CJS = /\brequire\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
    let m;
    while ((m = CJS.exec(content)) !== null) {
      imports.push({ specifier: m[2], line: content.slice(0, m.index).split("\n").length });
    }
    // ESM: import ... from '...'
    const ESM = /\bimport\s+[^'"]*from\s+(['"`])([^'"`]+)\1/g;
    while ((m = ESM.exec(content)) !== null) {
      imports.push({ specifier: m[2], line: content.slice(0, m.index).split("\n").length });
    }
    // ESM dynamic: import('...')
    const DYNAMIC = /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
    while ((m = DYNAMIC.exec(content)) !== null) {
      imports.push({ specifier: m[2], line: content.slice(0, m.index).split("\n").length });
    }
  }

  if (language === "python") {
    const PY = /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;
    let m;
    while ((m = PY.exec(content)) !== null) {
      imports.push({ specifier: m[1] || m[2], line: content.slice(0, m.index).split("\n").length });
    }
  }

  if (language === "go") {
    const GO_IMPORT = /"([^"]+)"/g;
    const importBlock = content.match(/import\s*\(([^)]+)\)/);
    if (importBlock) {
      let m;
      while ((m = GO_IMPORT.exec(importBlock[1])) !== null) {
        imports.push({ specifier: m[1], line: 0 }); // line not tracked for Go blocks
      }
    }
  }

  return imports;
}

/**
 * Extract named exports via regex.
 * @param {string} content
 * @param {string} language
 * @returns {import('../schema').ExtractedExport[]}
 */
function extractExportsRegex(content, language) {
  const exports = [];

  if (language === "js" || language === "ts") {
    // module.exports = { foo, bar } or module.exports.foo = ...
    const CJS_ASSIGN = /module\.exports(?:\.(\w+))?\s*=/g;
    let m;
    while ((m = CJS_ASSIGN.exec(content)) !== null) {
      exports.push({ name: m[1] || "default", line: content.slice(0, m.index).split("\n").length });
    }
    // export function/class/const foo
    const ESM_NAMED = /^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/gm;
    while ((m = ESM_NAMED.exec(content)) !== null) {
      exports.push({ name: m[1], line: content.slice(0, m.index).split("\n").length });
    }
    // export { foo, bar }
    const ESM_BRACE = /^export\s*\{([^}]+)\}/gm;
    while ((m = ESM_BRACE.exec(content)) !== null) {
      m[1].split(",").forEach((name) => {
        const trimmed = name.trim().split(/\s+as\s+/).pop().trim();
        if (trimmed) exports.push({ name: trimmed, line: content.slice(0, m.index).split("\n").length });
      });
    }
  }

  if (language === "python") {
    // Rough heuristic: top-level def / class names
    const PY = /^(?:def|class)\s+(\w+)/gm;
    let m;
    while ((m = PY.exec(content)) !== null) {
      exports.push({ name: m[1], line: content.slice(0, m.index).split("\n").length });
    }
  }

  return exports;
}

// ─── AST-based extractor (JS/TS via Acorn) ────────────────────────────────────

/**
 * Try to parse JS/TS with Acorn and walk the AST.
 * Returns null on parse failure so the caller can fall back to regex.
 *
 * @param {string} content
 * @returns {{ routes: ExtractedRoute[], imports: ExtractedImport[], exports: ExtractedExport[] } | null}
 */
function parseJsAst(content) {
  let acorn, walk;
  try {
    acorn = require("acorn");
    walk  = require("acorn-walk");
  } catch {
    return null; // acorn not installed yet
  }

  let ast;
  // Try module mode first, then script
  for (const sourceType of ["module", "script"]) {
    try {
      ast = acorn.parse(content, {
        sourceType,
        ecmaVersion:  "latest",
        locations:    true,
        allowHashBang: true,
        allowAwaitOutsideFunction: true,
      });
      break;
    } catch {
      // try next sourceType
    }
  }
  if (!ast) return null;

  const routes  = [];
  const imports = [];
  const exports = [];

  walk.simple(ast, {
    // ── import declarations ─────────────────────────────────────────────
    ImportDeclaration(node) {
      imports.push({
        specifier: node.source.value,
        line:      node.loc.start.line,
      });
    },

    // ── require() calls ─────────────────────────────────────────────────
    CallExpression(node) {
      if (
        node.callee.type === "Identifier" &&
        node.callee.name === "require" &&
        node.arguments.length > 0 &&
        node.arguments[0].type === "Literal"
      ) {
        imports.push({
          specifier: node.arguments[0].value,
          line:      node.loc.start.line,
        });
      }

      // router.get('/path', ...) / app.post('/path', ...)
      if (
        node.callee.type === "MemberExpression" &&
        node.callee.property.type === "Identifier" &&
        HTTP_METHODS.includes(node.callee.property.name.toLowerCase()) &&
        node.arguments.length > 0 &&
        (node.arguments[0].type === "Literal" || node.arguments[0].type === "TemplateLiteral")
      ) {
        const routePath =
          node.arguments[0].type === "Literal"
            ? node.arguments[0].value
            : node.arguments[0].quasis.map((q) => q.value.cooked).join("…");

        routes.push({
          method: node.callee.property.name.toUpperCase(),
          path:   String(routePath),
          line:   node.loc.start.line,
        });
      }
    },

    // ── export declarations ─────────────────────────────────────────────
    ExportNamedDeclaration(node) {
      if (node.declaration) {
        const decl = node.declaration;
        if (decl.id) {
          exports.push({ name: decl.id.name, line: node.loc.start.line });
        } else if (decl.declarations) {
          decl.declarations.forEach((d) => {
            if (d.id && d.id.name) {
              exports.push({ name: d.id.name, line: node.loc.start.line });
            }
          });
        }
      }
      if (node.specifiers) {
        node.specifiers.forEach((s) => {
          exports.push({
            name: s.exported.name || s.exported.value,
            line: node.loc.start.line,
          });
        });
      }
    },

    ExportDefaultDeclaration(node) {
      const decl = node.declaration;
      const name =
        (decl.id && decl.id.name) ||
        (decl.type === "Identifier" && decl.name) ||
        "default";
      exports.push({ name, line: node.loc.start.line });
    },

    // ── module.exports = ... ────────────────────────────────────────────
    AssignmentExpression(node) {
      if (
        node.left.type === "MemberExpression" &&
        node.left.object.type === "Identifier" &&
        node.left.object.name === "module" &&
        node.left.property.type === "Identifier" &&
        node.left.property.name === "exports"
      ) {
        exports.push({ name: "default", line: node.loc.start.line });
      }
    },
  });

  return { routes, imports, exports };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a single file and return all extracted information.
 *
 * @param {string} absPath  - Absolute path to the file
 * @param {string} relPath  - Path relative to repo root (for display)
 * @returns {{
 *   language:  string,
 *   lineCount: number,
 *   sizeBytes: number,
 *   routes:    import('../schema').ExtractedRoute[],
 *   imports:   import('../schema').ExtractedImport[],
 *   exports:   import('../schema').ExtractedExport[],
 *   parseWarnings: string[]
 * }}
 */
function parseFile(absPath, relPath) {
  const parseWarnings = [];
  let content = "";
  let sizeBytes = 0;

  try {
    const buf = fs.readFileSync(absPath);
    sizeBytes = buf.length;
    content   = buf.toString("utf8");
  } catch (err) {
    parseWarnings.push(`Could not read "${relPath}": ${err.message}`);
    return { language: "unknown", lineCount: 0, sizeBytes: 0, routes: [], imports: [], exports: [], parseWarnings };
  }

  const language  = detectLanguage(absPath);
  const lineCount = content.split("\n").length;

  let routes  = [];
  let imports = [];
  let exports = [];

  // ── JS/TS: try AST first ─────────────────────────────────────────────────
  if (language === "js" || language === "ts") {
    const astResult = parseJsAst(content);
    if (astResult) {
      routes  = astResult.routes;
      imports = astResult.imports;
      exports = astResult.exports;
    } else {
      parseWarnings.push(`AST parse failed for "${relPath}" — using regex fallback`);
      routes  = extractRoutesRegex(content, language);
      imports = extractImportsRegex(content, language);
      exports = extractExportsRegex(content, language);
    }
  } else {
    // All other languages: regex only
    routes  = extractRoutesRegex(content, language);
    imports = extractImportsRegex(content, language);
    exports = extractExportsRegex(content, language);
  }

  // De-duplicate imports by specifier
  const seenImports = new Set();
  imports = imports.filter((imp) => {
    if (seenImports.has(imp.specifier)) return false;
    seenImports.add(imp.specifier);
    return true;
  });

  return { language, lineCount, sizeBytes, routes, imports, exports, parseWarnings };
}

module.exports = { parseFile, detectLanguage };
