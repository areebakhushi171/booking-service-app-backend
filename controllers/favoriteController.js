const favoriteService = require("../services/favoriteService");
const realtimeService = require("../services/realtimeService");

const listFavorites = async (req, res) => {
    try {
        const favorites = await favoriteService.listFavorites(req.user.userId);

        return res.status(200).json({
            message: "Favorites fetched successfully!",
            favorites
        });
    } catch (error) {
        console.error("List Favorites Error:", error);

        return res.status(500).json({
            message: "Unable to fetch favorites"
        });
    }
};

const addFavorite = async (req, res) => {
    try {
        const result = await favoriteService.addFavorite(
            req.user.userId,
            req.params.propertyId
        );

        if (result.status === "property-not-found") {
            return res.status(404).json({
                message: "Property not found"
            });
        }

        if (result.created) {
            realtimeService.emitToUser(
                req.user.userId,
                "favorite:added",
                {
                    userId: req.user.userId,
                    favorite: result.favorite
                }
            );
        }

        return res.status(200).json({
            message: "Property added to favorites!",
            favorite: result.favorite
        });
    } catch (error) {
        console.error("Add Favorite Error:", error);

        return res.status(500).json({
            message: "Unable to add property to favorites"
        });
    }
};

const removeFavorite = async (req, res) => {
    try {
        await favoriteService.removeFavorite(
            req.user.userId,
            req.params.propertyId
        );

        return res.status(200).json({
            message: "Property removed from favorites!"
        });
    } catch (error) {
        console.error("Remove Favorite Error:", error);

        return res.status(500).json({
            message: "Unable to remove property from favorites"
        });
    }
};

const checkFavorite = async (req, res) => {
    try {
        const favorited = await favoriteService.isFavorited(
            req.user.userId,
            req.params.propertyId
        );

        return res.status(200).json({
            propertyId: req.params.propertyId,
            favorited
        });
    } catch (error) {
        console.error("Check Favorite Error:", error);

        return res.status(500).json({
            message: "Unable to check favorite status"
        });
    }
};

module.exports = {
    listFavorites,
    addFavorite,
    removeFavorite,
    checkFavorite
};
