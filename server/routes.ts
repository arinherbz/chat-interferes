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
  type ConditionQuestion as PersistedConditionQuestion,
  type InsertDelivery,
  type User,
} from "@shared/schema";
import { 
  validateIMEI, 
  processTradeIn,
  calculateConditionScore,
  getConditionQuestionsForDeviceType,
  DEFAULT_BASE_VALUES,
} from "./trade-in-scoring";
import { getTradeInIdentifierType, inferTradeInDeviceType, type TradeInDeviceType } from "../shared/trade-in-profile";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { handleUpload, removeUploadedFileByUrl, serveUploadedMedia } from "./uploads";
import { asyncHandler } from "./middleware/async-handler";
import { commerceService, ORDER_STATUSES } from "./services/commerce-service";
import { HttpError, sendFailure, sendSuccess } from "./utils/api-response";
import { normalizeUgPhoneNumber } from "./utils/phone";
import { registerWebAuthnRoutes } from "./webauthn-routes";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: User["role"];
    shopId?: string | null;
    customerAccountId?: string;
    customerId?: string;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    currentUser?: User;
    currentStoreCustomer?: {
      accountId: string;
      customerId: string;
      name: string;
      email?: string | null;
      phone: string;
    };
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

const storeSignupSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const storeLoginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(6, "Password is required"),
});

const baseValueUpsertSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  storage: z.string().min(1),
  baseValue: z.number().positive(),
  shopId: z.string().optional(),
  isActive: z.boolean().optional(),
});

const conditionQuestionManageSchema = z.object({
  id: z.string().optional(),
  deviceType: z.enum(["phone", "tablet", "laptop", "other"]),
  category: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.object({
    value: z.string().min(1),
    label: z.string().min(1),
    deduction: z.number().min(0).max(100),
    isRejection: z.boolean().optional(),
  })).min(2),
  sortOrder: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
  isCritical: z.boolean().default(false),
  isActive: z.boolean().default(true),
  shopId: z.string().optional().nullable(),
});

function resolveTradeInDeviceType(payload: {
  deviceType?: string | null;
  brand?: string | null;
  model?: string | null;
  storage?: string | null;
}): TradeInDeviceType {
  return inferTradeInDeviceType(payload);
}

function getTradeInQuestions(deviceType: TradeInDeviceType) {
  return getConditionQuestionsForDeviceType(deviceType).map((question) => ({
    id: question.id,
    category: question.category,
    question: question.question,
    options: question.options as ConditionOption[],
    sortOrder: question.sortOrder ?? 0,
    isRequired: question.isRequired ?? true,
    isCritical: question.isCritical ?? false,
  }));
}

type EffectiveTradeInQuestion = ReturnType<typeof getTradeInQuestions>[number];

function normalizePersistedTradeInQuestion(question: PersistedConditionQuestion): EffectiveTradeInQuestion {
  const options = Array.isArray(question.options)
    ? (question.options as ConditionOption[])
    : typeof question.options === "string"
      ? JSON.parse(question.options) as ConditionOption[]
      : [];

  return {
    id: question.id,
    category: question.category,
    question: question.question,
    options,
    sortOrder: question.sortOrder ?? 0,
    isRequired: question.isRequired ?? true,
    isCritical: question.isCritical ?? false,
  };
}

async function seedDefaultTradeInQuestions(deviceType: TradeInDeviceType) {
  const defaults = getConditionQuestionsForDeviceType(deviceType);
  for (const question of defaults) {
    await storage.createConditionQuestion({
      deviceType,
      category: question.category,
      question: question.question,
      options: question.options as any,
      sortOrder: question.sortOrder ?? 0,
      isRequired: question.isRequired ?? true,
      isCritical: question.isCritical ?? false,
      isActive: true,
      shopId: null,
    });
  }
}

async function getEffectiveTradeInQuestions(deviceType: TradeInDeviceType, shopId?: string) {
  const defaultQuestions = getTradeInQuestions(deviceType);

  try {
    const shopQuestions = shopId
      ? await storage.getConditionQuestions({ deviceType, shopId })
      : [];

    if (shopQuestions.length > 0) {
      return {
        source: "shop" as const,
        deviceType,
        questions: shopQuestions.map(normalizePersistedTradeInQuestion),
      };
    }

    let defaultProfile = await storage.getConditionQuestions({ deviceType });
    if (defaultProfile.length === 0) {
      await seedDefaultTradeInQuestions(deviceType);
      defaultProfile = await storage.getConditionQuestions({ deviceType });
    }

    if (defaultProfile.length > 0) {
      return {
        source: "default" as const,
        deviceType,
        questions: defaultProfile.map(normalizePersistedTradeInQuestion),
      };
    }
  } catch (error) {
    console.warn(`[trade-in] Falling back to built-in ${deviceType} condition profile:`, error);
  }

  return {
    source: "builtin" as const,
    deviceType,
    questions: defaultQuestions,
  };
}

