const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

/**
 * 🔒 SECURITY FIX P0-03: Socket.IO Server with Authentication & Tenant Isolation
 * 
 * CRITICAL CHANGES:
 * - Authentication middleware validates JWT on handshake
 * - businessId extracted from authenticated user (not client)
 * - Auto-join to authenticated business room only
 * - No client-controlled room selection
 * - Connection rate limiting preparation
 * - Structured security logging
 * 
 * ATTACK PREVENTION:
 * - Real-time espionage on other businesses
 * - PII/financial data leakage
 * - Cross-tenant order/payment exposure
 */

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// ─── SECURITY: Production fail-fast for critical secrets ──────────────
if (!dev) {
  const REQUIRED_SECRETS = [
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
  ];
  const RECOMMENDED_SECRETS = [
    'CUSTOMER_DEVICE_HMAC_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ];

  const missing = REQUIRED_SECRETS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
    console.error('   Server cannot start without these secrets.');
    process.exit(1);
  }

  // Check for placeholder/weak NEXTAUTH_SECRET
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && (secret.length < 32 || secret === 'changeme' || secret === 'secret')) {
    console.error('❌ FATAL: NEXTAUTH_SECRET is too short or a placeholder value.');
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED_SECRETS.filter(key => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(`⚠️  WARNING: Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
}

// Render ve benzeri platform'larda hostname "0.0.0.0" olmalı
const hostname = dev ? "localhost" : "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // ─── CORS: production'da YALNIZ NEXT_PUBLIC_APP_URL'yi kullan ──────────────
  // ✅ SECURITY: localhost origin production'da dahil edilmez
  const allowedOrigins = dev
    ? ["http://localhost:3000", ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : [])]
    : process.env.NEXT_PUBLIC_APP_URL
      ? [process.env.NEXT_PUBLIC_APP_URL]
      : [];

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

  // ✅ P0-03 FIX: Authentication middleware
  // This runs BEFORE any socket events, validating JWT and user
  io.use(async (socket, next) => {
    try {
      // Import authentication middleware (dynamic to avoid circular deps)
      const { authenticateSocket } = require("./src/lib/socket-auth.ts");
      await authenticateSocket(socket, next);
    } catch (error) {
      console.error("[Socket] Middleware error:", error);
      const err = new Error("Internal authentication error");
      err.data = { code: "AUTH_MIDDLEWARE_ERROR" };
      next(err);
    }
  });

  io.on("connection", (socket) => {
    // ✅ At this point, socket is authenticated
    // socket.data contains: { userId, businessId, role, email, authenticatedAt }
    
    const authData = socket.data;
    
    if (dev) {
      console.log(`[Socket.IO] ✅ Authenticated connection: ${socket.id}`);
      console.log(`  User: ${authData.email} (${authData.role})`);
      console.log(`  Business: ${authData.businessId}`);
    }

    // ✅ P0-03 FIX: Auto-join to authenticated business room
    // businessId comes from JWT, NOT from client
    const businessRoom = `business_${authData.businessId}`;
    socket.join(businessRoom);
    
    if (dev) {
      console.log(`[Socket.IO] ${socket.id} auto-joined room: ${businessRoom}`);
    }

    // Confirm room join to client
    socket.emit("room_joined", { 
      room: businessRoom,
      businessId: authData.businessId,
      // ❌ DO NOT send sensitive user data
    });

    // ✅ TODO: Track active connections per business for monitoring
    // ✅ TODO: Emit presence events (user online/offline)

    // ─── REMOVED: Client-controlled join_business event ─────────────
    // ❌ OLD CODE (VULNERABILITY):
    // socket.on("join_business", (businessId) => {
    //   socket.join(`business_${businessId}`); // ❌ Client chooses room!
    // });
    //
    // ✅ NEW: Server determines room from authentication

    // ─── REMOVED: Client-controlled leave_business event ─────────────
    // Users cannot leave their own business room
    // They can only disconnect entirely

    // ─── Bağlantı koptuğunda ─────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      if (dev) {
        console.log(`[Socket.IO] ${socket.id} disconnected: ${reason}`);
        console.log(`  User: ${authData.email}`);
      }
      
      // ✅ TODO: Audit log disconnection
      // ✅ TODO: Update user presence status
    });

    // ─── Hata yakalama ───────────────────────────────────────────────
    socket.on("error", (err) => {
      console.error(`[Socket.IO] Socket error ${socket.id}:`, {
        error: err.message,
        code: err.code,
        userId: authData.userId,
        businessId: authData.businessId,
        // ❌ DO NOT log tokens or sensitive data
      });
    });

    // ✅ TODO: Add additional event handlers with proper authorization
    // Example: socket.on("custom_event", (data) => { /* validate & process */ });
  });

  // ─── Connection error handling ───────────────────────────────────────
  io.engine.on("connection_error", (err) => {
    console.error("[Socket.IO] Connection error:", {
      code: err.code,
      message: err.message,
      context: err.context,
      // ❌ DO NOT log full error stack in production
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
      console.log(`> Socket.IO server active with authentication`);
      
      // ✅ Production readiness checks (non-fatal at this point — fatal checks are above)
      if (!dev) {
        console.log('🔒 Production security checks passed');
        console.log(`   CORS origins: ${allowedOrigins.join(', ') || '(none — all origins blocked!)')}`); 
      }
    });
});
