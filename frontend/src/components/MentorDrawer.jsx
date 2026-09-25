/**
 * MentorDrawer.jsx
 * Slide-in AI Mentor chat panel that opens when a player clicks a floating island.
 *
 * Features:
 *   - Pure-CSS 8-bit mascot (MENTOR-8) that bobs & has a blinking antenna
 *   - Speech bubble greeting personalised to the selected island
 *   - Three retro dialogue boxes (Objective / Bug Risks / Reward) that type-in
 *     character-by-character using a streaming fetch from POST /api/mentor/brief
 *   - Monospaced font throughout; coloured ► / ⚠ / ★ bullets per section
 *   - Steps-based keyframe animations — no smooth easing, fully pixel-safe
 *   - Escape key + overlay click to close
 *   - Re-brief button to re-run the LLM for the same island
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Typewriter hook ──────────────────────────────────────────────────────────

/**
 * Incrementally reveal `text` one character at a time.
 *
 * Key design: `text` grows as streaming tokens arrive.  We track how many
 * characters we have already *displayed* (`indexRef`) and only ever advance
 * forward — we never reset mid-stream, so newly appended characters smoothly
 * continue from wherever the cursor sits.  Resetting only happens when `active`
 * flips from false→true (new island opened) or when the whole text is replaced
 * wholesale (identified by it being shorter than our current index).
 *
 * @param {string}  text        Full target string (may grow over time)
 * @param {boolean} active      When false, display jumps immediately to full text
 * @param {number}  [charDelay] ms between characters (default 18)
 */
function useTypewriter(text, active, charDelay = 18) {
  const [displayed, setDisplayed] = useState("");
  const rafRef     = useRef(null);
  const indexRef   = useRef(0);
  const textRef    = useRef(text);
  const activeRef  = useRef(active);

  // Keep refs in sync with latest props every render
  textRef.current   = text;
  activeRef.current = active;

  // When active flips to false → jump to full text immediately, cancel any RAF
  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      indexRef.current = text.length;
      setDisplayed(text);
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect a hard reset: text got shorter than our current index
  // (happens when a brand-new island is selected and rawText is cleared)
  useEffect(() => {
    if (text.length < indexRef.current) {
      cancelAnimationFrame(rafRef.current);
      indexRef.current = 0;
      setDisplayed("");
    }
  }, [text]);

  // Kick off / keep alive the RAF loop whenever active and text grows
  useEffect(() => {
    if (!active) return;
    // If the cursor has already caught up, nothing to do
    if (indexRef.current >= textRef.current.length) return;

    let last = 0;

    function tick(ts) {
      // Check active each frame — may have been cancelled
      if (!activeRef.current) return;

      if (ts - last >= charDelay) {
        last = ts;
        indexRef.current += 1;
        setDisplayed(textRef.current.slice(0, indexRef.current));
      }

      if (indexRef.current < textRef.current.length) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [text, active, charDelay]); // re-run when text grows so the loop resumes

  const isDone = text.length > 0 && displayed.length >= text.length;
  return { displayed, isDone };
}

// ─── SSE streaming hook ───────────────────────────────────────────────────────

/**
 * Stream a quest briefing from POST /api/mentor/brief.
 *
 * Returns:
 *   { status, rawText, briefing, warning, startBrief }
 *
 * status: "idle" | "loading" | "streaming" | "done" | "error"
 */
function useMentorBrief(island) {
  const [status,   setStatus]   = useState("idle");
  const [rawText,  setRawText]  = useState("");
  const [briefing, setBriefing] = useState(null);   // { objective, risks, reward }
  const [warning,  setWarning]  = useState("");
  const abortRef   = useRef(null);
  // Keep a stable ref to the current island so startBrief never goes stale
  const islandRef  = useRef(island);
  islandRef.current = island;

  // Stable callback — never recreated, reads island via ref
  const startBrief = useCallback(async () => {
    const currentIsland = islandRef.current;
    if (!currentIsland) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl  = new AbortController();
    abortRef.current = ctrl;

    setStatus("loading");
    setRawText("");
    setBriefing(null);
    setWarning("");

    try {
      const res = await fetch("/api/mentor/brief", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          levelId:    currentIsland.id,
          title:      currentIsland.title,
          kind:       currentIsland.kind,
          files:      currentIsland.files,
          snippet:    currentIsland.snippet || "",
          difficulty: currentIsland.difficulty,
          xp:         currentIsland.xp,
          hint:       currentIsland.hint,
          desc:       currentIsland.desc,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      // ── Read the SSE stream ────────────────────────────────────────────
      setStatus("streaming");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });

        // SSE events are separated by "\n\n"
        const events = buf.split("\n\n");
        buf = events.pop(); // keep incomplete last chunk

        for (const event of events) {
          // Strip "data: " prefix
          const line = event.replace(/^data:\s*/m, "").trim();
          if (!line) continue;

          let parsed;
          try { parsed = JSON.parse(line); }
          catch { continue; }

          if (parsed.type === "token") {
            setRawText((prev) => prev + parsed.text);
          } else if (parsed.type === "section") {
            // section marker — no action needed; sections derived from rawText
          } else if (parsed.type === "done") {
            setBriefing(parsed.briefing);
            setStatus("done");
          } else if (parsed.type === "error") {
            setWarning(parsed.message);
          }
        }
      }

      // If stream ended without a "done" event (offline token-only mode)
      setStatus((s) => (s === "streaming" ? "done" : s));

    } catch (err) {
      if (err.name === "AbortError") return;
      setWarning(`Could not reach mentor: ${err.message}`);
      setStatus("error");
    }
  }, []); // stable — reads island via islandRef

  // Abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  return { status, rawText, briefing, warning, startBrief };
}

