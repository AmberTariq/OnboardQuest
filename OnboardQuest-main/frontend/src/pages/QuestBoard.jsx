import { useState } from "react";

const QUESTS = [
  {
    id: "q1",
    title: "THE_ENTRY_POINT.EXE",
    description: "Locate the application entry point and explain its role to the team.",
    xp: 100,
    difficulty: "EASY",
    completed: false,
  },
  {
    id: "q2",
    title: "LAYER_MAZE.EXE",
    description: "Identify every architectural layer and map the dependency graph.",
    xp: 250,
    difficulty: "MEDIUM",
    completed: false,
  },
  {
    id: "q3",
    title: "DATA_FLOW.EXE",
    description: "Trace a full request from HTTP handler to database and back.",
    xp: 400,
    difficulty: "HARD",
    completed: false,
  },
];

const DIFF_BADGE = {
  EASY:   "pixel-badge--mint",
  MEDIUM: "pixel-badge--yellow",
  HARD:   "pixel-badge--red",
};

export default function QuestBoard() {
  const [quests, setQuests] = useState(QUESTS);

  function toggleComplete(id) {
    setQuests((q) =>
      q.map((quest) =>
        quest.id === id ? { ...quest, completed: !quest.completed } : quest
      )
    );
  }

  const done  = quests.filter((q) => q.completed).length;
  const total = quests.length;

  return (
    <div className="pixel-window" style={{ height: "100%" }}>
      {/* Title bar */}
      <div className="pixel-titlebar">
        <span className="pixel-titlebar__title">QUEST_BOARD.EXE — {done}/{total} COMPLETE</span>
        <div className="pixel-titlebar__controls">
          <button className="pixel-titlebar__btn">_</button>
          <button className="pixel-titlebar__btn">□</button>
          <button className="pixel-titlebar__btn pixel-titlebar__btn--close">×</button>
        </div>
      </div>

      {/* XP progress */}
      <div style={{ padding: "10px 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="font-pixel" style={{ fontSize: "0.5rem", color: "var(--col-muted)" }}>
          XP PROGRESS
        </span>
        <div className="pixel-progress pixel-progress--xp">
          <div
            className="pixel-progress__fill"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Quest list */}
      <div className="pixel-window__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {quests.map((quest) => (
          <div
            key={quest.id}
            className={`quest-card${quest.completed ? " quest-card--completed" : ""}`}
            onClick={() => toggleComplete(quest.id)}
          >
            <div className="quest-card__title">
              {quest.completed ? "✓ " : ""}{quest.title}
            </div>
            <p className="quest-card__desc">{quest.description}</p>
            <div className="quest-card__meta">
              <span className={`pixel-badge ${DIFF_BADGE[quest.difficulty]}`}>
                {quest.difficulty}
              </span>
              <span className="pixel-badge pixel-badge--yellow xp-coin">
                {quest.xp} XP
              </span>
              {quest.completed && (
                <span className="pixel-badge pixel-badge--mint">COMPLETED</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="pixel-window__statusbar">
        <span className="pixel-window__statusbar-segment">
          {total - done} QUESTS REMAINING
        </span>
        <span className="pixel-window__statusbar-segment" style={{ marginLeft: "auto" }}>
          CLICK QUEST TO COMPLETE
        </span>
      </div>
    </div>
  );
}
