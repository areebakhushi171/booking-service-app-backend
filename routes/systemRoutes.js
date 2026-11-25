const express = require("express");
const systemController = require("../controllers/systemController");

const router = express.Router();

router.get("/health", systemController.health);
router.get("/bookease/users", systemController.getBookEaseUsers);

module.exports = router;
