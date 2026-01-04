const express = require("express");
const Authority = require("../models/Authority");
const { authenticate, JWT_SECRET } = require("../middleware/auth");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const authority = await Authority.findOne({ email: email.toLowerCase().trim() });
    
    if (!authority) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await authority.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: authority._id,
        email: authority.email,
        role: authority.role
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      authority: {
        id: authority._id,
        email: authority.email,
        name: authority.name,
        role: authority.role,
        assigned_pincodes: authority.assigned_pincodes
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    console.error("Error details:", error.message);
    
    // Check if it's a MongoDB connection error
    if (error.message && error.message.includes("MongoServerSelectionError")) {
      return res.status(503).json({ 
        message: "Database connection failed. Please ensure MongoDB is running.",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      message: "Login failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// Get current user
router.get("/me", authenticate, async (req, res) => {
  res.json({
    id: req.authority._id,
    email: req.authority.email,
    name: req.authority.name,
    role: req.authority.role,
    assigned_pincodes: req.authority.assigned_pincodes
  });
});

module.exports = router;

