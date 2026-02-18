# auc

Live auction demo built with Bun, React, MariaDB, and simple WebSocket-based rooms.

## 1. Install dependencies

From the project root:

```bash
bun install
cd frontend
bun install
```

## 2. Set up the database (MariaDB)

1. Log into MariaDB as a user with permission to create databases:

   ```bash
   mariadb -u root -p
   ```

2. Run the schema script from the project root:

   ```bash
   mariadb -u root -p < schema.sql
   ```

   This will:

   - Create a database called `auc` (if it does not exist).
   - Create `users` and `auctions` tables.

3. Create or grant a DB user for the app (example uses `user` / `password`):

   ```sql
   CREATE USER IF NOT EXISTS 'user'@'localhost' IDENTIFIED BY 'password';
   GRANT ALL PRIVILEGES ON auc.* TO 'user'@'localhost';
   FLUSH PRIVILEGES;
   ```

## 3. Configure environment variables

Create a `.env` file in the project root (already present if you followed earlier steps) with values matching your MariaDB setup:

```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=user
DB_PASSWORD=password
DB_NAME=auc

FRONTEND_ORIGIN=http://localhost:5173
PORT=3000
```

`FRONTEND_ORIGIN` should match the origin where your frontend dev server is running (by default Vite uses `http://localhost:5173`).

### Frontend API base URL

The frontend talks to the backend via a shared API base URL:

- Default value is configured in `frontend/src/config/api.ts`.
- You can override it with `VITE_API_BASE` in a `frontend/.env` file if you prefer.

Example `frontend/.env`:

```bash
VITE_API_BASE=http://localhost:3000
```

## 4. Run the backend

From the project root:

```bash
bun run index.ts
```

The backend will listen on `http://localhost:3000`.

## 5. Run the frontend

From the `frontend` directory:

```bash
cd frontend
bun dev
```

Open `http://localhost:5173` in your browser to access the app.

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

