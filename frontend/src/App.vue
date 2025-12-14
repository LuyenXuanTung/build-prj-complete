<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import axios from "axios";

// State
const jobs = ref([]);
const youtubeUrl = ref("");
const loading = ref(false);
const notification = ref("");

const API_URL = "https://build-prj-api-docker.onrender.com/jobs";
let pollingInterval = null;

// 1. Lấy danh sách Jobs
const fetchJobs = async () => {
  try {
    const response = await axios.get(API_URL);
    jobs.value = response.data;
  } catch (error) {
    console.error("Lỗi lấy danh sách:", error);
  }
};

// 2. Polling (Tự động cập nhật mỗi 2s)
const startPolling = () => {
  if (pollingInterval) return;
  pollingInterval = setInterval(() => {
    fetchJobs();
  }, 2000);
};

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

// 3. Nộp Video mới
const submitJob = async () => {
  if (!youtubeUrl.value) return alert("Vui lòng nhập Link YouTube!");

  loading.value = true;
  try {
    await axios.post(API_URL, { youtubeUrl: youtubeUrl.value });
    notification.value = "✅ Đã gửi video cho AI xử lý!";
    youtubeUrl.value = "";

    // Refresh ngay lập tức & bật polling
    fetchJobs();
    startPolling();

    // Tắt thông báo sau 3s
    setTimeout(() => {
      notification.value = "";
    }, 3000);
  } catch (error) {
    alert("Lỗi gửi yêu cầu!");
    console.error(error);
  } finally {
    loading.value = false;
  }
};

// 4. Xóa Job
const deleteJob = async (id) => {
  if (!confirm("Xóa lịch sử này?")) return;
  await axios.delete(`${API_URL}/${id}`);
  await fetchJobs();
};

onMounted(() => {
  fetchJobs();
  startPolling(); // Luôn bật polling để xem tiến độ
});

onUnmounted(stopPolling);
</script>

<template>
  <div class="container">
    <header>
      <h1>🎬 AI Video Repurposing Tool</h1>
      <p>Biến 1 Video YouTube dài thành 10 Video ngắn (Shorts) tự động</p>
    </header>

    <!-- Form nộp video -->
    <div class="card form-section">
      <h3>🚀 Tạo Project Mới</h3>
      <div class="input-group">
        <input
          v-model="youtubeUrl"
          placeholder="Dán link YouTube vào đây (VD: https://youtu.be/...)"
          @keyup.enter="submitJob"
        />
        <button @click="submitJob" :disabled="loading" class="primary-btn">
          {{ loading ? "Đang gửi..." : "Bắt Đầu Xử Lý" }}
        </button>
      </div>
      <div v-if="notification" class="alert">{{ notification }}</div>
    </div>

    <!-- Danh sách Jobs -->
    <div class="card list-section">
      <h3>📜 Lịch Sử Xử Lý</h3>

      <div v-if="jobs.length === 0" class="empty-state">
        Chưa có video nào. Hãy thử nhập link bên trên!
      </div>

      <div v-for="job in jobs" :key="job.id" class="job-item">
        <div class="job-info">
          <span class="job-id">#{{ job.id }}</span>
          <span class="job-url">{{ job.youtube_url }}</span>
        </div>

        <div class="job-status">
          <!-- Status Badge -->
          <span :class="['status-badge', job.status]">
            {{ job.status.toUpperCase() }}
          </span>

          <!-- Result Link -->
          <a
            v-if="job.result_url"
            :href="job.result_url"
            target="_blank"
            class="download-btn"
          >
            ⬇️ Tải Video
          </a>

          <button class="delete-btn" @click="deleteJob(job.id)">🗑️</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reset & Base */
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
  font-family: "Inter", sans-serif;
  color: #333;
}

header {
  text-align: center;
  margin-bottom: 40px;
}
header h1 {
  font-size: 2.5rem;
  margin: 0 0 10px 0;
  background: -webkit-linear-gradient(
    45deg,
    #ff3cac 0%,
    #784ba0 50%,
    #2b86c5 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
header p {
  color: #666;
  font-size: 1.1rem;
}

/* Cards */
.card {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  margin-bottom: 30px;
}

/* Form */
.input-group {
  display: flex;
  gap: 15px;
  margin-top: 20px;
}
input {
  flex: 1;
  padding: 15px;
  border: 2px solid #eee;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s;
}
input:focus {
  border-color: #784ba0;
  outline: none;
}
.primary-btn {
  background: #784ba0;
  color: white;
  border: none;
  padding: 0 30px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}
.primary-btn:hover {
  transform: translateY(-2px);
  background: #6a428d;
}
.primary-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

/* Alert */
.alert {
  margin-top: 15px;
  color: #27ae60;
  background: #eafaf1;
  padding: 10px;
  border-radius: 6px;
  text-align: center;
}

/* Job List */
.job-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-bottom: 1px solid #eee;
}
.job-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-width: 60%;
}
.job-id {
  font-size: 12px;
  color: #999;
  font-weight: bold;
}
.job-url {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.job-status {
  display: flex;
  align-items: center;
  gap: 15px;
}

/* Status Badges */
.status-badge {
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 20px;
  font-weight: bold;
  text-transform: uppercase;
}
.status-badge.queued {
  background: #f39c12;
  color: white;
}
.status-badge.processing {
  background: #3498db;
  color: white;
  animation: pulse 1.5s infinite;
}
.status-badge.completed {
  background: #27ae60;
  color: white;
}
.status-badge.failed {
  background: #e74c3c;
  color: white;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}

.download-btn {
  text-decoration: none;
  color: #27ae60;
  font-weight: bold;
  font-size: 14px;
}
.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
}
.delete-btn:hover {
  opacity: 1;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 40px;
}
</style>
