import { v2 as cloudinary } from "cloudinary";

export const initCloudinary = () => {
  if (!process.env.CLOUDINARY_NAME) {
    throw new Error("CLOUDINARY_NAME missing from environment");
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return cloudinary;
};

export default cloudinary;
