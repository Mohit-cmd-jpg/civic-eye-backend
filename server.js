require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");

const Report = require("./models/Report");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

/* ------------------ DATABASE CONNECTION ------------------ */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Atlas connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

/* ------------------ UPLOAD & PROCESS REPORT ------------------ */
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { issue_type, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    // Call AI service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/analyze`,
      {
        image_path: req.file.path,
        issue_type
      },
      { timeout: 15000 }
    );

    const {
      trust_score,
      base_severity,
      priority
    } = aiResponse.data;

    const report = new Report({
      image_filename: req.file.filename,
      issue_type,
      description: description || "",
      trust_score,
      base_severity,
      priority,
      status: "Pending"
    });

    await report.save();

    res.json({
      message: "Image uploaded and analyzed",
      report_id: report._id
    });
  } catch (error) {
    console.error("Upload error:", error.message);
    res
      .status(500)
      .json({ message: "AI processing failed" });
  }
});

/* ------------------ FETCH REPORTS ------------------ */
app.get("/reports", async (req, res) => {
  const reports = await Report.find().sort({ created_at: -1 });
  res.json(reports);
});

/* ------------------ UPDATE STATUS ------------------ */
app.put("/reports/:id/status", async (req, res) => {
  const { status } = req.body;

  await Report.findByIdAndUpdate(req.params.id, { status });
  res.json({ message: "Status updated successfully" });
});

/* ------------------ START SERVER ------------------ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
