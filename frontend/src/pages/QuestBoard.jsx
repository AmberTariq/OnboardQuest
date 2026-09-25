/**
 * QuestBoard.jsx
 * The landing page / hero screen for OnboardQuest.
 * Players enter a GitHub repo URL here to begin their adventure.
 * Shows recent scans, demo button, and feature highlights.
 */

import { useState, useRef, useEffect } from "react";

// ── Retro typing effect for the tagline ──────────────────────────────────────
function useTagline(lines, interval = 2800) {
  const [lineIdx, setLineIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    const target = lines[lineIdx];
    if (charIdx < target.length) {
      const t = setTimeout(() => {
        setDisplayed(target.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      }, 38);
      return () => clearTimeout(t);
    }
    // Finished typing — pause then move to next line
    const t = setTimeout(() => {
      const next = (lineIdx + 1) % lines.length;
      setLineIdx(next);
      setDisplayed("");
      setCharIdx(0);
    }, interval);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx, lines, interval]);

  return displayed;
}

// ── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-card__icon">{icon}</div>
      <div className="feature-card__title">{title}</div>
      <div className="feature-card__desc">{desc}</div>
    </div>
  );
}

// ── Main landing page ─────────────────────────────────────────────────────────
export default function QuestBoard({ onScanStart }) {
  const [repoUrl,  setRepoUrl]  = useState("");
  const [error,    setError]    = useState("");
  const [shaking,  setShaking]  = useState(false);
  const inputRef = useRef(null);

  const tagline = useTagline([
    "SCAN A REPO. CONQUER ITS CODE.",
    "TURN ANY CODEBASE INTO A QUEST.",
    "LEARN ARCHITECTURE. EARN XP.",
    "NO MORE README DREAD.",
  ]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setError("PASTE A GITHUB URL TO BEGIN YOUR ADVENTURE");
      shake();
      return;
    }
    const isGitHub = /^https?:\/\/github\.com\/.+\/.+/i.test(trimmed);
    if (!isGitHub) {
      setError("MUST BE A GITHUB URL — e.g. https://github.com/owner/repo");
      shake();
      return;
    }
    setError("");
    onScanStart(trimmed);
  }

  function shake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  function handleDemo() {
    onScanStart("DEMO");
  }

  return (
    <div className="landing">
      {/* ── Hero section ──────────────────────────────────────────────────── */}
      <div className="landing__hero">
        {/* Pixel star field */}
        <div className="landing__stars" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="landing__star" style={{
              left:             `${(i * 397 + 17) % 100}%`,
              top:              `${(i * 251 + 43) % 100}%`,
              animationDelay:   `${(i * 0.3) % 3}s`,
              width:            i % 3 === 0 ? 4 : 2,
              height:           i % 3 === 0 ? 4 : 2,
            }} />
          ))}
        </div>

        {/* Logo */}
        <div className="landing__logo">
          <span className="landing__logo-bracket">[</span>
          ONBOARD
          <span className="landing__logo-quest">QUEST</span>
          <span className="landing__logo-bracket">]</span>
        </div>

        {/* Animated tagline */}
        <div className="landing__tagline">
          <span>{tagline}</span>
          <span className="landing__cursor">█</span>
        </div>

        <div className="landing__sub">
          Powered by <span style={{ color: "var(--col-yellow)" }}>IBM Granite 3</span> via watsonx.ai
          &nbsp;·&nbsp; Real-time architecture analysis &nbsp;·&nbsp; Interactive quest map
        </div>
      </div>

      {/* ── Repo input form ─────────────────────────────────────────────────── */}
      <div className="landing__input-zone">
        <div className="pixel-window landing__input-window">
          <div className="pixel-titlebar">
            <span className="pixel-titlebar__title">NEW_QUEST.EXE — ENTER REPOSITORY</span>
            <div className="pixel-titlebar__controls">
              <span className="pixel-titlebar__btn">_</span>
              <span className="pixel-titlebar__btn">□</span>
              <span className="pixel-titlebar__btn pixel-titlebar__btn--close">×</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="landing__form">
            <div className={`landing__input-row${shaking ? " landing__input-row--shake" : ""}`}>
              <span className="landing__input-prompt">$</span>
              <input
                ref={inputRef}
                className="landing__input"
                type="text"
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setError(""); }}
                placeholder="https://github.com/owner/repo"
                autoComplete="off"
                spellCheck={false}
                aria-label="GitHub repository URL"
              />
            </div>

            {error && (
              <div className="landing__error">
                <span style={{ color: "var(--col-red)" }}>⚠</span> {error}
              </div>
            )}

            <div className="landing__actions">
              <button
                type="submit"
                className="pixel-btn pixel-btn--primary landing__btn-scan"
              >
                ▶ START ADVENTURE
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn--ghost"
                onClick={handleDemo}
              >
                ◈ TRY DEMO REPO
              </button>
            </div>
          </form>

          <div className="pixel-window__statusbar">
            <span className="pixel-window__statusbar-segment">READY</span>
            <span className="pixel-window__statusbar-segment">
              Supports public GitHub repos · Private repos need a PAT token in backend/.env
            </span>
          </div>
        </div>
      </div>

      {/* ── Feature cards ────────────────────────────────────────────────────── */}
      <div className="landing__features">
        <FeatureCard
          icon="🗺"
          title="ARCHITECTURE MAP"
          desc="Auto-generates a floating island map of every architectural layer — routes, models, utilities, tests."
        />
        <FeatureCard
          icon="🤖"
          title="AI MENTOR-8"
          desc="IBM Granite explains each layer in plain language. Streaming quest briefings with objective, risks, and XP reward."
        />
        <FeatureCard
          icon="⚔"
          title="MINI-CHALLENGES"
          desc="Each island includes hands-on challenges: trace a request, find an exception handler, map a dependency."
        />
        <FeatureCard
          icon="★"
          title="XP & PROGRESS"
          desc="Earn XP for completing quests. Track your progress across every layer of the codebase adventure."
        />
      </div>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <div className="landing__how">
        <div className="pixel-window" style={{ maxWidth: 780, width: "100%" }}>
          <div className="pixel-titlebar">
            <span className="pixel-titlebar__title">HOW_IT_WORKS.EXE</span>
            <div className="pixel-titlebar__controls">
              <span className="pixel-titlebar__btn">_</span>
              <span className="pixel-titlebar__btn">□</span>
            </div>
          </div>
          <div className="landing__steps">
            {[
              { n: "01", label: "PASTE A GITHUB URL", desc: "Any public repo. Works with Node, Python, Go, Ruby, and more." },
              { n: "02", label: "WATCH THE SCAN",     desc: "IBM Granite analyses the repo in real time — files, layers, dependencies." },
              { n: "03", label: "EXPLORE THE MAP",    desc: "Float across islands representing each architectural layer." },
              { n: "04", label: "BRIEF WITH MENTOR-8",desc: "Click any island to get an AI quest briefing, risks, and challenges." },
            ].map(({ n, label, desc }) => (
              <div key={n} className="landing__step">
                <div className="landing__step-n">{n}</div>
                <div className="landing__step-label">{label}</div>
                <div className="landing__step-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
