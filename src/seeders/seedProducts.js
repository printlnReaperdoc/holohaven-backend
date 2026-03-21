import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from '../models/Product.js'; // adjust path if needed

dotenv.config();

const productsData = [
  {
    name: "Tokino Sora Plush",
    price: 19.99,
    category: "Plush",
    image: "https://i.imgur.com/8JZlC3C.png",
  },
  {
    name: "Roboco Keychain",
    price: 7.5,
    category: "Keychain",
    image: "https://i.imgur.com/TZKMm1G.png",
  },
  {
    name: "Sakura Miko Poster",
    price: 12.0,
    category: "Poster",
    image: "https://i.imgur.com/3b9K2Bk.png",
  },
  {
    name: "Hoshimachi Suisei T-shirt",
    price: 22.5,
    category: "Apparel",
    image: "https://i.imgur.com/wt0fN4q.png",
  },
  {
    name: "Shirakami Fubuki Sticker Pack",
    price: 5.0,
    category: "Sticker",
    image: "https://i.imgur.com/ZK0ZlqF.png",
  },
  {
    name: "Natsuiro Matsuri Plush",
    price: 18.0,
    category: "Plush",
    image: "https://i.imgur.com/Ui2rklF.png",
  },
  {
    name: "Usada Pekora Mug",
    price: 10.0,
    category: "Merch",
    image: "https://i.imgur.com/Up4yB5Q.png",
  },
  {
    name: "Shiranui Flare Hoodie",
    price: 35.0,
    category: "Apparel",
    image: "https://i.imgur.com/PZkABqf.png",
  },
];

async function seedProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected for products seeder");

    // Clear existing products to avoid duplicates
    await Product.deleteMany({});
    console.log("Cleared existing products");

    for (const p of productsData) {
      await Product.create({
        name: p.name,
        price: p.price,
        category: p.category,
        image: p.image,
        description: `High quality ${p.category} merchandise featuring your favorite VTubers!`,
        isActive: true,
      });
      console.log(`✅ Product ${p.name} created`);
    }

    const count = await Product.countDocuments();
    console.log(`All products seeded! Total: ${count}`);
    mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error seeding products:", err);
    mongoose.disconnect();
  }
}

seedProducts();

