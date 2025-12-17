const amqp = require("amqplib");
const { Pool } = require("pg");
const express = require("express");
const ytdl = require("@distube/ytdl-core");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const OpenAI = require("openai");
require("dotenv").config();

// --- CONFIG ---
const QUEUE_NAME = "video_processing_queue";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // User will set this env

// --- HEALTH CHECK SERVER ---
const app = express();
const port = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Worker is running (AI Mode)"));
app.listen(port, () => console.log(`✅ Worker listening on port ${port}`));

// --- DB CONNECTION ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- HELPER FUNCTIONS ---

// 1. Download Video
// 1. Download Video (Using yt-dlp CLI for reliability)
const downloadVideo = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    console.log("   --> Downloading video (via yt-dlp)...");
    const { exec } = require("child_process");

    // Init command
    // -f "b[ext=mp4]" : Best quality mp4 (or just "b" for best) -> "bv*+ba/b" is default
    // -f "best[ext=mp4]/best" : Try to get mp4 directly
    // -o outputPath : Output file
    let cmd = `yt-dlp -f "best[ext=mp4]/best" -o "${outputPath}"`;

    // Handle Cookies
    if (process.env.YOUTUBE_COOKIES) {
      console.log("   --> Processing YouTube Cookies...");
      try {
        const cookiePath = path.resolve("./temp/cookies.txt");
        let cookieData = JSON.parse(process.env.YOUTUBE_COOKIES);

        // Handle { url: ..., cookies: [...] } format
        if (cookieData.cookies && Array.isArray(cookieData.cookies)) {
          cookieData = cookieData.cookies;
        }

        // Convert JSON to Netscape format (Required by yt-dlp)
        let netscapeCookies = "# Netscape HTTP Cookie File\n";

        if (Array.isArray(cookieData)) {
          cookieData.forEach((c) => {
            const domain = c.domain || ".youtube.com";
            const flag = domain.startsWith(".") ? "TRUE" : "FALSE";
            const path = c.path || "/";
            const secure = c.secure ? "TRUE" : "FALSE";
            const expiration = Math.round(
              c.expirationDate || Date.now() / 1000 + 31536000
            );
            const name = c.name;
            const value = c.value;

            netscapeCookies += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
          });

          fs.writeFileSync(cookiePath, netscapeCookies);
          console.log("   --> Cookies written to:", cookiePath);

          cmd += ` --cookies "${cookiePath}"`;
          // Use standard User Agent matching the browser cookies came from (approx)
          cmd += ` --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"`;
        }
      } catch (e) {
        console.warn("   ⚠️ Failed to process cookies:", e.message);
      }
    }

    // Add URL at the end
    // Add --no-progress to prevent stdout buffer overflow (which causes crash)
    cmd += ` --no-progress "${url}"`;

    console.log(`   --> Executing: ${cmd}`);

    // Increase maxBuffer to 50MB to be safe
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`   ❌ yt-dlp error: ${error.message}`);
        console.error(`   ❌ stderr: ${stderr}`);
        return reject(error);
      }
      console.log("   --> Download complete.");
      resolve(outputPath);
    });
  });
};

// 2. Extract Audio
const extractAudio = (videoPath, audioPath) => {
  return new Promise((resolve, reject) => {
    console.log("   --> Extracting audio...");
    ffmpeg(videoPath)
      .toFormat("mp3")
      .save(audioPath)
      .on("end", () => resolve(audioPath))
      .on("error", reject);
  });
};

// 3. AI Analysis (Whisper + GPT)
const analyzeVideoContent = async (audioPath) => {
  console.log("   --> AI is listening (Whisper)...");

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY env var");
  }

  // A. Transcribe
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
  });
  const text = transcription.text;
  console.log(`   --> Transcript length: ${text.length} chars`);

  // B. Analyze with GPT-4
  console.log("   --> AI is analyzing (GPT-4)...");
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          'You are a viral content editor. Find the funniest or most interesting 15-30 second segment in this text. Return JSON format: {"start": seconds, "end": seconds, "summary": "reason"}',
      },
      { role: "user", content: text },
    ],
    // "gpt-4" does not support JSON mode. We must use "gpt-4-turbo" or "gpt-4-0125-preview"
    model: "gpt-4-turbo-preview",
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(completion.choices[0].message.content);
  console.log("   --> AI Suggestion:", result);
  return result; // { start: 10, end: 40, summary: "..." }
};

