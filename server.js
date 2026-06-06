const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// Render ve benzeri platform'larda hostname "0.0.0.0" olmalı
const hostname = dev ? "localhost" : "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // ─── CORS: production'da NEXT_PUBLIC_APP_URL'yi kullan ──────────────
  const allowedOrigins = process.env.NEXT_PUBLIC_APP_URL
    ? [process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"]
    : ["http://localhost:3000"];

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Vercel/serverless'ta websocket yoktur; Render'da longpolling fallback yeterli
    transports: ["websocket", "polling"],
    // Bağlantı kesilince ping/pong ile 30sn'de anla
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // ─── Global io instance — API route'larından erişim ─────────────────
  global.__socketIO = io;

  io.on("connection", (socket) => {
    if (dev) {
      console.log(`[Socket.IO] Client connected: ${socket.id}`);
    }

    // ─── İşletme odasına katıl ───────────────────────────────────────
    socket.on("join_business", (businessId) => {
      if (
        !businessId ||
        typeof businessId !== "string" ||
        businessId.trim() === "" ||
        businessId.length > 100 // aşırı uzun id'leri reddet
      ) {
        console.warn(`[Socket.IO] Invalid join_business from ${socket.id}`);
        return;
      }

      const room = `business_${businessId.trim()}`;

      // Bir socket aynı anda birden fazla işletme odasında olamaz
      // Önce tüm business_ odalarından çıkar
      socket.rooms.forEach((r) => {
        if (r.startsWith("business_") && r !== room) {
          socket.leave(r);
        }
      });

      socket.join(room);
      if (dev) {
        console.log(`[Socket.IO] ${socket.id} joined room: ${room}`);
      }
      // Katılım onayı
      socket.emit("room_joined", { room, businessId: businessId.trim() });
    });

    // ─── İşletme odasından ayrıl ─────────────────────────────────────
    socket.on("leave_business", (businessId) => {
      if (!businessId || typeof businessId !== "string") return;
      const room = `business_${businessId.trim()}`;
      socket.leave(room);
    });

    // ─── Bağlantı koptuğunda ─────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      if (dev) {
        console.log(`[Socket.IO] ${socket.id} disconnected: ${reason}`);
      }
    });

    // ─── Hata yakalama ───────────────────────────────────────────────
    socket.on("error", (err) => {
      console.error(`[Socket.IO] Socket error ${socket.id}:`, err);
    });
  });

  // ─── Server başlat ───────────────────────────────────────────────────
  httpServer
    .once("error", (err) => {
      console.error("[Server] HTTP server error:", err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port} [${process.env.NODE_ENV || "development"}]`);
      console.log(`> Socket.IO server active`);
    });
});
