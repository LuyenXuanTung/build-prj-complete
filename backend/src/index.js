const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const amqp = require("amqplib");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Kết nối PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Init DB Table
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        youtube_url TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'queued',
        result_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table 'jobs' ready");
  } catch (err) {
    console.error("❌ Init DB Error:", err);
  }
}
initDB();

// 2. Kết nối RabbitMQ
let channel;
const QUEUE_NAME = "video_processing_queue";

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log("✅ Connected to RabbitMQ for Async Writes");
  } catch (err) {
    console.error("❌ RabbitMQ Error:", err);
    setTimeout(connectRabbitMQ, 5000);
  }
}
connectRabbitMQ();

// --- API ROUTES ---

// GET: Lấy danh sách Jobs (Polling status)
app.get("/jobs", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM jobs ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Nộp Video YouTube để xử lý
app.post("/jobs", async (req, res) => {
  const { youtubeUrl } = req.body;

  if (!youtubeUrl) return res.status(400).json({ error: "Missing youtubeUrl" });
  if (!channel) return res.status(500).json({ error: "Queue not ready" });

  try {
    // 1. Tạo record 'queued' trong DB ngay lập tức
    const result = await pool.query(
      "INSERT INTO jobs (youtube_url, status) VALUES ($1, $2) RETURNING id",
      [youtubeUrl, "queued"]
    );
    const jobId = result.rows[0].id;

    // 2. Gửi task vào Queue (kèm jobId)
    const task = { jobId, youtubeUrl };
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(task)), {
      persistent: true,
    });
    console.log(`[x] Queued Job #${jobId}: ${youtubeUrl}`);

    // 3. Trả về ngay cho user
    res.status(202).json({
      status: "queued",
      jobId,
      message: "Video đã được tiếp nhận và đang xếp hàng xử lý.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// DELETE: Xóa job
app.delete("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM jobs WHERE id = $1", [id]);
    res.json({ message: "Job deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
