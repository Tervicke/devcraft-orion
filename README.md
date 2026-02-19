
# devcraft-orion

Real-time auction engine powered by Kafka and MySQL/MariaDB.

---

# Architecture Overview

## 🐂 Taurus (Backend API)

Taurus is the core backend service responsible for authentication, auction management, and bid processing.

### Endpoints

- `GET /ping`  
  Health check endpoint.

- `POST /register`  
  Creates a new user in MySQL and sets a session cookie.

- `POST /login`  
  Validates user credentials and sets a session cookie.

- `GET /dashboard`  
  Authenticated endpoint that verifies the session.

- `POST /create`  
  Authenticated. Creates a new auction and inserts the initial bid inside a database transaction.

- `GET /api/auction/:id`  
  Returns auction details including:
  - Computed `currentPrice`
  - `endTime` formatted in RFC3339

- `POST /bid`  
  Authenticated.  
  - Validates bid amount  
  - Inserts bid into database  
  - Emits a bid event via WebSocket and Kafka  

---

## 🐟 Pisces (Gateway Service)

Pisces acts as a lightweight real-time gateway.

### Responsibilities

- **Kafka Consumer**
  - Subscribes to topic: `bids`

- **WebSocket Server**
  - `GET /ws` upgrades the connection
  - Adds clients to a broadcast hub

### Behavior

Every Kafka message received is broadcast to all connected WebSocket clients.

---

## 🦁 Leo (Frontend)

Leo is the client application.

### Tech Stack

- **React + TypeScript + Vite**  
  Fast, modern frontend development stack.

- **TailwindCSS**  
  Utility-first styling.

- **Radix UI**  
  Accessible, unstyled component primitives.

- **Bun**  
  Snappy runtime engine that does everything.

---

# Prerequisites

Install:

- Docker
- MySQL or MariaDB

Required ports:

- `9092` → Kafka
- `3306` → MySQL/MariaDB

---

# Kafka Setup (Docker)

## 1. Pull Kafka Image

```bash
docker pull apache/kafka:4.2.0
````

## 2. Run Kafka

```bash
docker run -d \
  --name kafka \
  -p 9092:9092 \
  apache/kafka:4.2.0
```

## 3. Create the `bids` Topic

Enter the container:

```bash
docker exec -it kafka bash
```

Create topic:

```bash
/opt/kafka/bin/kafka-topics.sh \
  --create \
  --topic bids \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1
```

Verify topic:

```bash
/opt/kafka/bin/kafka-topics.sh \
  --list \
  --bootstrap-server localhost:9092
```

---

# Database Setup (MySQL / MariaDB)

## 1. Install MySQL or MariaDB

Use your system package manager.

---

## 2. Start the Database Service

```bash
sudo systemctl enable --now mariadb
sudo systemctl start mariadb
sudo systemctl status mariadb
```

(Replace `mariadb` with `mysql` if using MySQL.)

---

## 3. Create the Database

Login:

```bash
mysql -u root -p
```

Inside MySQL:

```sql
CREATE DATABASE auction_engine;
SHOW DATABASES;
EXIT;
```

---

## 4. Import the Schema

From the project root:

```bash
mysql -u root -p auction_engine < schema.sql
```

---

## 5. Create Application User

Login as root:

```bash
mysql -u root -p
```

Then run:

```sql
CREATE USER 'user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON auction_engine.* TO 'user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

# Environment Configuration

Create a `.env` file in the project root:

```
DB_DSN=user:password@tcp(127.0.0.1:3306)/auction_engine?parseTime=true
```

Replace:

* `user` → database user
* `password` → database password
* `3306` → database port (default 3306)

Do not include brackets.
Do not commit `.env` to version control.

---

Good. Now we move from “nice architecture diagram” to “actually runnable system.” Revolutionary concept.

You’ve got:

* `tauras/` → Go backend API
* `Pisces/` → Go Kafka + WebSocket gateway
* `leo/` → Bun + Vite frontend

Here’s the section you append to your main `README.md`.

---

# Running the Services

Make sure Kafka and the database are already running before starting the services.

---

# 🐂 Start Taurus (Backend API)

Taurus is the core backend (Go).

## 1. Navigate to tauras

```bash
cd tauras
````

## 2. Install dependencies

```bash
go mod tidy
```

## 3. Run the server

```bash
go run main.go
```

By default, Taurus should start on:

```
http://localhost:8080
```

---

# 🐟 Start Pisces (Gateway Service)

Pisces consumes Kafka and broadcasts over WebSockets.

## 1. Navigate to Pisces

```bash
cd Pisces
```

## 2. Install dependencies

```bash
go mod tidy
```

## 3. Run the service

```bash
go run main.go
```

Pisces exposes:

```
GET /ws
```

WebSocket clients connect to:

```
ws://localhost:<pisces-port>/ws
```

Make sure Kafka is running before starting Pisces.

---

# 🦁 Start Leo (Frontend)

Leo is built with Bun + Vite.

## 1. Navigate to leo

```bash
cd leo
```

## 2. Install dependencies

```bash
bun install
```

## 3. Start development server

```bash
bun run dev
```

Frontend will be available at:

```
http://localhost:5173
```
