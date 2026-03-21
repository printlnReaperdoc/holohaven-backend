import express from "express";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// GET all reviews (admin only)
router.get("/admin/all", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("userId", "username email profilePicture")
      .populate("productId", "name image")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE any review (admin only)
router.delete("/admin/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.sendStatus(404);

    const productId = review.productId;

    await Review.deleteOne({ _id: req.params.id });

    // Remove from user's profile
    await User.findByIdAndUpdate(review.userId, {
      $pull: { reviewsPosted: req.params.id },
    });

    // Update product rating
    await updateProductRating(productId);

    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET reviews for a product
router.get("/product/:productId", async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.productId })
      .populate("userId", "username profilePicture")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET user's reviews
router.get("/user/my-reviews", authMiddleware, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.userId })
      .populate("productId", "name image")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE review (only verified buyers)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { productId, orderId, rating, comment } = req.body;

    // Verify that order exists and belongs to user
    const order = await Order.findOne({
      _id: orderId,
      userId: req.userId,
    });

    if (!order) {
      return res
        .status(403)
        .json({ error: "Only verified buyers can leave reviews" });
    }

    // Only allow reviews on delivered orders
    if (order.status !== "delivered") {
      return res
        .status(400)
        .json({ error: "You can only review products from delivered orders" });
    }

    // Check if product is in the order
    const itemInOrder = order.items.some(
      (item) => item.productId.toString() === productId
    );

    if (!itemInOrder) {
      return res.status(403).json({ error: "Product not in this order" });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      productId,
      userId: req.userId,
    });

    if (existingReview) {
      return res
        .status(400)
        .json({ error: "You already reviewed this product" });
    }

    // Create review
    const review = new Review({
      productId,
      userId: req.userId,
      orderId,
      rating,
      comment,
      isVerified: true,
    });

    await review.save();

    // Update product rating
    await updateProductRating(productId);

    // Add review to user's profile
    await User.findByIdAndUpdate(req.userId, {
      $push: { reviewsPosted: review._id },
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE review
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) return res.sendStatus(404);

    if (review.userId.toString() !== req.userId) {
      return res.sendStatus(403);
    }

    const { rating, comment } = req.body;
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;

    await review.save();

    // Update product rating
    await updateProductRating(review.productId);

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE review
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) return res.sendStatus(404);

    if (review.userId.toString() !== req.userId) {
      return res.sendStatus(403);
    }

    const productId = review.productId;

    await Review.deleteOne({ _id: req.params.id });

    // Remove from user's profile
    await User.findByIdAndUpdate(req.userId, {
      $pull: { reviewsPosted: req.params.id },
    });

    // Update product rating
    await updateProductRating(productId);

    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to update product rating
async function updateProductRating(productId) {
  try {
    const reviews = await Review.find({ productId });

    if (reviews.length === 0) {
      await Product.findByIdAndUpdate(productId, {
        averageRating: 0,
        reviewCount: 0,
      });
    } else {
      const avgRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await Product.findByIdAndUpdate(productId, {
        averageRating: Math.round(avgRating * 10) / 10,
        reviewCount: reviews.length,
      });
    }
  } catch (error) {
    console.error("Error updating product rating:", error);
  }
}

export default router;
