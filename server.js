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

const AI_MODE = process.env.AI_MODE || "LOCAL";
const LOCAL_AI_URL = "http://127.0.0.1:7000";

/* ------------------ DATABASE CONNECTION ------------------ */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

/* ------------------ UPLOAD REPORT ------------------ */
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { issue_type, description, pincode, address } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image required" });
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
      report_id: report._id
    });
  } catch (err) {
    res.status(500).json({ message: "Upload failed" });
  }
});

/* ------------------ RUN AI (LOCAL ONLY) ------------------ */
app.post("/reports/:id/run-ai", async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Not found" });

  if (AI_MODE !== "LOCAL") {
    report.ai_status = "FAILED";
    await report.save();
    return res.json({ message: "Cloud AI disabled" });
  }

  try {
    const aiRes = await axios.post(`${LOCAL_AI_URL}/analyze`, {
      image_path: report.image_filename,
      issue_type: report.issue_type
    });

    report.trust_score = aiRes.data.trust_score;
    report.priority = aiRes.data.priority;
    report.base_severity = aiRes.data.base_severity;
    report.ai_status = "COMPLETED";

    await report.save();

    res.json({ message: "AI completed locally" });
  } catch (e) {
    report.ai_status = "FAILED";
    await report.save();
    res.status(500).json({ message: "Local AI failed" });
  }
});

/* ------------------ FETCH REPORTS ------------------ */
app.get("/reports", async (req, res) => {
  const reports = await Report.find().sort({ created_at: -1 });
  res.json(reports);
});

/* ------------------ UPDATE STATUS ------------------ */
app.put("/reports/:id/status", async (req, res) => {
  await Report.findByIdAndUpdate(req.params.id, { status: req.body.status });
  res.json({ message: "Status updated" });
});

/* ------------------ START SERVER ------------------ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Backend running on", PORT));
