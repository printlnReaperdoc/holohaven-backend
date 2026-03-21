import express from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { Expo } from "expo-server-sdk";
import { saveOrderNotification } from "./notifications.routes.js";

const router = express.Router();
const expo = new Expo();

// GET user's orders
router.get("/", authMiddleware, async (req, res) => {
  try {
    console.log(`[ORDER] Fetching orders for user ${req.userId}`);
    const orders = await Order.find({ userId: req.userId })
      .populate("items.productId")
      .sort({ createdAt: -1 });
    console.log(`[ORDER] Found ${orders.length} orders`);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single order
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).populate("items.productId");

    if (!order) return res.sendStatus(404);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE order from cart (checkout)
router.post("/checkout", authMiddleware, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, transactionId } = req.body;
    console.log(`[ORDER] Checkout initiated by user ${req.userId}`);

    // Get user's cart
    const cart = await Cart.findOne({ userId: req.userId }).populate(
      "items.productId"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Prepare order items
    const orderItems = cart.items.map((item) => ({
      productId: item.productId._id,
      name: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity,
      image: item.productId.image,
    }));

    // Calculate total
    const totalPrice = orderItems.reduce((sum, item) => {
      return sum + Number(item.price) * item.quantity;
    }, 0);

    // Create order
    const order = new Order({
      userId: req.userId,
      items: orderItems,
      totalPrice,
      shippingAddress,
      paymentMethod,
      transactionId,
      status: "processing",
    });

    await order.save();

    // Clear cart
    await Cart.deleteOne({ userId: req.userId });

    console.log(`[ORDER] Order ${order._id} created with ${orderItems.length} items, total: $${totalPrice}`);
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE order status
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.sendStatus(404);

    // Once delivered, status cannot be changed
    if (order.status === "delivered") {
      return res.status(400).json({ error: "Delivered orders cannot be updated" });
    }

    // Only admin or owner can update
    const user = await User.findById(req.userId);
    if (!user.isAdmin && order.userId.toString() !== req.userId) {
      return res.sendStatus(403);
    }

    order.status = status;
    order.notificationsSent = false; // Reset to send new notification
    await order.save();

    // Send push notification to user
    await sendOrderNotification(order, status);

    // Save notification to DB for the order owner
    await saveOrderNotification(order.userId, order._id, status);

    console.log(`[ORDER] Status updated to "${status}" for order ${order._id}`);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to send push notification
async function sendOrderNotification(order, status) {
  try {
    const user = await User.findById(order.userId);

    if (!user || !user.pushTokens || user.pushTokens.length === 0) {
      return;
    }

    const messages = user.pushTokens.map((tokenObj) => ({
      to: tokenObj.token,
      sound: "default",
      title: "Order Update",
      body: `Your order #${order._id.toString().slice(-6)} status: ${status}`,
      data: {
        orderId: order._id.toString(),
        status: status,
      },
    }));

    const chunks = expo.chunkPushNotifications(messages);

    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }
  } catch (error) {
    console.error("Error in sendOrderNotification:", error);
  }
}

// GET sales analytics (admin only)
router.get("/admin/analytics", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.isAdmin) return res.sendStatus(403);

    // Only count delivered/processing/shipped orders (not cancelled)
    const orders = await Order.find({
      status: { $in: ["processing", "shipped", "delivered"] },
    }).populate("items.productId");

    // 1) Top products by quantity sold
    const productMap = {};
    // 2) Sales by category
    const categoryMap = {};
    // 3) Monthly revenue
    const monthlyMap = {};

    for (const order of orders) {
      // Monthly revenue
      const date = new Date(order.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + order.totalPrice;

      for (const item of order.items) {
        const qty = item.quantity;
        const revenue = item.price * qty;
        const name = item.name || "Unknown";
        const category =
          (item.productId && item.productId.category) || "Uncategorized";

        // Product aggregation
        if (!productMap[name]) {
          productMap[name] = { name, quantity: 0, revenue: 0 };
        }
        productMap[name].quantity += qty;
        productMap[name].revenue += revenue;

        // Category aggregation
        if (!categoryMap[category]) {
          categoryMap[category] = { category, quantity: 0, revenue: 0 };
        }
        categoryMap[category].quantity += qty;
        categoryMap[category].revenue += revenue;
      }
    }

    // Sort products by quantity desc, take top 10
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const categoryBreakdown = Object.values(categoryMap).sort(
      (a, b) => b.revenue - a.revenue
    );

    // Sort monthly by date
    const monthlyRevenue = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }));

    res.json({ topProducts, categoryBreakdown, monthlyRevenue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all orders (admin only)
router.get("/admin/all", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user.isAdmin) return res.sendStatus(403);

    const orders = await Order.find()
      .populate("userId", "username email")
      .populate("items.productId")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
