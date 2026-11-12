
require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./config/db");

async function createAdmin() {
  try {
    const name = "Admin";
    const email = "admin@example.com";
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
      throw new Error("ADMIN_PASSWORD is missing from .env");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO staff (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email`,
      [name, email, passwordHash]
    );

    if (result.rowCount === 0) {
      console.log("Admin account already exists. No changes made.");
    } else {
      console.log("Admin account created successfully!");
      console.log(result.rows[0]);
    }
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();
