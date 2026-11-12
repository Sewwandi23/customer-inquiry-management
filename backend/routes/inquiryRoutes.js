
const express = require("express");
const { z } = require("zod");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

console.log("Inquiry routes file loaded!");

// Create a new customer inquiry
router.post("/", authMiddleware, async (req, res) => {
  const schema = z.object({
    customer_name: z.string().trim().min(1).max(100),
    contact_method: z.enum(["Email", "Phone"]),
    contact_value: z.string().trim().min(1).max(150),
    subject: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1),
  });

  const validation = schema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: "Invalid inquiry data",
      errors: validation.error.issues,
    });
  }

  const {
    customer_name,
    contact_method,
    contact_value,
    subject,
    description,
  } = validation.data;

  try {
    const result = await pool.query(
      `INSERT INTO inquiries
       (customer_name, contact_method, contact_value, subject, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        customer_name,
        contact_method,
        contact_value,
        subject,
        description,
        req.staff.staffId,
      ]
    );

    res.status(201).json({
      message: "Inquiry created successfully",
      inquiry: result.rows[0],
    });
  } catch (error) {
    console.error("Create inquiry error:", error.message);

    res.status(500).json({
      message: "Failed to create inquiry",
    });
  }
});

// Get all customer inquiries with search and filter
router.get("/", authMiddleware, async (req, res) => {
  const { search, status } = req.query;

  try {
    let query = `
      SELECT *
      FROM inquiries
      WHERE 1 = 1
    `;

    const values = [];
    let index = 1;

    // Search by customer name or subject
    if (search) {
      query += ` AND (
        customer_name ILIKE $${index}
        OR subject ILIKE $${index}
      )`;

      values.push(`%${search}%`);
      index++;
    }

    // Filter by inquiry status
    if (status) {
      if (!["New", "In Progress", "Resolved"].includes(status)) {
        return res.status(400).json({
          message: "Invalid inquiry status",
        });
      }

      query += ` AND status = $${index}`;
      values.push(status);
      index++;
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, values);

    res.json({
      message: "Inquiries retrieved successfully",
      inquiries: result.rows,
    });
  } catch (error) {
    console.error("Get inquiries error:", error.message);

    res.status(500).json({
      message: "Failed to retrieve inquiries",
    });
  }
});

// Get a single inquiry by ID
router.get("/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid inquiry ID",
    });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM inquiries
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Inquiry not found",
      });
    }

    res.json({
      message: "Inquiry retrieved successfully",
      inquiry: result.rows[0],
    });
  } catch (error) {
    console.error("Get inquiry error:", error.message);

    res.status(500).json({
      message: "Failed to retrieve inquiry",
    });
  }
});

// Update inquiry status with version checking
router.patch("/:id/status", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  const schema = z.object({
    status: z.enum(["New", "In Progress", "Resolved"]),
    version: z.number().int().positive(),
  });

  const validation = schema.safeParse(req.body);

  // Validate inquiry ID
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid inquiry ID",
    });
  }

  // Validate request body
  if (!validation.success) {
    return res.status(400).json({
      message: "Invalid status or version",
      errors: validation.error.issues,
    });
  }

  const { status: newStatus, version } = validation.data;

  try {
    // Get current inquiry
    const result = await pool.query(
      "SELECT status, version FROM inquiries WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Inquiry not found",
      });
    }

    const currentInquiry = result.rows[0];

    // Check whether client has the latest version
    if (currentInquiry.version !== version) {
      return res.status(409).json({
        message: "Conflict: Inquiry was updated. Please refresh and try again.",
        currentVersion: currentInquiry.version,
      });
    }

    // Define allowed status transitions
    const allowedTransitions = {
      "New": ["In Progress"],
      "In Progress": ["Resolved"],
      "Resolved": [],
    };

    if (!allowedTransitions[currentInquiry.status].includes(newStatus)) {
      return res.status(400).json({
        message: `Cannot change status from ${currentInquiry.status} to ${newStatus}`,
      });
    }

    // Update only if version is still the same
    const updateResult = await pool.query(
      `UPDATE inquiries
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP,
           version = version + 1
       WHERE id = $2 AND version = $3
       RETURNING *`,
      [newStatus, id, version]
    );

    // Handle concurrent updates
    if (updateResult.rows.length === 0) {
      return res.status(409).json({
        message: "Conflict: Inquiry was updated. Please refresh and try again.",
      });
    }

    res.json({
      message: "Inquiry status updated successfully",
      inquiry: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Update inquiry status error:", error.message);

    res.status(500).json({
      message: "Failed to update inquiry status",
    });
  }
});

module.exports = router;
