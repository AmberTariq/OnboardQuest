import { useState } from "react";
import MentorDrawer from "../components/MentorDrawer.jsx";

// ─── Static island data (mirrors analyser LayerKind order) ───────────────────
// When the backend is wired, replace this with a fetch to GET /api/analyse/demo
const ISLANDS = [
  {
    id:         "level_entry_point",
    title:      "ENTRY_POINT.EXE",
    icon:       "▶",
    badge:      "BOOT",
    kind:       "entry_point",
    difficulty: "EASY",
    xp:         100,
    desc:       "Application bootstrap. Execution starts here.",
    hint:       "Trace every app.use() call to map the full request pipeline.",
    files:      ["src/index.js"],
    status:     "unlocked",
    // layout position as % of world width/height
    cx: 50, cy: 15,
  },
  {
    id:         "level_config",
    title:      "CONFIG_VAULT.EXE",
    icon:       "⚙",
    badge:      "ENV",
    kind:       "config",
    difficulty: "EASY",
    xp:         80,
    desc:       "Env vars, build config, and project manifests.",
    hint:       "Check .env.example to discover every external dependency.",
    files:      ["package.json", "vite.config.js", "tailwind.config.js"],
    status:     "unlocked",
    cx: 20, cy: 30,
  },
  {
    id:         "level_auth_middleware",
    title:      "GUARDIAN.EXE",
    icon:       "🔐",
    badge:      "GUARDIAN",
    kind:       "auth_middleware",
    difficulty: "MEDIUM",
    xp:         200,
    desc:       "Auth & authorisation middleware — the gatekeepers.",
    hint:       "Find where req.user is set. That's what all routes trust.",
    files:      ["middleware/auth.js"],
    status:     "unlocked",
    cx: 80, cy: 30,
  },
  {
    id:         "level_api_route",
    title:      "ROUTE_LABYRINTH.EXE",
    icon:       "⇝",
    badge:      "ROUTES",
    kind:       "api_route",
    difficulty: "MEDIUM",
    xp:         250,
    desc:       "HTTP route handlers — the public API surface.",
    hint:       "Group routes by resource. Each group is one mini-quest.",
    files:      ["routes/quests.js", "routes/players.js", "routes/analyse.js"],
    status:     "unlocked",
    cx: 50, cy: 44,
  },
  {
    id:         "level_database_schema",
    title:      "SCHEMA_WORLD.EXE",
    icon:       "🗄",
    badge:      "SCHEMA",
    kind:       "database_schema",
    difficulty: "HARD",
    xp:         300,
    desc:       "Data models & migrations that define what's stored.",
    hint:       "Sketch entity relationships before touching any query.",
    files:      ["models/User.js", "migrations/001_init.sql"],
    status:     "locked",
    cx: 22, cy: 60,
  },
  {
    id:         "level_database_client",
    title:      "DB_GATEWAY.EXE",
    icon:       "💾",
    badge:      "DB",
    kind:       "database_client",
    difficulty: "HARD",
    xp:         250,
    desc:       "Connection setup, query builders & repositories.",
    hint:       "Check the pool config — misconfigured pools cause prod fires.",
    files:      ["db/connection.js"],
    status:     "locked",
    cx: 78, cy: 60,
  },
  {
    id:         "level_utility",
    title:      "UTILITY_BELT.EXE",
    icon:       "🔧",
    badge:      "UTILS",
    kind:       "utility",
    difficulty: "MEDIUM",
    xp:         150,
    desc:       "Shared helpers & services used across the codebase.",
    hint:       "These files are the invisible glue. Know them well.",
    files:      ["analyser/index.js", "analyser/levelMapper.js"],
    status:     "locked",
    cx: 50, cy: 76,
  },
  {
    id:         "level_test",
    title:      "TEST_ARENA.EXE",
    icon:       "✓",
    badge:      "TEST",
    kind:       "test",
    difficulty: "EASY",
    xp:         120,
    desc:       "Unit & integration tests that prove correctness.",
    hint:       "Run tests before your first commit. Green = safe to explore.",
    files:      ["__tests__/quests.test.js"],
    status:     "locked",
    cx: 50, cy: 90,
  },
];

// Connections: pairs of island ids
const CONNECTIONS = [
  ["level_entry_point",       "level_config"],
  ["level_entry_point",       "level_auth_middleware"],
  ["level_entry_point",       "level_api_route"],
  ["level_auth_middleware",   "level_api_route"],
  ["level_config",            "level_api_route"],
  ["level_api_route",         "level_database_schema"],
  ["level_api_route",         "level_database_client"],
  ["level_database_schema",   "level_database_client"],
  ["level_database_schema",   "level_utility"],
  ["level_database_client",   "level_utility"],
  ["level_utility",           "level_test"],
];

// ─── Derived helpers ──────────────────────────────────────────────────────────

function titlebarVariant(island) {
  if (island.difficulty === "BOSS")    return "island-titlebar--boss";
  if (island.status === "locked")      return "island-titlebar--locked";
  if (island.status === "done")        return "island-titlebar--done";
  return "";
}

