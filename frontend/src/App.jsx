/**
 * App.jsx
 * Root application shell.
 *
 * State machine:
 *   "landing"  → user sees the hero/input page (QuestBoard)
 *   "scanning" → RepoScanner is showing the animated analysis
 *   "map"      → LevelMap shows the generated adventure map
 */

import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import QuestBoard    from "./pages/QuestBoard.jsx";
import LevelMap      from "./pages/LevelMap.jsx";
import RepoScanner   from "./pages/RepoScanner.jsx";
import PlayerProfile from "./pages/PlayerProfile.jsx";
import { TermsOfService, PrivacyPolicy } from "./pages/LegalPages.jsx";

// ── Player HUD strip ─────────────────────────────────────────────────────────
function PlayerHUD({ xp, level, questsDone, repoName }) {
  return (
    <div className="pixel-hud app-shell__hud">
      <div className="pixel-hud__stat">
        <span className="pixel-hud__label">PLAYER</span>
        <span className="pixel-hud__value pixel-hud__value--white">PLAYER_1</span>
      </div>
      <div className="pixel-hud__stat">
        <span className="pixel-hud__label">LEVEL</span>
        <span className="pixel-hud__value">{String(level).padStart(2, "0")}</span>
      </div>
      <div className="pixel-hud__stat">
        <span className="pixel-hud__label">XP</span>
        <span className="pixel-hud__value">{xp}</span>
      </div>
      <div className="pixel-hud__stat">
        <span className="pixel-hud__label">ISLANDS</span>
        <span className="pixel-hud__value pixel-hud__value--mint">{questsDone} DONE</span>
      </div>
      {repoName && (
        <div className="pixel-hud__stat" style={{ flex: 2 }}>
          <span className="pixel-hud__label">REPO</span>
          <span
            className="pixel-hud__value"
            style={{ fontSize: "0.52rem", color: "var(--col-yellow)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {repoName}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sidebar navigation ───────────────────────────────────────────────────────
function Sidebar({ onNewRepo, hasMap }) {
  return (
    <aside className="pixel-sidebar app-shell__sidebar">
      <div className="pixel-sidebar__section-header">NAVIGATION</div>
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `pixel-sidebar__item${isActive ? " pixel-sidebar__item--active" : ""}`
        }
      >
        ▶ QUEST_BOARD.EXE
      </NavLink>

      {hasMap && (
        <div
          className="pixel-sidebar__item"
          style={{ cursor: "pointer", color: "var(--col-mint)" }}
          onClick={onNewRepo}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNewRepo()}
        >
          ◈ LEVEL_MAP.EXE
        </div>
      )}

      <NavLink
        to="/profile"
        className={({ isActive }) =>
          `pixel-sidebar__item${isActive ? " pixel-sidebar__item--active" : ""}`
        }
      >
        ★ PLAYER.EXE
      </NavLink>

      <div className="pixel-sidebar__section-header" style={{ marginTop: "auto" }}>
        SYSTEM
      </div>
      <div className="pixel-sidebar__item" style={{ cursor: "default" }}>
        <span style={{ color: "var(--col-mint)" }}>●</span> API ONLINE
      </div>

      <div className="pixel-sidebar__section-header">LEGAL</div>
      <NavLink
        to="/terms"
        className={({ isActive }) =>
          `pixel-sidebar__item${isActive ? " pixel-sidebar__item--active" : ""}`
        }
      >
        ◻ TERMS_OF_SERVICE
      </NavLink>
      <NavLink
        to="/privacy"
        className={({ isActive }) =>
          `pixel-sidebar__item${isActive ? " pixel-sidebar__item--active" : ""}`
        }
      >
        ◻ PRIVACY_POLICY
      </NavLink>
    </aside>
  );
}

// ── Status bar ───────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <footer className="pixel-window__statusbar app-shell__statusbar">
      <span className="pixel-window__statusbar-segment">ONBOARDQUEST v1.0</span>
      <span className="pixel-window__statusbar-segment">
        {new Date().toLocaleDateString("en-GB")}
      </span>
      <Link
        to="/terms"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize:   "0.38rem",
          color:      "var(--col-caption)",
          textDecoration: "none",
          padding:    "1px 6px",
          border:     "1px solid var(--col-navy)",
          background: "var(--col-cream)",
        }}
      >
        TERMS
      </Link>
      <Link
        to="/privacy"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize:   "0.38rem",
          color:      "var(--col-caption)",
          textDecoration: "none",
          padding:    "1px 6px",
          border:     "1px solid var(--col-navy)",
          background: "var(--col-cream)",
        }}
      >
        PRIVACY
      </Link>
      <span className="pixel-window__statusbar-segment" style={{ marginLeft: "auto" }}>
        READY
      </span>
    </footer>
  );
}

