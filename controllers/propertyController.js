const { matchedData } = require("express-validator");
const propertyService = require("../services/propertyService");

const getPropertyFilters = (req) =>
    matchedData(req, { locations: ["query"] });

const createProperty = async (req, res) => {
    try {
        const property = await propertyService.createProperty(
            req.user.userId,
            req.body,
            req.files
        );

        return res.status(201).json({
            message: "Property created successfully!",
            property
        });
    } catch (error) {
        console.error("Create Property Error:", error);

        const isCloudinaryError = error.name === "CloudinaryError";
        return res.status(isCloudinaryError ? 502 : 500).json({
            message: isCloudinaryError
                ? "Unable to upload property images to Cloudinary"
                : error.imageCleanupFailed
                    ? "Unable to save property; uploaded image cleanup may be incomplete"
                    : "Unable to create property"
        });
    }
};

const listProperties = async (req, res) => {
    try {
        const properties = await propertyService.listProperties(
            getPropertyFilters(req)
        );

        return res.status(200).json({
            message: "Properties fetched successfully!",
            properties
        });
    } catch (error) {
        console.error("List Properties Error:", error);

        return res.status(500).json({
            message: "Unable to fetch properties"
        });
    }
};

const listPropertiesByOwner = async (req, res) => {
    try {
        const isOwner =
            req.user?.userId === req.params.ownerId &&
            req.user?.role === "provider";
        const properties = await propertyService.listPropertiesByOwner(
            req.params.ownerId,
            getPropertyFilters(req),
            isOwner
        );

        return res.status(200).json({
            message: "Owner properties fetched successfully!",
            properties
        });
    } catch (error) {
        console.error("List Owner Properties Error:", error);

        return res.status(500).json({
            message: "Unable to fetch owner properties"
        });
    }
};

const listMyProperties = async (req, res) => {
    try {
        const properties = await propertyService.listPropertiesByOwner(
            req.user.userId,
            getPropertyFilters(req),
            true
        );

        return res.status(200).json({
            message: "Your properties fetched successfully!",
            properties
        });
    } catch (error) {
        console.error("List My Properties Error:", error);

        return res.status(500).json({
            message: "Unable to fetch your properties"
        });
    }
};

const getProperty = async (req, res) => {
    try {
        const property = await propertyService.getPropertyById(
            req.params.id,
            req.user?.userId
        );

        if (!property) {
            return res.status(404).json({
                message: "Property not found"
            });
        }

        return res.status(200).json({
            message: "Property fetched successfully!",
            property
        });
    } catch (error) {
        console.error("Get Property Error:", error);

        return res.status(500).json({
            message: "Unable to fetch property"
        });
    }
};

const updateProperty = async (req, res) => {
    try {
        const result = await propertyService.updateProperty(
            req.params.id,
            req.user.userId,
            req.body,
            req.files
        );

        if (!result?.property) {
            return res.status(404).json({
                message: "Property not found"
            });
        }

        return res.status(200).json({
            message: "Property updated successfully!",
            property: result.property,
            ...(result.cleanupWarning && {
                warning: result.warningMessage
            })
        });
    } catch (error) {
        console.error("Update Property Error:", error);

        if (error.code === "INVALID_IMAGE_UPDATE") {
            return res.status(400).json({ message: error.message });
        }

        const isCloudinaryError = error.name === "CloudinaryError";
        return res.status(isCloudinaryError ? 502 : 500).json({
            message: isCloudinaryError
                ? "Unable to upload property images to Cloudinary"
                : error.imageCleanupFailed
                    ? "Unable to update property; uploaded image cleanup may be incomplete"
                    : "Unable to update property"
        });
    }
};

const deleteProperty = async (req, res) => {
    try {
        const deleted = await propertyService.deleteProperty(
            req.params.id,
            req.user.userId
        );

        if (!deleted) {
            return res.status(404).json({
                message: "Property not found"
            });
        }

        return res.status(200).json({
            message: "Property deleted successfully!"
        });
    } catch (error) {
        console.error("Delete Property Error:", error);

        return res.status(500).json({
            message: "Unable to delete property"
        });
    }
};

const deletePropertyImages = async (req, res) => {
    try {
        const result = await propertyService.deletePropertyImages(
            req.params.id,
            req.user.userId
        );

        if (!result) {
            return res.status(404).json({
                message: "Property not found"
            });
        }

        return res
            .status(result.cloudinaryCleanupFailed ? 502 : 200)
            .json({
                message: result.cleanupWarning
                    ? result.warningMessage
                    : "Property images deleted successfully!",
                property: result.property
            });
    } catch (error) {
        console.error("Delete Property Images Error:", error);

        return res.status(error.name === "CloudinaryError" ? 502 : 500).json({
            message: error.imageStateRecoveryFailed
                ? "Image cleanup failed and database references could not be fully restored"
                : "Unable to delete property images"
        });
    }
};

module.exports = {
    createProperty,
    listProperties,
    listPropertiesByOwner,
    listMyProperties,
    getProperty,
    updateProperty,
    deleteProperty,
    deletePropertyImages
};
