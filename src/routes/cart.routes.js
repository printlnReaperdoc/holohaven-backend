import express from "express";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// GET user's cart
router.get("/", authMiddleware, async (req, res) => {
  try {
    console.log(`[CART] Fetching cart for user ${req.userId}`);
    let cart = await Cart.findOne({ userId: req.userId }).populate(
      "items.productId"
    );

    if (!cart) {
      cart = new Cart({ userId: req.userId, items: [] });
      await cart.save();
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADD to cart
router.post("/items", authMiddleware, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    console.log(`[CART] Adding product ${productId} (qty: ${quantity}) for user ${req.userId}`);

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });

    let cart = await Cart.findOne({ userId: req.userId });

    if (!cart) {
      cart = new Cart({ userId: req.userId, items: [] });
    }

    // Check if item already in cart
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity || 1;
    } else {
      cart.items.push({
        productId,
        quantity: quantity || 1,
      });
    }

    await cart.save();
    await cart.populate("items.productId");

    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE cart item quantity
router.patch("/items/:productId", authMiddleware, async (req, res) => {
  try {
    const { quantity } = req.body;

    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) return res.sendStatus(404);

    const item = cart.items.find(
      (i) => i.productId.toString() === req.params.productId
    );

    if (!item) return res.sendStatus(404);

    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items = cart.items.filter(
        (i) => i.productId.toString() !== req.params.productId
      );
    } else {
      item.quantity = quantity;
    }

    await cart.save();
    await cart.populate("items.productId");

    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REMOVE from cart
router.delete("/items/:productId", authMiddleware, async (req, res) => {
  try {
    console.log(`[CART] Removing product ${req.params.productId} for user ${req.userId}`);
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) return res.sendStatus(404);

    cart.items = cart.items.filter(
      (i) => i.productId.toString() !== req.params.productId
    );

    await cart.save();
    await cart.populate("items.productId");

    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CLEAR cart
router.delete("/", authMiddleware, async (req, res) => {
  try {
    console.log(`[CART] Clearing cart for user ${req.userId}`);
    await Cart.deleteOne({ userId: req.userId });
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
