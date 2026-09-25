/**
 * ChallengePanel.jsx
 * A modal dialog showing mini-challenges for a selected island.
 * Challenges are generated based on the island's kind/layer type.
 */

import { useState } from "react";
import { createPortal } from "react-dom";

// ─── Challenge templates per layer kind ──────────────────────────────────────

const CHALLENGE_TEMPLATES = {
  entry_point: [
    {
      id: "c1",
      title: "TRACE THE PIPELINE",
      difficulty: "EASY",
      prompt:
        "Open the entry-point file. List every middleware mounted with app.use() in order. " +
        "What would happen if you swapped the auth middleware and the route handler?",
      hint: "Look for app.use() calls — the order matters for request processing.",
      xp: 50,
    },
    {
      id: "c2",
      title: "ADD ERROR HANDLER",
      difficulty: "MEDIUM",
      prompt:
        "The app is missing a global error handler. Write a 4-argument Express error handler " +
        "(err, req, res, next) that returns a JSON { error, message } response and logs to console.error.",
      hint: "Express identifies error handlers by having exactly 4 parameters.",
      xp: 100,
    },
    {
      id: "c3",
      title: "FIND THE PORT",
      difficulty: "EASY",
      prompt:
        "Where is the server port defined? What happens if PORT is not set in the environment? " +
        "Is there a fallback? Is it documented?",
      hint: "Check for process.env.PORT and any default value.",
      xp: 30,
    },
  ],
  config: [
    {
      id: "c1",
      title: "AUDIT ENV VARS",
      difficulty: "EASY",
      prompt:
        "List every environment variable the app reads. " +
        "Which ones are secrets? Which ones are safe to commit? " +
        "Create a .env.example with placeholder values for each.",
      hint: "Search for process.env. occurrences across the codebase.",
      xp: 60,
    },
    {
      id: "c2",
      title: "VALIDATE ON BOOT",
      difficulty: "MEDIUM",
      prompt:
        "Add a startup check that throws an error if any required env var is missing. " +
        "Required vars: DATABASE_URL, JWT_SECRET. Log a clear error message for each missing var.",
      hint: "Run this check before app.listen() so the server fails fast.",
      xp: 120,
    },
  ],
  api_route: [
    {
      id: "c1",
      title: "FIND THE CHECKOUT HANDLER",
      difficulty: "MEDIUM",
      prompt:
        "Locate the route handler for POST /api/checkout (or equivalent). " +
        "What user input does it accept? Is it validated before use? " +
        "Write a safe exception handler wrapping the core logic.",
      hint: "Look for try/catch blocks — or their absence.",
      xp: 150,
    },
    {
      id: "c2",
      title: "MAP THE API SURFACE",
      difficulty: "EASY",
      prompt:
        "List all HTTP routes in the format: METHOD /path — what it does. " +
        "Which routes are protected by auth middleware? Which are public?",
      hint: "Check router.get/post/put/delete and middleware arrays on each route.",
      xp: 80,
    },
    {
      id: "c3",
      title: "ADD INPUT VALIDATION",
      difficulty: "HARD",
      prompt:
        "Pick one POST route that accepts a request body. " +
        "Add validation to reject requests missing required fields, returning a 400 with { error, fields }.",
      hint: "Check each req.body field before using it in business logic.",
      xp: 200,
    },
  ],
  database_schema: [
    {
      id: "c1",
      title: "SKETCH THE ERD",
      difficulty: "MEDIUM",
      prompt:
        "Draw a simple entity-relationship diagram (text or ASCII is fine) of all the models. " +
        "What are the foreign keys? What indexes exist?",
      hint: "Look for references/associations between models.",
      xp: 120,
    },
    {
      id: "c2",
      title: "FIND MISSING INDEXES",
      difficulty: "HARD",
      prompt:
        "Which columns are used in WHERE clauses but have no index? " +
        "Write the SQL CREATE INDEX statement to add them.",
      hint: "Check query files for WHERE/JOIN conditions that reference unindexed columns.",
      xp: 200,
    },
  ],
  database_client: [
    {
      id: "c1",
      title: "CHECK THE POOL CONFIG",
      difficulty: "MEDIUM",
      prompt:
        "Find the connection pool configuration. What is the max connection count? " +
        "What happens under high load — could the pool exhaust? " +
        "Suggest a safer configuration.",
      hint: "Check pool.max and pool.idleTimeoutMillis settings.",
      xp: 100,
    },
  ],
  utility: [
    {
      id: "c1",
      title: "FIND CIRCULAR DEPS",
      difficulty: "HARD",
      prompt:
        "Trace the import chain for the main utility module. " +
        "Does any file import itself indirectly? " +
        "Draw the dependency graph as an ASCII tree.",
      hint: "Start from index.js and follow require/import statements.",
      xp: 180,
    },
    {
      id: "c2",
      title: "WRITE A UNIT TEST",
      difficulty: "MEDIUM",
      prompt:
        "Pick the most important utility function. Write a unit test with at least 3 cases: " +
        "happy path, edge case (empty/null input), and error case.",
      hint: "Good tests describe behaviour, not implementation.",
      xp: 120,
    },
  ],
  test: [
    {
      id: "c1",
      title: "RUN AND GREEN",
      difficulty: "EASY",
      prompt:
        "Run the test suite. How many pass? How many fail? " +
        "Pick one failing test and make it pass without changing the test itself.",
      hint: "Read the error message carefully — it tells you exactly what's expected.",
      xp: 80,
    },
    {
      id: "c2",
      title: "INCREASE COVERAGE",
      difficulty: "HARD",
      prompt:
        "Find a function with no test coverage. Write a test file covering: " +
        "normal use, boundary values, and one error scenario.",
      hint: "Use the coverage report (--coverage flag) to find untested code.",
      xp: 200,
    },
  ],
};

