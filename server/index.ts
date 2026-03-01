import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import fs from "fs";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
// Serve uploaded assets
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.locals.apiMetrics = {
  totalRequests: 0,
  totalApiRequests: 0,
  totalApiErrors: 0,
  avgApiLatencyMs: 0,
  byPath: {} as Record<string, { count: number; errors: number; avgLatencyMs: number }>,
};

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader("X-Request-Id", requestId);

  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const metrics = app.locals.apiMetrics;
    metrics.totalRequests += 1;
    if (path.startsWith("/api")) {
      metrics.totalApiRequests += 1;
      if (res.statusCode >= 400) metrics.totalApiErrors += 1;

      const nextTotal = metrics.totalApiRequests;
      metrics.avgApiLatencyMs =
        Math.round(((metrics.avgApiLatencyMs * (nextTotal - 1) + duration) / nextTotal) * 100) / 100;

      const byPath = metrics.byPath[path] || { count: 0, errors: 0, avgLatencyMs: 0 };
      const nextCount = byPath.count + 1;
      byPath.count = nextCount;
      if (res.statusCode >= 400) byPath.errors += 1;
      byPath.avgLatencyMs = Math.round(((byPath.avgLatencyMs * (nextCount - 1) + duration) / nextCount) * 100) / 100;
      metrics.byPath[path] = byPath;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error("[express:error]", err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "127.0.0.1";
  httpServer.listen(
    {
      port,
      host,
      // reusePort can be unsupported on some local setups; omit for safety
    },
    () => {
      log(`serving on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
    },
  );
})();
