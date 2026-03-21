import express from "express";
import { Expo } from "expo-server-sdk";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Notification from "../models/Notification.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();
const expo = new Expo();

/**
 * Send notification to a user device
 */
export const sendNotification = async (pushToken, notification) => {
  try {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.log(`[NOTIFICATION] Push token ${pushToken} is not a valid Expo push token`);
      return;
    }

    const messages = [
      {
        to: pushToken,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      },
    ];

    const tickets = await expo.sendPushNotificationsAsync(messages);
    console.log("[NOTIFICATION] Push sent successfully:", tickets);
    return tickets;
  } catch (error) {
    console.error("[NOTIFICATION] Error sending push:", error);
  }
};

/**
 * Save notification to DB for a specific user
 */
const saveNotificationForUser = async (userId, { title, body, type, data }) => {
  try {
    const notification = new Notification({
      userId,
      title,
      body,
      type: type || "system",
      data: data || {},
    });
    await notification.save();
    console.log(`[NOTIFICATION] Saved notification for user ${userId}: "${title}"`);
    return notification;
  } catch (error) {
    console.error("[NOTIFICATION] Error saving notification:", error);
  }
};

/**
 * GET /notifications - Fetch notifications for current user
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    console.log(`[NOTIFICATION] Fetching notifications for user ${req.userId}`);
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    console.log(`[NOTIFICATION] Found ${notifications.length} notifications`);
    res.json(notifications);
  } catch (error) {
    console.error("[NOTIFICATION] Error fetching notifications:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /notifications/:id/read - Mark notification as read
 */
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true },
      { new: true }
    );
    if (!notification) return res.sendStatus(404);
    console.log(`[NOTIFICATION] Marked notification ${req.params.id} as read`);
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send promotion notification for a specific product to all non-admin users
 * POST /notifications/send-promotion
 * Admin only
 */
router.post("/send-promotion", authMiddleware, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { productId, title, message } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Only non-admin users receive promotion notifications
    const users = await User.find({
      isAdmin: false,
      "pushTokens.0": { $exists: true },
    });

    const notification = {
      title: title || `🎉 Special: ${product.name}`,
      body: message || `Check out ${product.name} - $${product.price}`,
      type: "promotion",
      data: {
        type: "promotion",
        productId: product._id.toString(),
        productName: product.name,
        price: product.price.toString(),
        image: product.image,
        category: product.category,
      },
    };

    // Save to DB for ALL non-admin users
    const allNonAdminUsers = await User.find({ isAdmin: false });
    for (const user of allNonAdminUsers) {
      await saveNotificationForUser(user._id, notification);
    }

    // Send push to users with tokens
    let sentCount = 0;
    for (const user of users) {
      for (const tokenObj of user.pushTokens) {
        await sendNotification(tokenObj.token, notification);
        sentCount++;
      }
    }

    console.log(`[NOTIFICATION] Sent ${sentCount} promotion pushes for "${product.name}"`);
    res.json({
      message: `Sent ${sentCount} promotions`,
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
      },
    });
  } catch (error) {
    console.error("[NOTIFICATION] Error sending promotion:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send promotion notification for a RANDOM product to all non-admin users
 * POST /notifications/send-random-promotion
 * Admin only
 */
router.post("/send-random-promotion", authMiddleware, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get a random product
    const count = await Product.countDocuments({ isActive: true });
    if (count === 0) {
      return res.status(404).json({ error: "No products available" });
    }
    const randomIndex = Math.floor(Math.random() * count);
    const product = await Product.findOne({ isActive: true }).skip(randomIndex);

    if (!product) {
      return res.status(404).json({ error: "No product found" });
    }

    // Only non-admin users
    const users = await User.find({
      isAdmin: false,
      "pushTokens.0": { $exists: true },
    });

    const notification = {
      title: `🎉 Deal Alert: ${product.name}`,
      body: `Don't miss out on ${product.name} - Only $${product.price}!`,
      type: "promotion",
      data: {
        type: "promotion",
        productId: product._id.toString(),
        productName: product.name,
        price: product.price.toString(),
        image: product.image,
        category: product.category,
      },
    };

    // Save to DB for ALL non-admin users
    const allNonAdminUsers = await User.find({ isAdmin: false });
    for (const user of allNonAdminUsers) {
      await saveNotificationForUser(user._id, notification);
    }

    // Send push
    let sentCount = 0;
    for (const user of users) {
      for (const tokenObj of user.pushTokens) {
        await sendNotification(tokenObj.token, notification);
        sentCount++;
      }
    }

    console.log(`[NOTIFICATION] Sent random promotion for "${product.name}" to ${sentCount} devices`);
    res.json({
      message: `Sent ${sentCount} promotion notifications for random product`,
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
      },
    });
  } catch (error) {
    console.error("[NOTIFICATION] Error sending random promotion:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Register push token
 * POST /notifications/register-token
 */
router.post("/register-token", authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({ error: "Invalid Expo push token" });
    }

    const user = await User.findById(req.userId);
    const existingToken = user.pushTokens.find((t) => t.token === token);

    if (!existingToken) {
      user.pushTokens.push({ token, lastUsedAt: new Date() });
      await user.save();
      console.log(`[NOTIFICATION] Registered new push token for user ${user.username}`);
    } else {
      existingToken.lastUsedAt = new Date();
      await user.save();
      console.log(`[NOTIFICATION] Updated push token lastUsedAt for user ${user.username}`);
    }

    // Deliver any unread notifications as push to this device
    try {
      const unreadNotifications = await Notification.find({
        userId: req.userId,
        read: false,
      }).sort({ createdAt: -1 }).limit(20);

      if (unreadNotifications.length > 0) {
        console.log(`[NOTIFICATION] Sending ${unreadNotifications.length} pending notifications to user ${user.username}`);
        for (const notif of unreadNotifications) {
          await sendNotification(token, {
            title: notif.title,
            body: notif.body,
            data: notif.data || {},
          });
        }
      }
    } catch (pushError) {
      console.error("[NOTIFICATION] Error sending pending notifications:", pushError.message);
      // Don't fail the token registration if push delivery fails
    }

    res.json({ message: "Token registered successfully" });
  } catch (error) {
    console.error("[NOTIFICATION] Error registering token:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save an order notification for a user (called from orders route)
 */
export const saveOrderNotification = async (userId, orderId, status) => {
  const notification = {
    title: "📦 Order Update",
    body: `Your order #${orderId.toString().slice(-6).toUpperCase()} status: ${status}`,
    type: "order",
    data: {
      type: "order",
      orderId: orderId.toString(),
      status,
    },
  };
  await saveNotificationForUser(userId, notification);
};

export default router;
