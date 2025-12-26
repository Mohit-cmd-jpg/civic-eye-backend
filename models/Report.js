const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
  image_filename: {
    type: String,
    required: true
  },
  issue_type: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  pincode: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    default: ""
  },
  trust_score: {
    type: Number,
    default: null
  },
  base_severity: {
    type: Number,
    default: null
  },
  priority: {
    type: String,
    default: "UNKNOWN"
  },
  ai_status: {
    type: String,
    default: "PENDING" // PENDING | COMPLETED | FAILED
  },
  status: {
    type: String,
    default: "Pending"
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Report", ReportSchema);
