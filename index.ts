import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import memorystore from "memorystore";
import { registerRoutes } from "./routes";

// Logger
const log = (...args: any[]) => console.log("[LOG]", ...args);

const app = express();
const MemoryStore = memorystore(session);

// ✅ Shared session middleware
const sessionMiddleware = session({
  name: 'fut.draft.sid',
  store: new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  }),
  secret: process.env.SESSION_SECRET || "super-secret-key",
  resave: false,
  saveUninitialized: false,
 cookie: {
  secure: process.env.NODE_ENV === "production", // ✅ true on Netlify
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // ✅ none for cross-site, lax for local
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
}
});

// ✅ Apply session + CORS + parsers
app.use(sessionMiddleware);

app.use(cors({
  origin: "https://fut-x.netlify.app", // frontend origin
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Health check
app.get("/", (_req: Request, res: Response) => {
  res.send("FutX API is up and running!");
});

// ✅ Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

// ✅ Register routes and WebSocket using sessionMiddleware
(async () => {
  const server = await registerRoutes(app, sessionMiddleware);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  const port = process.env.PORT || 5000;
  server.listen({
    port: +port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`API server running on port ${port}`);
  });
})();
