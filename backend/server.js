
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const inquiryRoutes = require("./routes/inquiryRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/inquiries", inquiryRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Customer Inquiry Management API is running!",
  });
});

app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({
    message: "You are authorized!",
    staff: req.staff,
  });
});

// Export app for automated testing
module.exports = app;

// Start server only when running this file directly
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  server.on("close", () => {
    console.log("Express server was closed!");
  });

  server.on("error", (error) => {
    console.log("Server error:", error.message);
  });
}
