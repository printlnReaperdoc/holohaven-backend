import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import cloudinary, { initCloudinary } from "./config/cloudinary.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import productsRoutes from "./routes/products.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import reviewsRoutes from "./routes/reviews.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import promotionsRoutes from "./routes/promotions.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import User from "./models/User.js";

dotenv.config({ override: true });

const app = express();

// Configure CORS to accept requests from Android emulator
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[REQ] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  
  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[RES] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);
app.use("/reviews", reviewsRoutes);
app.use("/cart", cartRoutes);
app.use("/promotions", promotionsRoutes);
app.use("/notifications", notificationsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

/**
 * Remove stale push tokens (not used in over 30 days)
 */
const cleanupStaleTokens = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await User.updateMany(
      {},
      {
        $pull: {
          pushTokens: { lastUsedAt: { $lt: thirtyDaysAgo } },
        },
      }
    );
    console.log(`[CLEANUP] Stale token cleanup complete. Modified ${result.modifiedCount} users.`);
  } catch (error) {
    console.error("[CLEANUP] Error cleaning stale tokens:", error.message);
  }
};

const startServer = async () => {
  try {
    // MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    // Cloudinary (INIT AFTER ENV IS READY)
    initCloudinary();
    const status = await cloudinary.api.ping();
    console.log("✅ Cloudinary connected:", status.status);

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API running on http://0.0.0.0:${PORT}`);
      console.log(`🚀 Android emulator can access: http://10.0.2.2:${PORT}`);
    });

    // Run stale token cleanup on startup and every 24 hours
    cleanupStaleTokens();
    setInterval(cleanupStaleTokens, 24 * 60 * 60 * 1000);
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
