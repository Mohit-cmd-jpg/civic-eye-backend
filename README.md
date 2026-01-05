# 🖥️ Civic-Eye Backend

[![Node.js](https://img.shields.io/badge/Node.js-16+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

The core API engine for Civic-Eye, handling report submissions, authority management, and integration with the AI verification service.

## ✨ Features

- **🔐 Secure Authentication:** JWT-based login for authorities and administrators.
- **📍 Pincode Access Control:** Authorities can only access reports within their assigned jurisdictions.
- **📸 Report Management:** Full CRUD operations for citizen reports, including image uploads.
- **🤖 AI Integration:** Seamlessly communicates with the AI service for real-time verification.
- **📁 File Storage:** Managed local storage for report images.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (via Mongoose)
- **Auth:** JSON Web Tokens (JWT) & Bcrypt

## 📦 Project Structure

```text
backend/
├── middleware/       # Auth & validation middleware
├── models/           # MongoDB schemas (Report, Authority)
├── routes/           # API endpoints (Auth, Reports)
├── uploads/          # Image storage directory
├── server.js         # Entry point
├── package.json      # Dependencies & scripts
└── .gitignore        # Git ignore rules
```

## 🚀 Running Locally

1. **Clone & Navigate:**
   ```bash
   git clone https://github.com/Mohit-cmd-jpg/civic-eye-backend.git
   cd civic-eye-backend
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   AI_SERVICE_URL=http://localhost:5001
   ```

4. **Start Server:**
   ```bash
   npm start
   ```

## 📄 License
This project is open-source under the MIT License.

Made with ❤️ by Mohit Bindal
