const express = require("express");
const http = require("http");
const session = require("express-session");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const { Server } = require("socket.io");
const client = require("prom-client");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "chat_user",
  password: process.env.DB_PASSWORD || "ChatDb_Strong_2026!",
  database: process.env.DB_NAME || "chat_db"
});

client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode
    });
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "change_this_session_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" }
});
app.use(sessionMiddleware);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: "Username and password (>=6 chars) are required" });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users(username, password_hash) VALUES($1, $2) RETURNING id, username",
      [username.trim(), hash]
    );
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Username already exists" });
    console.error("register error", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  req.session.user = { id: user.id, username: user.username };
  res.json({ ok: true, user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get("/api/users", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, username, created_at FROM users WHERE id <> $1 ORDER BY username",
    [req.session.user.id]
  );
  res.json(result.rows);
});

app.get("/api/messages/:userId", requireAuth, async (req, res) => {
  const otherId = Number(req.params.userId);
  const me = req.session.user.id;
  const result = await pool.query(
    `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.created_at,
            s.username AS sender_name, r.username AS receiver_name
     FROM messages m
     JOIN users s ON s.id=m.sender_id
     JOIN users r ON r.id=m.receiver_id
     WHERE (m.sender_id=$1 AND m.receiver_id=$2)
        OR (m.sender_id=$2 AND m.receiver_id=$1)
     ORDER BY m.created_at ASC`,
    [me, otherId]
  );
  res.json(result.rows);
});

io.engine.use(sessionMiddleware);

io.on("connection", (socket) => {
  const user = socket.request.session.user;
  if (!user) {
    socket.disconnect(true);
    return;
  }
  socket.join(`user:${user.id}`);
  console.log(`socket connected user=${user.username}`);

  socket.on("chat:send", async (payload, ack) => {
    try {
      const receiverId = Number(payload.receiverId);
      const content = String(payload.content || "").trim();
      if (!receiverId || !content) return ack && ack({ ok: false, error: "Invalid message" });

      const result = await pool.query(
        `INSERT INTO messages(sender_id, receiver_id, content)
         VALUES($1, $2, $3)
         RETURNING id, sender_id, receiver_id, content, created_at`,
        [user.id, receiverId, content]
      );

      const msg = { ...result.rows[0], sender_name: user.username };
      io.to(`user:${user.id}`).emit("chat:message", msg);
      io.to(`user:${receiverId}`).emit("chat:message", msg);
      console.log(`message sender=${user.id} receiver=${receiverId}`);
      ack && ack({ ok: true });
    } catch (err) {
      console.error("chat send error", err);
      ack && ack({ ok: false, error: "Server error" });
    }
  });
});

async function start() {
  try {
    await pool.query("SELECT 1");
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Chat app listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect DB", err);
    process.exit(1);
  }
}

start();
