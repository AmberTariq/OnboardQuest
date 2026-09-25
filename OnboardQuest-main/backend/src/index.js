require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", game: "OnboardQuest", version: "1.0.0" });
});

// ── Routes ───────────────────────────────────────────────────────────────────
const questRouter   = require("./routes/quests");
const playerRouter  = require("./routes/players");
const analyseRouter = require("./routes/analyse");
const mentorRouter  = require("./routes/mentor");

app.use("/api/quests",  questRouter);
app.use("/api/players", playerRouter);
app.use("/api/analyse", analyseRouter);
app.use("/api/mentor",  mentorRouter);

// ── 404 fallback ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "ROUTE_NOT_FOUND" });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[OnboardQuest] API server running → http://localhost:${PORT}`);
});