// ── Root app ─────────────────────────────────────────────────────────────────
export default function App() {
  // App-level state
  const [appState,      setAppState]      = useState("landing"); // "landing" | "scanning" | "map"
  const [repoUrl,       setRepoUrl]       = useState("");
  const [analyseResult, setAnalyseResult] = useState(null);
  const [xp,            setXp]            = useState(0);
  const [level,         setLevel]         = useState(1);
  const [questsDone,    setQuestsDone]    = useState(0);

  function handleScanStart(url) {
    setRepoUrl(url);
    setAppState("scanning");
  }

  function handleScanComplete(result) {
    setAnalyseResult(result);
    setAppState("map");
  }

  function handleScanError(message) {
    console.error("Scan failed:", message);
    setAppState("landing");
  }

  function handleReset() {
    setAppState("landing");
    setAnalyseResult(null);
    setRepoUrl("");
  }

  const repoName = analyseResult?.repoName || (repoUrl && repoUrl !== "DEMO" ? repoUrl.replace("https://github.com/", "") : null);

  return (
    <BrowserRouter>
      <div className={`app-shell${appState === "scanning" ? " app-shell--fullscreen" : ""}`}>

        {/* HUD — always visible */}
        {appState !== "scanning" && (
          <PlayerHUD
            xp={xp}
            level={level}
            questsDone={questsDone}
            repoName={repoName}
          />
        )}

        {/* Sidebar — only when not scanning */}
        {appState !== "scanning" && (
          <Sidebar
            onNewRepo={() => setAppState("map")}
            hasMap={appState === "map" || !!analyseResult}
          />
        )}

        {/* Main content area */}
        <main className={`app-shell__main${appState === "scanning" ? " app-shell__main--scanning" : ""}`}>

          {/* ── Scanning overlay — full-screen, no sidebar ────────────── */}
          {appState === "scanning" && (
            <RepoScanner
              repoUrl={repoUrl}
              onComplete={handleScanComplete}
              onError={handleScanError}
            />
          )}

          {/* ── Map view ─────────────────────────────────────────────── */}
          {appState === "map" && analyseResult && (
            <LevelMap
              analyseResult={analyseResult}
              onReset={handleReset}
            />
          )}

          {/* ── All other pages (only shown when NOT scanning and NOT on map) ─── */}
          {appState !== "scanning" && appState !== "map" && (
            <Routes>
              <Route path="/"        element={<QuestBoard onScanStart={handleScanStart} />} />
              <Route path="/profile" element={<PlayerProfile />}   />
              <Route path="/terms"   element={<TermsOfService />}  />
              <Route path="/privacy" element={<PrivacyPolicy />}   />
              <Route path="*"        element={<QuestBoard onScanStart={handleScanStart} />} />
            </Routes>
          )}

          {/* ── On the map but user navigates back to landing ─────────── */}
          {appState === "map" && !analyseResult && (
            <QuestBoard onScanStart={handleScanStart} />
          )}
        </main>

        {/* Status bar */}
        {appState !== "scanning" && <StatusBar />}
      </div>
    </BrowserRouter>
  );
}