const FALLBACK_CHALLENGES = [
  {
    id: "c1",
    title: "READ THE FILES",
    difficulty: "EASY",
    prompt:
      "Open each file in this layer. For each one, write one sentence describing what it does. " +
      "Which file is the most important? Why?",
    hint: "Focus on exports — what does this file provide to the rest of the app?",
    xp: 60,
  },
  {
    id: "c2",
    title: "FIND THE DANGER ZONE",
    difficulty: "MEDIUM",
    prompt:
      "Look for any input that comes from outside the app (user input, network, env). " +
      "Is it validated before use? Where could an attacker inject unexpected values?",
    hint: "Unvalidated input is the #1 source of security bugs.",
    xp: 120,
  },
];

// ─── Difficulty colours ───────────────────────────────────────────────────────

const DIFF_STYLE = {
  EASY:   { background: "var(--col-mint)",   color: "var(--col-ink)" },
  MEDIUM: { background: "var(--col-yellow)", color: "var(--col-ink)" },
  HARD:   { background: "var(--col-red)",    color: "#fff"           },
};

// ─── Single challenge card ────────────────────────────────────────────────────

function ChallengeCard({ challenge, isActive, onSelect, onComplete, isCompleted }) {
  const diffStyle = DIFF_STYLE[challenge.difficulty] || {};

  return (
    <div
      className={`challenge-card${isActive ? " challenge-card--active" : ""}${isCompleted ? " challenge-card--done" : ""}`}
      onClick={() => onSelect(challenge.id)}
    >
      <div className="challenge-card__header">
        <span className="challenge-card__title">
          {isCompleted ? "✓ " : ""}{challenge.title}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <span className="pixel-badge" style={diffStyle}>{challenge.difficulty}</span>
          <span className="pixel-badge pixel-badge--yellow">★ {challenge.xp} XP</span>
        </div>
      </div>

      {isActive && (
        <div className="challenge-card__body">
          <div className="challenge-card__prompt">{challenge.prompt}</div>
          <div className="challenge-card__hint">
            <span className="challenge-card__hint-label">💡 HINT:</span> {challenge.hint}
          </div>
          {!isCompleted && (
            <button
              className="pixel-btn pixel-btn--success"
              style={{ fontSize: "0.42rem", marginTop: 8 }}
              onClick={(e) => { e.stopPropagation(); onComplete(challenge.id); }}
            >
              ✓ MARK COMPLETE
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ChallengePanel({ island, onClose, onComplete }) {
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [completedIds,    setCompletedIds]    = useState(new Set());

  const challenges = CHALLENGE_TEMPLATES[island?.kind] || FALLBACK_CHALLENGES;
  const allDone    = challenges.every((c) => completedIds.has(c.id));
  const earnedXp   = challenges
    .filter((c) => completedIds.has(c.id))
    .reduce((s, c) => s + c.xp, 0);

  function completeChallenge(id) {
    setCompletedIds((prev) => new Set([...prev, id]));
    setActiveChallenge(null);
  }

  const panel = (
    <>
      {/* Overlay */}
      <div className="mentor-overlay" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="mentor-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Challenges: ${island?.title}`}
      >
        {/* Title bar */}
        <div className="mentor-titlebar">
          <span className="mentor-titlebar__title">
            ⚔ MINI_CHALLENGES.EXE — {island?.badge}
          </span>
          <button
            className="mentor-titlebar__close"
            onClick={onClose}
            aria-label="Close challenges"
          >
            ×
          </button>
        </div>

        {/* Context strip */}
        <div className="mentor-context">
          <span className="mentor-context__icon">{island?.icon}</span>
          <span className="mentor-context__title">{island?.title}</span>
          <span className="pixel-badge pixel-badge--yellow">★ {earnedXp} XP EARNED</span>
        </div>

        {/* Progress */}
        <div style={{ padding: "8px 16px", borderBottom: "2px solid var(--col-navy)", background: "var(--col-parchment)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontFamily: "var(--font-pixel)", fontSize: "0.42rem", color: "var(--col-muted)" }}>
            <span>CHALLENGE PROGRESS</span>
            <span>{completedIds.size}/{challenges.length}</span>
          </div>
          <div className="pixel-progress pixel-progress--xp">
            <div
              className="pixel-progress__fill"
              style={{ width: `${challenges.length > 0 ? (completedIds.size / challenges.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Challenge list */}
        <div className="mentor-body">
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.42rem", color: "var(--col-muted)", marginBottom: 8 }}>
            {island?.hint || island?.desc}
          </div>

          {challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              isActive={activeChallenge === challenge.id}
              isCompleted={completedIds.has(challenge.id)}
              onSelect={(id) => setActiveChallenge((prev) => prev === id ? null : id)}
              onComplete={completeChallenge}
            />
          ))}

          {allDone && (
            <div className="scanner-ready" style={{ marginTop: 12 }}>
              ★ ALL CHALLENGES CLEARED! ISLAND CONQUERED!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mentor-footer">
          <button className="pixel-btn pixel-btn--ghost" onClick={onClose} style={{ fontSize: "0.42rem", padding: "5px 10px" }}>
            ← BACK TO MAP
          </button>
          {allDone && (
            <button
              className="pixel-btn pixel-btn--success"
              style={{ fontSize: "0.42rem", padding: "5px 10px" }}
              onClick={onComplete}
            >
              ✓ COMPLETE ISLAND
            </button>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
