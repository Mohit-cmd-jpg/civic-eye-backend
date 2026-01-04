require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Import routes
const reportsRouter = require("./routes/reports");
const authRouter = require("./routes/auth");

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Debug: Log all incoming requests (before routes) - MOVED UP
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
//   next();
// });

// API Routes - MUST be before 404 handler
app.use("/api/reports", reportsRouter);
app.use("/api/auth", authRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/civic-eye";

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
})
  .then(() => {
    console.log("✅ MongoDB connected");
    
    // Create default admin if doesn't exist
    const Authority = require("./models/Authority");
    Authority.findOne({ email: "admin@civiceye.com" })
      .then(async (admin) => {
        if (!admin) {
          const defaultAdmin = new Authority({
            email: "admin@civiceye.com",
            password: "admin123", // Change in production!
            name: "System Admin",
            role: "admin",
            assigned_pincodes: [] // Admin sees all
          });
          await defaultAdmin.save();
          console.log("✅ Default admin created (admin@civiceye.com / admin123)");
        }
      })
      .catch(err => console.error("Admin creation error:", err));
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("⚠️  Backend will continue but database operations will fail");
    console.error("💡 Make sure MongoDB is running or set MONGODB_URI in .env");
    // Don't exit - allow server to start even without DB for testing
  });

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🤖 AI Service: ${process.env.AI_SERVICE_URL || "http://localhost:7000"}`);
});
