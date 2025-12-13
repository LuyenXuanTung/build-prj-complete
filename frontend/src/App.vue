<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import axios from "axios";

const users = ref([]);
const newUser = ref({ name: "", email: "" });
const loading = ref(false);
const notification = ref("");
const pendingCount = ref(0); // Đếm số request đang chờ xử lý

const API_URL = "https://build-prj-api-docker.onrender.com/users";
let pollingInterval = null;

// 1. Lấy danh sách users
const fetchUsers = async () => {
  try {
    const response = await axios.get(API_URL);
    users.value = response.data;
  } catch (error) {
    console.error("Lỗi lấy danh sách:", error);
  }
};

// 2. Bật Polling (Tự động reload mỗi 2s)
const startPolling = () => {
  if (pollingInterval) return; // Đã bật rồi thì thôi

  pollingInterval = setInterval(() => {
    fetchUsers();
    console.log("🔄 Auto-refreshing...");
  }, 2000); // Mỗi 2 giây reload 1 lần
};

// 3. Tắt Polling
const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("⏸️ Polling stopped");
  }
};

// 4. Thêm user mới
const addUser = async () => {
  if (!newUser.value.name || !newUser.value.email)
    return alert("Nhập đủ thông tin nhé!");

  loading.value = true;
  pendingCount.value++;

  try {
    await axios.post(API_URL, newUser.value);

    notification.value = `✅ Đã gửi! Còn ${pendingCount.value} request đang xử lý...`;
    newUser.value = { name: "", email: "" };

    // Bật Polling để tự động cập nhật
    startPolling();

    // Sau 5 giây (Worker chậm 2s + buffer), giảm pending count
    setTimeout(() => {
      pendingCount.value--;
      if (pendingCount.value === 0) {
        notification.value = "";
        stopPolling(); // Tắt Polling khi hết việc
      } else {
        notification.value = `✅ Còn ${pendingCount.value} request đang xử lý...`;
      }
    }, 5000);
  } catch (error) {
    alert("Lỗi gửi yêu cầu!");
    pendingCount.value--;
  } finally {
    loading.value = false;
  }
};

// 5. Xóa user
const deleteUser = async (id) => {
  if (!confirm("Xóa nhé?")) return;
  await axios.delete(`${API_URL}/${id}`);
  await fetchUsers();
};

onMounted(fetchUsers);
onUnmounted(stopPolling); // Cleanup khi thoát trang
</script>

<template>
  <div class="container">
    <h1>🚀 Async User Manager</h1>
    <p>Architecture: Backend (Queue) → Worker (Delay 2s) → Neon DB</p>

    <!-- Thông báo -->
    <div v-if="notification" class="notification">
      {{ notification }}
      <span class="spinner">⏳</span>
    </div>

    <!-- Form -->
    <div class="card form-group">
      <input v-model="newUser.name" placeholder="Tên user..." />
      <input v-model="newUser.email" placeholder="Email..." />
      <button @click="addUser" :disabled="loading">
        {{ loading ? "Đang gửi..." : "Thêm User" }}
      </button>
    </div>

    <!-- List -->
    <div class="card">
      <h3>Danh sách Users ({{ users.length }})</h3>
      <div v-for="user in users" :key="user.id" class="user-item">
        <span
          >#{{ user.id }} - <b>{{ user.name }}</b> ({{ user.email }})</span
        >
        <button class="del-btn" @click="deleteUser(user.id)">X</button>
      </div>
      <p v-if="users.length === 0" style="text-align: center; color: #999">
        Chưa có user nào.
      </p>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 600px;
  margin: 40px auto;
  font-family: sans-serif;
}
.card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.form-group {
  display: flex;
  gap: 10px;
}
input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
button {
  cursor: pointer;
  background: #2c3e50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-weight: bold;
}
button:hover {
  background: #34495e;
}
.notification {
  background: #d4edda;
  color: #155724;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
  border: 1px solid #c3e6cb;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
.spinner {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.user-item {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #eee;
  padding: 10px 0;
  align-items: center;
}
.del-btn {
  background: #e74c3c;
  padding: 5px 10px;
  font-size: 12px;
}
h3 {
  margin-top: 0;
}
</style>
