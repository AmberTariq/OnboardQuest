const { Router } = require("express");
const router = Router();

/**
 * GET /api/quests
 * Returns all available quests (architecture challenges).
 */
router.get("/", (_req, res) => {
  res.json([
    {
      id: "q1",
      title: "THE_ENTRY_POINT.EXE",
      description: "Locate the application entry point and explain its role.",
      xp: 100,
      difficulty: "EASY",
      completed: false,
    },
    {
      id: "q2",
      title: "LAYER_MAZE.EXE",
      description: "Identify every architectural layer and draw the dependency graph.",
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
  ]);
});

/**
 * GET /api/quests/:id
 */
router.get("/:id", (req, res) => {
  res.json({ id: req.params.id, message: "Quest detail endpoint — stub" });
});

/**
 * POST /api/quests/:id/complete
 */
router.post("/:id/complete", (req, res) => {
  res.json({ id: req.params.id, completed: true, xpAwarded: 100 });
});

module.exports = router;
