const amqp = require("amqplib");
const { Pool } = require("pg");
const express = require("express");
require("dotenv").config();

const QUEUE_NAME = "user_creation_queue";

// Kết nối DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Tạo HTTP server giả để Render không báo lỗi "No open ports"
const app = express();
app.get("/", (req, res) => res.send("Worker is running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "worker" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Health check server running on port ${PORT}`);
});

// Worker logic
async function startWorker() {
  try {
    console.log("Worker starting...");
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    
    channel.prefetch(1);
    console.log(`[*] Waiting for messages in ${QUEUE_NAME}...`);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const userData = JSON.parse(msg.content.toString());
        console.log(`[x] Received task create user: ${userData.name}`);

        try {
          // Delay 2 giây để giả lập xử lý nặng
          await new Promise(r => setTimeout(r, 2000)); 
          
          const query = "INSERT INTO users (name, email) VALUES ($1, $2)";
          await pool.query(query, [userData.name, userData.email]);
          
          console.log(`[√] Saved to DB: ${userData.email}`);
          channel.ack(msg);
        } catch (err) {
          console.error("Failed to insert:", err.message);
          channel.ack(msg); // Tạm thời ack để không bị kẹt
        }
      }
    });
  } catch (error) {
    console.error("Worker Error:", error);
    setTimeout(startWorker, 5000);
  }
}

startWorker();
