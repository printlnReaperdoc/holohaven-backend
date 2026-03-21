import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: String,
    isVerified: {
      type: Boolean,
      default: true,
    }, // Verified by order
  },
  { timestamps: true }
);

// Index to prevent duplicate reviews per product per user
ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Review", ReviewSchema);
