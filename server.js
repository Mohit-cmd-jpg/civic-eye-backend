require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");
const fs = require("fs");

const Report = require("./models/Report");

const app = express();

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json());

// ---------------- Ensure uploads folder exists ----------------
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("Created uploads directory");
}

// ---------------- MongoDB Atlas ----------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB Atlas connected");
  })
  .catch((err) => {
    console.error("MongoDB Atlas connection error:", err);
  });

// ---------------- Multer (Image Upload) ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ---------------- Helper: Call AI Service with Retry ----------------
async function callAIService(payload, retries = 1) {
  try {
    return await axios.post(
      "https://civic-eye-ai-service.onrender.com/analyze",
      payload,
      { timeout: 20000 } // 20 seconds
    );
  } catch (error) {
    if (retries > 0 && error.response && error.response.status === 429) {
      console.log("AI service rate-limited, retrying...");
      await new Promise((res) => setTimeout(res, 3000)); // wait 3 sec
      return callAIService(payload, retries - 1);
    }
    throw error;
  }
}

// ---------------- Routes ----------------

// Health check
app.get("/", (req, res) => {
  res.send("Civic-Eye Backend is running");
});

// Fetch all reports
app.get("/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({ created_at: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reports" });
  }
});

// Update report status
app.put("/reports/:id/status", async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  try {
    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json(updatedReport);
  } catch (error) {
    res.status(500).json({ message: "Error updating report status" });
  }
});

// Upload image → AI Service → Save
app.post("/upload", upload.single("image"), async (req, res) => {
  const issueType = req.body.issue_type;

  if (!req.file || !issueType) {
    return res.status(400).json({
      message: "Image and issue_type are required"
    });
  }

  try {
    const aiResponse = await callAIService({
      filename: req.file.filename,
      issue_type: issueType
    });

    const aiData = aiResponse.data;

    const report = new Report({
      image_filename: aiData.filename,
      issue_type: aiData.issue_type,
      trust_score: aiData.trust_score,
      base_severity: aiData.base_severity,
      priority: aiData.priority
    });

    await report.save();

    res.json({
      message: "Report uploaded, analyzed, and saved",
      report: aiData
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      message: "AI service temporarily unavailable. Please retry."
    });
  }
});

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
