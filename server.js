require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Report = require("./models/Report");

const app = express();

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json());

// ---------------- MongoDB ----------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Atlas connected"))
  .catch((err) => console.error(err));

// ---------------- Multer ----------------
const upload = multer({ dest: "uploads/" });

// ---------------- Routes ----------------

app.get("/", (req, res) => {
  res.send("Civic-Eye Backend is running");
});

app.get("/reports", async (req, res) => {
  const reports = await Report.find().sort({ created_at: -1 });
  res.json(reports);
});

app.put("/reports/:id/status", async (req, res) => {
  const updated = await Report.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true }
  );
  res.json(updated);
});

// 🔥 FINAL CORRECT UPLOAD PIPELINE
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const issueType = req.body.issue_type;
    const imagePath = req.file.path;

    // Convert image to base64
    const imageBase64 = fs.readFileSync(imagePath, {
      encoding: "base64"
    });

    // Call AI service with image data
    const aiResponse = await axios.post(
      "https://civic-eye-ai-service.onrender.com/analyze",
      {
        image_base64: imageBase64,
        issue_type: issueType
      },
      { timeout: 30000 }
    );

    const ai = aiResponse.data;

    const report = new Report({
      image_filename: req.file.originalname,
      issue_type: issueType,
      trust_score: ai.trust_score,
      base_severity: ai.base_severity,
      priority: ai.priority
    });

    await report.save();

    res.json({
      message: "Report uploaded, analyzed, and saved",
      report: ai
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      message: "AI processing failed"
    });
  }
});

// ---------------- Start ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
