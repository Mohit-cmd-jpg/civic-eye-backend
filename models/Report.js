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
  trust_score: {
    type: Number,
    required: true
  },
  base_severity: {
    type: Number,
    required: true
  },
  priority: {
    type: String,
    required: true
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
