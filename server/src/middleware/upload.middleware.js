import multer from "multer";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGE_COUNT = 20;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Unsupported file type: ${file.mimetype}. Allowed types: JPG, PNG, WEBP.`);
    error.status = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: MAX_IMAGE_COUNT
  },
  fileFilter
});

export const uploadPostImages = (req, res, next) => {
  const uploadHandler = upload.array("images", MAX_IMAGE_COUNT);

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: `File too large. Maximum allowed size is 5 MB per image.`
          });
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            success: false,
            message: `Too many files. Maximum allowed is ${MAX_IMAGE_COUNT} images per post.`
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      return res.status(err.status || 400).json({
        success: false,
        message: err.message
      });
    }

    next();
  });
};

// Single-image upload used for avatars (profile photos). Same type and size
// limits as post images, but accepts exactly one file under the field "avatar".
export const uploadAvatarImage = (req, res, next) => {
  const uploadHandler = upload.single("avatar");

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "Image is too large. Maximum allowed size is 5 MB."
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            success: false,
            message: 'Unexpected file field. Upload the photo under the field name "avatar".'
          });
        }
        return res.status(400).json({ success: false, message: err.message });
      }

      return res.status(err.status || 400).json({
        success: false,
        message: err.message
      });
    }

    next();
  });
};

export { MAX_IMAGE_SIZE, MAX_IMAGE_COUNT, ALLOWED_IMAGE_MIME_TYPES };
