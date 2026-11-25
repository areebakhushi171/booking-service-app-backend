const prisma = require("../config/database");
const {
    uploadImages,
    deleteImage,
    cleanupUploadedImages
} = require("../utils/imageStorage");
const realtimeService = require("./realtimeService");

const propertySelect = {
    id: true,
    name: true,
    description: true,
    category: true,
    price: true,
    duration: true,
    imageUrl: true,
    imagePublicId: true,
    gallery: true,
    galleryPublicIds: true,
    features: true,
    isActive: true,
    providerId: true,
    country: true,
    city: true,
    createdAt: true,
    updatedAt: true
};

const toPublicService = ({
    imagePublicId,
    galleryPublicIds,
    ...service
}) => service;

const publishServiceEvent = async (property, event) => {
    if (!property) return;

    try {
        const [favorites, conversations] = await Promise.all([
            prisma.favorite.findMany({
                where: { serviceId: property.id },
                select: { userId: true }
            }),
            prisma.conversation.findMany({
                where: { serviceId: property.id },
                select: { customerId: true, ownerId: true }
            })
        ]);
        realtimeService.emitToUsers(
            [
                property.providerId,
                ...favorites.map(({ userId }) => userId),
                ...conversations.flatMap(({ customerId, ownerId }) => [
                    customerId,
                    ownerId
                ])
            ],
            event,
            { service: toPublicService(property) }
        );
    } catch (error) {
        console.error("Service realtime update error:", error);
    }
};

const createProperty = async (providerId, data, files = {}) => {
    const {
        name,
        description,
        category,
        price,
        duration,
        gallery,
        features,
        country,
        city,
        isActive
    } = data;

    const mainImageFile = files.mainImage?.[0];
    const galleryFiles = files.galleryImages ?? [];
    const uploaded = await uploadImages(
        [...(mainImageFile ? [mainImageFile] : []), ...galleryFiles],
        "bookease/services",
        `service-${providerId}`
    );
    const mainUpload = mainImageFile ? uploaded[0] : null;
    const uploadedGallery = uploaded.slice(mainImageFile ? 1 : 0);
    const legacyGallery = gallery ?? [];
    const dataToCreate = {
        name,
        description,
        category,
        price,
        duration,
        imageUrl: mainUpload?.url ?? data.imageUrl ?? null,
        imagePublicId: mainUpload?.publicId ?? null,
        gallery: [
            ...legacyGallery,
            ...uploadedGallery.map((image) => image.url)
        ],
        galleryPublicIds: [
            ...legacyGallery.map(() => ""),
            ...uploadedGallery.map((image) => image.publicId)
        ],
        features: features ?? [],
        country,
        city,
        ...(isActive !== undefined && { isActive }),
        providerId
    };

    try {
        const property = await prisma.service.create({
            data: dataToCreate,
            select: propertySelect
        });
        realtimeService.emitToAllUsers(
            "service:created",
            { service: toPublicService(property) }
        );
        return property;
    } catch (error) {
        const cleaned = await cleanupUploadedImages(uploaded);
        if (!cleaned) {
            error.imageCleanupFailed = true;
        }
        throw error;
    }
};

const buildWhere = (filters, { includeInactive = false } = {}) => {
    const {
        q,
        country,
        city,
        category,
        minPrice,
        maxPrice,
        isActive,
        availableFrom,
        availableTo
    } = filters;
    const where = {
        ...(includeInactive
            ? isActive === undefined
                ? {}
                : { isActive }
            : { isActive: true }),
        ...(country && { country: { equals: country, mode: "insensitive" } }),
        ...(city && { city: { equals: city, mode: "insensitive" } }),
        ...(category && {
            category: { equals: category, mode: "insensitive" }
        }),
        ...((minPrice !== undefined || maxPrice !== undefined) && {
            price: {
                ...(minPrice !== undefined && { gte: minPrice }),
                ...(maxPrice !== undefined && { lte: maxPrice })
            }
        }),
        ...(availableFrom &&
            availableTo && {
                bookings: {
                    none: {
                        status: "CONFIRMED",
                        startDate: { lt: availableTo },
                        endDate: { gt: availableFrom }
                    }
                }
            })
    };

    if (q) {
        where.OR = ["name", "description", "category", "country", "city"].map(
            (field) => ({
                [field]: { contains: q, mode: "insensitive" }
            })
        );
    }

    return where;
};