function nameVariant(island) {
  if (island.difficulty === "BOSS")    return "island-name--boss";
  if (island.status === "locked")      return "island-name--locked";
  if (island.status === "done")        return "island-name--done";
  return "";
}

function terrainVariant(island) {
  if (island.difficulty === "BOSS")    return "island-terrain--boss";
  if (island.status === "locked")      return "island-terrain--locked";
  return "";
}

function statusLabel(island) {
  if (island.status === "done")        return { cls: "island-status--done",     text: "★ CLEARED" };
  if (island.status === "locked")      return { cls: "island-status--locked",   text: "🔒 LOCKED" };
  if (island.difficulty === "BOSS")    return { cls: "island-status--boss",     text: "⚠ BOSS" };
  return { cls: "island-status--unlocked", text: "★ UNLOCKED" };
}

// Float animation delay — each island gets a unique offset so they bob out of phase
const FLOAT_DELAYS = ["0s", "-0.7s", "-1.4s", "-2.1s", "-2.8s", "-0.35s", "-1.05s", "-1.75s"];

// Island card width in px
const ISLAND_W = 148;

// ─── SVG path layer ───────────────────────────────────────────────────────────

/**
 * Render dotted SVG lines between connected islands.
 * Coordinates are expressed in percentage units matching cx/cy on the islands.
 */
function IslandPaths({ islands, active }) {
  const byId = Object.fromEntries(islands.map((n) => [n.id, n]));

  return (
    <svg
      className="island-paths"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        {/* Yellow dashed marker arrow */}
        <marker
          id="path-arrow"
          markerWidth="6" markerHeight="6"
          refX="3" refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="var(--col-amber)" />
        </marker>
      </defs>

      {CONNECTIONS.map(([aId, bId]) => {
        const a = byId[aId];
        const b = byId[bId];
        if (!a || !b) return null;

        const isActive = active === aId || active === bId;
        const isLocked = a.status === "locked" || b.status === "locked";

        return (
          <line
            key={`${aId}__${bId}`}
            x1={`${a.cx}%`} y1={`${a.cy}%`}
            x2={`${b.cx}%`} y2={`${b.cy}%`}
            stroke={
              isActive  ? "var(--col-yellow)" :
              isLocked  ? "var(--col-caption)" :
              "var(--col-blue)"
            }
            strokeWidth={isActive ? 2.5 : 1.5}
            strokeDasharray={isLocked ? "3 5" : "5 4"}
            strokeOpacity={isLocked ? 0.45 : 0.75}
            markerEnd={isActive ? "url(#path-arrow)" : undefined}
          />
        );
      })}
    </svg>
  );
}

// ─── Single island component ──────────────────────────────────────────────────

