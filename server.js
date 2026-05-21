const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Socket.IO instance'ını global olarak ayarla
  // API route'larından erişilebilir olması için
  global.__socketIO = io;

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // İşletme odasına katıl - sadece businessId kabul edilir
    socket.on("join_business", (businessId) => {
      // Basit validasyon - businessId string ve boş değil
      if (!businessId || typeof businessId !== "string" || businessId.trim() === "") {
        console.warn(`[Socket.IO] Invalid businessId from ${socket.id}`);
        return;
      }
      
      const room = `business_${businessId}`;
      socket.join(room);
      console.log(`[Socket.IO] ${socket.id} joined room: ${room}`);
    });

    // İşletme odasından ayrıl
    socket.on("leave_business", (businessId) => {
      if (!businessId || typeof businessId !== "string") {
        return;
      }
      
      const room = `business_${businessId}`;
      socket.leave(room);
      console.log(`[Socket.IO] ${socket.id} left room: ${room}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running`);
    });
});