function validateSerialNumber(serialNumber?: string | null): { valid: boolean; value: string; error?: string } {
  const value = (serialNumber ?? "").trim();
  if (value.length < 4) {
    return { valid: false, value, error: "Serial number must be at least 4 characters" };
  }
  if (value.length > 64) {
    return { valid: false, value, error: "Serial number is too long" };
  }
  return { valid: true, value };
}

function validateTradeInIdentifier(payload: {
  deviceType: TradeInDeviceType;
  imei?: string | null;
  serialNumber?: string | null;
}): {
  identifierType: "imei" | "serial";
  identifierValue: string;
  serialNumber: string | null;
  valid: boolean;
  error?: string;
} {
  const identifierType = getTradeInIdentifierType(payload.deviceType);
  if (identifierType === "imei") {
    const normalizedImei = (payload.imei ?? "").trim();
    const validation = validateIMEI(normalizedImei);
    return {
      identifierType,
      identifierValue: normalizedImei,
      serialNumber: (payload.serialNumber ?? "").trim() || null,
      valid: validation.valid,
      error: validation.error,
    };
  }

  const validation = validateSerialNumber(payload.serialNumber);
  const identifierValue = validation.valid ? validation.value : (payload.serialNumber ?? "").trim();
  return {
    identifierType,
    identifierValue,
    serialNumber: validation.valid ? validation.value : identifierValue || null,
    valid: validation.valid,
    error: validation.error,
  };
}

function normalizeBaseValueText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeBrandName(value: string | null | undefined) {
  const normalized = normalizeBaseValueText(value).toLowerCase();
  if (!normalized) return "";
  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStorageLabel(value: string | null | undefined) {
  const normalized = normalizeBaseValueText(value);
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) {
    return `${normalized}GB`;
  }
  return normalized.toUpperCase().replace(/\s+/g, "");
}

function normalizeBaseValuePayload(payload: {
  brand: string;
  model: string;
  storage: string;
  baseValue: number;
  isActive?: boolean;
  shopId?: string | null;
}) {
  return {
    brand: normalizeBrandName(payload.brand),
    model: normalizeBaseValueText(payload.model),
    storage: normalizeStorageLabel(payload.storage),
    baseValue: payload.baseValue,
    isActive: payload.isActive ?? true,
    shopId: payload.shopId || null,
  };
}

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

const productUpsertSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  displayTitle: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  category: z.string().min(1, "Category is required").max(120),
  condition: z.string().trim().max(120).optional().nullable(),
  price: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int().nonnegative(),
  costPrice: z.coerce.number().nonnegative(),
  minStock: z.coerce.number().int().nonnegative(),
  sku: z.string().trim().max(120).optional().nullable(),
  barcode: z.string().trim().max(120).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  storefrontVisibility: z.enum(["published", "draft", "hidden", "archived"]).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isFlashDeal: z.boolean().optional(),
  flashDealPrice: z.coerce.number().int().nonnegative().optional().nullable(),
  flashDealEndsAt: z.string().datetime().optional().nullable(),
  shopId: z.string().optional().nullable(),
});

