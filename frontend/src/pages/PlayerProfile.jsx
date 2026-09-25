const BADGES = [
  { id: "b1", label: "FIRST_QUEST.EXE", icon: "★", earned: false },
  { id: "b2", label: "EXPLORER.EXE",    icon: "◈", earned: false },
  { id: "b3", label: "COMPLETIONIST",   icon: "♦", earned: false },
];

export default function PlayerProfile() {
  return (
    <div className="pixel-window" style={{ height: "100%" }}>
      <div className="pixel-titlebar">
        <span className="pixel-titlebar__title">PLAYER.EXE — PROFILE &amp; PROGRESS</span>
        <div className="pixel-titlebar__controls">
          <button className="pixel-titlebar__btn">_</button>
          <button className="pixel-titlebar__btn">□</button>
          <button className="pixel-titlebar__btn pixel-titlebar__btn--close">×</button>
        </div>
      </div>

      <div className="pixel-window__body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Avatar + stats */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Avatar tile */}
          <div
            className="border-pixel shadow-pixel bg-pixel-sky"
            style={{
              width: 64, height: 64, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2rem",
            }}
          >
            🧑‍💻
          </div>

          {/* Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <h2 className="font-pixel" style={{ fontSize: "0.7rem", color: "var(--col-blue)" }}>
              PLAYER_1
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="font-pixel" style={{ fontSize: "0.45rem", color: "var(--col-muted)" }}>
                LEVEL 1 — XP: 0 / 500
              </span>
              <div className="pixel-progress pixel-progress--xp">
                <div className="pixel-progress__fill" style={{ width: "0%" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pixel-badge pixel-badge--blue">LEVEL 1</span>
              <span className="pixel-badge">0 QUESTS</span>
              <span className="pixel-badge pixel-badge--yellow">0 XP</span>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div>
          <div
            className="pixel-sidebar__section-header"
            style={{ marginBottom: 8, padding: "6px 8px" }}
          >
            BADGES
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {BADGES.map((badge) => (
              <div
                key={badge.id}
                className="border-pixel shadow-pixel font-pixel"
                style={{
                  padding:    "8px 10px",
                  background: badge.earned ? "var(--col-yellow)" : "var(--col-parchment)",
                  fontSize:   "0.45rem",
                  color:      "var(--col-ink)",
                  opacity:    badge.earned ? 1 : 0.5,
                  display:    "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{badge.icon}</span>
                <span>{badge.label}</span>
                <span style={{ color: "var(--col-muted)", fontSize: "0.4rem" }}>
                  {badge.earned ? "EARNED" : "LOCKED"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div
            className="pixel-sidebar__section-header"
            style={{ marginBottom: 8, padding: "6px 8px" }}
          >
            ACTIVITY LOG
          </div>
          <table className="pixel-table">
            <thead>
              <tr>
                <th>EVENT</th>
                <th>XP</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--col-caption)" }}>
                  No activity yet. Start a quest!
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="pixel-window__statusbar">
        <span className="pixel-window__statusbar-segment">PLAYER_1</span>
        <span className="pixel-window__statusbar-segment" style={{ marginLeft: "auto" }}>
          RANK: RECRUIT
        </span>
      </div>
    </div>
  );
}
