const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const favoriteController = require("../controllers/favoriteController");
const {
    favoritePropertyIdValidators
} = require("../validators/favoriteValidators");

const router = express.Router();

router.use(authMiddleware);
router.get("/", favoriteController.listFavorites);
router.post(
    "/:propertyId",
    favoritePropertyIdValidators,
    favoriteController.addFavorite
);
router.get(
    "/:propertyId/check",
    favoritePropertyIdValidators,
    favoriteController.checkFavorite
);
router.delete(
    "/:propertyId",
    favoritePropertyIdValidators,
    favoriteController.removeFavorite
);

module.exports = router;
