
const { test } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");

const app = require("../server");

test("GET / should return API running message", async () => {
  const response = await request(app).get("/");

  assert.strictEqual(response.status, 200);
  assert.strictEqual(
    response.body.message,
    "Customer Inquiry Management API is running!"
  );
});

test("GET /api/protected without token should return 401", async () => {
  const response = await request(app).get("/api/protected");

  assert.strictEqual(response.status, 401);
  assert.strictEqual(
    response.body.message,
    "Unauthorized. Please login first."
  );
});

test("POST /api/inquiries without token should return 401", async () => {
  const response = await request(app)
    .post("/api/inquiries")
    .send({
      customer_name: "Test Customer",
      contact_method: "Email",
      contact_value: "test@example.com",
      subject: "Test Inquiry",
      description: "This is a test inquiry",
    });

  assert.strictEqual(response.status, 401);
});
