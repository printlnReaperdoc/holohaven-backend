import mongoose from "mongoose";

const PushTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  lastUsedAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    username: { type: String, unique: true },
    passwordHash: { type: String },
    profilePicture: { type: String }, // URL or file path
    pushTokens: [PushTokenSchema],
    isAdmin: { type: Boolean, default: false },
    // Profile fields
    fullName: String,
    phone: String,
    bio: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    // Google Auth
    googleId: String,
    googleEmail: String,
    // Verification
    reviewsPosted: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
