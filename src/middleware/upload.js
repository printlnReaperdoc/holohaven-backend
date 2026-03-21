// src/middleware/upload.js
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "holohaven/products",
    allowed_formats: ["jpg", "png", "webp", "jpeg"],
    transformation: [{ width: 1024, crop: "limit" }],
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('🖼️ Upload fileFilter - File received:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    
    // Accept image files only
    if (!file.mimetype.startsWith('image/')) {
      console.error('❌ File rejected - not an image:', file.mimetype);
      return cb(new Error('Only image files are allowed'));
    }
    console.log('✅ File accepted:', file.originalname);
    cb(null, true);
  },
});

export default upload;
