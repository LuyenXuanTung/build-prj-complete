# Async CRUD User Management

A full-stack web application demonstrating **asynchronous processing** with RabbitMQ, built to learn Docker, CI/CD, and microservices architecture.

## 🚀 Live Demo

- **Frontend**: https://build-prj-finished.netlify.app

## 📋 Features

- ✅ **CRUD Operations**: Create, Read, Delete users
- ✅ **Async Processing**: User creation handled by background worker via RabbitMQ
- ✅ **Real-time Updates**: Frontend auto-refreshes using polling
- ✅ **Dockerized**: Run entire stack with one command
- ✅ **CI/CD**: Auto-deploy on Git push (Netlify + Render)

## 🏗️ Architecture

```
Frontend (Vue.js) → Backend (Express) → RabbitMQ → Worker → PostgreSQL
                         ↓
                    PostgreSQL (Read)
```

**Flow:**

- **Create User**: Frontend → Backend → RabbitMQ queue → Worker (2s delay) → PostgreSQL
- **Read Users**: Frontend → Backend → PostgreSQL (direct)
- **Delete User**: Frontend → Backend → PostgreSQL (direct)

## 🛠️ Tech Stack

| Component        | Technology                                  |
| ---------------- | ------------------------------------------- |
| Frontend         | Vue 3, Vite, Axios                          |
| Backend          | Node.js, Express                            |
| Worker           | Node.js                                     |
| Database         | PostgreSQL (Neon.tech)                      |
| Message Queue    | RabbitMQ (CloudAMQP)                        |
| Containerization | Docker, Docker Compose                      |
| Hosting          | Netlify (Frontend), Render (Backend/Worker) |

## 🐳 Quick Start with Docker

### Prerequisites

- Docker Desktop installed and running

### Run Locally

```bash
# Clone repository
git clone https://github.com/LuyenXuanTung/build-prj-complete.git
cd build-prj-complete

# Start all services
docker-compose up --build

# Access application
# Frontend: http://localhost:8080
# Backend: http://localhost:3000
# RabbitMQ UI: http://localhost:15672 (user/password)
```

### Stop Services

```bash
docker-compose down
```

## 💻 Manual Setup (Without Docker)

### Prerequisites

- Node.js 18+
- PostgreSQL (or use Neon.tech)
- RabbitMQ (or use CloudAMQP)

### Backend

```bash
cd backend
npm install
# Create .env file (see .env.example)
npm run dev
```

### Worker

```bash
cd worker
npm install
# Create .env file (see .env.example)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

```
build-cloud/
├── backend/          # Express API server
├── worker/           # Background task processor
├── frontend/         # Vue.js application
├── docker-compose.yml
├── DOCKER.md         # Docker usage guide
└── README.md
```

## 🔧 Environment Variables

### Backend & Worker

```env
PORT=3000
DATABASE_URL=postgresql://user:pass@host/db
RABBITMQ_URL=amqp://user:pass@host
```

See `.env.example` for template.

## 📚 Documentation

- [Docker Guide](./DOCKER.md) - Detailed Docker usage
- [Walkthrough](./walkthrough.md) - Complete project walkthrough

## 🎯 Learning Objectives

This project demonstrates:

- ✅ **Async Processing** with RabbitMQ message queues
- ✅ **Microservices** architecture (Backend, Worker separation)
- ✅ **Docker** containerization and orchestration
- ✅ **CI/CD** with automatic deployments
- ✅ **Cloud Services** integration (Neon, CloudAMQP, Render, Netlify)

## 🧪 Testing

### Production

Visit https://aesthetic-piroshki-2b6443.netlify.app and:

1. Add 3 users quickly
2. Observe "Processing..." notification
3. Watch users appear one by one (2s delay each)

### Local (Docker)

```bash
docker-compose up
# Visit http://localhost:8080
```

## 📝 License

MIT

## 👤 Author

LuyenXuanTung

---

**Note**: This is a learning project demonstrating Docker, CI/CD, and RabbitMQ concepts.
