// Quick test script to check if MongoDB connection works
require("dotenv").config();
const mongoose = require("mongoose");
const Report = require("./models/Report");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/civic-eye";

async function testConnection() {
  try {
    console.log("Testing MongoDB connection...");
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("✅ MongoDB connected!");
    
    // Try to create a test report
    const testReport = new Report({
      image_filename: "test.jpg",
      issue_type: "pothole",
      description: "Test",
      pincode: "123456",
      address: "Test Address"
    });
    
    await testReport.save();
    console.log("✅ Test report created! Complaint ID:", testReport.complaintId);
    
    // Clean up
    await Report.deleteOne({ _id: testReport._id });
    console.log("✅ Test report deleted");
    
    await mongoose.disconnect();
    console.log("✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

testConnection();

