
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const pool = require("../config/db");

const router = express.Router();
console.log("Auth routes file loaded!");
router.get("/test", (req, res) => {
  res.json({
    message: "Auth routes are working!"
  });
});

router.post("/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const validation = schema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: "Invalid email or password format",
    });
  }

  const { email, password } = validation.data;

  try {
    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM staff WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const staff = result.rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      staff.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { staffId: staff.id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      message: "Internal server error",
    });
  }
});

module.exports = router;
