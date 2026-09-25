/**
 * RepoScanner.jsx
 * Full-screen scanning animation shown while the backend analyses a repository.
 * Displays a scrolling terminal log, animated progress bar, and a pixel mascot.
 */

import { useEffect, useState, useRef } from "react";

const SCAN_STEPS = [
  "INITIALISING ANALYSIS ENGINE…",
  "CLONING REPOSITORY…",
  "WALKING FILE TREE…",
  "DETECTING LANGUAGES…",
  "MAPPING ARCHITECTURAL LAYERS…",
  "IDENTIFYING ENTRY POINTS…",
  "TRACING DEPENDENCY GRAPH…",
  "SCORING DIFFICULTY LEVELS…",
  "GENERATING QUEST ISLANDS…",
  "BRIEFING MENTOR-8…",
  "COMPILING ADVENTURE MAP…",
  "READY.",
];

export default function RepoScanner({ repoUrl, onComplete, onError }) {
  const [logLines, setLogLines]   = useState([]);
  const [progress, setProgress]   = useState(0);
  const [stepIdx,  setStepIdx]    = useState(0);
  const [done,     setDone]       = useState(false);
  const logRef  = useRef(null);
  const mounted = useRef(true);

  // Auto-scroll terminal log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let stepTimer;
    let currentStep = 0;

    function advanceStep() {
      if (!mounted.current) return;
      if (currentStep >= SCAN_STEPS.length - 1) return;
      currentStep += 1;
      setStepIdx(currentStep);
      setLogLines((prev) => [
        ...prev,
        { text: `> ${SCAN_STEPS[currentStep]}`, cls: "scanner-log--active" },
      ]);
      setProgress(Math.round((currentStep / (SCAN_STEPS.length - 1)) * 80));
      stepTimer = setTimeout(advanceStep, 420 + Math.random() * 340);
    }

    // Kick off immediately with first step
    setLogLines([{ text: `> ${SCAN_STEPS[0]}`, cls: "scanner-log--active" }]);
    setProgress(2);
    stepTimer = setTimeout(advanceStep, 500);

    // Fire the real API call
    const ctrl = new AbortController();

    async function doAnalyse() {
      try {
        const isDemo = repoUrl === "DEMO";
        const res = await fetch(isDemo ? "/api/analyse/demo" : "/api/analyse", {
          method:  isDemo ? "GET" : "POST",
          headers: isDemo ? undefined : { "Content-Type": "application/json" },
          body:    isDemo ? undefined : JSON.stringify({ target: repoUrl, slim: false }),
          signal:  ctrl.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }

        const data = await res.json();

        clearTimeout(stepTimer);
        if (!mounted.current) return;

        // Complete the progress bar
        setLogLines((prev) => [
          ...prev,
          { text: `> SCAN COMPLETE — ${data.stats?.totalFiles ?? "?"} FILES PROCESSED`, cls: "scanner-log--success" },
          { text: `> ${(data.levels || []).length} ISLANDS GENERATED`, cls: "scanner-log--success" },
          { text: `> ADVENTURE MAP READY. GOOD LUCK, HERO.`, cls: "scanner-log--success" },
        ]);
        setProgress(100);
        setDone(true);

        setTimeout(() => {
          if (mounted.current) onComplete(data);
        }, 1200);
      } catch (err) {
        if (err.name === "AbortError") return;
        clearTimeout(stepTimer);
        if (!mounted.current) return;
        setLogLines((prev) => [
          ...prev,
          { text: `> ERROR: ${err.message}`, cls: "scanner-log--error" },
          { text: `> FALLING BACK TO DEMO MODE…`, cls: "scanner-log--warn" },
        ]);
        setProgress(100);

        setDone(true);
        setTimeout(() => {
          if (mounted.current) onError(err.message);
        }, 1200);
      }
    }

    doAnalyse();
    return () => {
      mounted.current = false;
      clearTimeout(stepTimer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl]);

  return (
    <div className="scanner-screen">
      {/* Header */}
      <div className="scanner-header">
        <div className="scanner-header__logo">ONBOARDQUEST</div>
        <div className="scanner-header__sub">REPOSITORY ANALYSIS ENGINE v1.0</div>
      </div>

      {/* Mascot + status */}
      <div className="scanner-mascot-row">
        <div className={`scanner-mascot${done ? " scanner-mascot--done" : ""}`} aria-hidden="true">
          <div className="scanner-mascot__antenna" />
          <div className="scanner-mascot__eyes">
            <span className="scanner-mascot__eye" />
            <span className="scanner-mascot__eye" />
          </div>
          <div className="scanner-mascot__mouth" />
        </div>
        <div className="scanner-status">
          <div className="scanner-status__label">
            {done ? "✓ SCAN COMPLETE" : SCAN_STEPS[stepIdx]}
          </div>
          <div className="scanner-status__repo">{repoUrl}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="scanner-progress-wrap">
        <div className="scanner-progress">
          <div
            className="scanner-progress__fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="scanner-progress__pct">{progress}%</span>
      </div>

      {/* Terminal log */}
      <div className="scanner-terminal" ref={logRef}>
        {logLines.map((line, i) => (
          <div key={i} className={`scanner-log ${line.cls || ""}`}>
            {line.text}
            {i === logLines.length - 1 && !done && (
              <span className="scanner-cursor" aria-hidden="true">█</span>
            )}
          </div>
        ))}
      </div>

      {done && (
        <div className="scanner-ready">
          ★ ADVENTURE MAP GENERATED — ENTERING QUEST WORLD…
        </div>
      )}
    </div>
  );
}
