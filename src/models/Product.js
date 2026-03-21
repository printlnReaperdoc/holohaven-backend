import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    image: { type: String }, // URL or path to image
    description: String,
    vtuberTag: String, // e.g., "Vtuber Name"
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    images: [String], // Gallery of images
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", ProductSchema);