// ─── Text-to-rendered-lines converter ────────────────────────────────────────

/**
 * Convert a section text string into an array of JSX spans.
 * Lines starting with ►, ⚠, or ★ get coloured bullet classes.
 */
function renderLines(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    const trimmed = line.trimStart();
    let cls = "";
    if (trimmed.startsWith("►")) cls = "mentor-bullet--obj";
    else if (trimmed.startsWith("⚠")) cls = "mentor-bullet--risk";
    else if (trimmed.startsWith("★")) cls = "mentor-bullet--reward";

    return (
      <span key={i} className={`mentor-bullet ${cls}`}>
        {line}
      </span>
    );
  });
}

// ─── Section dialogue box ─────────────────────────────────────────────────────

const SECTION_META = {
  objective: { label: "► OBJECTIVE",    variant: "mentor-section--objective" },
  risks:     { label: "⚠ BUG RISKS",    variant: "mentor-section--risks"     },
  reward:    { label: "★ REWARD",        variant: "mentor-section--reward"    },
};

/**
 * A single retro dialogue box. Types in its content character by character
 * while `streaming` is true; jumps to full text when done.
 */
function SectionBox({ sectionKey, text, streaming }) {
  const { displayed, isDone } = useTypewriter(text, streaming && text.length > 0);
  const meta = SECTION_META[sectionKey];

  return (
    <div className={`mentor-section ${meta.variant}`}>
      <div className="mentor-section__header">{meta.label}</div>
      <div className="mentor-section__body">
        {renderLines(displayed)}
        {!isDone && streaming && <span className="mentor-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}

// ─── Loading dots ─────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="mentor-loading">
      <div className="mentor-loading__dots">
        <span className="mentor-loading__dot" />
        <span className="mentor-loading__dot" />
        <span className="mentor-loading__dot" />
      </div>
      MENTOR-8 IS ANALYSING…
    </div>
  );
}

// ─── Mascot ───────────────────────────────────────────────────────────────────

function Mascot() {
  return (
    <div className="mentor-mascot" aria-hidden="true">
      <div className="mentor-mascot-antenna" />
    </div>
  );
}

// ─── Greeting messages per layer kind ────────────────────────────────────────

const GREETINGS = {
  entry_point:     "Booting up quest briefing… This is where it all begins, hero!",
  config:          "Unlocking the CONFIG_VAULT… Handle these keys with care!",
  auth_middleware: "Entering the GUARDIAN zone… The gates are watching.",
  api_route:       "Mapping the ROUTE_LABYRINTH… So many paths to explore!",
  database_schema: "Entering SCHEMA_WORLD… The truth lives in the models.",
  database_client: "Connecting to DB_GATEWAY… Mind the connection pool!",
  utility:         "Opening the UTILITY_BELT… Every hero needs good tools.",
  frontend:        "Loading UI_REALM… Pixels and components await.",
  test:            "Entering TEST_ARENA… Green means safe. Red means fix it.",
  ci_cd:           "Activating DEPLOY_PIPELINE… Ships ahoy!",
  docs:            "Consulting the LORE_ARCHIVE… Ancient knowledge within.",
  unknown:         "Scanning MYSTERY_ZONE… Even I am not sure what lurks here!",
};

const DIFF_STYLE = {
  EASY:   { background: "var(--col-mint)",   color: "var(--col-ink)" },
  MEDIUM: { background: "var(--col-yellow)", color: "var(--col-ink)" },
  HARD:   { background: "var(--col-red)",    color: "#fff"           },
  BOSS:   { background: "var(--col-amber)",  color: "var(--col-ink)" },
};

// ─── Main drawer component ────────────────────────────────────────────────────

/**
 * @param {{ island: Object|null, onClose: () => void, onChallenge?: (island) => void, onComplete?: (id) => void }} props
 */
export default function MentorDrawer({ island, onClose, onChallenge, onComplete }) {
  const [closing, setClosing] = useState(false);

  const { status, rawText, briefing, warning, startBrief } = useMentorBrief(island);

  // Stable ref to onClose so the Escape listener never becomes stale
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stable close handler — reads closing state via ref to avoid stale closure
  const closingRef = useRef(false);
  const handleClose = useCallback(() => {
    if (closingRef.current) return; // already closing
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => {
      closingRef.current = false;
      onCloseRef.current();
    }, 120);
  }, []);

  // ── Auto-start briefing when drawer opens with a new island ──────────────
  useEffect(() => {
    if (island) {
      closingRef.current = false;
      setClosing(false);
      startBrief();
    }
  }, [island?.id, startBrief]);

  // ── Escape key to close ───────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  if (!island) return null;

  const greeting     = GREETINGS[island.kind] || GREETINGS.unknown;
  const isStreaming  = status === "streaming";
  const isLoading    = status === "loading";
  const isDone       = status === "done" || status === "error";
  const diffStyle    = DIFF_STYLE[island.difficulty] || {};

  // ── Derive section texts ──────────────────────────────────────────────────
  // When "done", briefing.* are clean parsed strings.
  // While "streaming", we parse rawText live with loose tag matching so sections
  // appear and fill as tokens arrive.
  function getSectionText(key) {
    if (briefing) return briefing[key] || "";
    // live parse from rawText
    const re = new RegExp(`<${key}>([\\s\\S]*?)(?:<\\/${key}>|$)`, "i");
    const m  = rawText.match(re);
    return m ? m[1] : "";
  }

  const objText   = getSectionText("objective");
  const riskText  = getSectionText("risks");
  const rewText   = getSectionText("reward");

  // A section is "visible" as soon as any text for it exists
  const showObj  = objText.length  > 0;
  const showRisk = riskText.length > 0;
  const showRew  = rewText.length  > 0;

  // ─────────────────────────────────────────────────────────────────────────

  const drawer = (
    <>
      {/* Overlay — click to close */}
      <div
        className="mentor-overlay"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={`mentor-drawer${closing ? " mentor-drawer--closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Quest briefing: ${island.title}`}
      >
        {/* ── Title bar ──────────────────────────────────────────────────── */}
        <div className="mentor-titlebar">
          <span className="mentor-titlebar__title">
            MENTOR-8.EXE — QUEST_BRIEFING
          </span>
          <button
            className="mentor-titlebar__close"
            onClick={handleClose}
            aria-label="Close mentor"
          >
            ×
          </button>
        </div>

        {/* ── Mascot + greeting bubble ───────────────────────────────────── */}
        <div className="mentor-mascot-row">
          <Mascot />
          <div className="mentor-bubble">
            <div className="mentor-bubble__name">MENTOR-8</div>
            {greeting}
          </div>
        </div>

        {/* ── Island context strip ───────────────────────────────────────── */}
        <div className="mentor-context">
          <span className="mentor-context__icon">{island.icon}</span>
          <span className="mentor-context__title">{island.title}</span>
          <span
            className="mentor-context__diff"
            style={diffStyle}
          >
            {island.difficulty}
          </span>
          <span className="pixel-badge">{island.badge}</span>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <div className="mentor-body">

          {/* Loading state */}
          {isLoading && <LoadingDots />}

          {/* Warning / fallback notice */}
          {warning && (
            <div className="mentor-warning">
              <div className="mentor-warning__label">⚠ SYSTEM NOTICE</div>
              {warning}
            </div>
          )}

          {/* ── Section: Objective ─────────────────────────────────────── */}
          {showObj && (
            <SectionBox
              sectionKey="objective"
              text={objText}
              streaming={isStreaming && !briefing}
            />
          )}

          {/* ── Section: Bug Risks ─────────────────────────────────────── */}
          {showRisk && (
            <SectionBox
              sectionKey="risks"
              text={riskText}
              streaming={isStreaming && !briefing}
            />
          )}

          {/* ── Section: Reward ────────────────────────────────────────── */}
          {showRew && (
            <SectionBox
              sectionKey="reward"
              text={rewText}
              streaming={isStreaming && !briefing}
            />
          )}

          {/* Streaming cursor shown until done event fires */}
          {isStreaming && !showObj && (
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize:   "0.8rem",
              color:      "var(--col-muted)",
              padding:    "4px 0",
            }}>
              <span className="mentor-cursor" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="mentor-footer">
          <button
            className="pixel-btn pixel-btn--ghost"
            onClick={startBrief}
            disabled={isLoading || isStreaming}
            style={{ fontSize: "0.42rem", padding: "5px 10px" }}
          >
            ↺ RE-BRIEF
          </button>

          {onChallenge && (
            <button
              className="pixel-btn pixel-btn--accent"
              onClick={() => { onChallenge(island); handleClose(); }}
              style={{ fontSize: "0.42rem", padding: "5px 10px" }}
            >
              ⚔ CHALLENGES
            </button>
          )}

          <button
            className="pixel-btn pixel-btn--primary"
            onClick={() => {
              if (onComplete) onComplete(island.id);
              handleClose();
            }}
            style={{ fontSize: "0.42rem", padding: "5px 10px" }}
          >
            ✓ UNDERSTOOD
          </button>

          {isDone && (
            <span className="mentor-xp-award">
              ★ +{island.xp} XP
            </span>
          )}
        </div>
      </div>
    </>
  );

  // Render into document.body via portal so it escapes any overflow:hidden parents
  return createPortal(drawer, document.body);
}
