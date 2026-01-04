const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Report = require("../models/Report");
const { calculateSeverityAndPriority } = require("../severity");
const ngeohash = require("ngeohash");
const { authenticate, authorizePincode } = require("../middleware/auth");

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed"));
  }
});

// Public: Submit new report
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    // Debug: Log received data
    console.log("=== REPORT SUBMISSION ===");
    console.log("Received form data:", {
      issue_type: req.body.issue_type,
      pincode: req.body.pincode,
      address: req.body.address,
      description: req.body.description,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      hasImage: !!req.file,
      imageFilename: req.file?.filename
    });

    const { issue_type, description, pincode, address, latitude, longitude } = req.body;

    // Validation
    if (!issue_type || !pincode || !address) {
      // Delete uploaded file if validation fails
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        message: "Issue type, pincode, and address are required" 
      });
    }

    // Generate geohash if coordinates provided
    let geohash = "";
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        geohash = ngeohash.encode(lat, lng, 9);
      }
    }

    const report = new Report({
      image_filename: req.file.filename,
      issue_type,
      description: description || "",
      pincode: pincode.trim(),
      address: address.trim(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      geohash,
      ai_status: process.env.AI_SERVICE_URL ? "PENDING" : "UNAVAILABLE",
      status: "Pending"
    });

    console.log("Saving report to database...");
    try {
      await report.save();
      console.log("Report saved successfully. Complaint ID:", report.complaintId);
    } catch (dbError) {
      console.error("Database save error:", dbError);
      // Clean up uploaded file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw new Error("Database connection failed. Please ensure MongoDB is running. Error: " + dbError.message);
    }

    res.status(201).json({
      message: "Report submitted successfully",
      complaintId: report.complaintId,
      id: report._id
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Report submission error:", error);
    res.status(500).json({ 
      message: "Failed to submit report",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Public: Track complaint by ID
router.get("/:complaintId", async (req, res) => {
  try {
    const report = await Report.findOne({ complaintId: req.params.complaintId });
    
    if (!report) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    res.json({
      complaintId: report.complaintId,
      issue_type: report.issue_type,
      description: report.description,
      pincode: report.pincode,
      address: report.address,
      latitude: report.latitude,
      longitude: report.longitude,
      status: report.status,
      ai_status: report.ai_status,
      trust_score: report.trust_score,
      priority: report.priority,
      created_at: report.created_at,
      image_url: report.image_url,
      user_date: report.user_date,
      user_time: report.user_time
    });
  } catch (error) {
    console.error("Track complaint error:", error);
    res.status(500).json({ message: "Failed to fetch complaint" });
  }
});

// Protected: Update report status
router.put("/:id/status", authenticate, authorizePincode, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!["Pending", "In Progress", "Resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Check authorization (if authority is assigned to this pincode)
    if (req.authority.role !== "admin" && 
        req.authority.assigned_pincodes.length > 0 && 
        !req.authority.assigned_pincodes.includes(report.pincode)) {
      return res.status(403).json({ message: "Unauthorized to update this report" });
    }

    report.status = status;
    await report.save();

    res.json({ message: "Status updated successfully", status: report.status });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
});

// Protected: List reports (filtered by pincode)
router.get("/", authenticate, authorizePincode, async (req, res) => {
  try {
    const { pincode, status, priority, limit = 50, skip = 0 } = req.query;
    
    const query = {};

    // Filter by pincode (authority can only see assigned pincodes)
    if (req.authority.role === "admin") {
      // Admin can see all
      if (pincode) query.pincode = pincode;
    } else {
      // Regular authority can only see assigned pincodes
      if (req.authority.assigned_pincodes.length > 0) {
        query.pincode = { $in: req.authority.assigned_pincodes };
      } else {
        // No assigned pincodes = no access
        return res.json({ reports: [], total: 0 });
      }
      
      if (pincode && req.authority.assigned_pincodes.includes(pincode)) {
        query.pincode = pincode;
      }
    }

    // Additional filters
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const reports = await Report.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Report.countDocuments(query);

    res.json({
      reports,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error("List reports error:", error);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
});

// Protected: Trigger AI verification
router.post("/:id/verify", authenticate, async (req, res) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:200',message:'Verify endpoint entry',data:{reportId:req.params.id,hasAuth:!!req.authority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const report = await Report.findById(req.params.id);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:203',message:'Report fetched',data:{reportFound:!!report,reportId:report?._id?.toString(),imageFilename:report?.image_filename},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Check pincode access
    if (req.authority.role !== "admin" && 
        req.authority.assigned_pincodes.length > 0 &&
        !req.authority.assigned_pincodes.includes(report.pincode)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const imagePath = path.join(uploadDir, report.image_filename);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:215',message:'Image path check',data:{imagePath,fileExists:fs.existsSync(imagePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!fs.existsSync(imagePath)) {
      report.ai_status = "FAILED";
      await report.save();
      return res.status(404).json({ message: "Image file not found" });
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:7000";
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:223',message:'Before AI service call',data:{aiServiceUrl,issueType:report.issue_type,imageSize:fs.statSync(imagePath).size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:226',message:'Image buffer read',data:{bufferSize:imageBuffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      const aiUrl = `${aiServiceUrl}/analyze?issue_type=${encodeURIComponent(report.issue_type)}`;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:228',message:'Before fetch to AI',data:{aiUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      const aiResponse = await fetch(aiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: imageBuffer,
        signal: AbortSignal.timeout(30000) // 30s timeout
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:235',message:'AI response received',data:{status:aiResponse.status,statusText:aiResponse.statusText,ok:aiResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:238',message:'AI response not ok',data:{status:aiResponse.status,errorText:errorText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        throw new Error(`AI service returned ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:243',message:'AI data parsed',data:{hasTrustScore:aiData.trust_score!==undefined,trustScore:aiData.trust_score,hasPriority:aiData.priority!==undefined,priority:aiData.priority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // Calculate severity and priority
      const result = calculateSeverityAndPriority({
        trust_score: aiData.trust_score,
        issue_type: report.issue_type
      });

      // Update report
      report.trust_score = aiData.trust_score;
      report.base_severity = result.base_severity;
      report.priority = result.priority;
      report.ai_status = "COMPLETED";
      await report.save();

      res.json({
        message: "AI verification completed",
        trust_score: report.trust_score,
        base_severity: report.base_severity,
        priority: report.priority,
        explanation: aiData.explanation || {}
      });
    } catch (aiError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:261',message:'AI error caught',data:{errorMessage:aiError.message,errorName:aiError.name,errorCode:aiError.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error("AI verification error:", aiError);
      report.ai_status = "FAILED";
      await report.save();
      
      res.status(503).json({
        message: "AI verification service unavailable",
        error: process.env.NODE_ENV === "development" ? aiError.message : undefined
      });
    }
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9e3afc6-a17b-425e-a047-ac848866ab88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reports.js:272',message:'General error caught',data:{errorMessage:error.message,errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error("Verify report error:", error);
    res.status(500).json({ message: "Failed to verify report" });
  }
});

// Protected: Update report status
router.put("/:id/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!["Pending", "In Progress", "Resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Check pincode access
    if (req.authority.role !== "admin" && 
        req.authority.assigned_pincodes.length > 0 &&
        !req.authority.assigned_pincodes.includes(report.pincode)) {
      return res.status(403).json({ message: "Access denied" });
    }

    report.status = status;
    await report.save();

    res.json({
      message: "Status updated successfully",
      status: report.status
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
});

module.exports = router;