function normalizeProductText(value?: string | null) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function normalizeProductBarcode(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeProductImageUrl(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeProductDate(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function slugifyShopName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "main-shop";
}

function getProductValidationMessage(error: z.ZodError) {
  const firstIssue = error.issues[0];
  const field = firstIssue?.path?.[0];
  if (field === "stock" || field === "minStock") {
    return "Stock values cannot be negative";
  }
  if (field === "price" || field === "costPrice") {
    return "Price values cannot be negative";
  }
  return firstIssue?.message || "Invalid product payload";
}

const closureStatusUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "flagged"]),
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
    return sendFailure(res, status, message, details);
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
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(self)");
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

  // Attach the current user to the request for downstream handlers
  app.use(async (req, _res, next) => {
    if (req.session?.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.currentUser = user;
      }
    }
    if (req.session?.customerAccountId && req.session?.customerId) {
      const [account, customer] = await Promise.all([
        storage.getCustomerAccount(req.session.customerAccountId),
        storage.getCustomer(req.session.customerId),
      ]);
      if (account && customer) {
        req.currentStoreCustomer = {
          accountId: account.id,
          customerId: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        };
      }
    }
    next();
  });

  const requireStoreCustomer = (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentStoreCustomer) {
      return res.status(401).json({ message: "Store customer authentication required" });
    }
    next();
  };

  // Require auth for all API routes except auth endpoints
  app.use("/api", (req, res, next) => {
    // Public customer/storefront APIs must stay accessible without a session.
    if (req.path.startsWith("/auth") || req.path.startsWith("/store")) return next();
    return requireAuth(req, res, next);
  });

  // ===================== UPLOADS =====================
  app.get("/uploads/media/:id/:filename?", asyncHandler(serveUploadedMedia));
  app.post("/api/uploads", requireRole(["Owner", "Manager"]), handleUpload);

  // ===================== WEBAUTHN (FACE ID / TOUCH ID) =====================
  registerWebAuthnRoutes(app, requireAuth, storage);

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

    const existingShops = await storage.getShops();
    if (existingShops.length === 0) {
      const defaultShop = await storage.createShop({
        name: "Main Shop",
        slug: slugifyShopName("Main Shop"),
        address: "",
        description: "Primary Ariostore branch",
        currency: "UGX",
        timezone: "UTC",
        subscriptionPlan: "trial",
        isMain: true,
      });
      const updatedOwner = await storage.updateUser(created.id, { shopId: defaultShop.id });
      if (updatedOwner) {
        created.shopId = updatedOwner.shopId;
      }
    }

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

    if (!authenticatedUser.shopId) {
      const existingShops = await storage.getShops();
      let assignedShop = existingShops.find((shop) => shop.isMain) ?? existingShops[0];
      if (!assignedShop && authenticatedUser.role === "Owner") {
        assignedShop = await storage.createShop({
          name: "Main Shop",
          slug: slugifyShopName("Main Shop"),
          address: "",
          description: "Primary Ariostore branch",
          currency: "UGX",
          timezone: "UTC",
          subscriptionPlan: "trial",
          isMain: true,
        });
      }
      if (assignedShop) {
        const updatedUser = await storage.updateUser(authenticatedUser.id, { shopId: assignedShop.id });
        if (updatedUser) {
          authenticatedUser = updatedUser;
        }
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

  app.get("/api/auth/me", asyncHandler(async (req: Request, res: Response) => {
    const user = req.currentUser;
    if (!user) {
      res.json({ user: null, preferences: null });
      return;
    }
    const preferences = await storage.upsertUserPreferences(user.id, {});
    res.json({ user: sanitizeUser(user), preferences });
  }));

  app.post("/api/store/auth/signup", asyncHandler(async (req: Request, res: Response) => {
    const payload = storeSignupSchema.parse(req.body);
    const email = payload.email?.trim().toLowerCase() || null;
    const phone = normalizeUgPhoneNumber(payload.phone);

    if (email) {
      const existingEmailAccount = await storage.getCustomerAccountByEmail(email);
      if (existingEmailAccount) {
        throw new HttpError(409, "An account with this email already exists");
      }
    }

    const existingPhoneAccount = await storage.getCustomerAccountByPhone(phone);
    if (existingPhoneAccount) {
      throw new HttpError(409, "An account with this phone number already exists");
    }

    let customer =
      (email ? await storage.getCustomerByEmail(email) : undefined) ??
      (await storage.getCustomerByPhone(phone));

    if (customer) {
      customer =
        (await storage.updateCustomer(customer.id, {
          name: payload.name.trim(),
          email,
          phone,
        })) ?? customer;
    } else {
      customer = await storage.createCustomer({
        name: payload.name.trim(),
        phone,
        email,
        shopId: null,
      });
    }

    const existingLinkedAccount = await storage.getCustomerAccountByCustomerId(customer.id);
    if (existingLinkedAccount) {
      throw new HttpError(409, "This customer already has an account");
    }

    const account = await storage.createCustomerAccount({
      customerId: customer.id,
      email,
      phone,
      password: hashSecret(payload.password),
    });

    req.session.customerAccountId = account.id;
    req.session.customerId = customer.id;
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

    return sendSuccess(res, {
      customer: {
        accountId: account.id,
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    }, 201);
  }));

  app.post("/api/store/auth/login", asyncHandler(async (req: Request, res: Response) => {
    const payload = storeLoginSchema.parse(req.body);
    const identifier = payload.identifier.trim();
    const normalizedEmail = identifier.includes("@") ? identifier.toLowerCase() : null;
    const normalizedPhone = normalizedEmail ? null : normalizeUgPhoneNumber(identifier);

    const account = normalizedEmail
      ? await storage.getCustomerAccountByEmail(normalizedEmail)
      : await storage.getCustomerAccountByPhone(normalizedPhone!);

    if (!account || !verifySecret(payload.password, account.password)) {
      throw new HttpError(401, "Incorrect email/phone or password");
    }

    const customer = await storage.getCustomer(account.customerId);
    if (!customer) {
      throw new HttpError(404, "Customer account is not linked correctly");
    }

    req.session.customerAccountId = account.id;
    req.session.customerId = customer.id;
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

    return sendSuccess(res, {
      customer: {
        accountId: account.id,
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    });
  }));

  app.post("/api/store/auth/logout", asyncHandler(async (req: Request, res: Response) => {
    if (req.session) {
      delete req.session.customerAccountId;
      delete req.session.customerId;
      await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    }
    return sendSuccess(res, { success: true });
  }));

  app.get("/api/store/auth/me", asyncHandler(async (req: Request, res: Response) => {
    return sendSuccess(res, { customer: req.currentStoreCustomer ?? null });
  }));

  app.get("/api/store/account", requireStoreCustomer, asyncHandler(async (req: Request, res: Response) => {
    const currentCustomer = req.currentStoreCustomer!;
    const [orders, tradeIns] = await Promise.all([
      storage.getOrders(),
      storage.getTradeInAssessments(),
    ]);

    const customerOrders = orders
      .filter((order) =>
        order.customerId === currentCustomer.customerId ||
        order.customerPhone === currentCustomer.phone ||
        (!!currentCustomer.email && order.customerEmail?.trim().toLowerCase() === currentCustomer.email?.trim().toLowerCase()),
      )
      .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());

    const savedAddresses = Array.from(new Set(
      customerOrders
        .map((order) => order.deliveryAddress?.trim())
        .filter((address): address is string => !!address),
    ));

    const customerTradeIns = tradeIns
      .filter((assessment) =>
        assessment.customerId === currentCustomer.customerId ||
        assessment.customerPhone === currentCustomer.phone ||
        (!!currentCustomer.email && assessment.customerEmail?.trim().toLowerCase() === currentCustomer.email?.trim().toLowerCase()),
      )
      .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());

    return sendSuccess(res, {
      customer: currentCustomer,
      orders: customerOrders,
      tradeIns: customerTradeIns,
      savedAddresses,
      support: {
        whatsappUrl: `https://wa.me/256756524407?text=${encodeURIComponent("Hello Ario Store, I need help with my account.")}`,
      },
    });
  }));

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
        totalAmount: payload.totalAmount,
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
      const deviceType = resolveTradeInDeviceType({
        deviceType: req.query.deviceType as string | undefined,
        brand: req.query.brand as string | undefined,
        model: req.query.model as string | undefined,
        storage: req.query.storage as string | undefined,
      });
      const shopId = req.query.shopId as string | undefined;
      const profile = await getEffectiveTradeInQuestions(deviceType, shopId);
      res.json({
        profile: {
          deviceType: profile.deviceType,
          source: profile.source,
          questionCount: profile.questions.length,
        },
        questions: profile.questions,
      });
    } catch (error) {
      console.error("Error fetching questions:", error);
      const deviceType = resolveTradeInDeviceType({
        deviceType: req.query.deviceType as string | undefined,
      });
      res.json({
        profile: {
          deviceType,
          source: "builtin",
          questionCount: getTradeInQuestions(deviceType).length,
          warning: "Condition profile fallback is being used.",
        },
        questions: getTradeInQuestions(deviceType),
      });
    }
  });

  app.post("/api/trade-in/questions/manage", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const parsed = conditionQuestionManageSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Invalid question payload", parsed.error.errors);
      }

      const payload = parsed.data;
      const values = {
        deviceType: payload.deviceType,
        category: payload.category,
        question: payload.question,
        options: payload.options as any,
        sortOrder: payload.sortOrder,
        isRequired: payload.isRequired,
        isCritical: payload.isCritical,
        isActive: payload.isActive,
        shopId: payload.shopId || req.currentUser?.shopId || null,
      };

      const saved = payload.id
        ? await storage.updateConditionQuestion(payload.id, values)
        : await storage.createConditionQuestion(values);

      if (!saved) {
        return sendError(res, 404, "Condition question not found");
      }

      return sendSuccess(res, saved, payload.id ? 200 : 201);
    } catch (error) {
      console.error("Error saving trade-in question:", error);
      sendError(res, 500, "Failed to save trade-in question");
    }
  });

  app.patch("/api/trade-in/questions/:id", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const parsed = conditionQuestionManageSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Invalid question update payload", parsed.error.errors);
      }

      const payload = parsed.data;
      const updated = await storage.updateConditionQuestion(req.params.id, {
        deviceType: payload.deviceType,
        category: payload.category,
        question: payload.question,
        options: payload.options as any,
        sortOrder: payload.sortOrder,
        isRequired: payload.isRequired,
        isCritical: payload.isCritical,
        isActive: payload.isActive,
        shopId: payload.shopId || req.currentUser?.shopId || null,
      });

      if (!updated) {
        return sendError(res, 404, "Condition question not found");
      }

      return sendSuccess(res, updated);
    } catch (error) {
      console.error("Error updating trade-in question:", error);
      sendError(res, 500, "Failed to update trade-in question");
    }
  });

  app.post("/api/trade-in/questions/reset", requireRole(["Owner", "Manager"]), async (req: Request, res: Response) => {
    try {
      const parsed = z.object({
        deviceType: z.enum(["phone", "tablet", "laptop", "other"]),
        shopId: z.string().optional().nullable(),
      }).safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 400, "Invalid reset payload", parsed.error.errors);
      }

      const targetShopId = parsed.data.shopId || req.currentUser?.shopId || undefined;
      const existing = await storage.getConditionQuestions({
        deviceType: parsed.data.deviceType,
        shopId: targetShopId,
      });

      await Promise.all(existing.map((question) =>
        storage.updateConditionQuestion(question.id, { isActive: false })
      ));

      return sendSuccess(res, {
        reset: true,
        deviceType: parsed.data.deviceType,
        disabledCount: existing.length,
      });
    } catch (error) {
      console.error("Error resetting trade-in profile:", error);
      sendError(res, 500, "Failed to reset trade-in profile");
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
      const payload = normalizeBaseValuePayload(parsed.data);
      const upserted = await storage.upsertDeviceBaseValue(payload);
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

  app.post("/api/trade-in/validate-identifier", async (req: Request, res: Response) => {
    try {
      const deviceType = resolveTradeInDeviceType(req.body ?? {});
      const identifier = validateTradeInIdentifier({
        deviceType,
        imei: req.body?.imei,
        serialNumber: req.body?.serialNumber,
      });

      if (!identifier.valid) {
        return res.json({
          valid: false,
          deviceType,
          identifierType: identifier.identifierType,
          message: identifier.error,
          blocked: false,
          duplicate: false,
        });
      }

      const blocked = await storage.getBlockedImei(identifier.identifierValue);
      if (blocked) {
        return res.json({
          valid: false,
          deviceType,
          identifierType: identifier.identifierType,
          message: `${identifier.identifierType === "imei" ? "IMEI" : "Serial"} blocked: ${blocked.reason}`,
          blocked: true,
          duplicate: false,
        });
      }

      const existing = await storage.getTradeInByImei(identifier.identifierValue);
      const isDuplicate = !!existing && existing.status !== "rejected" && existing.status !== "cancelled";

      return res.json({
        valid: !isDuplicate,
        deviceType,
        identifierType: identifier.identifierType,
        blocked: false,
        duplicate: isDuplicate,
        message: isDuplicate ? "This device has already been processed in trade-in / buyback" : undefined,
        existingTradeIn: isDuplicate ? {
          id: existing.id,
          tradeInNumber: existing.tradeInNumber,
          status: existing.status,
        } : undefined,
      });
    } catch (error) {
      console.error("Error validating identifier:", error);
      sendError(res, 500, "Failed to validate device identifier");
    }
  });

  // Calculate trade-in offer (preview before submission)
  app.post("/api/trade-in/calculate", async (req: Request, res: Response) => {
    try {
      const { brand, model, storage: storageSize, conditionAnswers } = req.body;
      const deviceType = resolveTradeInDeviceType(req.body ?? {});
      const canFallbackToManualReview = req.currentUser?.role === "Owner" || req.currentUser?.role === "Manager";
      const identifier = validateTradeInIdentifier({
        deviceType,
        imei: req.body?.imei,
        serialNumber: req.body?.serialNumber,
      });

      const effectiveProfile = await getEffectiveTradeInQuestions(deviceType, req.currentUser?.shopId ?? undefined);
      const formattedQuestions = effectiveProfile.questions;
      const scorePreview = calculateConditionScore(conditionAnswers || {}, formattedQuestions);

      // Get base value
      const baseValueRecord = await storage.getDeviceBaseValue(brand, model, storageSize);
      if (!baseValueRecord) {
        if (!canFallbackToManualReview) {
          return sendError(res, 404, "No base value found for this device configuration");
        }

        return res.json({
          deviceType,
          identifierType: identifier.identifierType,
          baseValue: 0,
          conditionScore: scorePreview.score,
          calculatedOffer: 0,
          decision: "manual_review",
          rejectionReasons: ["Missing pricing rule"],
          deductionBreakdown: scorePreview.deductions,
          requiresPricingRule: true,
          reviewMessage: "Pricing rule missing. Intake can continue, but the final offer requires manager review.",
        });
      }

      const blocked = identifier.valid ? await storage.getBlockedImei(identifier.identifierValue) : null;
      const existing = identifier.valid ? await storage.getTradeInByImei(identifier.identifierValue) : null;
      const isDuplicate = !!existing && existing.status !== "rejected" && existing.status !== "cancelled";
      
      // Process trade-in scoring
      const result = processTradeIn(
        baseValueRecord.baseValue,
        conditionAnswers || {},
        formattedQuestions,
        false,
        false,
        isDuplicate || false,
        !identifier.valid
      );
      
      res.json({
        deviceType,
        identifierType: identifier.identifierType,
        conditionProfileSource: effectiveProfile.source,
        baseValue: baseValueRecord.baseValue,
        requiresPricingRule: false,
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
      const deviceType = resolveTradeInDeviceType(data);
      const canFallbackToManualReview = req.currentUser?.role === "Owner" || req.currentUser?.role === "Manager";
      const identifier = validateTradeInIdentifier({
        deviceType,
        imei: data.imei,
        serialNumber: data.serialNumber,
      });
      
      if (!identifier.valid) {
        return sendError(res, 400, identifier.error || "Invalid device identifier");
      }
      
      // Check if blocked
      const blocked = await storage.getBlockedImei(identifier.identifierValue);
      if (blocked) {
        return sendError(res, 400, `${identifier.identifierType === "imei" ? "IMEI" : "Serial"} blocked: ${blocked.reason}`);
      }
      
      // Check duplicate
      const existing = await storage.getTradeInByImei(identifier.identifierValue);
      const isDuplicate = !!existing && existing.status !== 'rejected' && existing.status !== 'cancelled';
      
      if (isDuplicate) {
        // Block the IMEI
        await storage.createBlockedImei({
          imei: identifier.identifierValue,
          reason: "duplicate",
          blockedBy: "system",
          notes: `Duplicate attempt. Original trade-in: ${existing.tradeInNumber}`,
        });
        return res.status(400).json({ 
          message: `Duplicate ${identifier.identifierType.toUpperCase()} - this device has already been traded in`,
          existingTradeIn: existing.tradeInNumber,
        });
      }
      
      // Get base value
      const baseValueRecord = await storage.getDeviceBaseValue(data.brand, data.model, data.storage || "Unknown");
      if (!baseValueRecord && !canFallbackToManualReview) {
        return sendError(res, 400, "No base value found for this device. Please contact manager.");
      }
      
      const effectiveProfile = await getEffectiveTradeInQuestions(deviceType, req.currentUser?.shopId ?? undefined);
      const formattedQuestions = effectiveProfile.questions;

      const scoringResult = baseValueRecord
        ? processTradeIn(
            baseValueRecord.baseValue,
            data.conditionAnswers,
            formattedQuestions,
            false,
            false,
            false,
            false
          )
        : (() => {
            const preview = calculateConditionScore(data.conditionAnswers, formattedQuestions);
            return {
              conditionScore: preview.score,
              calculatedOffer: 0,
              decision: "manual_review" as const,
              rejectionReasons: ["Missing pricing rule"],
              deductionBreakdown: preview.deductions,
            };
          })();
      
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
        imei: identifier.identifierValue,
        serialNumber: identifier.serialNumber,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        baseValue: baseValueRecord?.baseValue ?? 0,
        conditionAnswers: data.conditionAnswers,
        conditionScore: scoringResult.conditionScore,
        calculatedOffer: scoringResult.calculatedOffer,
        finalOffer: scoringResult.decision === "auto_accept" ? scoringResult.calculatedOffer : null,
        decision: scoringResult.decision,
        rejectionReasons: scoringResult.rejectionReasons.length > 0 ? scoringResult.rejectionReasons : null,
        reviewNotes: baseValueRecord ? null : "Pricing rule missing at intake. Final offer pending manager review.",
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
        requiresPricingRule: !baseValueRecord,
        conditionProfileSource: effectiveProfile.source,
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
      const parsed = productUpsertSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, getProductValidationMessage(parsed.error));
      }
      const payload = {
        ...parsed.data,
        name: parsed.data.name.trim(),
        displayTitle: normalizeProductText(parsed.data.displayTitle),
        description: normalizeProductText(parsed.data.description),
        brand: normalizeProductText(parsed.data.brand),
        model: normalizeProductText(parsed.data.model),
        category: parsed.data.category.trim(),
        condition: normalizeProductText(parsed.data.condition),
        sku: normalizeProductText(parsed.data.sku),
        barcode: normalizeProductBarcode(parsed.data.barcode),
        imageUrl: normalizeProductImageUrl(parsed.data.imageUrl),
        storefrontVisibility: parsed.data.storefrontVisibility ?? "published",
        isFeatured: parsed.data.isFeatured ?? false,
        isFlashDeal: parsed.data.isFlashDeal ?? false,
        flashDealPrice: parsed.data.flashDealPrice ?? null,
        flashDealEndsAt: normalizeProductDate(parsed.data.flashDealEndsAt) ?? null,
      };
      if (Number(payload.stock) < 0 || Number(payload.minStock) < 0) {
        return sendError(res, 400, "Stock values cannot be negative");
      }
      if (Number(payload.price) < 0 || Number(payload.costPrice) < 0) {
        return sendError(res, 400, "Price values cannot be negative");
      }
      if (payload.isFlashDeal && (!payload.flashDealPrice || payload.flashDealPrice <= 0)) {
        return sendError(res, 400, "Flash deal products require a valid deal price");
      }
      if (payload.flashDealPrice && payload.flashDealPrice >= payload.price) {
        return sendError(res, 400, "Flash deal price must be lower than the regular price");
      }
      if (payload.barcode) {
        const existing = await storage.getProductByBarcode(payload.barcode);
        if (existing) {
          return sendError(res, 409, "Barcode is already assigned to another product");
        }
      }
      const created = await storage.createProduct({ ...payload, shopId: payload.shopId || req.currentUser?.shopId || null });
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
      const existingProduct = await storage.getProduct(id);
      if (!existingProduct) return sendError(res, 404, "Product not found");
      const parsed = productUpsertSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        console.error("Invalid product update payload", {
          body: req.body,
          issues: parsed.error.issues,
        });
        return sendError(res, 400, getProductValidationMessage(parsed.error));
      }
      const updates = {
        ...parsed.data,
        name: parsed.data.name?.trim(),
        displayTitle: parsed.data.displayTitle === null ? null : normalizeProductText(parsed.data.displayTitle),
        description: parsed.data.description === null ? null : normalizeProductText(parsed.data.description),
        brand: parsed.data.brand === null ? null : normalizeProductText(parsed.data.brand),
        model: parsed.data.model === null ? null : normalizeProductText(parsed.data.model),
        category: parsed.data.category?.trim(),
        condition: parsed.data.condition === null ? null : normalizeProductText(parsed.data.condition),
        sku: parsed.data.sku === null ? null : normalizeProductText(parsed.data.sku),
        barcode: parsed.data.barcode === null ? null : normalizeProductBarcode(parsed.data.barcode),
        imageUrl: parsed.data.imageUrl === null ? null : normalizeProductImageUrl(parsed.data.imageUrl),
        storefrontVisibility: parsed.data.storefrontVisibility ?? undefined,
        isFeatured: parsed.data.isFeatured ?? undefined,
        isFlashDeal: parsed.data.isFlashDeal ?? undefined,
        flashDealPrice: parsed.data.flashDealPrice === null ? null : parsed.data.flashDealPrice,
        flashDealEndsAt: parsed.data.flashDealEndsAt === null ? null : normalizeProductDate(parsed.data.flashDealEndsAt),
      };
      if (updates.stock !== undefined && Number(updates.stock) < 0) {
        return sendError(res, 400, "Stock cannot be negative");
      }
      if (updates.minStock !== undefined && Number(updates.minStock) < 0) {
        return sendError(res, 400, "Minimum stock cannot be negative");
      }
      if (updates.price !== undefined && Number(updates.price) < 0) {
        return sendError(res, 400, "Price cannot be negative");
      }
      if (updates.costPrice !== undefined && Number(updates.costPrice) < 0) {
        return sendError(res, 400, "Cost price cannot be negative");
      }
      const nextPrice = updates.price ?? existingProduct.price;
      const nextIsFlashDeal = updates.isFlashDeal ?? existingProduct.isFlashDeal;
      const nextFlashDealPrice = updates.flashDealPrice !== undefined ? updates.flashDealPrice : existingProduct.flashDealPrice;
      if (nextIsFlashDeal && (!nextFlashDealPrice || nextFlashDealPrice <= 0)) {
        return sendError(res, 400, "Flash deal products require a valid deal price");
      }
      if (nextFlashDealPrice && nextPrice !== undefined && nextFlashDealPrice >= nextPrice) {
        return sendError(res, 400, "Flash deal price must be lower than the regular price");
      }
      if (updates.barcode) {
        const barcodeOwner = await storage.getProductByBarcode(updates.barcode);
        if (barcodeOwner && barcodeOwner.id !== id) {
          return sendError(res, 409, "Barcode is already assigned to another product");
        }
      }
      const previousImageUrl = existingProduct.imageUrl;
      const updated = await storage.updateProduct(id, updates);
      if (!updated) return sendError(res, 404, "Product not found");
      if (previousImageUrl && updated.imageUrl !== previousImageUrl) {
        removeUploadedFileByUrl(previousImageUrl);
      }
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
      const existingProduct = await storage.getProduct(id);
      await storage.deleteProduct(id);
      if (existingProduct?.imageUrl) {
        removeUploadedFileByUrl(existingProduct.imageUrl);
      }
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

  // ==================== STOREFRONT API ROUTES ====================

  // Get products for storefront (public)
  app.get("/api/store/products", asyncHandler(async (req: Request, res: Response) => {
    const products = await commerceService.listStoreProducts({
      shopId: req.query.shopId as string | undefined,
      query: req.query.q as string | undefined,
      sort: req.query.sort as string | undefined,
      condition: req.query.condition as string | undefined,
    });

    return sendSuccess(res, products);
  }));

  // Get single product for storefront (public)
  app.get("/api/store/products/:id", asyncHandler(async (req: Request, res: Response) => {
    const product = await commerceService.getStoreProduct(req.params.id);
    return sendSuccess(res, product);
  }));

  // Create order (checkout) - public but requires customer info
  app.post("/api/store/checkout", asyncHandler(async (req: Request, res: Response) => {
    const checkoutSchema = z.object({
      shopId: z.string().optional(),
      customerName: z.string().min(1),
      customerPhone: z.string().min(1),
      customerEmail: z.string().email().optional(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })).min(1),
      paymentMethod: z.enum(["Cash", "Card", "Mobile Money"]),
      deliveryType: z.enum(["PICKUP", "KAMPALA", "UPCOUNTRY"]).optional(),
      deliveryAddress: z.string().optional(),
      notes: z.string().optional(),
    });

    const order = await commerceService.createStoreOrder(checkoutSchema.parse(req.body));
    return sendSuccess(res, order, 201);
  }));

  // Track order status (public)
  app.get("/api/store/orders/:id/track", asyncHandler(async (req: Request, res: Response) => {
    const order = await commerceService.trackOrder(req.params.id);
    return sendSuccess(res, order);
  }));

  app.get("/api/store/orders/track/:orderNumber", asyncHandler(async (req: Request, res: Response) => {
    const order = await commerceService.trackOrder(req.params.orderNumber);
    return sendSuccess(res, order);
  }));

  // ==================== ADMIN ORDER MANAGEMENT ROUTES ====================

  // Get orders (admin/staff)
  app.get("/api/orders", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const orders = await commerceService.listOrders({
      shopId: req.query.shopId as string | undefined,
      status: req.query.status as string | undefined,
      assignedStaffId: req.currentUser?.role === "Sales"
        ? req.currentUser.id
        : req.query.assignedStaffId as string | undefined,
    });
    return sendSuccess(res, orders);
  }));

  // Get single order (admin/staff)
  app.get("/api/orders/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const order = await commerceService.getOrderDetail(req.params.id);
    if (req.currentUser?.role === "Sales" && order.assignedStaffId !== req.currentUser.id) {
      throw new HttpError(403, "Forbidden");
    }
    return sendSuccess(res, order);
  }));

  // Update order status (admin/staff)
  app.patch("/api/orders/:id/status", requireRole(["Owner", "Manager"]), asyncHandler(async (req: Request, res: Response) => {
    const statusSchema = z.object({
      status: z.enum(ORDER_STATUSES),
      assignedStaffId: z.string().optional(),
    });

    const { status, assignedStaffId } = statusSchema.parse(req.body);
    const order = await commerceService.updateOrderStatus(req.params.id, status, assignedStaffId);
    return sendSuccess(res, order);
  }));

  // ==================== DELIVERY MANAGEMENT ROUTES ====================

  // Get deliveries (admin/staff)
  app.get("/api/deliveries", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const deliveries = await commerceService.listDeliveries({
      status: req.query.status as string | undefined,
      assignedRiderId: req.currentUser?.role === "Sales"
        ? req.currentUser.id
        : req.query.assignedRiderId as string | undefined,
    });
    return sendSuccess(res, deliveries);
  }));

  // Create delivery for order (admin/staff)
  app.post("/api/deliveries", requireRole(["Owner", "Manager"]), asyncHandler(async (req: Request, res: Response) => {
    const deliverySchema = z.object({
      orderId: z.string(),
      address: z.string().min(1).optional(),
      assignedRiderId: z.string().optional(),
      scheduledAt: z.coerce.date().optional(),
      notes: z.string().optional(),
    });

    const delivery = await commerceService.createDelivery(deliverySchema.parse(req.body));
    return sendSuccess(res, delivery, 201);
  }));

  // Update delivery status (admin/staff)
  app.patch("/api/deliveries/:id/status", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const statusSchema = z.object({
      status: z.enum(["PENDING", "ASSIGNED", "PICKED UP", "IN TRANSIT", "DELIVERED", "FAILED"]),
      riderId: z.string().optional(),
      notes: z.string().optional(),
    });

    if (req.currentUser?.role === "Sales") {
      const delivery = await storage.getDelivery(req.params.id);
      if (!delivery || delivery.assignedRiderId !== req.currentUser.id) {
        throw new HttpError(403, "Forbidden");
      }
    }

    const delivery = await commerceService.updateDeliveryStatus(req.params.id, statusSchema.parse(req.body));
    return sendSuccess(res, delivery);
  }));

  // ==================== RECEIPT MANAGEMENT ROUTES ====================

  // Get receipts for order (admin/staff)
  app.get("/api/receipts", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const receipts = await commerceService.listReceipts(req.query.orderId as string | undefined);
    return sendSuccess(res, receipts);
  }));

  // Generate receipt for order (admin/staff)
  app.post("/api/receipts", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const receiptSchema = z.object({
      orderId: z.string(),
      pdfUrl: z.string().optional(),
      sentVia: z.array(z.string()).optional(),
    });

    const receipt = await commerceService.createReceipt(receiptSchema.parse(req.body));
    return sendSuccess(res, receipt, 201);
  }));

  // ==================== NOTIFICATION ROUTES ====================

  // Get notifications (admin/staff)
  app.get("/api/notifications", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const availableShops = await storage.getShops();
    const defaultShopId = (availableShops.find((shop) => shop.isMain) ?? availableShops[0])?.id;
    const shopId = req.currentUser?.shopId || req.query.shopId as string | undefined || defaultShopId;
    const notifications = await commerceService.listNotifications(shopId);
    return sendSuccess(res, notifications);
  }));

  // Mark notification as read (admin/staff)
  app.patch("/api/notifications/:id/read", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const notification = await commerceService.markNotificationRead(req.params.id);
    return sendSuccess(res, notification);
  }));

  // Get unread notification count (admin/staff)
  app.get("/api/notifications/unread-count", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const availableShops = await storage.getShops();
    const defaultShopId = (availableShops.find((shop) => shop.isMain) ?? availableShops[0])?.id;
    const shopId = req.currentUser?.shopId || req.query.shopId as string | undefined || defaultShopId;
    if (!shopId) {
      throw new HttpError(400, "Shop ID required");
    }
    const count = await commerceService.getUnreadNotificationCount(shopId);
    return sendSuccess(res, { count });
  }));

  return httpServer;
}