function Island({ island, index, isActive, onClick }) {
  const { cls: statusCls, text: statusText } = statusLabel(island);

  return (
    <div
      className="island-wrapper"
      style={{
        left:    `calc(${island.cx}% - ${ISLAND_W / 2}px)`,
        top:     `${island.cy}%`,
        width:   `${ISLAND_W}px`,
        "--delay": FLOAT_DELAYS[index % FLOAT_DELAYS.length],
      }}
      onClick={() => onClick(island.id)}
      role="button"
      tabIndex={0}
      aria-label={`${island.title} — ${island.status}`}
      onKeyDown={(e) => e.key === "Enter" && onClick(island.id)}
    >
      {/* Tooltip (shown on hover via CSS) */}
      <div className="island-tooltip">
        <div className="island-tooltip__title">{island.title}</div>
        <div className="island-tooltip__hint">{island.hint}</div>
        {island.files.length > 0 && (
          <div className="island-tooltip__files">
            {island.files.slice(0, 3).map((f) => (
              <div key={f}>› {f}</div>
            ))}
            {island.files.length > 3 && (
              <div>+{island.files.length - 3} more…</div>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className={`island-card${isActive ? " island-card--active" : ""}`}>

        {/* .EXE title bar */}
        <div className={`island-titlebar ${titlebarVariant(island)}`}>
          <span className="island-titlebar__title">{island.title}</span>
          <div className="island-titlebar__dots">
            <span className="island-titlebar__dot island-titlebar__dot--close" />
            <span className="island-titlebar__dot island-titlebar__dot--min"   />
            <span className="island-titlebar__dot island-titlebar__dot--max"   />
          </div>
        </div>

        {/* Large icon */}
        <div className="island-icon">{island.icon}</div>

        {/* Layer name */}
        <div className={`island-name ${nameVariant(island)}`}>
          {island.badge}
        </div>

        {/* Short description */}
        <div className="island-desc">{island.desc}</div>

        {/* Bottom row: XP + difficulty */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
          <div className="island-xp">★ {island.xp} XP</div>
          <div className={`island-diff island-diff--${island.difficulty}`}>
            {island.difficulty}
          </div>
        </div>

        {/* Status badge */}
        <div className={`island-status ${statusCls}`}>
          {statusText}
        </div>
      </div>

      {/* Terrain rock slab underneath the card */}
      <div className={`island-terrain ${terrainVariant(island)}`} />
    </div>
  );
}

// ─── Map legend ───────────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div className="island-legend">
      <div className="island-legend__title">LEGEND</div>
      {[
        { color: "var(--col-mint)",    label: "UNLOCKED" },
        { color: "var(--col-blue)",    label: "CLEARED"  },
        { color: "var(--col-parchment)", label: "LOCKED" },
        { color: "var(--col-amber)",   label: "BOSS"     },
      ].map(({ color, label }) => (
        <div key={label} className="island-legend__row">
          <span className="island-legend__swatch" style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function MapStats({ islands }) {
  const unlocked = islands.filter((i) => i.status !== "locked").length;
  const done     = islands.filter((i) => i.status === "done").length;
  const totalXp  = islands.reduce((s, i) => s + i.xp, 0);

  return (
    <div
      style={{
        display:     "flex",
        gap:         2,
        padding:     "6px 14px",
        background:  "var(--col-parchment)",
        borderBottom:"2px solid var(--col-navy)",
        flexWrap:    "wrap",
      }}
    >
      {[
        { label: "ISLANDS",  value: islands.length },
        { label: "UNLOCKED", value: unlocked        },
        { label: "CLEARED",  value: done            },
        { label: "TOTAL XP", value: `${totalXp} XP` },
        { label: "PATHS",    value: CONNECTIONS.length },
      ].map(({ label, value }) => (
        <div
          key={label}
          style={{
            display:       "flex",
            flexDirection: "column",
            padding:       "3px 10px",
            background:    "var(--col-navy)",
            gap:           1,
            minWidth:      72,
          }}
        >
          <span
            style={{
              fontFamily:    "var(--font-pixel)",
              fontSize:      "0.38rem",
              color:         "var(--col-caption)",
              letterSpacing: "0.06em",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize:   "0.6rem",
              color:      "var(--col-yellow)",
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function LevelMap() {
  const [active,       setActive]       = useState(null);
  const [mentorIsland, setMentorIsland] = useState(null);

  function handleIslandClick(id) {
    // Toggle active selection AND open the mentor drawer for this island
    const island = ISLANDS.find((i) => i.id === id);
    setActive(id);
    setMentorIsland(island ?? null);
  }

  function handleMentorClose() {
    setMentorIsland(null);
    // Keep the island highlighted on the map after closing
  }

  // Compute world stage height: enough to show deepest island + padding
  const deepest = Math.max(...ISLANDS.map((i) => i.cy));
  // Each island card is ~170px tall + terrain; reserve space based on deepest %
  const worldHeight = Math.round((deepest / 100) * 800) + 220;

  return (
    <div className="pixel-window" style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Window title bar ───────────────────────────────────────────── */}
      <div className="pixel-titlebar">
        <span className="pixel-titlebar__title">LEVEL_MAP.EXE — CODEBASE ARCHITECTURE</span>
        <div className="pixel-titlebar__controls">
          <button className="pixel-titlebar__btn" aria-label="Minimise">_</button>
          <button className="pixel-titlebar__btn" aria-label="Maximise">□</button>
          <button className="pixel-titlebar__btn pixel-titlebar__btn--close" aria-label="Close">×</button>
        </div>
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────── */}
      <MapStats islands={ISLANDS} />

      {/* ── Map sub-header ────────────────────────────────────────────── */}
      <div className="island-map-header">
        <span className="island-map-header__title">WORLD MAP</span>
        <span className="island-map-header__sub">
          {active
            ? `SELECTED: ${ISLANDS.find((i) => i.id === active)?.title ?? active}`
            : "Hover an island for details · Click to select"}
        </span>
      </div>

      {/* ── Scrollable world stage ────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div
          className="island-world"
          style={{ minHeight: `${worldHeight}px` }}
        >
          {/* SVG dotted path layer — rendered behind all islands */}
          <IslandPaths islands={ISLANDS} active={active} />

          {/* Floating islands */}
          {ISLANDS.map((island, idx) => (
            <Island
              key={island.id}
              island={island}
              index={idx}
              isActive={active === island.id}
              onClick={handleIslandClick}
            />
          ))}

          {/* Legend — bottom-right corner */}
          <MapLegend />
        </div>
      </div>

      {/* ── AI Mentor Drawer (portal — renders into document.body) ────── */}
      <MentorDrawer island={mentorIsland} onClose={handleMentorClose} />

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <div className="pixel-window__statusbar">
        <span className="pixel-window__statusbar-segment">
          {ISLANDS.length} ISLANDS
        </span>
        <span className="pixel-window__statusbar-segment">
          {CONNECTIONS.length} PATHS
        </span>
        <span className="pixel-window__statusbar-segment">
          {ISLANDS.filter((i) => i.status !== "locked").length} UNLOCKED
        </span>
        <span className="pixel-window__statusbar-segment" style={{ marginLeft: "auto" }}>
          {active ? `SELECTED: ${active.replace("level_", "").toUpperCase()}` : "EXPLORE MODE"}
        </span>
      </div>
    </div>
  );
}
