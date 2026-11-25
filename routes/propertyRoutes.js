const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const propertyController = require("../controllers/propertyController");
const {
    uploadServiceImages,
    parseMultipartArrays
} = require("../middleware/imageUploadMiddleware");
const {
    createPropertyValidators,
    updatePropertyValidators,
    propertyIdValidators,
    ownerIdValidators,
    listPropertyValidators
} = require("../validators/propertyValidators");

const router = express.Router();

router.get("/", listPropertyValidators, propertyController.listProperties);
router.post(
    "/",
    authMiddleware,
    authorizeRoles("provider"),
    uploadServiceImages,
    parseMultipartArrays,
    createPropertyValidators,
    propertyController.createProperty
);
router.get(
    "/owner/me",
    authMiddleware,
    authorizeRoles("provider"),
    listPropertyValidators,
    propertyController.listMyProperties
);
router.get(
    "/owner/:ownerId",
    ownerIdValidators,
    listPropertyValidators,
    propertyController.listPropertiesByOwner
);
router.get(
    "/:id",
    propertyIdValidators,
    propertyController.getProperty
);
router.patch(
    "/:id",
    authMiddleware,
    authorizeRoles("provider"),
    uploadServiceImages,
    parseMultipartArrays,
    propertyIdValidators,
    updatePropertyValidators,
    propertyController.updateProperty
);
router.delete(
    "/:id/images",
    authMiddleware,
    authorizeRoles("provider"),
    propertyIdValidators,
    propertyController.deletePropertyImages
);
router.delete(
    "/:id",
    authMiddleware,
    authorizeRoles("provider"),
    propertyIdValidators,
    propertyController.deleteProperty
);

module.exports = router;
