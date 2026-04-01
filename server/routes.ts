import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { pool } from "./db";
import { 
  tradeInWizardSchema, 
  tradeInReviewSchema,
  type ConditionOption,
  type User,
} from "@shared/schema";
import { 
  validateIMEI, 
  processTradeIn,
  DEFAULT_CONDITION_QUESTIONS,
  DEFAULT_BASE_VALUES,
} from "./trade-in-scoring";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { handleUpload } from "./uploads";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: User["role"];
    shopId?: string | null;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    currentUser?: User;
  }
}

const PgSession = connectPgSimple(session);
const hashIterations = 120000;
const sessionCookieName = "connect.sid";

function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(secret, salt, hashIterations, 64, "sha512").toString("hex");
  return `pbkdf2:${hashIterations}:${salt}:${derived}`;
}

function verifySecret(secret: string, stored: string | null): boolean {
  if (!stored || !stored.startsWith("pbkdf2:")) return false;
  const [, iterStr, salt, storedHash] = stored.split(":");
  const derived = pbkdf2Sync(secret, salt, parseInt(iterStr, 10), 64, "sha512").toString("hex");
  try {
    return timingSafeEqual(Buffer.from(storedHash), Buffer.from(derived));
  } catch {
    return false;
  }
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
  };
}

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  secret: z.string().min(4, "PIN/Password required"),
});

const staffSchema = z.object({
  username: z.string().min(3),
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(["Owner", "Manager", "Sales"]),
  shopId: z.string().optional(),
  pin: z.string().min(4).max(12),
  status: z.enum(["active", "disabled"]).default("active"),
});

const baseValueUpsertSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  storage: z.string().min(1),
  baseValue: z.number().positive(),
  shopId: z.string().optional(),
  isActive: z.boolean().optional(),
});

const bootstrapOwnerSchema = z.object({
  username: z.string().min(3).max(64),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(12)
    .regex(/[A-Z]/, "Password must include uppercase")
    .regex(/[a-z]/, "Password must include lowercase")
    .regex(/[0-9]/, "Password must include number")
    .regex(/[^A-Za-z0-9]/, "Password must include symbol"),
});

const preferenceUpdateSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  currency: z.string().min(3).max(8).optional(),
  dateFormat: z.string().min(2).max(24).optional(),
  timezone: z.string().min(2).max(80).optional(),
  defaultBranchId: z.string().nullable().optional(),
  sidebarCollapsed: z.boolean().optional(),
  density: z.enum(["compact", "comfortable"]).optional(),
  dashboardLayout: z.any().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

const customerCreateSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  shopId: z.string().optional(),
});

const deviceCreateSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  imei: z.string().min(10, "IMEI is required"),
  color: z.string().min(1, "Color is required"),
  storage: z.string().min(1, "Storage is required"),
  condition: z.enum(["New", "Used", "Refurbished"]),
  status: z.enum(["In Stock", "Sold", "Repaired"]).optional(),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  warrantyPeriod: z.number().int().nonnegative().optional(),
  warrantyExpiresAt: z.string().datetime().optional().or(z.literal("")),
  shopId: z.string().optional(),
});

const saleCreateSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      productId: z.string().optional(),
      deviceId: z.string().optional(),
      name: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      totalPrice: z.number().nonnegative(),
    })
  ).min(1, "At least one sale item is required"),
  totalAmount: z.number().nonnegative(),
  paymentMethod: z.enum(["Cash", "MTN", "Airtel", "Card"]),
  status: z.enum(["Completed", "Refunded"]).default("Completed"),
  soldBy: z.string().min(1),
  shopId: z.string().optional(),
});

const repairCreateSchema = z.object({
  deviceBrand: z.string().min(1, "Device brand is required"),
  deviceModel: z.string().min(1, "Device model is required"),
  imei: z.string().min(3, "IMEI or serial is required"),
  issueDescription: z.string().min(3, "Issue description is required"),
  repairType: z.string().min(1, "Repair type is required"),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  technician: z.string().optional(),
  status: z.enum(["Pending", "In Progress", "Completed", "Delivered"]).optional(),
  shopId: z.string().optional(),
});

const repairStatusUpdateSchema = z.object({
  status: z.enum(["Pending", "In Progress", "Completed", "Delivered"]),
});

const expenseCreateSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive(),
  paymentMethod: z.enum(["Cash", "MTN", "Airtel", "Card"]).optional(),
  date: z.string().datetime().optional().or(z.literal("")),
  recordedBy: z.string().min(1).optional(),
  shopId: z.string().optional(),
});

const closurePayloadSchema = z.object({
  cashExpected: z.number().nonnegative(),
  cashCounted: z.number().nonnegative(),
  mtnAmount: z.number().nonnegative(),
  airtelAmount: z.number().nonnegative(),
  cardAmount: z.number().nonnegative(),
  expensesTotal: z.number().nonnegative(),
  variance: z.number(),
  submittedBy: z.string().min(1),
  status: z.enum(["pending", "confirmed", "flagged"]),
  proofs: z.object({
    cashDrawer: z.string().optional(),
    mtn: z.string().optional(),
    airtel: z.string().optional(),
    card: z.string().optional(),
  }).optional(),
  shopId: z.string().optional(),
  sales: z.array(z.any()).optional(),
  repairs: z.array(z.any()).optional(),
});

const closureStatusUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "flagged"]),
});

const storefrontCartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const orderCreateSchema = z.object({
  shopId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(10),
  customerEmail: z.string().email().optional().or(z.literal("")),
  items: z.array(storefrontCartItemSchema).min(1),
  deliveryType: z.enum(["PICKUP", "KAMPALA", "UPCOUNTRY"]),
  deliveryAddress: z.string().optional(),
  deliveryFee: z.number().int().nonnegative().default(0),
  paymentMethod: z.enum(["MTN_MOMO", "AIRTEL_MONEY", "CASH_ON_DELIVERY", "PAY_AT_STORE"]),
  paymentStatus: z.enum(["PENDING", "PAID", "PARTIAL"]).default("PENDING"),
  channel: z.enum(["ONLINE", "POS"]).default("ONLINE"),
  notes: z.string().optional(),
  assignedStaffId: z.string().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"]).default("PENDING"),
});

const orderStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"]),
  paymentStatus: z.enum(["PENDING", "PAID", "PARTIAL"]).optional(),
  assignedStaffId: z.string().optional(),
  notes: z.string().optional(),
});

const deliveryStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"]),
  failureReason: z.string().optional(),
  notes: z.string().optional(),
});

const deliveryAssignSchema = z.object({
  assignedRiderId: z.string().min(1),
  scheduledAt: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().optional(),
});

const notificationReadSchema = z.object({
  read: z.boolean().default(true),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toEastAfricaDate(input?: string | Date | null) {
  if (!input) return null;
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Kampala",
  }).format(date);
}

function formatUGX(amount: number) {
  return `${Math.round(amount).toLocaleString("en-US")} UGX`;
}

function normalizeUgPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("256")) return `+${digits}`;
  if (digits.startsWith("0")) return `+256${digits.slice(1)}`;
  if (digits.length === 9) return `+256${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

function sanitizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function allowedOriginsFromEnv() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

type LoginWindow = { count: number; firstAttemptTs: number };
const loginAttempts = new Map<string, LoginWindow>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

type RateLimitWindow = { count: number; firstTs: number };
const writeRateLimits = new Map<string, RateLimitWindow>();
const WRITE_LIMIT_WINDOW_MS = 60 * 1000;
const WRITE_LIMIT_MAX = 120;

const idempotencyCache = new Map<string, { status: number; payload: unknown; storedAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Railway and similar hosts sit behind reverse proxies.
  // Trust proxy headers so session/cookie handling works correctly.
  app.set("trust proxy", true);

  app.get("/healthz", async (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "ariostore-gadgets",
      time: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
    });
  });

  app.get("/readyz", async (_req: Request, res: Response) => {
    try {
      if (pool) {
        await pool.query("select 1");
      }

      res.json({
        status: "ready",
        database: pool ? "connected" : "sqlite-fallback",
        time: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: "not_ready",
        database: "unreachable",
        message: error instanceof Error ? error.message : "Database connection failed",
      });
    }
  });

  // Ensure session table exists when using Postgres-backed sessions.
  if (pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        sid varchar NOT NULL COLLATE "default",
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        CONSTRAINT user_sessions_pkey PRIMARY KEY (sid)
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON user_sessions (expire);`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL UNIQUE,
        theme text DEFAULT 'system',
        currency text DEFAULT 'UGX',
        date_format text DEFAULT 'PPP',
        timezone text DEFAULT 'UTC',
        default_branch_id varchar,
        sidebar_collapsed boolean DEFAULT false,
        density text DEFAULT 'comfortable',
        dashboard_layout jsonb,
        accent_color text,
        created_at timestamp(6) DEFAULT now(),
        updated_at timestamp(6) DEFAULT now()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_user_preferences_user_id" ON user_preferences (user_id);`);
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS description text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS condition text DEFAULT 'New';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS ram text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS storage text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS specs jsonb;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_flash_deal boolean DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_deal_price integer;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_deal_ends_at timestamp(6);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS popularity integer DEFAULT 0;
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_products_slug" ON products (slug);`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number text NOT NULL UNIQUE,
        shop_id varchar NOT NULL,
        customer_id varchar,
        customer_name text NOT NULL,
        customer_phone text NOT NULL,
        customer_email text,
        subtotal integer NOT NULL DEFAULT 0,
        delivery_fee integer NOT NULL DEFAULT 0,
        total integer NOT NULL DEFAULT 0,
        payment_method text NOT NULL,
        payment_status text NOT NULL DEFAULT 'PENDING',
        channel text NOT NULL DEFAULT 'ONLINE',
        status text NOT NULL DEFAULT 'PENDING',
        delivery_type text NOT NULL,
        delivery_address text,
        assigned_staff_id varchar,
        notes text,
        created_at timestamp(6) DEFAULT now(),
        updated_at timestamp(6) DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id varchar NOT NULL,
        product_id varchar NOT NULL,
        product_name text NOT NULL,
        imei text,
        quantity integer NOT NULL DEFAULT 1,
        unit_price integer NOT NULL DEFAULT 0,
        total integer NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS deliveries (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id varchar NOT NULL UNIQUE,
        assigned_rider_id varchar,
        status text NOT NULL DEFAULT 'PENDING',
        address text NOT NULL,
        scheduled_at timestamp(6),
        picked_up_at timestamp(6),
        delivered_at timestamp(6),
        failure_reason text,
        notes text
      );
      CREATE TABLE IF NOT EXISTS receipts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id varchar NOT NULL,
        pdf_url text,
        sent_via jsonb DEFAULT '[]'::jsonb,
        created_at timestamp(6) DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id varchar NOT NULL,
        type text NOT NULL,
        target_id varchar NOT NULL,
        message text NOT NULL,
        read boolean NOT NULL DEFAULT false,
        created_at timestamp(6) DEFAULT now()
      );
    `);
  }

  if (process.env.NODE_ENV === "production" && !pool) {
    console.warn("[session] No Postgres DATABASE_URL configured; falling back to in-memory sessions.");
  }

  // Choose session store: Postgres-backed when `pool` is available, otherwise in-memory fallback
  const sessionStore = pool
    ? new PgSession({
        pool,
        tableName: "user_sessions",
        // We create the table ourselves above; keep auto-create off for deterministic startup.
        createTableIfMissing: false,
      })
    : new session.MemoryStore();

  const sessionSecret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production"
      ? `render-fallback-${randomBytes(32).toString("hex")}`
      : "dev-only-session-secret");

  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    console.warn("[session] SESSION_SECRET is not set; using an ephemeral fallback secret for this boot.");
  }

  app.use(
    session({
      store: sessionStore,
      proxy: true,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // Default false to avoid dropped cookies behind mis-detected proxies.
        // Set SESSION_COOKIE_SECURE=true in env once proxy+HTTPS behavior is confirmed.
        secure: process.env.SESSION_COOKIE_SECURE === "true",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  const sanitizeUser = (user: User) => {
    if (!user) return null;
    const { password, pin, ...safe } = user;
    return safe;
  };

  const destroySession = async (req: Request, res: Response) => {
    await new Promise<void>((resolve) => {
      if (!req.session) return resolve();
      req.session.destroy(() => resolve());
    });
    res.clearCookie(sessionCookieName, getSessionCookieOptions());
  };

  const sendError = (
    res: Response,
    status: number,
    message: string,
    details?: unknown,
  ) => {
    const payload: Record<string, unknown> = { message };
    if (details !== undefined) payload.details = details;
    return res.status(status).json(payload);
  };

  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!req.currentUser) {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        await destroySession(req, res);
        return res.status(401).json({ message: "Session expired" });
      }
      req.currentUser = user;
    }

    if (req.currentUser.status === "disabled") {
      await destroySession(req, res);
      return res.status(403).json({ message: "Your account has been disabled. Contact an administrator." });
    }

    await storage.touchUserActivity(req.currentUser.id);
    next();
  };

  const requireRole = (roles: Array<User["role"]>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const proceed = () => {
        if (!req.currentUser || !roles.includes(req.currentUser.role as User["role"])) {
          return res.status(403).json({ message: "Forbidden" });
        }
        return next();
      };

      if (!req.currentUser) {
        return requireAuth(req, res, (err?: any) => {
          if (err) return next(err);
          return proceed();
        });
      }

      return proceed();
    };
  };

  const hasOwnerAccount = async () => {
    const existingUsers = await storage.listUsers();
    return existingUsers.some((u) => u.role === "Owner");
  };

  const tooManyLoginAttempts = (identity: string) => {
    const now = Date.now();
    const existing = loginAttempts.get(identity);
    if (!existing) return false;
    if (now - existing.firstAttemptTs > LOGIN_WINDOW_MS) {
      loginAttempts.delete(identity);
      return false;
    }
    return existing.count >= LOGIN_MAX_ATTEMPTS;
  };

  const trackFailedLogin = (identity: string) => {
    const now = Date.now();
    const existing = loginAttempts.get(identity);
    if (!existing || now - existing.firstAttemptTs > LOGIN_WINDOW_MS) {
      loginAttempts.set(identity, { count: 1, firstAttemptTs: now });
      return;
    }
    loginAttempts.set(identity, { ...existing, count: existing.count + 1 });
  };

  const clearFailedLogins = (identity: string) => {
    loginAttempts.delete(identity);
  };

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = allowedOriginsFromEnv();

    if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    }

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    next();
  });

  app.use("/api", (req, res, next) => {
    const method = req.method.toUpperCase();
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) return next();
    const origin = req.headers.origin;
    if (!origin) return next();
    try {
      const originUrl = new URL(origin);
      const host = req.get("host");
      if (host && originUrl.host !== host) {
        return res.status(403).json({ message: "Cross-site request blocked" });
      }
    } catch {
      return res.status(403).json({ message: "Invalid origin" });
    }
    next();
  });

  app.use("/api", (req, res, next) => {
    const method = req.method.toUpperCase();
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) return next();

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${ip}:${method}`;
    const now = Date.now();
    const current = writeRateLimits.get(key);

    if (!current || now - current.firstTs > WRITE_LIMIT_WINDOW_MS) {
      writeRateLimits.set(key, { count: 1, firstTs: now });
      return next();
    }

    if (current.count >= WRITE_LIMIT_MAX) {
      return res.status(429).json({ message: "Too many write requests. Please slow down." });
    }

    writeRateLimits.set(key, { ...current, count: current.count + 1 });
    next();
  });

  app.use("/api", (req, res, next) => {
    const method = req.method.toUpperCase();
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) return next();

    const key = req.headers["x-idempotency-key"]?.toString().trim();
    if (!key) return next();

    const cacheKey = `${method}:${req.path}:${key}`;
    const now = Date.now();

    for (const [storedKey, cached] of Array.from(idempotencyCache.entries())) {
      if (now - cached.storedAt > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(storedKey);
    }

    const cached = idempotencyCache.get(cacheKey);
    if (cached) {
      return res.status(cached.status).json(cached.payload);
    }

    const originalJson = res.json.bind(res);
    res.json = ((payload: unknown) => {
      idempotencyCache.set(cacheKey, { status: res.statusCode || 200, payload, storedAt: Date.now() });
      return originalJson(payload);
    }) as typeof res.json;
    return next();
  });

  // Attach the current user to the request for downstream handlers
  app.use(async (req, _res, next) => {
    if (req.session?.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.currentUser = user;
      }
    }
    next();
  });

  // Require auth for all API routes except auth and store endpoints
  app.use("/api", (req, res, next) => {
    // Allow unauthenticated access to auth bootstrap/login endpoints and public store endpoints.
    if (req.path.startsWith("/auth") || req.path.startsWith("/store")) return next();
    return requireAuth(req, res, next);
  });

  // ===================== UPLOADS =====================
  app.post("/api/uploads", requireRole(["Owner", "Manager"]), handleUpload);

  // ===================== AUTH & STAFF =====================
  app.get("/api/auth/bootstrap-status", async (_req: Request, res: Response) => {
    const ownerExists = await hasOwnerAccount();
    res.json({ ownerExists });
  });

  app.post("/api/auth/bootstrap-owner", async (req: Request, res: Response) => {
    const ownerExists = await hasOwnerAccount();
    if (ownerExists) {
      return res.status(409).json({ message: "Owner account already exists" });
    }

    const parsed = bootstrapOwnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid owner payload", details: parsed.error.errors });
    }

    const payload = parsed.data;
    const existing = await storage.getUserByUsername(payload.username);
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const created = await storage.createUser({
      username: payload.username,
      password: hashSecret(payload.password),
      name: payload.name,
      email: payload.email,
      role: "Owner",
      status: "active",
      shopId: null,
    });

    await storage.upsertUserPreferences(created.id, {
      timezone: "UTC",
      theme: "system",
      density: "comfortable",
      currency: "UGX",
      dateFormat: "PPP",
      sidebarCollapsed: false,
    });

    await storage.createActivityLog({
      action: "owner_bootstrapped",
      entity: "auth",
      entityId: created.id,
      userId: created.id,
      userName: created.name || created.username,
      role: created.role,
      details: "Owner account initialized through secure bootstrap flow",
      metadata: {},
    });

    return res.status(201).json({ user: sanitizeUser(created) });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ownerExists = await hasOwnerAccount();
    if (!ownerExists) {
      return res.status(428).json({ message: "Owner bootstrap required", code: "OWNER_BOOTSTRAP_REQUIRED" });
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const { username, secret } = parsed.data;
    const identityKey = `${req.ip}:${username}`;
    if (tooManyLoginAttempts(identityKey)) {
      return res.status(429).json({ message: "Too many failed attempts. Try again later." });
    }
    const user = await storage.getUserByUsername(username);
    const passwordValid = user ? verifySecret(secret, user.password) : false;
    const legacyPinValid = !!user?.pin && user.pin === secret;
    const secretValid = passwordValid || legacyPinValid;

    if (!user || !secretValid) {
      trackFailedLogin(identityKey);
      return res.status(401).json({ message: "Incorrect username or password." });
    }
    clearFailedLogins(identityKey);

    if (user.status === "disabled") {
      await destroySession(req, res);
      return res.status(403).json({ message: "Your account has been disabled. Contact an administrator." });
    }

    let authenticatedUser = user;
    if (legacyPinValid) {
      const migratedUser = await storage.updateUser(user.id, {
        password: hashSecret(secret),
        pin: null,
      });
      if (migratedUser) {
        authenticatedUser = migratedUser;
      }
    }

    // Regenerate + save explicitly so the cookie/session are durable across redirects/navigation.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.userId = authenticatedUser.id;
    req.session.role = authenticatedUser.role as User["role"];
    req.session.shopId = authenticatedUser.shopId || null;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    await storage.touchUserActivity(authenticatedUser.id, { lastLogin: true });
    await storage.createActivityLog({
      action: "login",
      entity: "auth",
      entityId: authenticatedUser.id,
      userId: authenticatedUser.id,
      userName: authenticatedUser.name || authenticatedUser.username,
      role: authenticatedUser.role,
      details: "User logged in",
      metadata: { shopId: authenticatedUser.shopId, migratedLegacyPin: legacyPinValid || undefined },
      shopId: authenticatedUser.shopId || undefined,
    });

    const preferences = await storage.upsertUserPreferences(authenticatedUser.id, {});
    res.json({ user: sanitizeUser(authenticatedUser), preferences });
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (userId) {
      await storage.createActivityLog({
        action: "logout",
        entity: "auth",
        entityId: userId,
        userId,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: "User logged out",
        metadata: {},
      });
    }
    await destroySession(req, res);
    res.json({ success: true });
  });

  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    const user = req.currentUser!;
    const preferences = await storage.upsertUserPreferences(user.id, {});
    res.json({ user: sanitizeUser(user), preferences });
  });

  app.get("/api/staff", requireRole(["Owner", "Manager"]), async (_req: Request, res: Response) => {
    const staff = await storage.listUsers();
    res.json(staff.map(u => sanitizeUser(u)));
  });

  app.get("/api/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getCustomers(shopId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/devices", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getDevices(shopId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  app.post("/api/devices", requireAuth, async (req: Request, res: Response) => {
    const parsed = deviceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid device payload", details: parsed.error.errors });
    }

    try {
      const payload = parsed.data;
      const created = await storage.createDevice({
        ...payload,
        status: payload.status || "In Stock",
        warrantyExpiresAt: payload.warrantyExpiresAt ? new Date(payload.warrantyExpiresAt) : null,
        shopId: payload.shopId || req.currentUser?.shopId || null,
      });
      await storage.createActivityLog({
        action: "device_created",
        entity: "device",
        entityId: created.id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Created device ${created.brand} ${created.model}`,
        metadata: { imei: created.imei },
        shopId: created.shopId || undefined,
      });
      res.status(201).json(created);
    } catch (error: any) {
      console.error("Error creating device:", error);
      const duplicate = typeof error?.message === "string" && error.message.toLowerCase().includes("unique");
      res.status(duplicate ? 409 : 500).json({
        message: duplicate ? "A device with this IMEI already exists." : "Failed to create device",
      });
    }
  });

  app.post("/api/customers", requireAuth, async (req: Request, res: Response) => {
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid customer payload", details: parsed.error.errors });
    }

    try {
      const payload = parsed.data;
      const created = await storage.createCustomer({
        ...payload,
        email: payload.email || null,
        shopId: payload.shopId || req.currentUser?.shopId || null,
      });
      await storage.createActivityLog({
        action: "customer_created",
        entity: "customer",
        entityId: created.id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Created customer ${created.name}`,
        metadata: { customerId: created.id },
        shopId: created.shopId || undefined,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.get("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getSales(shopId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.post("/api/sales", requireAuth, async (req: Request, res: Response) => {
    const parsed = saleCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid sale payload", details: parsed.error.errors });
    }

    try {
      const payload = parsed.data;
      const computedTotal = payload.items.reduce((sum, item) => sum + item.totalPrice, 0);

      for (const item of payload.items) {
        if (!item.productId) continue;
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(404).json({ message: `Product not found for item ${item.name}` });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({ message: `Not enough stock for ${product.name}` });
        }
      }

      for (const item of payload.items) {
        if (!item.deviceId) continue;
        const device = await storage.getDevice(item.deviceId);
        if (!device) {
          return res.status(404).json({ message: `Device not found for item ${item.name}` });
        }
        if (device.status !== "In Stock") {
          return res.status(400).json({ message: `${device.brand} ${device.model} is not available for sale` });
        }
      }

      const saleNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const created = await storage.createSale({
        saleNumber,
        customerId: payload.customerId || null,
        customerName: payload.customerName || "Walk-in Customer",
        items: payload.items,
        totalAmount: computedTotal,
        paymentMethod: payload.paymentMethod,
        status: payload.status,
        soldBy: payload.soldBy,
        shopId: payload.shopId || req.currentUser?.shopId || null,
      });

      for (const item of payload.items) {
        if (!item.productId) continue;
        const product = await storage.getProduct(item.productId);
        if (!product) continue;
        await storage.updateProduct(product.id, {
          stock: Math.max(0, product.stock - item.quantity),
        });
      }

      for (const item of payload.items) {
        if (!item.deviceId) continue;
        await storage.updateDevice(item.deviceId, { status: "Sold" });
      }

      if (payload.customerId) {
        await storage.incrementCustomerPurchases(payload.customerId);
      }

      await storage.createActivityLog({
        action: "sale_created",
        entity: "sale",
        entityId: created.id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Created sale ${created.saleNumber}`,
        metadata: { totalAmount: created.totalAmount, items: payload.items.length },
        shopId: created.shopId || undefined,
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: "Failed to create sale" });
    }
  });

  const hydrateOrder = async (orderId: string) => {
    const order = await storage.getOrder(orderId);
    if (!order) return null;
    const items = await storage.getOrderItems(order.id);
    const delivery = await storage.getDeliveryByOrderId(order.id);
    const receiptList = await storage.getReceiptsByOrderId(order.id);
    return { ...order, items, delivery, receipts: receiptList };
  };

  const resolveShopId = async (requestedShopId?: string | null) => {
    if (requestedShopId) return requestedShopId;
    const shops = await storage.getShops();
    return shops[0]?.id ?? "shop1";
  };

  const buildValidatedCart = async (items: Array<{ productId: string; quantity: number }>, shopId?: string) => {
    const scopedProducts = await storage.getProducts(shopId);
    const allProducts = shopId ? [...scopedProducts, ...(await storage.getProducts()).filter((product) => !product.shopId)] : scopedProducts;
    const productMap = new Map(allProducts.map((product) => [product.id, product]));
    const normalizedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      if ((product.isPublished ?? true) === false) {
        throw new Error(`${product.name} is not available online`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`${product.name} only has ${product.stock} item(s) left`);
      }

      const flashDealActive =
        product.isFlashDeal &&
        product.flashDealPrice &&
        (!product.flashDealEndsAt || new Date(product.flashDealEndsAt) > new Date());
      const unitPrice = flashDealActive ? product.flashDealPrice! : product.price;
      const total = unitPrice * item.quantity;
      subtotal += total;
      normalizedItems.push({ product, quantity: item.quantity, unitPrice, total });
    }

    return { items: normalizedItems, subtotal };
  };

  const restoreOrderStock = async (orderId: string) => {
    const items = await storage.getOrderItems(orderId);
    for (const item of items) {
      const product = await storage.getProduct(item.productId);
      if (!product) continue;
      await storage.updateProduct(product.id, {
        stock: product.stock + item.quantity,
      });
    }
  };

  const reserveOrderStock = async (items: Array<{ product: any; quantity: number }>) => {
    for (const item of items) {
      await storage.updateProduct(item.product.id, {
        stock: Math.max(0, item.product.stock - item.quantity),
        popularity: (item.product.popularity ?? 0) + item.quantity,
      });
    }
  };

  const createOrderFromPayload = async (
    payload: z.infer<typeof orderCreateSchema>,
    fallbackShopId?: string | null,
  ) => {
    if (payload.deliveryType !== "PICKUP" && !payload.deliveryAddress?.trim()) {
      throw new Error("Delivery address is required for delivery orders.");
    }
    const shopId = await resolveShopId(payload.shopId || fallbackShopId || null);
    const customerPhone = normalizeUgPhone(payload.customerPhone);
    const { items, subtotal } = await buildValidatedCart(payload.items, shopId);
    const deliveryFee = payload.deliveryType === "UPCOUNTRY" ? 0 : payload.deliveryFee;
    const total = subtotal + deliveryFee;
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

    const existingCustomers = await storage.getCustomers(shopId);
    let matchedCustomer = existingCustomers.find((customer) => normalizeUgPhone(customer.phone) === customerPhone);
    if (!matchedCustomer) {
      matchedCustomer = await storage.createCustomer({
        name: payload.customerName,
        phone: customerPhone,
        email: payload.customerEmail || null,
        shopId,
      });
    }

    const created = await storage.createOrder(
      {
        orderNumber,
        shopId,
        customerId: payload.customerId || matchedCustomer.id || null,
        customerName: payload.customerName,
        customerPhone,
        customerEmail: payload.customerEmail || null,
        subtotal,
        deliveryFee,
        total,
        paymentMethod: payload.paymentMethod,
        paymentStatus: payload.paymentStatus,
        channel: payload.channel,
        status: payload.status,
        deliveryType: payload.deliveryType,
        deliveryAddress: payload.deliveryAddress || null,
        assignedStaffId: payload.assignedStaffId || null,
        notes: payload.notes || null,
      },
      items.map((item) => ({
        orderId: "" as never,
        productId: item.product.id,
        productName: item.product.name,
        imei: null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    );

    await reserveOrderStock(items);

    if (payload.deliveryType !== "PICKUP" && payload.deliveryAddress) {
      await storage.upsertDelivery({
        orderId: created.id,
        assignedRiderId: null,
        status: "PENDING",
        address: payload.deliveryAddress,
        scheduledAt: null,
        pickedUpAt: null,
        deliveredAt: null,
        failureReason: null,
        notes: payload.notes || null,
      });
    }

    await storage.createNotification({
      shopId,
      type: "ORDER_CREATED",
      targetId: created.id,
      message: `New ${payload.channel.toLowerCase()} order ${orderNumber} from ${payload.customerName}`,
      read: false,
    });

    await storage.incrementCustomerPurchases(matchedCustomer.id);

    return hydrateOrder(created.id);
  };

  app.post("/api/orders", async (req: Request, res: Response) => {
    const parsed = orderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid order payload", details: parsed.error.errors });
    }

    try {
      const hydrated = await createOrderFromPayload(parsed.data, req.currentUser?.shopId || null);
      res.status(201).json(hydrated);
    } catch (error: any) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: error?.message || "Failed to create order" });
    }
  });

  app.get("/api/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const filters = {
        shopId: (req.query.shopId as string) || req.currentUser?.shopId || undefined,
        status: (req.query.status as string) || undefined,
        assignedStaffId:
          req.currentUser?.role === "Sales"
            ? req.currentUser.id
            : ((req.query.assignedStaffId as string) || undefined),
      };
      const list = await storage.getOrders(filters);
      const items = await Promise.all(list.map((order) => hydrateOrder(order.id)));
      res.json(items.filter(Boolean));
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const order = await hydrateOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.patch("/api/orders/:id/status", requireAuth, async (req: Request, res: Response) => {
    const parsed = orderStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid status payload", details: parsed.error.errors });
    }

    try {
      const existing = await storage.getOrder(req.params.id);
      if (!existing) return res.status(404).json({ message: "Order not found" });

      const nextStatus = parsed.data.status;
      const wasTerminal = ["CANCELLED", "RETURNED"].includes(existing.status);
      const becomesTerminal = ["CANCELLED", "RETURNED"].includes(nextStatus);
      const isReactivation = wasTerminal && !becomesTerminal;

      if (isReactivation) {
        const items = await storage.getOrderItems(existing.id);
        const enriched = await Promise.all(
          items.map(async (item) => ({
            quantity: item.quantity,
            product: await storage.getProduct(item.productId),
          })),
        );
        const missing = enriched.find((item) => !item.product || item.product.stock < item.quantity);
        if (missing) {
          return res.status(409).json({ message: "Cannot reopen order because stock is no longer available." });
        }
      }

      const updated = await storage.updateOrder(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Order not found" });

      if (!wasTerminal && becomesTerminal) {
        await restoreOrderStock(updated.id);
        const delivery = await storage.getDeliveryByOrderId(updated.id);
        if (delivery) {
          await storage.updateDelivery(delivery.id, {
            status: "FAILED",
            failureReason: `Order ${updated.status.toLowerCase()}`,
          });
        }
      }
      if (isReactivation) {
        const items = await storage.getOrderItems(updated.id);
        const enriched = await Promise.all(
          items.map(async (item) => ({
            quantity: item.quantity,
            product: await storage.getProduct(item.productId),
          })),
        );
        const missing = enriched.find((item) => !item.product || item.product.stock < item.quantity);
        await reserveOrderStock(enriched as Array<{ product: any; quantity: number }>);
      }

      if (parsed.data.status === "OUT_FOR_DELIVERY" || parsed.data.status === "DELIVERED") {
        const delivery = await storage.getDeliveryByOrderId(updated.id);
        if (delivery) {
          await storage.updateDelivery(delivery.id, {
            status: parsed.data.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
            deliveredAt: parsed.data.status === "DELIVERED" ? new Date() : delivery.deliveredAt,
          });
        }
      }

      await storage.createNotification({
        shopId: updated.shopId,
        type: "ORDER_STATUS",
        targetId: updated.id,
        message: `Order ${updated.orderNumber} updated to ${parsed.data.status}`,
        read: false,
      });

      const order = await hydrateOrder(updated.id);
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  const sendOrderReceipt = async (req: Request, res: Response) => {
    try {
      const order = await hydrateOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const shop = await storage.getShop(order.shopId);
      const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${order.orderNumber} Receipt</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 32px; color: #111827; }
          .wrap { max-width: 720px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 24px; padding: 32px; }
          .muted { color: #6b7280; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
          .right { text-align: right; }
          .total { font-weight: 700; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>${shop?.name || "TechPOS"} Receipt</h1>
          <p class="muted">${shop?.address || ""} ${shop?.phone ? `• ${shop.phone}` : ""}</p>
          <p><strong>Order:</strong> ${order.orderNumber}<br/><strong>Date:</strong> ${toEastAfricaDate(order.createdAt)}<br/><strong>Customer:</strong> ${order.customerName}<br/><strong>Phone:</strong> ${order.customerPhone}</p>
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th class="right">Amount</th></tr></thead>
            <tbody>
              ${order.items.map((item) => `<tr><td>${item.productName}</td><td>${item.quantity}</td><td class="right">${formatUGX(item.total)}</td></tr>`).join("")}
              <tr><td colspan="2">Subtotal</td><td class="right">${formatUGX(order.subtotal)}</td></tr>
              <tr><td colspan="2">Delivery</td><td class="right">${formatUGX(order.deliveryFee)}</td></tr>
              <tr><td colspan="2" class="total">Total</td><td class="right total">${formatUGX(order.total)}</td></tr>
            </tbody>
          </table>
          <p><strong>Payment:</strong> ${order.paymentMethod} (${order.paymentStatus})</p>
          <p class="muted">Thank you for shopping with ${shop?.name || "TechPOS"}.</p>
        </div>
      </body>
      </html>`;

      const receipt = await storage.createReceipt({
        orderId: order.id,
        pdfUrl: null,
        sentVia: [],
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="${order.orderNumber}.html"`);
      res.setHeader("X-Receipt-Id", receipt.id);
      res.send(html);
    } catch (error) {
      console.error("Error generating receipt:", error);
      res.status(500).json({ message: "Failed to generate receipt" });
    }
  };

  app.get("/api/orders/:id/receipt", requireAuth, sendOrderReceipt);
  app.post("/api/orders/:id/receipt", requireAuth, sendOrderReceipt);

  app.get("/api/deliveries", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const filters = {
        status: (req.query.status as string) || undefined,
        assignedRiderId:
          req.currentUser?.role === "Sales"
            ? req.currentUser.id
            : ((req.query.assignedRiderId as string) || undefined),
      };
      const list = await storage.getDeliveries(filters);
      const payload = await Promise.all(
        list.map(async (delivery) => ({
          ...delivery,
          order: await storage.getOrder(delivery.orderId),
        })),
      );
      res.json(payload.filter((delivery) => !shopId || delivery.order?.shopId === shopId));
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      res.status(500).json({ message: "Failed to fetch deliveries" });
    }
  });

  app.patch("/api/deliveries/:id/status", requireAuth, async (req: Request, res: Response) => {
    const parsed = deliveryStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid delivery status payload", details: parsed.error.errors });
    }

    try {
      const nextData: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.status === "PICKED_UP") nextData.pickedUpAt = new Date();
      if (parsed.data.status === "DELIVERED") nextData.deliveredAt = new Date();
      const updated = await storage.updateDelivery(req.params.id, nextData);
      if (!updated) return res.status(404).json({ message: "Delivery not found" });

      if (updated.orderId) {
        const mappedOrderStatus =
          parsed.data.status === "DELIVERED"
            ? "DELIVERED"
            : parsed.data.status === "IN_TRANSIT"
              ? "OUT_FOR_DELIVERY"
              : undefined;
        if (mappedOrderStatus) {
          await storage.updateOrder(updated.orderId, { status: mappedOrderStatus });
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  app.post("/api/deliveries/:id/assign", requireAuth, async (req: Request, res: Response) => {
    const parsed = deliveryAssignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid delivery assignment payload", details: parsed.error.errors });
    }

    try {
      const updated = await storage.updateDelivery(req.params.id, {
        assignedRiderId: parsed.data.assignedRiderId,
        status: "ASSIGNED",
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        notes: parsed.data.notes || null,
      });
      if (!updated) return res.status(404).json({ message: "Delivery not found" });
      const order = await storage.getOrder(updated.orderId);
      if (order) {
        await storage.createNotification({
          shopId: order.shopId,
          type: "DELIVERY_ASSIGNED",
          targetId: updated.id,
          message: `Delivery assigned for order ${order.orderNumber}`,
          read: false,
        });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error assigning delivery:", error);
      res.status(500).json({ message: "Failed to assign delivery" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getNotifications(shopId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id", requireAuth, async (req: Request, res: Response) => {
    const parsed = notificationReadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid notification payload", details: parsed.error.errors });
    }

    try {
      const updated = parsed.data.read
        ? await storage.markNotificationRead(req.params.id)
        : undefined;
      if (!updated) return res.status(404).json({ message: "Notification not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating notification:", error);
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  app.get("/api/store/products", async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || undefined;
      const q = ((req.query.q as string) || "").toLowerCase().trim();
      const brand = (req.query.brand as string) || "";
      const condition = (req.query.condition as string) || "";
      const ram = (req.query.ram as string) || "";
      const storageSize = (req.query.storage as string) || "";
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
      const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
      const category = (req.query.category as string) || "";
      const sort = (req.query.sort as string) || "popular";

      let list = await storage.getProducts(shopId);
      list = list.filter((product) => (product.isPublished ?? true) !== false);

      if (q) {
        list = list.filter((product) =>
          [product.name, product.brand, product.model, product.category, product.description]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q)),
        );
      }
      if (brand) list = list.filter((product) => (product.brand || "").toLowerCase() === brand.toLowerCase());
      if (condition) list = list.filter((product) => (product.condition || "New").toLowerCase() === condition.toLowerCase());
      if (ram) list = list.filter((product) => (product.ram || "").toLowerCase() === ram.toLowerCase());
      if (storageSize) list = list.filter((product) => (product.storage || "").toLowerCase() === storageSize.toLowerCase());
      if (category) list = list.filter((product) => (product.category || "").toLowerCase() === category.toLowerCase());
      if (minPrice !== undefined) list = list.filter((product) => product.price >= minPrice);
      if (maxPrice !== undefined) list = list.filter((product) => product.price <= maxPrice);

      list = [...list].sort((a, b) => {
        if (sort === "price-asc") return a.price - b.price;
        if (sort === "newest") return +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0);
        if (sort === "stock") return b.stock - a.stock;
        return (b.popularity ?? 0) - (a.popularity ?? 0);
      });

      res.json(
        list.map((product) => ({
          ...product,
          slug: product.slug || `${slugify(product.name)}-${product.id.slice(0, 6)}`,
          priceLabel: formatUGX(product.price),
        })),
      );
    } catch (error) {
      console.error("Error fetching storefront products:", error);
      res.status(500).json({ message: "Failed to fetch storefront products" });
    }
  });

  app.get("/api/store/products/:slug", async (req: Request, res: Response) => {
    try {
      const list = await storage.getProducts((req.query.shopId as string) || undefined);
      const product = list.find((entry) => {
        const slug = entry.slug || `${slugify(entry.name)}-${entry.id.slice(0, 6)}`;
        return slug === req.params.slug;
      });
      if (!product) return res.status(404).json({ message: "Product not found" });

      const related = list
        .filter((entry) => entry.id !== product.id && entry.category === product.category)
        .slice(0, 8)
        .map((entry) => ({
          ...entry,
          slug: entry.slug || `${slugify(entry.name)}-${entry.id.slice(0, 6)}`,
        }));

      const imeiTracked = (await storage.getDevices(product.shopId || undefined)).some(
        (device) =>
          device.status === "In Stock" &&
          device.brand.toLowerCase() === (product.brand || "").toLowerCase() &&
          device.model.toLowerCase() === (product.model || "").toLowerCase(),
      );

      res.json({
        ...product,
        slug: product.slug || `${slugify(product.name)}-${product.id.slice(0, 6)}`,
        related,
        imeiTracked,
      });
    } catch (error) {
      console.error("Error fetching storefront product:", error);
      res.status(500).json({ message: "Failed to fetch storefront product" });
    }
  });

  app.post("/api/store/cart", async (req: Request, res: Response) => {
    const parsed = z.object({ items: z.array(storefrontCartItemSchema).min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid cart payload", details: parsed.error.errors });
    }

    try {
      const { items, subtotal } = await buildValidatedCart(parsed.data.items);
      res.json({
        items: items.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          stock: item.product.stock,
        })),
        subtotal,
      });
    } catch (error: any) {
      console.error("Error validating cart:", error);
      res.status(400).json({ message: error?.message || "Failed to validate cart" });
    }
  });

  app.post("/api/store/checkout", async (req: Request, res: Response) => {
    const parsed = orderCreateSchema.safeParse({ ...req.body, channel: "ONLINE" });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid checkout payload", details: parsed.error.errors });
    }

    try {
      const hydrated = await createOrderFromPayload(parsed.data, null);
      res.status(201).json(hydrated);
    } catch (error: any) {
      console.error("Error during checkout:", error);
      res.status(500).json({ message: error?.message || "Failed to complete checkout" });
    }
  });

  // app.get("/api/store/orders/track/:orderNumber", async (req: Request, res: Response) => {
  //   try {
  //     const { orderNumber } = req.params;
  //     const orders = await storage.getOrders();
  //     const order = orders.find((o) => o.orderNumber === orderNumber);

  //     if (!order) {
  //       return res.status(404).json({ message: "Order not found" });
  //     }

  //     const orderItems = await storage.getOrderItems(order.id);
  //     const deliveries = await storage.getDeliveries();
  //     const delivery = deliveries.find((d) => d.orderId === order.id);

  //     res.json({
  //       order: {
  //         id: order.id,
  //         orderNumber: order.orderNumber,
  //         customerName: order.customerName,
  //         customerPhone: order.customerPhone,
  //         customerEmail: order.customerEmail,
  //         subtotal: order.subtotal,
  //         deliveryFee: order.deliveryFee,
  //         total: order.total,
  //         paymentMethod: order.paymentMethod,
  //         paymentStatus: order.paymentStatus,
  //         status: order.status,
  //         deliveryType: order.deliveryType,
  //         deliveryAddress: order.deliveryAddress,
  //         notes: order.notes,
  //         createdAt: order.createdAt,
  //       },
  //       items: orderItems.map((item) => ({
  //         id: item.id,
  //         productName: item.productName,
  //         quantity: item.quantity,
  //         unitPrice: item.unitPrice,
  //         total: item.total,
  //       })),
  //       delivery: delivery ? {
  //         status: delivery.status,
  //         address: delivery.address,
  //         scheduledAt: delivery.scheduledAt,
  //         pickedUpAt: delivery.pickedUpAt,
  //         deliveredAt: delivery.deliveredAt,
  //         failureReason: delivery.failureReason,
  //       } : undefined,
  //     });
  //   } catch (error) {
  //     console.error("Error fetching order tracking:", error);
  //     res.status(500).json({ message: "Failed to fetch order tracking" });
  //   }
  // });

  app.get("/api/dashboard/metrics", requireAuth, async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Number(req.query.days || 7));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const [orders, deliveries, sales, products] = await Promise.all([
        storage.getOrders({ shopId }),
        storage.getDeliveries({}),
        storage.getSales(shopId),
        storage.getProducts(shopId),
      ]);

      const scopedOrders = orders.filter((order) => new Date(order.createdAt || 0) >= since);
      const scopedSales = sales.filter((sale) => new Date(sale.createdAt || 0) >= since);
      const scopedDeliveries = deliveries.filter((delivery) => {
        const order = orders.find((entry) => entry.id === delivery.orderId);
        return !!order && new Date(order.createdAt || 0) >= since;
      });

      const now = Date.now();
      const pendingDeliveries = scopedDeliveries.filter((delivery) => delivery.status !== "DELIVERED").length;
      const overdueDeliveries = scopedDeliveries.filter(
        (delivery) => delivery.status !== "DELIVERED" && delivery.scheduledAt && +new Date(delivery.scheduledAt) < now,
      ).length;
      const deliveredCount = scopedDeliveries.filter((delivery) => delivery.status === "DELIVERED").length;
      const deliveryCompletionRate = scopedDeliveries.length > 0 ? Math.round((deliveredCount / scopedDeliveries.length) * 100) : 0;

      const onlineRevenue = scopedOrders.reduce((sum, order) => sum + order.total, 0);
      const posRevenue = scopedSales.reduce((sum, sale) => sum + sale.totalAmount, 0);

      const topSellingProducts = Object.values(
        (await Promise.all(scopedOrders.map((order) => storage.getOrderItems(order.id)))).flat().reduce((acc, item) => {
          const current = acc[item.productId] || { productId: item.productId, name: item.productName, units: 0, revenue: 0 };
          current.units += item.quantity;
          current.revenue += item.total;
          acc[item.productId] = current;
          return acc;
        }, {} as Record<string, { productId: string; name: string; units: number; revenue: number }>),
      ).sort((a, b) => b.units - a.units).slice(0, 5);

      const paymentBreakdown = scopedOrders.reduce(
        (acc, order) => {
          acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + order.total;
          return acc;
        },
        {} as Record<string, number>,
      );

      res.json({
        ordersTodayCount: orders.filter((order) => new Date(order.createdAt || 0).toDateString() === new Date().toDateString()).length,
        ordersTodayValue: orders
          .filter((order) => new Date(order.createdAt || 0).toDateString() === new Date().toDateString())
          .reduce((sum, order) => sum + order.total, 0),
        pendingDeliveries,
        overdueDeliveries,
        deliveryCompletionRate,
        topSellingProducts,
        revenueByChannel: [
          { channel: "Walk-in POS", value: posRevenue },
          { channel: "Online Store", value: onlineRevenue },
        ],
        paymentMethodBreakdown: Object.entries(paymentBreakdown).map(([method, value]) => ({ method, value })),
        stockVelocity: {
          fastestSelling: [...topSellingProducts].slice(0, 3),
          longestSitting: [...products].sort((a, b) => (a.popularity ?? 0) - (b.popularity ?? 0)).slice(0, 3),
        },
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get("/api/repairs", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getRepairs(shopId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching repairs:", error);
      res.status(500).json({ message: "Failed to fetch repairs" });
    }
  });

  app.post("/api/repairs", requireAuth, async (req: Request, res: Response) => {
    const parsed = repairCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid repair payload", details: parsed.error.errors });
    }

    try {
      const payload = parsed.data;
      const repairNumber = `REP-${Date.now().toString(36).toUpperCase()}`;
      const created = await storage.createRepair({
        ...payload,
        notes: payload.notes || payload.issueDescription,
        customerName: payload.customerName || "Walk-in",
        technician: payload.technician || req.currentUser?.name || "Unassigned",
        status: payload.status || "Pending",
        repairNumber,
        shopId: payload.shopId || req.currentUser?.shopId || null,
      });

      await storage.createActivityLog({
        action: "repair_created",
        entity: "repair",
        entityId: created.id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Created repair ${created.repairNumber}`,
        metadata: { repairType: created.repairType, imei: created.imei },
        shopId: created.shopId || undefined,
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating repair:", error);
      res.status(500).json({ message: "Failed to create repair" });
    }
  });

  app.patch("/api/repairs/:id/status", requireAuth, async (req: Request, res: Response) => {
    const parsed = repairStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid repair status payload", details: parsed.error.errors });
    }

    try {
      const updated = await storage.updateRepair(req.params.id, { status: parsed.data.status });
      if (!updated) {
        return res.status(404).json({ message: "Repair not found" });
      }

      await storage.createActivityLog({
        action: "repair_status_updated",
        entity: "repair",
        entityId: updated.id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Updated repair ${updated.repairNumber} to ${updated.status}`,
        metadata: { status: updated.status },
        shopId: updated.shopId || undefined,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating repair status:", error);
      res.status(500).json({ message: "Failed to update repair status" });
    }
  });

  app.get("/api/expenses", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getExpenses(shopId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = expenseCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid expense payload", details: parsed.error.errors });
    }

    try {
      const payload = parsed.data;
      const created = await storage.createExpense({
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod || "Cash",
        date: payload.date ? new Date(payload.date) : new Date(),
        recordedBy: payload.recordedBy || req.currentUser?.name || "Staff",
        shopId: payload.shopId || req.currentUser?.shopId || null,
      });

      await storage.createActivityLog({
        action: "expense_created",
        entity: "expense",
        entityId: created.id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Recorded expense ${created.category}`,
        metadata: { amount: created.amount },
        shopId: created.shopId || undefined,
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to record expense" });
    }
  });

  app.get("/api/closures", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getClosures(shopId);
      res.json(list);
    } catch (error) {
      console.error("Error fetching closures:", error);
      res.status(500).json({ message: "Failed to fetch closures" });
    }
  });

  app.post("/api/closures", requireAuth, async (req: Request, res: Response) => {
    const parsed = closurePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid closure payload", details: parsed.error.errors });
    }

    try {
      const payload = parsed.data;
      const created = await storage.createClosure({
        ...payload,
        shopId: payload.shopId || req.currentUser?.shopId || null,
      });

      await storage.createActivityLog({
        action: "closure_created",
        entity: "closure",
        entityId: created.id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Submitted daily closure with status ${created.status}`,
        metadata: { variance: created.variance },
        shopId: created.shopId || undefined,
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating closure:", error);
      res.status(500).json({ message: "Failed to submit closure" });
    }
  });

  app.patch("/api/closures/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const fullPayload = closurePayloadSchema.partial().safeParse(req.body);
    if (!fullPayload.success) {
      return res.status(400).json({ message: "Invalid closure update payload", details: fullPayload.error.errors });
    }

    try {
      const updated = await storage.updateClosure(req.params.id, fullPayload.data);
      if (!updated) {
        return res.status(404).json({ message: "Closure not found" });
      }

      await storage.createActivityLog({
        action: "closure_updated",
        entity: "closure",
        entityId: updated.id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Updated daily closure ${updated.id}`,
        metadata: { status: updated.status },
        shopId: updated.shopId || undefined,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating closure:", error);
      res.status(500).json({ message: "Failed to update closure" });
    }
  });

  app.get("/api/preferences", requireAuth, async (req: Request, res: Response) => {
    const preferences = await storage.upsertUserPreferences(req.currentUser!.id, {});
    res.json(preferences);
  });

  app.patch("/api/preferences", requireAuth, async (req: Request, res: Response) => {
    const parsed = preferenceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid preferences payload", details: parsed.error.errors });
    }

    const updated = await storage.upsertUserPreferences(req.currentUser!.id, parsed.data);
    await storage.createActivityLog({
      action: "preferences_updated",
      entity: "user_preferences",
      entityId: req.currentUser!.id,
      userId: req.currentUser!.id,
      userName: req.currentUser!.name,
      role: req.currentUser!.role,
      details: "Updated personalization preferences",
      metadata: parsed.data,
      shopId: req.currentUser?.shopId || undefined,
    });
    res.json(updated);
  });

  // Shops: get and update
  const updateShopSchema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().optional(),
    description: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    location: z.string().optional().or(z.literal("")), // allow front-end location, map to address
    phone: z.string().optional().or(z.literal("")),
    email: z.string().optional().or(z.literal("")),
    timezone: z.string().optional().or(z.literal("")),
    logo: z.any().optional(),
    logoUrl: z.string().optional(), // string URL for compatibility
    coverImage: z.any().optional(),
    coverUrl: z.string().optional(), // string URL for compatibility
    themeColorPrimary: z.string().optional(),
    themeColorAccent: z.string().optional(),
    isMain: z.boolean().optional(),
    currency: z.string().optional(),
    subscriptionPlan: z.string().optional(),
  });

  app.get("/api/shops", async (_req: Request, res: Response) => {
    try {
      const list = await storage.getShops();
      res.json(list);
    } catch (error) {
      console.error("Error fetching shops:", error);
      res.status(500).json({ message: "Failed to fetch shops" });
    }
  });

  app.get("/api/shops/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const shop = await storage.getShop(id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    res.json(shop);
  });

  app.patch("/api/shops/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = updateShopSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid payload", details: parsed.error.errors });
    const { id } = req.params;

    const payload: any = { ...parsed.data };
    // Map location -> address if provided
    if (payload.location && !payload.address) payload.address = payload.location;
    delete payload.location;

    // Map legacy logo/cover URLs to objects
    if (payload.logoUrl && !payload.logo) payload.logo = { url: payload.logoUrl };
    if (payload.coverUrl && !payload.coverImage) payload.coverImage = { url: payload.coverUrl };
    delete payload.logoUrl;
    delete payload.coverUrl;

    const updated = await storage.updateShop(id, payload as any);
    if (!updated) return res.status(404).json({ message: "Shop not found" });
    // log activity
    try {
      await storage.createActivityLog({
        action: "shop_updated",
        entity: "shop",
        entityId: id,
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        role: req.currentUser?.role,
        details: `Updated shop ${updated.name}`,
        metadata: parsed.data as any,
        shopId: id,
      });
    } catch {}
    res.json(updated);
  });

  app.post("/api/staff", requireRole(["Owner"]), async (req: Request, res: Response) => {
    const parsed = staffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid staff payload", details: parsed.error.errors });
    }

    const payload = parsed.data;
    const existing = await storage.getUserByUsername(payload.username);
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const created = await storage.createUser({
      username: payload.username,
      name: payload.name,
      email: payload.email,
      password: hashSecret(payload.pin),
      role: payload.role,
      status: payload.status,
      shopId: payload.shopId || null,
    });

    await storage.createActivityLog({
      action: "staff_created",
      entity: "user",
      entityId: created.id,
      userId: req.currentUser?.id,
      userName: req.currentUser?.name,
      role: req.currentUser?.role,
      details: `Created staff ${created.username} (${created.role})`,
      metadata: { shopId: created.shopId },
    });

    res.status(201).json(sanitizeUser(created));
  });

  app.patch("/api/staff/:id", requireRole(["Owner"]), async (req: Request, res: Response) => {
    const parsed = staffSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid staff payload", details: parsed.error.errors });
    }

    const { id } = req.params;
    const updates = { ...parsed.data } as any;
    if (updates.pin) {
      updates.password = hashSecret(updates.pin);
      delete updates.pin;
    }

    const updated = await storage.updateUser(id, updates);
    if (!updated) {
      return res.status(404).json({ message: "Staff not found" });
    }

    await storage.createActivityLog({
      action: "staff_updated",
      entity: "user",
      entityId: id,
      userId: req.currentUser?.id,
      userName: req.currentUser?.name,
      role: req.currentUser?.role,
      details: `Updated staff ${updated.username}`,
      metadata: updates,
    });

    res.json(sanitizeUser(updated));
  });

  app.patch("/api/staff/:id/status", requireRole(["Owner"]), async (req: Request, res: Response) => {
    const status = req.body.status as "active" | "disabled";
    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await storage.setUserStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ message: "Staff not found" });
    }

    await storage.createActivityLog({
      action: "staff_status_changed",
      entity: "user",
      entityId: req.params.id,
      userId: req.currentUser?.id,
      userName: req.currentUser?.name,
      role: req.currentUser?.role,
      details: `Set status to ${status}`,
      metadata: { status },
    });

    res.json(sanitizeUser(updated));
  });

  app.get("/api/activity", requireRole(["Owner", "Manager"]), async (_req: Request, res: Response) => {
    const limit = Number(_req.query.limit || 200);
    const logs = await storage.getActivityLogs(limit);
    res.json(logs);
  });

  app.get("/api/system/health", requireRole(["Owner"]), async (_req: Request, res: Response) => {
    const metrics = (_req.app.locals.apiMetrics || {}) as Record<string, unknown>;
    const uptimeSec = Math.floor(process.uptime());
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      uptimeSec,
      memory: process.memoryUsage(),
      metrics,
    });
  });

  app.post("/api/activity", requireAuth, async (req: Request, res: Response) => {
    const payload = req.body || {};
    const log = await storage.createActivityLog({
      action: payload.action || "unknown",
      entity: payload.entity || "event",
      entityId: payload.entityId,
      details: payload.details,
      metadata: payload.metadata || {},
      userId: req.currentUser?.id,
      userName: req.currentUser?.name,
      role: req.currentUser?.role,
      shopId: req.currentUser?.shopId || undefined,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]?.toString(),
    });
    res.status(201).json(log);
  });

  // ===================== LEADS API =====================
  const createLeadSchema = z.object({
    customerName: z.string().min(1),
    customerPhone: z.string().min(6),
    customerEmail: z.string().optional().or(z.literal("")),
    source: z.string().optional(),
    notes: z.string().optional(),
    assignedTo: z.string().optional(),
    priority: z.string().optional(),
    status: z.string().optional(),
    nextFollowUpAt: z.string().optional().or(z.null()),
    shopId: z.string().optional(),
  });

  const updateLeadSchema = z.object({
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().min(6).optional(),
    customerEmail: z.string().optional().or(z.literal("")),
    source: z.string().optional(),
    notes: z.string().optional(),
    assignedTo: z.string().optional().or(z.null()),
    priority: z.enum(["low", "normal", "high"]).optional(),
    status: z.enum(["new", "contacted", "in_progress", "won", "lost"]).optional(),
    nextFollowUpAt: z.string().optional().or(z.null()),
    shopId: z.string().optional().or(z.null()),
  });

  const assignLeadSchema = z.object({
    assignedTo: z.string().min(1, "assignedTo is required"),
  });

  app.get("/api/leads", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getLeads(shopId);
      res.json(list);
    } catch (err) {
      console.error("Error fetching leads:", err);
      sendError(res, 500, "Failed to fetch leads");
    }
  });

  app.post("/api/leads", requireAuth, async (req: Request, res: Response) => {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid payload", details: parsed.error.errors });

    try {
      const payload = parsed.data as any;
      const leadPayload = {
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerEmail: payload.customerEmail || null,
        source: payload.source || null,
        notes: payload.notes || null,
        assignedTo: payload.assignedTo || null,
        priority: payload.priority || 'normal',
        status: payload.status || 'new',
        nextFollowUpAt: payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : null,
        followUpHistory: [],
        createdBy: req.currentUser?.id || null,
        createdByName: req.currentUser?.name || null,
        shopId: payload.shopId || req.currentUser?.shopId || null,
      };

      const created = await storage.createLead(leadPayload as any);

      await storage.createLeadAuditLog({
        leadId: created.id,
        action: 'created',
        userId: req.currentUser?.id,
        userName: req.currentUser?.name,
        details: `Lead created: ${created.customerName}`,
        metadata: created,
      });

      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating lead:", err);
      sendError(res, 500, "Failed to create lead");
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const lead = await storage.getLead(id);
      if (!lead) return sendError(res, 404, "Lead not found");
      res.json(lead);
    } catch (err) {
      console.error("Error fetching lead:", err);
      sendError(res, 500, "Failed to fetch lead");
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", details: parsed.error.errors });
    }

    try {
      const { id } = req.params;
      const updates = parsed.data as any;
      if (updates.nextFollowUpAt) updates.nextFollowUpAt = new Date(updates.nextFollowUpAt);
      const updated = await storage.updateLead(id, updates);
      if (!updated) return sendError(res, 404, "Lead not found");

      await storage.createLeadAuditLog({ leadId: id, action: 'updated', userId: req.currentUser?.id, userName: req.currentUser?.name, details: 'Lead updated', metadata: updates });
      res.json(updated);
    } catch (err) {
      console.error("Error updating lead:", err);
      sendError(res, 500, "Failed to update lead");
    }
  });

  app.post("/api/leads/:id/assign", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = assignLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", details: parsed.error.errors });
    }

    try {
      const { id } = req.params;
      const { assignedTo } = parsed.data;
      const updated = await storage.updateLead(id, { assignedTo });
      if (!updated) return sendError(res, 404, "Lead not found");

      await storage.createLeadAuditLog({ leadId: id, action: 'assigned', userId: req.currentUser?.id, userName: req.currentUser?.name, details: `Assigned to ${assignedTo}`, metadata: { assignedTo } });
      res.json(updated);
    } catch (err) {
      console.error("Error assigning lead:", err);
      sendError(res, 500, "Failed to assign lead");
    }
  });

  const followUpSchema = z.object({ note: z.string().optional(), result: z.string().optional(), nextFollowUpAt: z.string().optional().or(z.null()) });
  app.post("/api/leads/:id/follow-ups", requireAuth, async (req: Request, res: Response) => {
    const parsed = followUpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid payload", details: parsed.error.errors });

    try {
      const { id } = req.params;
      const payload = parsed.data;
      const updated = await storage.addLeadFollowUp(id, {
        by: req.currentUser?.id,
        byName: req.currentUser?.name || undefined,
        note: payload.note,
        result: payload.result,
        nextFollowUpAt: payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : undefined,
      });
      if (!updated) return sendError(res, 404, "Lead not found");

      await storage.createLeadAuditLog({ leadId: id, action: 'follow_up', userId: req.currentUser?.id, userName: req.currentUser?.name, details: `Follow-up: ${payload.note || ''}`, metadata: payload });
      res.json(updated);
    } catch (err) {
      console.error("Error adding follow-up:", err);
      sendError(res, 500, "Failed to add follow-up");
    }
  });

  app.get("/api/leads/:id/audit-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const logs = await storage.getLeadAuditLogs(id);
      res.json(logs);
    } catch (err) {
      console.error("Error fetching lead audit logs:", err);
      sendError(res, 500, "Failed to fetch audit logs");
    }
  });

  // ===================== TRADE-IN API =====================
  
  // Get all condition questions for the wizard
  app.get("/api/trade-in/questions", async (req: Request, res: Response) => {
    try {
      let questions = await storage.getConditionQuestions();
      
      // If no questions exist, seed with defaults
      if (questions.length === 0) {
        for (const q of DEFAULT_CONDITION_QUESTIONS) {
          // Storage expects `options` as JSON; coerce here to satisfy the Insert schema
          await storage.createConditionQuestion({ ...q, options: q.options as any });
        }
        questions = await storage.getConditionQuestions();
      }
      
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      sendError(res, 500, "Failed to fetch questions");
    }
  });

  // Get device base values for pricing
  app.get("/api/trade-in/base-values", async (req: Request, res: Response) => {
    try {
      const shopId = req.query.shopId as string | undefined;
      let values = await storage.getDeviceBaseValues(shopId);
      
      // If no values exist, seed with defaults
      if (values.length === 0) {
        for (const v of DEFAULT_BASE_VALUES) {
          await storage.upsertDeviceBaseValue({ ...v, isActive: true, shopId: shopId || null });
        }
        values = await storage.getDeviceBaseValues(shopId);
      }
      
      res.json(values);
    } catch (error) {
      console.error("Error fetching base values:", error);
      sendError(res, 500, "Failed to fetch base values");
    }
  });

  // Seed base values (Owner/Manager)
  app.post("/api/trade-in/base-values/seed", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const shopId = req.query.shopId as string | undefined;
      const existing = await storage.getDeviceBaseValues(shopId);
      if (existing.length > 0) {
        return res.json({ message: "Base values already seeded", count: existing.length });
      }

      for (const v of DEFAULT_BASE_VALUES) {
        await storage.upsertDeviceBaseValue({ ...v, isActive: true, shopId: shopId || null });
      }

      const after = await storage.getDeviceBaseValues(shopId);
      res.json({ message: "Base values seeded", count: after.length });
    } catch (error) {
      console.error("Error seeding base values:", error);
      sendError(res, 500, "Failed to seed base values");
    }
  });

  // Upsert base value (Owner/Manager) without touching existing records unless matching brand/model/storage
  app.post("/api/trade-in/base-values/manage", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const parsed = baseValueUpsertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", details: parsed.error.errors });
      }
      const payload = parsed.data;
      const upserted = await storage.upsertDeviceBaseValue({
        brand: payload.brand,
        model: payload.model,
        storage: payload.storage,
        baseValue: payload.baseValue,
        isActive: payload.isActive ?? true,
        shopId: payload.shopId || null,
      });
      res.json(upserted);
    } catch (error) {
      console.error("Error upserting base value:", error);
      sendError(res, 500, "Failed to upsert base value");
    }
  });

  // Get base value for specific device
  app.get("/api/trade-in/base-value", async (req: Request, res: Response) => {
    try {
      const { brand, model, storage: storageSize, shopId } = req.query;
      
      if (!brand || !model || !storageSize) {
        return sendError(res, 400, "Brand, model, and storage are required");
      }
      
      const value = await storage.getDeviceBaseValue(
        brand as string, 
        model as string, 
        storageSize as string, 
        shopId as string | undefined
      );
      
      if (!value) {
        return sendError(res, 404, "No base value found for this device");
      }
      
      res.json(value);
    } catch (error) {
      console.error("Error fetching base value:", error);
      sendError(res, 500, "Failed to fetch base value");
    }
  });

  // Get all brands from normalized brands table
  app.get("/api/brands", async (req: Request, res: Response) => {
    try {
      const brandList = await storage.getBrands();
      
      // If normalized brands exist, use them
      if (brandList.length > 0) {
        res.json(brandList.map(b => ({ id: b.id, name: b.name })));
        return;
      }
      
      // Fallback: derive from base values for backward compatibility
      const shopId = req.query.shopId as string | undefined;
      const values = await storage.getDeviceBaseValues(shopId);
      const brands = Array.from(new Set(values.map(v => v.brand))).sort();
      res.json(brands.map((name, index) => ({ id: String(index + 1), name })));
    } catch (error) {
      console.error("Error fetching brands:", error);
      sendError(res, 500, "Failed to fetch brands");
    }
  });

  // Get models for a specific brand (supports brandId or brand name)
  app.get("/api/models", async (req: Request, res: Response) => {
    try {
      const brandId = req.query.brand_id as string;
      const brand = req.query.brand as string;
      
      // If brandId provided, use normalized tables
      if (brandId) {
        const modelList = await storage.getModels(brandId);
        res.json(modelList.map(m => ({ id: m.id, name: m.name, brandId: m.brandId })));
        return;
      }
      
      // Fallback: derive from base values by brand name
      if (!brand) {
        return sendError(res, 400, "Brand or brand_id is required");
      }
      
      const shopId = req.query.shopId as string | undefined;
      const values = await storage.getDeviceBaseValues(shopId);
      const models = Array.from(new Set(values.filter(v => v.brand === brand).map(v => v.model))).sort();
      res.json(models.map((name, index) => ({ id: String(index + 1), name })));
    } catch (error) {
      console.error("Error fetching models:", error);
      sendError(res, 500, "Failed to fetch models");
    }
  });

  // Get storage options for a specific model (supports modelId or brand+model name)
  app.get("/api/storages", async (req: Request, res: Response) => {
    try {
      const modelId = req.query.model_id as string;
      const brand = req.query.brand as string;
      const model = req.query.model as string;
      
      // If modelId provided, use normalized tables
      if (modelId) {
        const storageList = await storage.getStorageOptions(modelId);
        res.json(storageList.map(s => ({ id: s.id, size: s.size, modelId: s.modelId })));
        return;
      }
      
      // Fallback: derive from base values by brand+model name
      const shopId = req.query.shopId as string | undefined;
      const values = await storage.getDeviceBaseValues(shopId);
      
      let filtered = values;
      if (brand) {
        filtered = filtered.filter(v => v.brand === brand);
      }
      if (model) {
        filtered = filtered.filter(v => v.model === model);
      }
      
      const storages = Array.from(new Set(filtered.map(v => v.storage))).sort();
      res.json(storages.map((size, index) => ({ id: String(index + 1), size })));
    } catch (error) {
      console.error("Error fetching storages:", error);
      sendError(res, 500, "Failed to fetch storages");
    }
  });

  // Brands CRUD (Owner/Manager)
  const brandSchema = z.object({ name: z.string().min(1), sortOrder: z.number().optional(), isActive: z.boolean().optional() });
  app.post("/api/brands", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = brandSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid payload", details: parsed.error.errors });
    try {
      const created = await storage.createBrand(parsed.data as any);
      await storage.createActivityLog({ action: 'brand_created', entity: 'brand', entityId: created.id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Created brand ${created.name}` });
      res.status(201).json(created);
    } catch (err) {
      console.error('Error creating brand:', err);
      sendError(res, 500, "Failed to create brand");
    }
  });

  app.patch("/api/brands/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = brandSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', details: parsed.error.errors });
    try {
      const { id } = req.params;
      const updated = await storage.updateBrand(id, parsed.data as any);
      if (!updated) return sendError(res, 404, "Brand not found");
      await storage.createActivityLog({ action: 'brand_updated', entity: 'brand', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Updated brand ${updated.name}` });
      res.json(updated);
    } catch (err) {
      console.error('Error updating brand:', err);
      sendError(res, 500, "Failed to update brand");
    }
  });

  app.delete("/api/brands/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteBrand(id);
      await storage.createActivityLog({ action: 'brand_deleted', entity: 'brand', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Deleted brand ${id}` });
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting brand:', err);
      sendError(res, 500, "Failed to delete brand");
    }
  });

  // Models CRUD
  const modelSchema = z.object({ brandId: z.string().min(1), name: z.string().min(1), sortOrder: z.number().optional(), isActive: z.boolean().optional() });
  app.post("/api/models", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = modelSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', details: parsed.error.errors });
    try {
      const created = await storage.createModel(parsed.data as any);
      await storage.createActivityLog({ action: 'model_created', entity: 'model', entityId: created.id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Created model ${created.name}` });
      res.status(201).json(created);
    } catch (err) {
      console.error('Error creating model:', err);
      sendError(res, 500, "Failed to create model");
    }
  });

  app.patch("/api/models/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = modelSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', details: parsed.error.errors });
    try {
      const { id } = req.params;
      const updated = await storage.updateModel(id, parsed.data as any);
      if (!updated) return sendError(res, 404, "Model not found");
      await storage.createActivityLog({ action: 'model_updated', entity: 'model', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Updated model ${updated.name}` });
      res.json(updated);
    } catch (err) {
      console.error('Error updating model:', err);
      sendError(res, 500, "Failed to update model");
    }
  });

  app.delete("/api/models/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteModel(id);
      await storage.createActivityLog({ action: 'model_deleted', entity: 'model', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Deleted model ${id}` });
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting model:', err);
      sendError(res, 500, "Failed to delete model");
    }
  });

  // Storage options CRUD
  const storageOptionSchema = z.object({ modelId: z.string().min(1), size: z.string().min(1), sortOrder: z.number().optional(), isActive: z.boolean().optional() });
  app.post("/api/storage-options", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = storageOptionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', details: parsed.error.errors });
    try {
      const created = await storage.createStorageOption(parsed.data as any);
      await storage.createActivityLog({ action: 'storage_option_created', entity: 'storage_option', entityId: created.id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Created storage option ${created.size}` });
      res.status(201).json(created);
    } catch (err) {
      console.error('Error creating storage option:', err);
      sendError(res, 500, "Failed to create storage option");
    }
  });

  app.patch("/api/storage-options/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = storageOptionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', details: parsed.error.errors });
    try {
      const { id } = req.params;
      const updated = await storage.updateStorageOption(id, parsed.data as any);
      if (!updated) return sendError(res, 404, "Storage option not found");
      await storage.createActivityLog({ action: 'storage_option_updated', entity: 'storage_option', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Updated storage option ${updated.size}` });
      res.json(updated);
    } catch (err) {
      console.error('Error updating storage option:', err);
      sendError(res, 500, "Failed to update storage option");
    }
  });

  app.delete("/api/storage-options/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteStorageOption(id);
      await storage.createActivityLog({ action: 'storage_option_deleted', entity: 'storage_option', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Deleted storage option ${id}` });
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting storage option:', err);
      sendError(res, 500, "Failed to delete storage option");
    }
  });

  // Create or update base value (Owner only)
  app.post("/api/trade-in/base-values", async (req: Request, res: Response) => {
    try {
      const { brand, model, storage: storageSize, baseValue, shopId } = req.body;
      
      if (!brand || !model || !storageSize || baseValue === undefined) {
        return sendError(res, 400, "All fields are required");
      }
      
      const created = await storage.createDeviceBaseValue({
        brand,
        model,
        storage: storageSize,
        baseValue,
        isActive: true,
        shopId: shopId || null,
      });
      
      res.json(created);
    } catch (error) {
      console.error("Error creating base value:", error);
      sendError(res, 500, "Failed to create base value");
    }
  });

  app.put("/api/trade-in/base-values/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updated = await storage.updateDeviceBaseValue(id, updates);
      if (!updated) {
        return sendError(res, 404, "Base value not found");
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating base value:", error);
      sendError(res, 500, "Failed to update base value");
    }
  });

  // Validate IMEI
  app.get("/api/trade-in/validate-imei/:imei", async (req: Request, res: Response) => {
    try {
      const { imei } = req.params;
      
      // Check format validity
      const validation = validateIMEI(imei);
      if (!validation.valid) {
        return res.json({ 
          valid: false, 
          message: validation.error,
          blocked: false,
          duplicate: false,
        });
      }
      
      // Check if IMEI is blocked
      const blocked = await storage.getBlockedImei(imei);
      if (blocked) {
        return res.json({ 
          valid: false, 
          message: `IMEI blocked: ${blocked.reason}`,
          blocked: true,
          blockReason: blocked.reason,
          duplicate: false,
        });
      }
      
      // Check if IMEI was already traded in
      const existing = await storage.getTradeInByImei(imei);
      const isDuplicate = existing && existing.status !== 'rejected' && existing.status !== 'cancelled';
      
      res.json({ 
        valid: !isDuplicate,
        message: isDuplicate ? "This device has already been traded in" : undefined,
        blocked: false,
        duplicate: isDuplicate,
        existingTradeIn: isDuplicate ? {
          id: existing.id,
          tradeInNumber: existing.tradeInNumber,
          status: existing.status,
        } : undefined,
      });
    } catch (error) {
      console.error("Error validating IMEI:", error);
      sendError(res, 500, "Failed to validate IMEI");
    }
  });

  // Calculate trade-in offer (preview before submission)
  app.post("/api/trade-in/calculate", async (req: Request, res: Response) => {
    try {
      const { brand, model, storage: storageSize, conditionAnswers, isIcloudLocked, isGoogleLocked, imei } = req.body;
      
      // Get base value
      const baseValueRecord = await storage.getDeviceBaseValue(brand, model, storageSize);
      if (!baseValueRecord) {
        return sendError(res, 404, "No base value found for this device configuration");
      }
      
      // Get questions for scoring
      const questions = await storage.getConditionQuestions();
      const formattedQuestions = questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options as ConditionOption[],
      }));
      
      // Validate IMEI
      const imeiValidation = validateIMEI(imei || "");
      const blocked = imei ? await storage.getBlockedImei(imei) : null;
      const existing = imei ? await storage.getTradeInByImei(imei) : null;
      const isDuplicate = existing && existing.status !== 'rejected' && existing.status !== 'cancelled';
      
      // Process trade-in scoring
      const result = processTradeIn(
        baseValueRecord.baseValue,
        conditionAnswers || {},
        formattedQuestions,
        isIcloudLocked || false,
        isGoogleLocked || false,
        isDuplicate || false,
        !imeiValidation.valid
      );
      
      res.json({
        baseValue: baseValueRecord.baseValue,
        ...result,
      });
    } catch (error) {
      console.error("Error calculating offer:", error);
      sendError(res, 500, "Failed to calculate offer");
    }
  });

  // Submit trade-in assessment
  app.post("/api/trade-in/submit", async (req: Request, res: Response) => {
    try {
      const parsed = tradeInWizardSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Invalid input", parsed.error.errors);
      }
      
      const data = parsed.data;
      const attachments = Array.isArray(data.attachments) ? data.attachments : [];
      
      // Validate IMEI
      const imeiValidation = validateIMEI(data.imei);
      if (!imeiValidation.valid) {
        return sendError(res, 400, imeiValidation.error || "Invalid IMEI");
      }
      
      // Check if blocked
      const blocked = await storage.getBlockedImei(data.imei);
      if (blocked) {
        return sendError(res, 400, `IMEI blocked: ${blocked.reason}`);
      }
      
      // Check duplicate
      const existing = await storage.getTradeInByImei(data.imei);
      const isDuplicate = existing && existing.status !== 'rejected' && existing.status !== 'cancelled';
      
      if (isDuplicate) {
        // Block the IMEI
        await storage.createBlockedImei({
          imei: data.imei,
          reason: "duplicate",
          blockedBy: "system",
          notes: `Duplicate attempt. Original trade-in: ${existing.tradeInNumber}`,
        });
        return res.status(400).json({ 
          message: "Duplicate IMEI - this device has already been traded in",
          existingTradeIn: existing.tradeInNumber,
        });
      }
      
      // Get base value
      const baseValueRecord = await storage.getDeviceBaseValue(data.brand, data.model, data.storage || "Unknown");
      if (!baseValueRecord) {
        return sendError(res, 400, "No base value found for this device. Please contact manager.");
      }
      
      // Get questions and calculate score
      const questions = await storage.getConditionQuestions();
      const formattedQuestions = questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options as ConditionOption[],
      }));
      
      const scoringResult = processTradeIn(
        baseValueRecord.baseValue,
        data.conditionAnswers,
        formattedQuestions,
        data.isIcloudLocked,
        data.isGoogleLocked,
        false,
        false
      );
      
      // Generate trade-in number
      const tradeInNumber = await storage.getNextTradeInNumber();
      
      // Determine status based on decision
      let status: string;
      if (scoringResult.decision === "auto_accept") {
        status = "approved";
      } else if (scoringResult.decision === "auto_reject") {
        status = "rejected";
      } else {
        status = "pending";
      }
      
      // Create the assessment
      const shopId = (req.body.shopId as string | undefined) || req.currentUser?.shopId || null;
      const processedBy = req.currentUser?.id || (req.body.processedBy as string | undefined) || null;

      const assessment = await storage.createTradeInAssessment({
        tradeInNumber,
        brand: data.brand,
        model: data.model,
        storage: data.storage,
        color: data.color,
        imei: data.imei,
        serialNumber: data.serialNumber,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        baseValue: baseValueRecord.baseValue,
        conditionAnswers: data.conditionAnswers,
        conditionScore: scoringResult.conditionScore,
        calculatedOffer: scoringResult.calculatedOffer,
        finalOffer: scoringResult.decision === "auto_accept" ? scoringResult.calculatedOffer : null,
        decision: scoringResult.decision,
        rejectionReasons: scoringResult.rejectionReasons.length > 0 ? scoringResult.rejectionReasons : null,
        payoutMethod: data.payoutMethod || null,
        linkedSaleId: data.linkedSaleId || null,
        linkedRepairId: data.linkedRepairId || null,
        status,
        shopId,
        processedBy,
        attachments,
      });
      
      // Create audit log
      await storage.createTradeInAuditLog({
        tradeInId: assessment.id,
        action: "created",
        newState: assessment,
        userId: processedBy || undefined,
        userName: req.currentUser?.name || req.body.processedByName || "System",
        notes: `Trade-in ${tradeInNumber} created with decision: ${scoringResult.decision}`,
      });
      
      res.json({
        assessment,
        scoring: scoringResult,
      });
    } catch (error) {
      console.error("Error submitting trade-in:", error);
      sendError(res, 500, "Failed to submit trade-in");
    }
  });

  // Get all trade-in assessments
  app.get("/api/trade-in/assessments", async (req: Request, res: Response) => {
    try {
      const shopId = req.query.shopId as string | undefined;
      const assessments = await storage.getTradeInAssessments(shopId);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      sendError(res, 500, "Failed to fetch assessments");
    }
  });

  // ==================== PRODUCTS API ====================
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const shopId = req.query.shopId as string | undefined;
      const list = await storage.getProducts(shopId);
      const page = Math.max(Number(req.query.page || 1), 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize || 100), 1), 500);
      const start = (page - 1) * pageSize;
      const paged = list.slice(start, start + pageSize);
      res.json({
        data: paged,
        page,
        pageSize,
        total: list.length,
        totalPages: Math.max(Math.ceil(list.length / pageSize), 1),
      });
    } catch (err) {
      console.error("Error fetching products:", err);
      sendError(res, 500, "Failed to fetch products");
    }
  });

  app.post("/api/products", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      if (Number(payload.stock) < 0 || Number(payload.minStock) < 0) {
        return sendError(res, 400, "Stock values cannot be negative");
      }
      if (Number(payload.price) < 0 || Number(payload.costPrice) < 0) {
        return sendError(res, 400, "Price values cannot be negative");
      }
      const created = await storage.createProduct({
        ...payload,
        slug: payload.slug || slugify(payload.name || ""),
        shopId: payload.shopId || req.currentUser?.shopId || null,
      });
      await storage.createActivityLog({ action: "product_created", entity: "product", entityId: created.id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Created product ${created.name}`, metadata: { product: created } });
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating product:", err);
      sendError(res, 500, "Failed to create product");
    }
  });

  app.patch("/api/products/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (req.body.stock !== undefined && Number(req.body.stock) < 0) {
        return sendError(res, 400, "Stock cannot be negative");
      }
      if (req.body.minStock !== undefined && Number(req.body.minStock) < 0) {
        return sendError(res, 400, "Minimum stock cannot be negative");
      }
      if (req.body.price !== undefined && Number(req.body.price) < 0) {
        return sendError(res, 400, "Price cannot be negative");
      }
      if (req.body.costPrice !== undefined && Number(req.body.costPrice) < 0) {
        return sendError(res, 400, "Cost price cannot be negative");
      }
      const updated = await storage.updateProduct(id, {
        ...req.body,
        slug: req.body.slug || (req.body.name ? slugify(req.body.name) : undefined),
      });
      if (!updated) return sendError(res, 404, "Product not found");
      await storage.createActivityLog({ action: "product_updated", entity: "product", entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Updated product ${updated.name}` });
      res.json(updated);
    } catch (err) {
      console.error("Error updating product:", err);
      sendError(res, 500, "Failed to update product");
    }
  });

  app.delete("/api/products/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteProduct(id);
      await storage.createActivityLog({ action: "product_deleted", entity: "product", entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Deleted product ${id}` });
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting product:", err);
      sendError(res, 500, "Failed to delete product");
    }
  });

  // Get single trade-in assessment
  app.get("/api/trade-in/assessments/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const assessment = await storage.getTradeInAssessment(id);
      
      if (!assessment) {
        return sendError(res, 404, "Assessment not found");
      }
      
      // Get audit logs for this assessment
      const auditLogs = await storage.getTradeInAuditLogs(id);
      
      res.json({ assessment, auditLogs });
    } catch (error) {
      console.error("Error fetching assessment:", error);
      sendError(res, 500, "Failed to fetch assessment");
    }
  });

  // Review/approve/reject a trade-in (for manual review cases)
  app.post("/api/trade-in/assessments/:id/review", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = tradeInReviewSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return sendError(res, 400, "Invalid input", parsed.error.errors);
      }
      
      const { decision, finalOffer, reviewNotes, rejectionReasons } = parsed.data;
      
      const existing = await storage.getTradeInAssessment(id);
      if (!existing) {
        return sendError(res, 404, "Assessment not found");
      }
      
      const previousState = { ...existing };
      
      const reviewerId = req.currentUser?.id || (req.body.reviewedBy as string | undefined);
      const updated = await storage.updateTradeInAssessment(id, {
        decision,
        status: decision === "accepted" ? "approved" : "rejected",
        finalOffer: finalOffer || existing.calculatedOffer,
        reviewNotes,
        rejectionReasons: rejectionReasons || null,
        reviewedBy: reviewerId || null,
        reviewedAt: new Date(),
      });
      
      // Create audit log
      await storage.createTradeInAuditLog({
        tradeInId: id,
        action: "reviewed",
        previousState,
        newState: updated,
        userId: reviewerId,
        userName: req.currentUser?.name || req.body.reviewedByName || "Manager",
        notes: `Trade-in ${decision}. ${reviewNotes || ""}`,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error reviewing trade-in:", error);
      sendError(res, 500, "Failed to review trade-in");
    }
  });

  // Complete payout for approved trade-in
  app.post("/api/trade-in/assessments/:id/complete-payout", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { payoutMethod, payoutReference } = req.body;
      const completedBy = req.currentUser?.id || (req.body.completedBy as string | undefined);
      
      const existing = await storage.getTradeInAssessment(id);
      if (!existing) {
        return sendError(res, 404, "Assessment not found");
      }
      
      if (existing.status !== "approved") {
        return sendError(res, 400, "Trade-in must be approved before completing payout");
      }
      
      const previousState = { ...existing };
      
      const updated = await storage.updateTradeInAssessment(id, {
        status: "completed",
        payoutMethod,
        payoutReference,
        payoutCompletedAt: new Date(),
      });
      
      // Create audit log
      await storage.createTradeInAuditLog({
        tradeInId: id,
        action: "payout_completed",
        previousState,
        newState: updated,
        userId: completedBy,
        userName: req.currentUser?.name || req.body.completedByName || "Staff",
        notes: `Payout completed via ${payoutMethod}. Reference: ${payoutReference || "N/A"}`,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error completing payout:", error);
      sendError(res, 500, "Failed to complete payout");
    }
  });

  // Get trade-in audit logs
  app.get("/api/trade-in/audit-logs", async (req: Request, res: Response) => {
    try {
      const shopId = req.query.shopId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAllTradeInAuditLogs(shopId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      sendError(res, 500, "Failed to fetch audit logs");
    }
  });

  return httpServer;
}
