const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const AuthoritySchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  assigned_pincodes: {
    type: [String],
    default: [],
    index: true
  },
  role: {
    type: String,
    enum: ["authority", "admin"],
    default: "authority"
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
AuthoritySchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
AuthoritySchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Authority", AuthoritySchema);

