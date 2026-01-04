const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: false, // Will be auto-generated in pre-save hook
    unique: true,
    index: true
  },
  image_filename: {
    type: String,
    required: true
  },
  issue_type: {
    type: String,
    required: true,
    enum: ["pothole", "road_block", "garbage", "accident", "water_leak", "fire", "other"]
  },
  description: {
    type: String,
    default: ""
  },
  pincode: {
    type: String,
    required: true,
    index: true
  },
  address: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  geohash: {
    type: String,
    default: ""
  },
  trust_score: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  },
  base_severity: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  },
  priority: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH", "UNKNOWN"],
    default: "UNKNOWN"
  },
  ai_status: {
    type: String,
    enum: ["PENDING", "COMPLETED", "FAILED", "UNAVAILABLE"],
    default: "PENDING"
  },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Resolved"],
    default: "Pending"
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Generate complaintId before saving
ReportSchema.pre("save", async function(next) {
  try {
    if (!this.complaintId) {
      const count = await mongoose.model("Report").countDocuments();
      this.complaintId = `CIV-${Date.now()}-${String(count + 1).padStart(6, "0")}`;
    }
    next();
  } catch (error) {
    // If countDocuments fails, generate ID without count
    if (!this.complaintId) {
      this.complaintId = `CIV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
    next();
  }
});

module.exports = mongoose.model("Report", ReportSchema);
