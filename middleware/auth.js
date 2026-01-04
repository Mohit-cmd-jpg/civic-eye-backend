const jwt = require("jsonwebtoken");
const Authority = require("../models/Authority");

const JWT_SECRET = process.env.JWT_SECRET || "civic-eye-secret-key-change-in-production";

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const authority = await Authority.findById(decoded.id).select("-password");
    
    if (!authority) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.authority = authority;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const authorizePincode = (req, res, next) => {
  const { pincode } = req.query;
  
  // Admins can see all reports
  if (req.authority.role === "admin") {
    return next();
  }

  // If pincode filter is provided, check if authority has access
  if (pincode && req.authority.assigned_pincodes.length > 0) {
    if (!req.authority.assigned_pincodes.includes(pincode)) {
      return res.status(403).json({ 
        message: "You don't have access to this pincode" 
      });
    }
  }

  next();
};

module.exports = { authenticate, authorizePincode, JWT_SECRET };

