/**
 * LevelMap.jsx
 * The main adventure map page — shows the floating-island architecture map
 * generated from a real scanned repository.
 *
 * Props:
 *   analyseResult  — the full response from POST /api/analyse
 *   repoName       — display name, e.g. "owner/repo"
 *   onReset        — callback to go back to the landing page
 */

import { useState, useMemo } from "react";
import MentorDrawer from "../components/MentorDrawer.jsx";
import ChallengePanel from "../components/ChallengePanel.jsx";

// ─── Derive island position layout ───────────────────────────────────────────

/**
 * Spread islands across a 2D grid in a visually interesting pattern.
 * Odd rows are offset so islands stagger like a honeycomb.
 * Returns the levels array enriched with cx/cy (% coordinates).
 */
function layoutIslands(levels) {
  if (!levels || levels.length === 0) return [];

  const cols       = Math.ceil(Math.sqrt(levels.length));
  const colStep    = Math.min(80 / cols, 28);
  const rowStep    = 18;
  const startX     = 10;
  const startY     = 10;

  return levels.map((level, idx) => {
    const col    = idx % cols;
    const row    = Math.floor(idx / cols);
    const xOff   = row % 2 === 1 ? colStep / 2 : 0;
    const cx     = startX + col * colStep + xOff;
    const cy     = startY + row * rowStep;
    return {
      ...level,
      // Normalise field names — backend uses description/files/keySymbols
      desc:     level.description || level.desc || "",
      hint:     level.hint        || "",
      files:    level.files       || [],
      icon:     level.icon        || "◈",
      badge:    level.badge       || level.kind?.toUpperCase() || "LAYER",
      status:   level.status      || "unlocked",
      cx:       Math.min(Math.max(cx, 5), 90),
      cy:       Math.min(Math.max(cy, 5), 95),
    };
  });
}

/**
 * Build connections from level.connections.next data.
 * Returns array of [fromId, toId] pairs.
 */
function buildConnections(levels) {
  const pairs = [];
  const seen  = new Set();
  for (const level of levels) {
    const nexts = level.connections?.next || [];
    for (const toId of nexts) {
      const key = [level.id, toId].sort().join("__");
      if (!seen.has(key) && levels.find((l) => l.id === toId)) {
        seen.add(key);
        pairs.push([level.id, toId]);
      }
    }
  }
  return pairs;
}

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

const FLOAT_DELAYS = ["0s", "-0.7s", "-1.4s", "-2.1s", "-2.8s", "-0.35s", "-1.05s", "-1.75s", "-0.5s", "-1.2s"];
const ISLAND_W     = 148;

// ─── SVG path layer ───────────────────────────────────────────────────────────