const listProperties = (filters) => {
    return prisma.service.findMany({
        where: buildWhere(filters),
        select: propertySelect,
        orderBy: { createdAt: "desc" }
    });
};

const listPropertiesByOwner = (ownerId, filters, isOwner) => {
    return prisma.service.findMany({
        where: {
            ...buildWhere(filters, { includeInactive: isOwner }),
            providerId: ownerId
        },
        select: propertySelect,
        orderBy: { createdAt: "desc" }
    });
};

const getPropertyById = async (id, requesterId) => {
    const property = await prisma.service.findUnique({
        where: { id },
        select: propertySelect
    });

    if (!property || (!property.isActive && property.providerId !== requesterId)) {
        return null;
    }

    return property;
};

const updateProperty = async (id, providerId, data, files = {}) => {
    const existing = await prisma.service.findFirst({
        where: { id, providerId },
        select: {
            ...propertySelect,
            imageUrl: true,
            imagePublicId: true,
            gallery: true,
            galleryPublicIds: true
        }
    });

    if (!existing) {
        return null;
    }

    const mainImageFile = files.mainImage?.[0];
    const galleryFiles = files.galleryImages ?? [];
    const uploaded = await uploadImages(
        [...(mainImageFile ? [mainImageFile] : []), ...galleryFiles],
        "bookease/services",
        `service-${id}`
    );
    const mainUpload = mainImageFile ? uploaded[0] : null;
    const uploadedGallery = uploaded.slice(mainImageFile ? 1 : 0);
    const editableFields = [
        "name",
        "description",
        "category",
        "price",
        "duration",
        "imageUrl",
        "gallery",
        "features",
        "isActive",
        "country",
        "city"
    ];
    const updateData = Object.fromEntries(
        Object.entries(data).filter(
            ([field]) =>
                editableFields.includes(field) &&
                field !== "imageUrl" &&
                field !== "gallery"
        )
    );

    const replacedPublicIds = [];
    const explicitlyRemovedGalleryImages = [];
    let legacyImagesWithoutPublicIds = false;
    if (mainUpload) {
        updateData.imageUrl = mainUpload.url;
        updateData.imagePublicId = mainUpload.publicId;
        if (existing.imagePublicId) {
            replacedPublicIds.push(existing.imagePublicId);
        } else if (existing.imageUrl) {
            legacyImagesWithoutPublicIds = true;
        }
    } else if (
        data.imageUrl !== undefined &&
        data.imageUrl !== existing.imageUrl
    ) {
        updateData.imageUrl = data.imageUrl;
        updateData.imagePublicId = null;
        if (existing.imagePublicId) {
            replacedPublicIds.push(existing.imagePublicId);
        } else if (existing.imageUrl) {
            legacyImagesWithoutPublicIds = true;
        }
    }

    const currentGallery = existing.gallery ?? [];
    const currentPublicIds = currentGallery.map(
        (_, index) => existing.galleryPublicIds?.[index] ?? ""
    );
    let nextGallery = currentGallery.slice();
    let nextPublicIds = currentPublicIds.slice();

    if (data.gallery !== undefined) {
        const unusedIndexes = new Set(currentGallery.keys());
        nextGallery = data.gallery.slice();
        nextPublicIds = nextGallery.map((url) => {
            const existingIndex = currentGallery.findIndex(
                (currentUrl, index) =>
                    unusedIndexes.has(index) && currentUrl === url
            );
            if (existingIndex === -1) {
                return "";
            }
            unusedIndexes.delete(existingIndex);
            return currentPublicIds[existingIndex];
        });
        for (const index of unusedIndexes) {
            if (currentPublicIds[index]) {
                replacedPublicIds.push(currentPublicIds[index]);
            } else if (currentGallery[index]) {
                legacyImagesWithoutPublicIds = true;
            }
        }
    }

    const indexesToRemove = data.removeGalleryIndexes ?? [];
    if (indexesToRemove.length > 0) {
        if (data.gallery !== undefined) {
            const error = new Error(
                "gallery cannot be replaced and removed by index in the same request"
            );
            const cleaned = await cleanupUploadedImages(uploaded);
            if (!cleaned) error.imageCleanupFailed = true;
            error.code = "INVALID_IMAGE_UPDATE";
            throw error;
        }

        const removeIndexes = new Set(indexesToRemove);
        for (const index of removeIndexes) {
            if (index < 0 || index >= nextGallery.length) {
                const error = new Error("Gallery image index is out of range");
                const cleaned = await cleanupUploadedImages(uploaded);
                if (!cleaned) error.imageCleanupFailed = true;
                error.code = "INVALID_IMAGE_UPDATE";
                throw error;
            }
            if (nextPublicIds[index]) {
                replacedPublicIds.push(nextPublicIds[index]);
                explicitlyRemovedGalleryImages.push({
                    url: nextGallery[index],
                    publicId: nextPublicIds[index]
                });
            } else if (nextGallery[index]) {
                legacyImagesWithoutPublicIds = true;
            }
        }
        nextGallery = nextGallery.filter((_, index) => !removeIndexes.has(index));
        nextPublicIds = nextPublicIds.filter(
            (_, index) => !removeIndexes.has(index)
        );
    }

    if (uploadedGallery.length > 0) {
        nextGallery.push(...uploadedGallery.map((image) => image.url));
        nextPublicIds.push(...uploadedGallery.map((image) => image.publicId));
    }

    if (
        data.gallery !== undefined ||
        indexesToRemove.length > 0 ||
        uploadedGallery.length > 0
    ) {
        updateData.gallery = nextGallery;
        updateData.galleryPublicIds = nextPublicIds;
    }

    try {
        const result = await prisma.service.updateMany({
            where: { id, providerId },
            data: updateData
        });

        if (result.count === 0) {
            const cleaned = await cleanupUploadedImages(uploaded);
            return {
                property: null,
                cleanupWarning: !cleaned
            };
        }
    } catch (error) {
        const cleaned = await cleanupUploadedImages(uploaded);
        if (!cleaned) {
            error.imageCleanupFailed = true;
        }
        throw error;
    }

    let property = await prisma.service.findUnique({
        where: { id },
        select: propertySelect
    });

    const retainedPublicIds = new Set([
        property?.imagePublicId,
        ...(property?.galleryPublicIds ?? [])
    ]);
    const idsToDelete = [...new Set(replacedPublicIds)].filter(
        (publicId) => publicId && !retainedPublicIds.has(publicId)
    );
    const deletionResults = await Promise.allSettled(
        idsToDelete.map((publicId) => deleteImage(publicId))
    );
    const cloudinaryCleanupFailed = deletionResults.some(
        (result) => result.status === "rejected"
    );
    const cleanupWarning =
        cloudinaryCleanupFailed || legacyImagesWithoutPublicIds;
    const failedPublicIds = new Set(
        deletionResults.flatMap((result, index) =>
            result.status === "rejected" ? [idsToDelete[index]] : []
        )
    );
    const galleryImagesToRestore = explicitlyRemovedGalleryImages.filter(
        (image) => failedPublicIds.has(image.publicId)
    );

    if (galleryImagesToRestore.length > 0) {
        try {
            const current = await prisma.service.findUnique({
                where: { id },
                select: {
                    gallery: true,
                    galleryPublicIds: true
                }
            });
            const currentGallery = current?.gallery ?? [];
            const currentPublicIds = currentGallery.map(
                (_, index) => current.galleryPublicIds?.[index] ?? ""
            );

            for (const image of galleryImagesToRestore) {
                if (!currentPublicIds.includes(image.publicId)) {
                    currentGallery.push(image.url);
                    currentPublicIds.push(image.publicId);
                }
            }

            await prisma.service.updateMany({
                where: { id, providerId },
                data: {
                    gallery: currentGallery,
                    galleryPublicIds: currentPublicIds
                }
            });
            property = await prisma.service.findUnique({
                where: { id },
                select: propertySelect
            });
        } catch (error) {
            error.imageStateRecoveryFailed = true;
            console.error(
                "Unable to preserve gallery image references after Cloudinary deletion failure:",
                error
            );
            throw error;
        }
    }

    if (cloudinaryCleanupFailed) {
        console.error(
            "Unable to delete replaced service images:",
            deletionResults
                .filter((result) => result.status === "rejected")
                .map((result) => result.reason)
        );
    }

    await publishServiceEvent(property, "service:updated");

    const warningMessage = [
        cloudinaryCleanupFailed &&
            "Some replaced images could not be deleted from Cloudinary",
        legacyImagesWithoutPublicIds &&
            "Some legacy images had no stored Cloudinary public ID and could not be deleted remotely"
    ]
        .filter(Boolean)
        .join("; ") || null;

    return { property, cleanupWarning, warningMessage };
};

