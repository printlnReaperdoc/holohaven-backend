import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Register push token
router.post("/push-token", authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;

    await User.updateOne(
      { _id: req.userId, "pushTokens.token": { $ne: token } },
      {
        $push: {
          pushTokens: { token, lastUsedAt: new Date() },
        },
      }
    );

    await User.updateOne(
      { _id: req.userId, "pushTokens.token": token },
      {
        $set: { "pushTokens.$.lastUsedAt": new Date() },
      }
    );

    res.sendStatus(200);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("-passwordHash")
      .populate("reviewsPosted");
    if (!user) return res.sendStatus(404);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { fullName, phone, bio, address, username, email, password, currentPassword, profilePicture } = req.body;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // If updating password, verify current password
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required to change password" });
      }
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
      
      // Validate new password
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    // If updating email, check uniqueness
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
      user.email = email;
    }

    // If updating username, check uniqueness
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
      }
      user.username = username;
    }

    // Update profile fields
    if (fullName !== undefined) user.fullName = fullName || undefined;
    if (phone !== undefined) user.phone = phone || undefined;
    if (bio !== undefined) user.bio = bio || undefined;
    if (address !== undefined) user.address = address || undefined;
    if (profilePicture !== undefined) user.profilePicture = profilePicture || undefined;

    await user.save();
    
    const updatedUser = await User.findById(req.userId).select("-passwordHash");
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPLOAD profile picture
router.post(
  "/profile-picture",
  authMiddleware,
  (req, res, next) => {
    // If Content-Type is application/json, skip multer (image already uploaded via Cloudinary)
    if (req.get('content-type') && req.get('content-type').includes('application/json')) {
      console.log('✅ JSON request detected, skipping multer for profile picture');
      return next();
    }
    
    upload.single("profilePicture")(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err.message);
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      console.log('profilePictureRoute: Request received from user:', req.userId);
      
      // If profilePicture is in body (JSON), use it directly
      const profilePictureUrl = req.body?.profilePicture || req.file?.path;
      
      if (!profilePictureUrl) {
        console.error('profilePictureRoute: No file or URL in request');
        return res.status(400).json({ error: "No profile picture provided" });
      }

      console.log('profilePictureRoute: Picture URL:', {
        type: req.file ? 'file' : 'url',
        url: profilePictureUrl,
      });

      const user = await User.findByIdAndUpdate(
        req.userId,
        { profilePicture: profilePictureUrl },
        { new: true }
      ).select("-passwordHash");

      if (!user) {
        console.error('profilePictureRoute: User not found:', req.userId);
        return res.status(404).json({ error: "User not found" });
      }

      console.log('profilePictureRoute: User updated successfully, new URL:', user.profilePicture);

      res.json(user);
    } catch (error) {
      console.error('profilePictureRoute: Error:', error);
      res.status(500).json({ error: 'Server error: ' + error.message });
    }
  }
);

// GET user reviews
router.get("/reviews", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "reviewsPosted",
      populate: [
        { path: "productId", select: "name image" },
        { path: "orderId", select: "createdAt" },
      ],
    });

    if (!user) return res.sendStatus(404);
    res.json(user.reviewsPosted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
