-- AlterTable
ALTER TABLE "User"
ADD COLUMN "avatarPublicId" TEXT;

-- AlterTable
ALTER TABLE "Service"
ADD COLUMN "imagePublicId" TEXT,
ADD COLUMN "galleryPublicIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Keep existing gallery URLs intact and reserve a matching empty public ID
-- for each legacy image whose Cloudinary public ID is unknown.
UPDATE "Service"
SET "galleryPublicIds" = array_fill(
    ''::TEXT,
    ARRAY[cardinality("gallery")]
)
WHERE cardinality("gallery") > 0;