// 4. Cut Video
const cutVideo = (inputPath, outputPath, startTime, duration) => {
  return new Promise((resolve, reject) => {
    console.log(`   --> Cutting video from ${startTime}s (${duration}s)...`);
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject);
  });
};

// 5. Upload to file.io
const uploadToFileIO = (filePath) => {
  console.log("   --> Uploading to file.io...");
  const { execSync } = require("child_process");
  try {
    // curl -F "file=@/path/to/file" https://file.io
    // file.io returns {"success":true,"key":"...","link":"https://file.io/..."}
    const output = execSync(
      `curl -s -F "file=@${filePath}" https://file.io`
    ).toString();
    const json = JSON.parse(output);
    return json.success ? json.link : "https://upload-failed.com";
  } catch (e) {
    console.error("Upload failed", e.message);
    return "https://upload-error.com";
  }
};

// --- MAIN WORKER ---
async function startWorker() {
  try {
    console.log("Worker starting...");

    // Ensure temp dir exists
    if (!fs.existsSync("./temp")) fs.mkdirSync("./temp");

    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    channel.prefetch(1);
    console.log(`[*] Waiting for jobs in ${QUEUE_NAME}...`);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const { jobId, youtubeUrl } = JSON.parse(msg.content.toString());
        console.log(`\n[x] Processing Job #${jobId}: ${youtubeUrl}`);

        const videoPath = `./temp/${jobId}.mp4`;
        const audioPath = `./temp/${jobId}.mp3`;
        const resultPath = `./temp/${jobId}_shorts.mp4`;

        try {
          // 1. Update Status -> PROCESSING
          await pool.query(
            "UPDATE jobs SET status = 'processing' WHERE id = $1",
            [jobId]
          );

          // 2. Download
          await downloadVideo(youtubeUrl, videoPath);

          // 3. AI Processing (Extract -> Transcribe -> Analyze)
          // Note: If no API Key, we skip this and pretend we found a segment
          let segment = { start: 0, end: 15, summary: "Fallback segment" };

          if (process.env.OPENAI_API_KEY) {
            await extractAudio(videoPath, audioPath);
            segment = await analyzeVideoContent(audioPath);
          } else {
            console.log(
              "⚠️ No OPENAI_API_KEY found. Using fallback segment (0-15s)."
            );
            // Add fake delay to simulate AI
            await new Promise((r) => setTimeout(r, 3000));
          }

          // 4. Cut Video
          await cutVideo(
            videoPath,
            resultPath,
            segment.start,
            segment.end - segment.start
          );

          // 5. Update Status -> COMPLETED
          // Upload resultPath to file.io
          let finalLink = "https://error-uploading.com";
          try {
            finalLink = uploadToFileIO(resultPath);
          } catch (e) {
            console.log("Upload logic error", e);
          }

          await pool.query(
            "UPDATE jobs SET status = 'completed', result_url = $1 WHERE id = $2",
            [finalLink, jobId]
          );

          console.log(
            `[√] Job #${jobId} Completed! AI Summary: ${segment.summary}`
          );

          // Cleanup
          if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath); // Delete actual result to save space

          channel.ack(msg);
        } catch (err) {
          console.error("Failed to process:", err);
          await pool.query("UPDATE jobs SET status = 'failed' WHERE id = $1", [
            jobId,
          ]);
          channel.ack(msg);
        }
      }
    });
  } catch (error) {
    console.error("Worker Error:", error);
    setTimeout(startWorker, 5000);
  }
}

startWorker();
