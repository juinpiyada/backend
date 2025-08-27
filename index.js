require("dotenv").config();
const express = require("express");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

// ✅ Import pool from issue-be/config/db.js
const pool = require("./config/db");

const app = express();

// -------------------- Middleware --------------------
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(
  "/uploads",
  express.static(path.join(__dirname, process.env.UPLOAD_DIR || "uploads"))
);

// -------------------- Multer Setup --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || "uploads");
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// -------------------- Routes --------------------

// Health check
app.get("/", (req, res) => {
  res.send("✅ Server is running with PostgreSQL + SSL");
});

// Upload file and store metadata in DB
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const sql = `
      INSERT INTO uploads (filename, file_url, mimetype, size, created_at)
      VALUES ($1, $2, $3, $4, NOW()) RETURNING *
    `;
    const values = [
      req.file.filename,
      fileUrl,
      req.file.mimetype,
      req.file.size,
    ];
    const result = await pool.query(sql, values);

    res.json({ status: "ok", data: result.rows[0] });
  } catch (err) {
    console.error("DB Insert Error:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

// Fetch uploaded files
app.get("/api/uploads", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM uploads ORDER BY created_at DESC"
    );
    res.json({ status: "ok", data: rows });
  } catch (err) {
    console.error("DB Fetch Error:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 9091;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
