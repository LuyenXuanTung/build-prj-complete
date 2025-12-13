# Docker Quick Start Guide

## Prerequisites

- Docker Desktop installed and running
- Git repository cloned

## Running the Application

### 1. Start all services

```bash
docker-compose up --build
```

This will start:

- PostgreSQL (port 5432)
- RabbitMQ (port 5672, Management UI: http://localhost:15672)
- Backend API (port 3000)
- Worker (background process)
- Frontend (port 8080)

### 2. Access the application

- Frontend: http://localhost:8080
- Backend API: http://localhost:3000
- RabbitMQ Management: http://localhost:15672 (user/password)

### 3. Stop all services

```bash
docker-compose down
```

### 4. Stop and remove volumes (clean slate)

```bash
docker-compose down -v
```

## Useful Commands

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f worker
```

### Rebuild specific service

```bash
docker-compose up --build backend
```

### Execute commands in running container

```bash
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres -d userdb
```

## Troubleshooting

### Port already in use

If you see "port is already allocated", stop the conflicting service or change ports in docker-compose.yml

### Database connection issues

Wait for PostgreSQL to be fully ready (check logs: `docker-compose logs postgres`)

### Frontend can't connect to Backend

Make sure Backend is running and healthy: `docker-compose ps`
