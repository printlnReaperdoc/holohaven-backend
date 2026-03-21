import express from "express";
import Promotion from "../models/Promotion.js";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { Expo } from "expo-server-sdk";
import upload from "../middleware/upload.js";

const router = express.Router();
const expo = new Expo();

// GET all active promotions
router.get("/", async (req, res) => {
  try {
    const promotions = await Promotion.find({
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    }).populate("applicableProducts", "name price");

    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single promotion
router.get("/:id", async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id).populate(
      "applicableProducts"
    );
    if (!promotion) return res.sendStatus(404);
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE promotion (admin only)
router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user.isAdmin) return res.sendStatus(403);

      const {
        title,
        description,
        discountPercent,
        validFrom,
        validUntil,
        applicableProducts,
        applicableCategories,
      } = req.body;

      const promotion = new Promotion({
        title,
        description,
        image: req.file?.path,
        discountPercent,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        applicableProducts:
          typeof applicableProducts === "string"
            ? JSON.parse(applicableProducts)
            : applicableProducts,
        applicableCategories:
          typeof applicableCategories === "string"
            ? JSON.parse(applicableCategories)
            : applicableCategories,
      });

      await promotion.save();

      // Send push notification to all users
      await sendPromotionNotification(promotion);

      res.status(201).json(promotion);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// UPDATE promotion
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user.isAdmin) return res.sendStatus(403);

    const promotion = await Promotion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!promotion) return res.sendStatus(404);
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE promotion
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user.isAdmin) return res.sendStatus(403);

    await Promotion.deleteOne({ _id: req.params.id });
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send promotion notification to all users
async function sendPromotionNotification(promotion) {
  try {
    const users = await User.find({ "pushTokens.0": { $exists: true } });

    const messages = [];

    for (let user of users) {
      for (let tokenObj of user.pushTokens) {
        messages.push({
          to: tokenObj.token,
          sound: "default",
          title: "🎉 New Promotion!",
          body: `${promotion.title}`,
          data: {
            promotionId: promotion._id.toString(),
            type: "promotion",
          },
        });
      }
    }

    if (messages.length > 0) {
      const chunks = expo.chunkPushNotifications(messages);

      for (let chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error("Error sending promotion notification:", error);
        }
      }
    }
  } catch (error) {
    console.error("Error in sendPromotionNotification:", error);
  }
}

export default router;