function IslandPaths({ islands, connections, active }) {
  const byId = Object.fromEntries(islands.map((n) => [n.id, n]));

  return (
    <svg
      className="island-paths"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <marker
          id="path-arrow"
          markerWidth="6" markerHeight="6"
          refX="3" refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="var(--col-amber)" />
        </marker>
      </defs>

      {connections.map(([aId, bId]) => {
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

function Island({ island, index, isActive, isDone, onClick }) {
  const displayIsland = isDone ? { ...island, status: "done" } : island;
  const { cls: statusCls, text: statusText } = statusLabel(displayIsland);

  return (
    <div
      className="island-wrapper"
      style={{
        left:      `calc(${island.cx}% - ${ISLAND_W / 2}px)`,
        top:       `${island.cy}%`,
        width:     `${ISLAND_W}px`,
        "--delay": FLOAT_DELAYS[index % FLOAT_DELAYS.length],
      }}
      onClick={() => onClick(island.id)}
      role="button"
      tabIndex={0}
      aria-label={`${island.title} — ${displayIsland.status}`}
      onKeyDown={(e) => e.key === "Enter" && onClick(island.id)}
    >
      {/* Tooltip (shown on hover via CSS) */}
      <div className="island-tooltip">
        <div className="island-tooltip__title">{island.title}</div>
        <div className="island-tooltip__hint">{island.hint || island.desc}</div>
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
      <div className={`island-card${isActive ? " island-card--active" : ""}${isDone ? " island-card--done" : ""}`}>

        {/* .EXE title bar */}
        <div className={`island-titlebar ${titlebarVariant(displayIsland)}`}>
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
        <div className={`island-name ${nameVariant(displayIsland)}`}>
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
          {isDone ? "★ CLEARED" : statusText}
        </div>
      </div>

      {/* Terrain rock slab underneath the card */}
      <div className={`island-terrain ${terrainVariant(displayIsland)}`} />
    </div>
  );
}

// ─── Map legend ───────────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div className="island-legend">
      <div className="island-legend__title">LEGEND</div>
      {[
        { color: "var(--col-mint)",      label: "UNLOCKED" },
        { color: "var(--col-blue)",      label: "CLEARED"  },
        { color: "var(--col-parchment)", label: "LOCKED"   },
        { color: "var(--col-amber)",     label: "BOSS"     },
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

function MapStats({ islands, connections, repoName, completedIds }) {
  const done    = completedIds.size;
  const totalXp = islands.reduce((s, i) => s + (i.xp || 0), 0);
  const earnedXp = islands
    .filter((i) => completedIds.has(i.id))
    .reduce((s, i) => s + (i.xp || 0), 0);

  return (
    <div className="map-stats">
      {[
        { label: "REPO",     value: repoName || "UNKNOWN" },
        { label: "ISLANDS",  value: islands.length },
        { label: "CLEARED",  value: `${done}/${islands.length}` },
        { label: "XP",       value: `${earnedXp}/${totalXp}` },
        { label: "PATHS",    value: connections.length },
      ].map(({ label, value }) => (
        <div key={label} className="map-stats__cell">
          <span className="map-stats__label">{label}</span>
          <span className="map-stats__value">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function LevelMap({ analyseResult, onReset }) {
  const [active,        setActive]        = useState(null);
  const [mentorIsland,  setMentorIsland]  = useState(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeIsland, setChallengeIsland] = useState(null);
  const [completedIds,  setCompletedIds]  = useState(new Set());

  const repoName  = analyseResult?.repoName  || "UNKNOWN_REPO";
  const rawLevels = analyseResult?.levels    || [];

  const islands     = useMemo(() => layoutIslands(rawLevels), [rawLevels]);
  const connections = useMemo(() => buildConnections(islands), [islands]);

  // Compute world stage height
  const deepest    = islands.length > 0 ? Math.max(...islands.map((i) => i.cy)) : 80;
  const worldHeight = Math.round((deepest / 100) * 900) + 280;

  function handleIslandClick(id) {
    const island = islands.find((i) => i.id === id);
    setActive(id);
    setMentorIsland(island ?? null);
  }

  function handleMentorClose() {
    setMentorIsland(null);
  }

  function handleOpenChallenge(island) {
    setChallengeIsland(island);
    setChallengeOpen(true);
  }

  function handleCompleteIsland(id) {
    setCompletedIds((prev) => new Set([...prev, id]));
  }

  return (
    <div
      className="pixel-window"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* ── Window title bar ─────────────────────────────────────────────── */}
      <div className="pixel-titlebar">
        <span className="pixel-titlebar__title">
          LEVEL_MAP.EXE — {repoName.toUpperCase()}
        </span>
        <div className="pixel-titlebar__controls">
          <button
            className="pixel-titlebar__btn"
            onClick={onReset}
            title="Scan a new repo"
            aria-label="Back to home"
          >
            ⌂
          </button>
          <button className="pixel-titlebar__btn" aria-label="Minimise">_</button>
          <button className="pixel-titlebar__btn" aria-label="Maximise">□</button>
          <button
            className="pixel-titlebar__btn pixel-titlebar__btn--close"
            onClick={onReset}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <MapStats
        islands={islands}
        connections={connections}
        repoName={repoName}
        completedIds={completedIds}
      />

      {/* ── Map sub-header ───────────────────────────────────────────────── */}
      <div className="island-map-header">
        <span className="island-map-header__title">WORLD MAP</span>
        <span className="island-map-header__sub">
          {active
            ? `SELECTED: ${islands.find((i) => i.id === active)?.title ?? active}`
            : "Hover an island for details · Click to enter quest briefing"}
        </span>
        <button
          className="pixel-btn pixel-btn--ghost"
          style={{ marginLeft: "auto", fontSize: "0.4rem", padding: "3px 8px" }}
          onClick={onReset}
        >
          ◄ NEW REPO
        </button>
      </div>

      {/* ── Scrollable world stage ───────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div
          className="island-world"
          style={{ minHeight: `${worldHeight}px` }}
        >
          <IslandPaths islands={islands} connections={connections} active={active} />

          {islands.map((island, idx) => (
            <Island
              key={island.id}
              island={island}
              index={idx}
              isActive={active === island.id}
              isDone={completedIds.has(island.id)}
              onClick={handleIslandClick}
            />
          ))}

          {islands.length === 0 && (
            <div style={{
              position:  "absolute",
              top:       "50%",
              left:      "50%",
              transform: "translate(-50%,-50%)",
              fontFamily:"var(--font-pixel)",
              fontSize:  "0.55rem",
              color:     "var(--col-muted)",
              textAlign: "center",
              lineHeight: 2,
            }}>
              NO ISLANDS GENERATED<br />
              <span style={{ fontSize: "0.42rem" }}>
                The analyser found no classifiable layers in this repository.
              </span>
            </div>
          )}

          <MapLegend />
        </div>
      </div>

      {/* ── AI Mentor Drawer ─────────────────────────────────────────────── */}
      <MentorDrawer
        island={mentorIsland}
        onClose={handleMentorClose}
        onChallenge={handleOpenChallenge}
        onComplete={handleCompleteIsland}
      />

      {/* ── Challenge Panel ──────────────────────────────────────────────── */}
      {challengeOpen && challengeIsland && (
        <ChallengePanel
          island={challengeIsland}
          onClose={() => setChallengeOpen(false)}
          onComplete={() => {
            handleCompleteIsland(challengeIsland.id);
            setChallengeOpen(false);
          }}
        />
      )}

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="pixel-window__statusbar">
        <span className="pixel-window__statusbar-segment">
          {islands.length} ISLANDS
        </span>
        <span className="pixel-window__statusbar-segment">
          {connections.length} PATHS
        </span>
        <span className="pixel-window__statusbar-segment">
          {completedIds.size} CLEARED
        </span>
        <span className="pixel-window__statusbar-segment" style={{ marginLeft: "auto" }}>
          {active
            ? `SELECTED: ${active.replace("level_", "").toUpperCase()}`
            : "EXPLORE MODE"}
        </span>
      </div>
    </div>
  );
}
