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

type LoginWindow = { count: number; firstAttemptTs: number };
const loginAttempts = new Map<string, LoginWindow>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

const idempotencyCache = new Map<string, { status: number; payload: unknown; storedAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production for persistent sessions.");
  }

  // Railway and similar hosts sit behind reverse proxies.
  // Trust proxy headers so session/cookie handling works correctly.
  app.set("trust proxy", true);

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
  }

  // Choose session store: Postgres-backed when `pool` is available, otherwise in-memory store for local dev
  const sessionStore = pool
    ? new PgSession({
        pool,
        tableName: "user_sessions",
        // We create the table ourselves above; keep auto-create off for deterministic startup.
        createTableIfMissing: false,
      })
    : new session.MemoryStore();

  const sessionSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && !sessionSecret) {
    throw new Error("SESSION_SECRET is required in production.");
  }

  app.use(
    session({
      store: sessionStore,
      proxy: true,
      secret: sessionSecret || "dev-only-session-secret",
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

  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!req.currentUser) {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "Session expired" });
      }
      req.currentUser = user;
    }

    if (req.currentUser.status === "disabled") {
      return res.status(403).json({ message: "Account disabled" });
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

  const seedOwnerAccount = async () => {
    const existingOwners = await storage.listUsers();
    const owner = existingOwners.find(u => u.role === "Owner");
    if (!owner) {
      const created = await storage.createUser({
        username: "owner",
        password: hashSecret("0000"),
        name: "Shop Owner",
        email: "owner@ariostore.local",
        role: "Owner",
        status: "active",
        shopId: null,
      });
      try {
        await storage.createActivityLog({
          action: "seed",
          entity: "user",
          entityId: created.id,
          userId: created.id,
          userName: created.name || "Owner",
          role: created.role,
          details: "Default owner account created (username: owner, PIN: 0000). Please change immediately.",
          metadata: {},
        });
      } catch (err) {
        console.warn("Activity log table not ready during seed. Proceeding.");
      }
      console.log("Seeded default owner account (owner / 0000). Change the PIN in staff settings.");
    }

    // Seed a default staff login for convenience (username: staff, PIN: 1111)
    const staffUser = existingOwners.find(u => u.username === "staff");
    if (!staffUser) {
      const staff = await storage.createUser({
        username: "staff",
        password: hashSecret("1111"),
        name: "Default Staff",
        email: "staff@ariostore.local",
        role: "Sales",
        status: "active",
        shopId: null,
      });
      try {
        await storage.createActivityLog({
          action: "seed",
          entity: "user",
          entityId: staff.id,
          userId: staff.id,
          userName: staff.name || "Staff",
          role: staff.role,
          details: "Default staff account created (username: staff, PIN: 1111). Please change immediately.",
          metadata: {},
        });
      } catch (err) {
        console.warn("Activity log table not ready during staff seed. Proceeding.");
      }
      console.log("Seeded default staff account (staff / 1111). Change the PIN in staff settings.");
    }
  };

  const seedDefaultUsers = async () => {
    const existingUsers = await storage.listUsers();
    let ownerSeeded = false;
    let staffSeeded = false;

    const owner = existingUsers.find(u => u.role === "Owner");
    if (!owner) {
      const created = await storage.createUser({
        username: "owner",
        password: hashSecret("0000"),
        name: "Shop Owner",
        email: "owner@ariostore.local",
        role: "Owner",
        status: "active",
        shopId: null,
      });
      ownerSeeded = true;
      try {
        await storage.createActivityLog({
          action: "seed",
          entity: "user",
          entityId: created.id,
          userId: created.id,
          userName: created.name || "Owner",
          role: created.role,
          details: "Default owner account created (username: owner, PIN: 0000). Please change immediately.",
          metadata: {},
        });
      } catch (err) {
        console.warn("Activity log table not ready during seed. Proceeding.");
      }
    }

    const staffUser = existingUsers.find(u => u.username === "staff");
    if (!staffUser) {
      const staff = await storage.createUser({
        username: "staff",
        password: hashSecret("1111"),
        name: "Default Staff",
        email: "staff@ariostore.local",
        role: "Sales",
        status: "active",
        shopId: null,
      });
      staffSeeded = true;
      try {
        await storage.createActivityLog({
          action: "seed",
          entity: "user",
          entityId: staff.id,
          userId: staff.id,
          userName: staff.name || "Staff",
          role: staff.role,
          details: "Default staff account created (username: staff, PIN: 1111). Please change immediately.",
          metadata: {},
        });
      } catch (err) {
        console.warn("Activity log table not ready during staff seed. Proceeding.");
      }
    }

    return { ownerSeeded, staffSeeded };
  };

  // Do not auto-seed default credentials; owners must bootstrap explicitly.

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

  // Require auth for all API routes except auth endpoints
  app.use("/api", (req, res, next) => {
    // Allow unauthenticated access only to auth bootstrap/login endpoints.
    if (req.path.startsWith("/auth")) return next();
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

    const secretValid = user
      ? verifySecret(secret, user.password) || (!!user.pin && user.pin === secret)
      : false;

    if (!user || !secretValid) {
      trackFailedLogin(identityKey);
      return res.status(401).json({ message: "Invalid username or PIN" });
    }
    clearFailedLogins(identityKey);

    if (user.status === "disabled") {
      return res.status(403).json({ message: "Account disabled" });
    }

    // Regenerate + save explicitly so the cookie/session are durable across redirects/navigation.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.userId = user.id;
    req.session.role = user.role as User["role"];
    req.session.shopId = user.shopId || null;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    await storage.touchUserActivity(user.id, { lastLogin: true });
    await storage.createActivityLog({
      action: "login",
      entity: "auth",
      entityId: user.id,
      userId: user.id,
      userName: user.name || user.username,
      role: user.role,
      details: "User logged in",
      metadata: { shopId: user.shopId },
      shopId: user.shopId || undefined,
    });

    const preferences = await storage.upsertUserPreferences(user.id, {});
    res.json({ user: sanitizeUser(user), preferences });
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    req.session?.destroy(() => {});
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
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.currentUser || await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const preferences = await storage.upsertUserPreferences(user.id, {});
    res.json({ user: sanitizeUser(user), preferences });
  });

  app.get("/api/staff", requireRole(["Owner", "Manager"]), async (_req: Request, res: Response) => {
    const staff = await storage.listUsers();
    res.json(staff.map(u => sanitizeUser(u)));
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

  app.get("/api/leads", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = (req.query.shopId as string) || req.currentUser?.shopId || undefined;
      const list = await storage.getLeads(shopId);
      res.json(list);
    } catch (err) {
      console.error("Error fetching leads:", err);
      res.status(500).json({ error: "Failed to fetch leads" });
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
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const lead = await storage.getLead(id);
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json(lead);
    } catch (err) {
      console.error("Error fetching lead:", err);
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body as any;
      if (updates.nextFollowUpAt) updates.nextFollowUpAt = new Date(updates.nextFollowUpAt);
      const updated = await storage.updateLead(id, updates);
      if (!updated) return res.status(404).json({ error: "Lead not found" });

      await storage.createLeadAuditLog({ leadId: id, action: 'updated', userId: req.currentUser?.id, userName: req.currentUser?.name, details: 'Lead updated', metadata: updates });
      res.json(updated);
    } catch (err) {
      console.error("Error updating lead:", err);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.post("/api/leads/:id/assign", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const assignedTo = req.body.assignedTo as string | undefined;
      if (!assignedTo) return res.status(400).json({ error: "assignedTo is required" });
      const updated = await storage.updateLead(id, { assignedTo });
      if (!updated) return res.status(404).json({ error: "Lead not found" });

      await storage.createLeadAuditLog({ leadId: id, action: 'assigned', userId: req.currentUser?.id, userName: req.currentUser?.name, details: `Assigned to ${assignedTo}`, metadata: { assignedTo } });
      res.json(updated);
    } catch (err) {
      console.error("Error assigning lead:", err);
      res.status(500).json({ error: "Failed to assign lead" });
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
      if (!updated) return res.status(404).json({ error: "Lead not found" });

      await storage.createLeadAuditLog({ leadId: id, action: 'follow_up', userId: req.currentUser?.id, userName: req.currentUser?.name, details: `Follow-up: ${payload.note || ''}`, metadata: payload });
      res.json(updated);
    } catch (err) {
      console.error("Error adding follow-up:", err);
      res.status(500).json({ error: "Failed to add follow-up" });
    }
  });

  app.get("/api/leads/:id/audit-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const logs = await storage.getLeadAuditLogs(id);
      res.json(logs);
    } catch (err) {
      console.error("Error fetching lead audit logs:", err);
      res.status(500).json({ error: "Failed to fetch audit logs" });
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
      res.status(500).json({ error: "Failed to fetch questions" });
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
      res.status(500).json({ error: "Failed to fetch base values" });
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
      res.status(500).json({ error: "Failed to seed base values" });
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
      res.status(500).json({ error: "Failed to upsert base value" });
    }
  });

  // Get base value for specific device
  app.get("/api/trade-in/base-value", async (req: Request, res: Response) => {
    try {
      const { brand, model, storage: storageSize, shopId } = req.query;
      
      if (!brand || !model || !storageSize) {
        return res.status(400).json({ error: "Brand, model, and storage are required" });
      }
      
      const value = await storage.getDeviceBaseValue(
        brand as string, 
        model as string, 
        storageSize as string, 
        shopId as string | undefined
      );
      
      if (!value) {
        return res.status(404).json({ error: "No base value found for this device" });
      }
      
      res.json(value);
    } catch (error) {
      console.error("Error fetching base value:", error);
      res.status(500).json({ error: "Failed to fetch base value" });
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
      res.status(500).json({ error: "Failed to fetch brands" });
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
        return res.status(400).json({ error: "Brand or brand_id is required" });
      }
      
      const shopId = req.query.shopId as string | undefined;
      const values = await storage.getDeviceBaseValues(shopId);
      const models = Array.from(new Set(values.filter(v => v.brand === brand).map(v => v.model))).sort();
      res.json(models.map((name, index) => ({ id: String(index + 1), name })));
    } catch (error) {
      console.error("Error fetching models:", error);
      res.status(500).json({ error: "Failed to fetch models" });
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
      res.status(500).json({ error: "Failed to fetch storages" });
    }
  });

  // Seed normalized brands/models/storage data
  app.post("/api/seed-brands", async (req: Request, res: Response) => {
    try {
      // Check if brands already exist
      const existingBrands = await storage.getBrands();
      if (existingBrands.length > 0) {
        return res.json({ message: "Brands already seeded", count: existingBrands.length });
      }

      // Apple data
      const apple = await storage.createBrand({ name: "Apple", sortOrder: 1, isActive: true });
      const iphone16ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 16 Pro Max", sortOrder: 1, isActive: true });
      const iphone16Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 16 Pro", sortOrder: 2, isActive: true });
      const iphone16Plus = await storage.createModel({ brandId: apple.id, name: "iPhone 16 Plus", sortOrder: 3, isActive: true });
      const iphone16 = await storage.createModel({ brandId: apple.id, name: "iPhone 16", sortOrder: 4, isActive: true });
      const iphone15ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 15 Pro Max", sortOrder: 5, isActive: true });
      const iphone15Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 15 Pro", sortOrder: 6, isActive: true });
      const iphone15Plus = await storage.createModel({ brandId: apple.id, name: "iPhone 15 Plus", sortOrder: 7, isActive: true });
      const iphone15 = await storage.createModel({ brandId: apple.id, name: "iPhone 15", sortOrder: 8, isActive: true });
      const iphone14ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 14 Pro Max", sortOrder: 9, isActive: true });
      const iphone14Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 14 Pro", sortOrder: 10, isActive: true });
      const iphone14Plus = await storage.createModel({ brandId: apple.id, name: "iPhone 14 Plus", sortOrder: 11, isActive: true });
      const iphone14 = await storage.createModel({ brandId: apple.id, name: "iPhone 14", sortOrder: 12, isActive: true });
      const iphone13ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 13 Pro Max", sortOrder: 13, isActive: true });
      const iphone13Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 13 Pro", sortOrder: 14, isActive: true });
      const iphone13 = await storage.createModel({ brandId: apple.id, name: "iPhone 13", sortOrder: 15, isActive: true });
      const iphone13Mini = await storage.createModel({ brandId: apple.id, name: "iPhone 13 Mini", sortOrder: 16, isActive: true });
      const iphone12ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 12 Pro Max", sortOrder: 17, isActive: true });
      const iphone12Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 12 Pro", sortOrder: 18, isActive: true });
      const iphone12 = await storage.createModel({ brandId: apple.id, name: "iPhone 12", sortOrder: 19, isActive: true });
      const iphone12Mini = await storage.createModel({ brandId: apple.id, name: "iPhone 12 Mini", sortOrder: 20, isActive: true });
      const iphoneSE3 = await storage.createModel({ brandId: apple.id, name: "iPhone SE (3rd Gen)", sortOrder: 21, isActive: true });
      const iphone11ProMax = await storage.createModel({ brandId: apple.id, name: "iPhone 11 Pro Max", sortOrder: 22, isActive: true });
      const iphone11Pro = await storage.createModel({ brandId: apple.id, name: "iPhone 11 Pro", sortOrder: 23, isActive: true });
      const iphone11 = await storage.createModel({ brandId: apple.id, name: "iPhone 11", sortOrder: 24, isActive: true });

      // Storage options for Pro/Pro Max models (256GB, 512GB, 1TB)
      for (const m of [iphone16ProMax, iphone16Pro, iphone15ProMax, iphone15Pro, iphone14ProMax, iphone14Pro, iphone13ProMax, iphone13Pro]) {
        await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 1, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 2, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "1TB", sortOrder: 3, isActive: true });
      }

      // Storage options for standard models (128GB, 256GB, 512GB)
      for (const m of [iphone16Plus, iphone16, iphone15Plus, iphone15, iphone14Plus, iphone14, iphone13, iphone12, iphone11]) {
        await storage.createStorageOption({ modelId: m.id, size: "128GB", sortOrder: 1, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 2, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 3, isActive: true });
      }

      // Storage options for Mini models (64GB, 128GB, 256GB)
      for (const m of [iphone13Mini, iphone12Mini]) {
        await storage.createStorageOption({ modelId: m.id, size: "64GB", sortOrder: 1, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "128GB", sortOrder: 2, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 3, isActive: true });
      }

      // Storage options for 12 Pro/Pro Max (128GB, 256GB, 512GB)
      for (const m of [iphone12ProMax, iphone12Pro]) {
        await storage.createStorageOption({ modelId: m.id, size: "128GB", sortOrder: 1, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 2, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 3, isActive: true });
      }

      // Storage options for 11 Pro/Pro Max (64GB, 256GB, 512GB)
      for (const m of [iphone11ProMax, iphone11Pro]) {
        await storage.createStorageOption({ modelId: m.id, size: "64GB", sortOrder: 1, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 2, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 3, isActive: true });
      }

      // Storage for SE (64GB, 128GB, 256GB)
      await storage.createStorageOption({ modelId: iphoneSE3.id, size: "64GB", sortOrder: 1, isActive: true });
      await storage.createStorageOption({ modelId: iphoneSE3.id, size: "128GB", sortOrder: 2, isActive: true });
      await storage.createStorageOption({ modelId: iphoneSE3.id, size: "256GB", sortOrder: 3, isActive: true });

      // Samsung data
      const samsung = await storage.createBrand({ name: "Samsung", sortOrder: 2, isActive: true });
      const s24Ultra = await storage.createModel({ brandId: samsung.id, name: "Galaxy S24 Ultra", sortOrder: 1, isActive: true });
      const s24Plus = await storage.createModel({ brandId: samsung.id, name: "Galaxy S24+", sortOrder: 2, isActive: true });
      const s24 = await storage.createModel({ brandId: samsung.id, name: "Galaxy S24", sortOrder: 3, isActive: true });
      const s23Ultra = await storage.createModel({ brandId: samsung.id, name: "Galaxy S23 Ultra", sortOrder: 4, isActive: true });
      const s23Plus = await storage.createModel({ brandId: samsung.id, name: "Galaxy S23+", sortOrder: 5, isActive: true });
      const s23 = await storage.createModel({ brandId: samsung.id, name: "Galaxy S23", sortOrder: 6, isActive: true });
      const zFold5 = await storage.createModel({ brandId: samsung.id, name: "Galaxy Z Fold5", sortOrder: 7, isActive: true });
      const zFlip5 = await storage.createModel({ brandId: samsung.id, name: "Galaxy Z Flip5", sortOrder: 8, isActive: true });
      const a54 = await storage.createModel({ brandId: samsung.id, name: "Galaxy A54", sortOrder: 9, isActive: true });

      // Samsung storage options
      for (const m of [s24Ultra, s23Ultra]) {
        await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 1, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 2, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "1TB", sortOrder: 3, isActive: true });
      }

      for (const m of [s24Plus, s24, s23Plus, s23, zFold5, zFlip5]) {
        await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 1, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "512GB", sortOrder: 2, isActive: true });
      }

      await storage.createStorageOption({ modelId: a54.id, size: "128GB", sortOrder: 1, isActive: true });
      await storage.createStorageOption({ modelId: a54.id, size: "256GB", sortOrder: 2, isActive: true });

      // Google data
      const google = await storage.createBrand({ name: "Google", sortOrder: 3, isActive: true });
      const pixel8Pro = await storage.createModel({ brandId: google.id, name: "Pixel 8 Pro", sortOrder: 1, isActive: true });
      const pixel8 = await storage.createModel({ brandId: google.id, name: "Pixel 8", sortOrder: 2, isActive: true });
      const pixel7Pro = await storage.createModel({ brandId: google.id, name: "Pixel 7 Pro", sortOrder: 3, isActive: true });
      const pixel7 = await storage.createModel({ brandId: google.id, name: "Pixel 7", sortOrder: 4, isActive: true });
      const pixel7a = await storage.createModel({ brandId: google.id, name: "Pixel 7a", sortOrder: 5, isActive: true });

      for (const m of [pixel8Pro, pixel8, pixel7Pro, pixel7]) {
        await storage.createStorageOption({ modelId: m.id, size: "128GB", sortOrder: 1, isActive: true });
        await storage.createStorageOption({ modelId: m.id, size: "256GB", sortOrder: 2, isActive: true });
      }

      await storage.createStorageOption({ modelId: pixel7a.id, size: "128GB", sortOrder: 1, isActive: true });

      res.json({ message: "Brands, models, and storage options seeded successfully" });
    } catch (error) {
      console.error("Error seeding brands:", error);
      res.status(500).json({ error: "Failed to seed brands" });
    }
  });

  // Seed default owner/staff users (Owner only)
  app.post("/api/seed-users", requireRole(["Owner"]), async (_req: Request, res: Response) => {
    try {
      if (process.env.ENABLE_DEFAULT_USER_SEED !== "true") {
        return res.status(403).json({ error: "Default user seeding is disabled by policy." });
      }
      const result = await seedDefaultUsers();
      res.json({ message: "Users seeded", ...result });
    } catch (error) {
      console.error("Error seeding users:", error);
      res.status(500).json({ error: "Failed to seed users" });
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
      res.status(500).json({ error: 'Failed to create brand' });
    }
  });

  app.patch("/api/brands/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = brandSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', details: parsed.error.errors });
    try {
      const { id } = req.params;
      const updated = await storage.updateBrand(id, parsed.data as any);
      if (!updated) return res.status(404).json({ error: 'Brand not found' });
      await storage.createActivityLog({ action: 'brand_updated', entity: 'brand', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Updated brand ${updated.name}` });
      res.json(updated);
    } catch (err) {
      console.error('Error updating brand:', err);
      res.status(500).json({ error: 'Failed to update brand' });
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
      res.status(500).json({ error: 'Failed to delete brand' });
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
      res.status(500).json({ error: 'Failed to create model' });
    }
  });

  app.patch("/api/models/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = modelSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', details: parsed.error.errors });
    try {
      const { id } = req.params;
      const updated = await storage.updateModel(id, parsed.data as any);
      if (!updated) return res.status(404).json({ error: 'Model not found' });
      await storage.createActivityLog({ action: 'model_updated', entity: 'model', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Updated model ${updated.name}` });
      res.json(updated);
    } catch (err) {
      console.error('Error updating model:', err);
      res.status(500).json({ error: 'Failed to update model' });
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
      res.status(500).json({ error: 'Failed to delete model' });
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
      res.status(500).json({ error: 'Failed to create storage option' });
    }
  });

  app.patch("/api/storage-options/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    const parsed = storageOptionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', details: parsed.error.errors });
    try {
      const { id } = req.params;
      const updated = await storage.updateStorageOption(id, parsed.data as any);
      if (!updated) return res.status(404).json({ error: 'Storage option not found' });
      await storage.createActivityLog({ action: 'storage_option_updated', entity: 'storage_option', entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Updated storage option ${updated.size}` });
      res.json(updated);
    } catch (err) {
      console.error('Error updating storage option:', err);
      res.status(500).json({ error: 'Failed to update storage option' });
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
      res.status(500).json({ error: 'Failed to delete storage option' });
    }
  });

  // Create or update base value (Owner only)
  app.post("/api/trade-in/base-values", async (req: Request, res: Response) => {
    try {
      const { brand, model, storage: storageSize, baseValue, shopId } = req.body;
      
      if (!brand || !model || !storageSize || baseValue === undefined) {
        return res.status(400).json({ error: "All fields are required" });
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
      res.status(500).json({ error: "Failed to create base value" });
    }
  });

  app.put("/api/trade-in/base-values/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updated = await storage.updateDeviceBaseValue(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Base value not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating base value:", error);
      res.status(500).json({ error: "Failed to update base value" });
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
          error: validation.error,
          blocked: false,
          duplicate: false,
        });
      }
      
      // Check if IMEI is blocked
      const blocked = await storage.getBlockedImei(imei);
      if (blocked) {
        return res.json({ 
          valid: false, 
          error: `IMEI blocked: ${blocked.reason}`,
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
        error: isDuplicate ? "This device has already been traded in" : undefined,
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
      res.status(500).json({ error: "Failed to validate IMEI" });
    }
  });

  // Calculate trade-in offer (preview before submission)
  app.post("/api/trade-in/calculate", async (req: Request, res: Response) => {
    try {
      const { brand, model, storage: storageSize, conditionAnswers, isIcloudLocked, isGoogleLocked, imei } = req.body;
      
      // Get base value
      const baseValueRecord = await storage.getDeviceBaseValue(brand, model, storageSize);
      if (!baseValueRecord) {
        return res.status(404).json({ error: "No base value found for this device configuration" });
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
      res.status(500).json({ error: "Failed to calculate offer" });
    }
  });

  // Submit trade-in assessment
  app.post("/api/trade-in/submit", async (req: Request, res: Response) => {
    try {
      const parsed = tradeInWizardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
      }
      
      const data = parsed.data;
      const attachments = Array.isArray(data.attachments) ? data.attachments : [];
      
      // Validate IMEI
      const imeiValidation = validateIMEI(data.imei);
      if (!imeiValidation.valid) {
        return res.status(400).json({ error: imeiValidation.error });
      }
      
      // Check if blocked
      const blocked = await storage.getBlockedImei(data.imei);
      if (blocked) {
        return res.status(400).json({ error: `IMEI blocked: ${blocked.reason}` });
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
          error: "Duplicate IMEI - this device has already been traded in",
          existingTradeIn: existing.tradeInNumber,
        });
      }
      
      // Get base value
      const baseValueRecord = await storage.getDeviceBaseValue(data.brand, data.model, data.storage || "Unknown");
      if (!baseValueRecord) {
        return res.status(400).json({ error: "No base value found for this device. Please contact manager." });
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
      res.status(500).json({ error: "Failed to submit trade-in" });
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
      res.status(500).json({ error: "Failed to fetch assessments" });
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
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      if (Number(payload.stock) < 0 || Number(payload.minStock) < 0) {
        return res.status(400).json({ error: "Stock values cannot be negative" });
      }
      if (Number(payload.price) < 0 || Number(payload.costPrice) < 0) {
        return res.status(400).json({ error: "Price values cannot be negative" });
      }
      const created = await storage.createProduct({ ...payload, shopId: payload.shopId || req.currentUser?.shopId || null });
      await storage.createActivityLog({ action: "product_created", entity: "product", entityId: created.id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Created product ${created.name}`, metadata: { product: created } });
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating product:", err);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (req.body.stock !== undefined && Number(req.body.stock) < 0) {
        return res.status(400).json({ error: "Stock cannot be negative" });
      }
      if (req.body.minStock !== undefined && Number(req.body.minStock) < 0) {
        return res.status(400).json({ error: "Minimum stock cannot be negative" });
      }
      if (req.body.price !== undefined && Number(req.body.price) < 0) {
        return res.status(400).json({ error: "Price cannot be negative" });
      }
      if (req.body.costPrice !== undefined && Number(req.body.costPrice) < 0) {
        return res.status(400).json({ error: "Cost price cannot be negative" });
      }
      const updated = await storage.updateProduct(id, req.body);
      if (!updated) return res.status(404).json({ error: "Product not found" });
      await storage.createActivityLog({ action: "product_updated", entity: "product", entityId: id, userId: req.currentUser?.id, userName: req.currentUser?.name, role: req.currentUser?.role, details: `Updated product ${updated.name}` });
      res.json(updated);
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(500).json({ error: "Failed to update product" });
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
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Get single trade-in assessment
  app.get("/api/trade-in/assessments/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const assessment = await storage.getTradeInAssessment(id);
      
      if (!assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      
      // Get audit logs for this assessment
      const auditLogs = await storage.getTradeInAuditLogs(id);
      
      res.json({ assessment, auditLogs });
    } catch (error) {
      console.error("Error fetching assessment:", error);
      res.status(500).json({ error: "Failed to fetch assessment" });
    }
  });

  // Review/approve/reject a trade-in (for manual review cases)
  app.post("/api/trade-in/assessments/:id/review", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = tradeInReviewSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
      }
      
      const { decision, finalOffer, reviewNotes, rejectionReasons } = parsed.data;
      
      const existing = await storage.getTradeInAssessment(id);
      if (!existing) {
        return res.status(404).json({ error: "Assessment not found" });
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
      res.status(500).json({ error: "Failed to review trade-in" });
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
        return res.status(404).json({ error: "Assessment not found" });
      }
      
      if (existing.status !== "approved") {
        return res.status(400).json({ error: "Trade-in must be approved before completing payout" });
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
      res.status(500).json({ error: "Failed to complete payout" });
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
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  return httpServer;
}
