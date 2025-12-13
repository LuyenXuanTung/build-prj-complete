const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const amqp = require("amqplib");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Kết nối PostgreSQL (Để Read List)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 2. Kết nối RabbitMQ (Để Write Async)
let channel;
const QUEUE_NAME = "user_creation_queue";

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

// GET: Đọc trực tiếp từ DB (Để nhanh)
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Gửi sang Worker (Để không tắc server)
app.post("/users", async (req, res) => {
  const { name, email } = req.body;

  if (!channel) return res.status(500).json({ error: "Queue not ready" });

  const task = { name, email };

  // Gửi vào Queue
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(task)), {
    persistent: true,
  });
  console.log(`[x] Queued creation for: ${name}`);

  // Trả về ngay lập tức
  res.status(202).json({
    status: "queued",
    message: "Yêu cầu tạo User đã được tiếp nhận và đang xử lý ngầm.",
  });
});

// DELETE: Tạm thời xóa trực tiếp cho, hoặc cũng đẩy qua queue nếu muốn
app.delete("/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
