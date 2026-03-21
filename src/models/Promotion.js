import mongoose from "mongoose";

const PromotionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    image: String,
    discountPercent: Number,
    validFrom: Date,
    validUntil: Date,
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategories: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Promotion", PromotionSchema);