const deleteProperty = async (id, providerId) => {
    const existing = await prisma.service.findFirst({
        where: { id, providerId },
        select: { isActive: true }
    });
    const result = await prisma.service.updateMany({
        where: { id, providerId },
        data: { isActive: false }
    });

    if (result.count > 0 && existing?.isActive) {
        const property = await prisma.service.findUnique({
            where: { id },
            select: propertySelect
        });
        if (property) {
            await publishServiceEvent(property, "service:deleted");
        }
    }

    return result.count > 0;
};

const deletePropertyImages = async (id, providerId) => {
    const existing = await prisma.service.findFirst({
        where: { id, providerId },
        select: {
            id: true,
            imageUrl: true,
            imagePublicId: true,
            gallery: true,
            galleryPublicIds: true
        }
    });

    if (!existing) {
        return null;
    }

    const legacyImagesWithoutPublicIds = Boolean(
        (existing.imageUrl && !existing.imagePublicId) ||
        (existing.gallery ?? []).some(
            (url, index) => url && !existing.galleryPublicIds?.[index]
        )
    );

    const result = await prisma.service.updateMany({
        where: { id, providerId },
        data: {
            imageUrl: null,
            imagePublicId: null,
            gallery: [],
            galleryPublicIds: []
        }
    });

    if (result.count === 0) {
        return null;
    }

    const galleryImages = (existing.gallery ?? []).map((url, index) => ({
        url,
        publicId: existing.galleryPublicIds?.[index] ?? ""
    }));
    const cloudImages = [
        ...(existing.imagePublicId
            ? [{
                kind: "main",
                url: existing.imageUrl,
                publicId: existing.imagePublicId
            }]
            : []),
        ...galleryImages
            .filter((image) => image.publicId)
            .map((image) => ({ kind: "gallery", ...image }))
    ];
    const deletionResults = await Promise.allSettled(
        cloudImages.map((image) => deleteImage(image.publicId))
    );
    const failedImages = cloudImages.filter(
        (_, index) => deletionResults[index].status === "rejected"
    );

    if (failedImages.length > 0) {
        const restoreData = {
            imageUrl: null,
            imagePublicId: null,
            gallery: [],
            galleryPublicIds: []
        };
        const failedMain = failedImages.find((image) => image.kind === "main");
        if (failedMain) {
            restoreData.imageUrl = failedMain.url;
            restoreData.imagePublicId = failedMain.publicId;
        }
        const failedGallery = failedImages.filter(
            (image) => image.kind === "gallery"
        );
        restoreData.gallery = failedGallery.map((image) => image.url);
        restoreData.galleryPublicIds = failedGallery.map(
            (image) => image.publicId
        );

        try {
            await prisma.service.updateMany({
                where: { id, providerId },
                data: restoreData
            });
        } catch (error) {
            error.imageStateRecoveryFailed = true;
            console.error(
                "Unable to restore service image references after Cloudinary deletion failure:",
                error
            );
            throw error;
        }

        console.error(
            "Unable to delete some service images:",
            deletionResults
                .filter((item) => item.status === "rejected")
                .map((item) => item.reason)
        );
    }

    const property = await prisma.service.findUnique({
        where: { id },
        select: propertySelect
    });

    if (property) {
        await publishServiceEvent(property, "service:updated");
    }

    return {
        property,
        cleanupWarning:
            failedImages.length > 0 || legacyImagesWithoutPublicIds,
        cloudinaryCleanupFailed: failedImages.length > 0,
        warningMessage: [
            failedImages.length > 0 &&
                "Some Cloudinary images could not be deleted; their references were preserved",
            legacyImagesWithoutPublicIds &&
                "Legacy images without Cloudinary public IDs were cleared from the database but could not be deleted remotely"
        ]
            .filter(Boolean)
            .join("; ") || null
    };
};

module.exports = {
    createProperty,
    listProperties,
    listPropertiesByOwner,
    getPropertyById,
    updateProperty,
    deleteProperty,
    deletePropertyImages
};
