const { Router } = require("express");
const router = Router();

/**
 * GET /api/players/:id
 * Returns player profile & progress.
 */
router.get("/:id", (req, res) => {
  res.json({
    id: req.params.id,
    handle: "PLAYER_1",
    level: 1,
    xp: 0,
    xpToNextLevel: 500,
    questsCompleted: [],
    badges: [],
  });
});

/**
 * PATCH /api/players/:id/xp
 * Award XP to a player.
 */
router.patch("/:id/xp", (req, res) => {
  const { amount } = req.body;
  res.json({ id: req.params.id, xpAwarded: amount, message: "XP updated — stub" });
});

module.exports = router;
