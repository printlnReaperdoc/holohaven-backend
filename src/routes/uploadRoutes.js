// src/routes/uploadRoutes.js
import express from "express";
import upload from "../middleware/upload.js";

const router = express.Router();

router.post("/upload", upload.single("image"), (req, res) => {
  res.json({
    url: req.file.path,
    public_id: req.file.filename,
  });
});

export default router;
