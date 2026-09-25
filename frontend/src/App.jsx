import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import QuestBoard from "./pages/QuestBoard.jsx";
import LevelMap    from "./pages/LevelMap.jsx";
import PlayerProfile from "./pages/PlayerProfile.jsx";
import { TermsOfService, PrivacyPolicy } from "./pages/LegalPages.jsx";

// ── Player HUD strip ────────────────────────────────────────────────────────
function PlayerHUD() {
  return (
    <div className="pixel-hud app-shell__hud">
      <div className="pixel-hud__stat">
        <span className="pixel-hud__label">PLAYER</span>
        <span className="pixel-hud__value pixel-hud__value--white">PLAYER_1</span>
      </div>
      <div className="pixel-hud__stat">
        <span className="pixel-hud__label">LEVEL</span>
        <span className="pixel-hud__value">01</span>
      </div>
      <div className="pixel-hud__stat">
        <span className="pixel-hud__label">XP</span>
        <span className="pixel-hud__value">000 / 500</span>
      </div>
      <div className="pixel-hud__stat">
        <span className="pixel-hud__label">QUESTS</span>
        <span className="pixel-hud__value pixel-hud__value--mint">0 DONE</span>
      </div>
    </div>
  );
}

// ── Sidebar navigation ──────────────────────────────────────────────────────
function Sidebar() {
  const nav = [
    { to: "/",        label: "▶ QUEST_BOARD.EXE" },
    { to: "/map",     label: "◈ LEVEL_MAP.EXE"   },
    { to: "/profile", label: "★ PLAYER.EXE"       },
  ];

  return (
    <aside className="pixel-sidebar app-shell__sidebar">
      <div className="pixel-sidebar__section-header">NAVIGATION</div>
      {nav.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `pixel-sidebar__item${isActive ? " pixel-sidebar__item--active" : ""}`
          }
        >
          {label}
        </NavLink>
      ))}

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

// ── Status bar ──────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <footer className="pixel-window__statusbar app-shell__statusbar">
      <span className="pixel-window__statusbar-segment">ONBOARDQUEST v1.0</span>
      <span className="pixel-window__statusbar-segment">
        {new Date().toLocaleDateString("en-GB")}
      </span>
      {/* Legal footer links — inline in status bar, retro monospaced style */}
      <Link
        to="/terms"
        style={{
          fontFamily:    "var(--font-pixel)",
          fontSize:      "0.38rem",
          color:         "var(--col-caption)",
          textDecoration: "none",
          padding:       "1px 6px",
          border:        "1px solid var(--col-navy)",
          background:    "var(--col-cream)",
        }}
      >
        TERMS
      </Link>
      <Link
        to="/privacy"
        style={{
          fontFamily:    "var(--font-pixel)",
          fontSize:      "0.38rem",
          color:         "var(--col-caption)",
          textDecoration: "none",
          padding:       "1px 6px",
          border:        "1px solid var(--col-navy)",
          background:    "var(--col-cream)",
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

// ── Root app ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <PlayerHUD />
        <Sidebar />
        <main className="app-shell__main">
          <Routes>
            <Route path="/"        element={<QuestBoard />}      />
            <Route path="/map"     element={<LevelMap />}        />
            <Route path="/profile" element={<PlayerProfile />}   />
            <Route path="/terms"   element={<TermsOfService />}  />
            <Route path="/privacy" element={<PrivacyPolicy />}   />
          </Routes>
        </main>
        <StatusBar />
      </div>
    </BrowserRouter>
  );
}
