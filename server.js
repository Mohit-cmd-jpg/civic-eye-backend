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

/* ------------------ UPLOAD REPORT (NO AI CALL) ------------------ */
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { issue_type, description, pincode, address } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const report = new Report({
      image_filename: req.file.filename,
      issue_type,
      description: description || "",
      pincode: pincode || "",
      address: address || "",
      ai_status: "PENDING",
      priority: "UNKNOWN",
      status: "Pending"
    });

    await report.save();

    res.json({
      message: "Report submitted successfully",
      report_id: report._id,
      ai_status: "PENDING"
    });
  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({ message: "Failed to submit report" });
  }
});

/* ------------------ RUN AI VERIFICATION (MANUAL) ------------------ */
app.post("/reports/:id/run-ai", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Call AI service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/analyze`,
      {
        image_path: report.image_filename,
        issue_type: report.issue_type
      },
      { timeout: 20000 }
    );

    const {
      trust_score,
      base_severity,
      priority
    } = aiResponse.data;

    report.trust_score = trust_score;
    report.base_severity = base_severity;
    report.priority = priority;
    report.ai_status = "COMPLETED";

    await report.save();

    res.json({
      message: "AI verification completed",
      trust_score,
      priority
    });
  } catch (error) {
    console.error("AI run error:", error.message);

    await Report.findByIdAndUpdate(req.params.id, {
      ai_status: "FAILED"
    });

    res.status(500).json({ message: "AI verification failed" });
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
