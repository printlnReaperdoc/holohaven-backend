import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import User from '../models/User.js';

dotenv.config();

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Map local image filenames to usernames
const imageMap = {
  "sora.jpg": "TokinoSora",
  "roboco.jpg": "Roboco",
  "miko.jpg": "SakuraMiko",
  "suisei.jpg": "HoshimachiSuisei",
  "fubuki.jpg": "ShirakamiFubuki",
  "matsuri.jpg": "NatsuiroMatsuri",
  "aki.jpg": "AkiRosenthal",
  "akai haato.jpg": "AkaiHaato",
  "ayame.jpg": "NakiriAyame",
  "choco.jpg": "YuzukiChoco",
  "subaru.jpg": "OozoraSubaru",
  "pekora.jpg": "UsadaPekora",
  "flare.jpg": "ShiranuiFlare",
  "noel.jpg": "ShiroganeNoel",
  "marine.jpg": "HoushouMarine",
};

const usersData = [
  {
    email: "sora@holohaven.com",
    username: "TokinoSora",
    password: "password123",
    image: "sora.jpg",
    isAdmin: true,
  },
  {
    email: "roboco@holohaven.com",
    username: "Roboco",
    password: "password123",
    image: "roboco.jpg",
    isAdmin: false,
  },
  {
    email: "sakura@holohaven.com",
    username: "SakuraMiko",
    password: "password123",
    image: "miko.jpg",
    isAdmin: false,
  },
  {
    email: "suisei@holohaven.com",
    username: "HoshimachiSuisei",
    password: "password123",
    image: "suisei.jpg",
    isAdmin: false,
  },
  {
    email: "fubuki@holohaven.com",
    username: "ShirakamiFubuki",
    password: "password123",
    image: "fubuki.jpg",
    isAdmin: false,
  },
  {
    email: "matsuri@holohaven.com",
    username: "NatsuiroMatsuri",
    password: "password123",
    image: "matsuri.jpg",
    isAdmin: false,
  },
  {
    email: "aki@holohaven.com",
    username: "AkiRosenthal",
    password: "password123",
    image: "aki.jpg",
    isAdmin: false,
  },
  {
    email: "haato@holohaven.com",
    username: "AkaiHaato",
    password: "password123",
    image: "akai haato.jpg",
    isAdmin: false,
  },
  {
    email: "ayame@holohaven.com",
    username: "NakiriAyame",
    password: "password123",
    image: "ayame.jpg",
    isAdmin: false,
  },
  {
    email: "choco@holohaven.com",
    username: "YuzukiChoco",
    password: "password123",
    image: "choco.jpg",
    isAdmin: false,
  },
  {
    email: "subaru@holohaven.com",
    username: "OozoraSubaru",
    password: "password123",
    image: "subaru.jpg",
    isAdmin: false,
  },
  {
    email: "pekora@holohaven.com",
    username: "UsadaPekora",
    password: "password123",
    image: "pekora.jpg",
    isAdmin: false,
  },
  {
    email: "flare@holohaven.com",
    username: "ShiranuiFlare",
    password: "password123",
    image: "flare.jpg",
    isAdmin: false,
  },
  {
    email: "noel@holohaven.com",
    username: "ShiroganeNoel",
    password: "password123",
    image: "noel.jpg",
    isAdmin: false,
  },
  {
    email: "marine@holohaven.com",
    username: "HoushouMarine",
    password: "password123",
    image: "marine.jpg",
    isAdmin: false,
  },
];

// Upload image to Cloudinary
async function uploadImageToCloudinary(imagePath, username) {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: "holohaven/profile-pictures",
      public_id: `${username.toLowerCase()}`,
      overwrite: true,
    });
    console.log(`✅ Uploaded profile picture for ${username}: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error(`❌ Failed to upload image for ${username}:`, error.message);
    return null;
  }
}

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected for users seeder");

    await User.deleteMany({});
    console.log("🗑️ Existing users cleared");


    const userpicsDir = path.resolve("../frontend/assets/userpics");

    for (const u of usersData) {
      let profilePicture = null;

      // Upload image if it exists
      if (u.image) {
        const imagePath = path.join(userpicsDir, u.image);
        if (fs.existsSync(imagePath)) {
          profilePicture = await uploadImageToCloudinary(imagePath, u.username);
        } else {
          console.warn(`⚠️  Image not found: ${imagePath}`);
        }
      }

      const hash = await bcrypt.hash(u.password, 10);
      await User.create({
        email: u.email,
        username: u.username,
        passwordHash: hash,
        profilePicture: profilePicture,
        isAdmin: u.isAdmin,
      });
      console.log(`👤 User ${u.username} created with profile picture`);
    }

    console.log("✅ All users seeded");
    mongoose.disconnect();
  } catch (err) {
    console.error("❌ Seeding error:", err);
  }
}

seedUsers();
