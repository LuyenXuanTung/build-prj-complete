const amqp = require("amqplib");
const { Pool } = require("pg");
require("dotenv").config();

const QUEUE_NAME = "user_creation_queue";

// Kết nối DB
const pool = new Pool({
  connectionString: process.env.RABBITMQ_URL.includes("neon")
    ? process.env.RABBITMQ_URL
    : process.env.DATABASE_URL,
  // Lưu ý: User cần check lại file .env của worker xem có biến DATABASE_URL chưa
  // Tôi sẽ fix code này để đọc đúng biến DATABASE_URL ở bước sau
  // Tạm thời giả định file .env của Worker đã có DATABASE_URL (Tôi sẽ update file .env ngay sau đây)
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function startWorker() {
  try {
    console.log("Worker starting...");

    // Connect RabbitMQ
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Chỉ nhận 1 task mỗi lần
    channel.prefetch(1);
    console.log(`[*] Waiting for messages in ${QUEUE_NAME}...`);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const userData = JSON.parse(msg.content.toString());
        console.log(`[x] Received task create user: ${userData.name}`);

        try {
          // Thực hiện INSERT vào DB (Đây là lúc tốn thời gian)
          // Giả lập chậm 2 giây để thấy rõ tác dụng
          await new Promise((r) => setTimeout(r, 2000));

          const query = "INSERT INTO users (name, email) VALUES ($1, $2)";
          await pool.query(query, [userData.name, userData.email]);

          console.log(`[√] Saved to DB: ${userData.email}`);
          channel.ack(msg); // Báo xong
        } catch (err) {
          console.error("Failed to insert:", err.message);
          // Có thể nack hoặc gửi vào Dead Letter Queue
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
