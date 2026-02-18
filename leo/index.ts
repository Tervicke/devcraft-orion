import { createPool, type Pool } from "mariadb";

const PORT = Number(Bun.env.PORT ?? 3000);
const FRONTEND_ORIGIN = Bun.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

const dbPool: Pool = createPool({
  host: Bun.env.DB_HOST ?? "localhost",
  port: Bun.env.DB_PORT ? Number(Bun.env.DB_PORT) : 3306,
  user: Bun.env.DB_USER ?? "root",
  password: Bun.env.DB_PASSWORD ?? "",
  database: Bun.env.DB_NAME ?? "auc",
  connectionLimit: 5,
});

type Session = {
  userId: number;
};

const sessions = new Map<string, Session>();

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function buildCorsHeaders(extra: Record<string, string> = {}): Headers {
  const headers = new Headers(extra);
  headers.set("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return headers;
}


function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
  setCookie?: string,
): Response {
  const headers = buildCorsHeaders({
    "Content-Type": "application/json",
  });
  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers,
  });
}

function textResponse(
  text: string,
  init: ResponseInit = {},
  setCookie?: string,
): Response {
  const headers = buildCorsHeaders({
    "Content-Type": "text/plain; charset=utf-8",
  });
  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }
  return new Response(text, {
    status: init.status ?? 200,
    headers,
  });
}

function parseSessionCookie(request: Request): Session | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const parts = cookie.split(";").map((p) => p.trim());
  const sessionPart = parts.find((p) => p.startsWith("session="));
  if (!sessionPart) return null;
  const token = sessionPart.split("=")[1];
  if (!token) return null;
  const session = sessions.get(token);
  return session ?? null;
}

function createSession(userId: number): string {
  const token = crypto.randomUUID();
  sessions.set(token, { userId });
  return token;
}

function buildSessionCookie(token: string): string {
  // Simple in-memory session cookie; expires when browser closes.
  return `session=${token}; HttpOnly; Path=/; SameSite=Lax`;
}

async function handleRegister(request: Request): Promise<Response> {
  type Body = { email?: string; password?: string };
  const body = await parseJsonBody<Body>(request);
  if (!body?.email || !body?.password) {
    return jsonResponse(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const { email, password } = body;

  const conn = await dbPool.getConnection();
  try {
    const existing = await conn.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    if (existing.length > 0) {
      return jsonResponse(
        { error: "User with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    const result = await conn.query(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      [email, passwordHash],
    );

    const userId = Number(result.insertId);
    const token = createSession(userId);
    const cookie = buildSessionCookie(token);

    return jsonResponse(
      { id: userId, email },
      { status: 201 },
      cookie,
    );
  } catch (err) {
    console.error("Error in /register:", err);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  } finally {
    conn.release();
  }
}

async function handleLogin(request: Request): Promise<Response> {
  type Body = { email?: string; password?: string };
  const body = await parseJsonBody<Body>(request);
  if (!body?.email || !body?.password) {
    return jsonResponse(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const { email, password } = body;

  const conn = await dbPool.getConnection();
  try {
    const rows = await conn.query(
      "SELECT id, password_hash FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (rows.length === 0) {
      return jsonResponse({ error: "Invalid email or password" }, { status: 401 });
    }

    const user = rows[0] as { id: number; password_hash: string };

    const valid = await Bun.password.verify(password, user.password_hash);
    if (!valid) {
      return jsonResponse({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = createSession(user.id);
    const cookie = buildSessionCookie(token);

    return jsonResponse(
      { id: user.id, email },
      { status: 200 },
      cookie,
    );
  } catch (err) {
    console.error("Error in /login:", err);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  } finally {
    conn.release();
  }
}

async function handleDashboard(request: Request): Promise<Response> {
  const session = parseSessionCookie(request);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  return jsonResponse({
    message: "Dashboard data placeholder",
    userId: session.userId,
  });
}

async function handleCreateAuction(request: Request): Promise<Response> {
  const session = parseSessionCookie(request);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  type Body = {
    item?: string;
    startingPrice?: number;
    image?: string;
    endTime?: string;
  };

  const body = await parseJsonBody<Body>(request);
  if (!body?.item || body.startingPrice === undefined || !body.endTime) {
    return jsonResponse(
      { error: "Item, starting price, and end time are required" },
      { status: 400 },
    );
  }

  const { item, startingPrice, image, endTime } = body;

  const conn = await dbPool.getConnection();
  try {
    const result = await conn.query(
      "INSERT INTO auctions (user_id, item, starting_price, image_url, end_time) VALUES (?, ?, ?, ?, ?)",
      [session.userId, item, startingPrice, image ?? null, new Date(endTime)],
    );

    const auctionId = Number(result.insertId);
    return jsonResponse({ auctionId }, { status: 201 });
  } catch (err) {
    console.error("Error in /create:", err);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  } finally {
    conn.release();
  }
}

async function handleGetAuction(request: Request, id: string): Promise<Response> {
  const conn = await dbPool.getConnection();
  try {
    const rows = await conn.query(
      "SELECT id, item, starting_price, image_url, end_time FROM auctions WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      return jsonResponse({ error: "Auction not found" }, { status: 404 });
    }

    const auction = rows[0] as {
      id: number;
      item: string;
      starting_price: number;
      image_url: string | null;
      end_time: Date;
    };
    return jsonResponse({
      id: auction.id,
      item: auction.item,
      startingPrice: Number(auction.starting_price),
      imageUrl: auction.image_url,
      endTime: new Date(auction.end_time).toISOString(),
    });
  } catch (err) {
    console.error("Error in /api/auction/:id:", err);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  } finally {
    conn.release();
  }
}

const server = Bun.serve<{ auctionId: string }>({
  port: PORT,
  async fetch(request, server) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(),
      });
    }

    if (request.method === "POST" && url.pathname === "/register") {
      return handleRegister(request);
    }

    if (request.method === "POST" && url.pathname === "/login") {
      return handleLogin(request);
    }

    if (request.method === "GET" && url.pathname === "/dashboard") {
      return handleDashboard(request);
    }

    if (request.method === "POST" && url.pathname === "/create") {
      return handleCreateAuction(request);
    }

    const auctionMatch = url.pathname.match(/^\/api\/auction\/(\d+)$/);
    if (request.method === "GET" && auctionMatch) {
      return handleGetAuction(request, auctionMatch[1]!);
    }

    if (url.pathname.startsWith("/auction/")) {
      const session = parseSessionCookie(request);
      if (!session) {
        return textResponse("Unauthorized", { status: 401 });
      }

      if (
        server.upgrade(request, {
          data: { auctionId: url.pathname.split("/")[2]! },
        })
      ) {
        return undefined as unknown as Response;
      }
      return textResponse("WebSocket upgrade failed", { status: 400 });
    }

    return textResponse("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      const { auctionId } = ws.data as { auctionId?: string };
      console.log("WebSocket connected for auction", auctionId);
    },
    message(ws, message) {
      // Placeholder: broadcast incoming messages to all clients in this auction.
      ws.send(message);
    },
    close(ws) {
      const { auctionId } = ws.data as { auctionId?: string };
      console.log("WebSocket closed for auction", auctionId);
    },
  },
});

console.log(`Auction backend running on http://localhost:${PORT}`);
