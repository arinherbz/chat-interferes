import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";



// ===================== USERS =====================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  pin: text("pin"),
  name: text("name"),
  email: text("email"),
  role: text("role").default("Sales"),
  status: text("status").default("active"), // active | disabled
  lastLoginAt: timestamp("last_login_at"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  shopId: varchar("shop_id"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  pin: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  lastActiveAt: true,
  shopId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ===================== USER PREFERENCES =====================
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  theme: text("theme").default("system"), // light | dark | system
  currency: text("currency").default("UGX"),
  dateFormat: text("date_format").default("PPP"),
  timezone: text("timezone").default("UTC"),
  defaultBranchId: varchar("default_branch_id"),
  sidebarCollapsed: boolean("sidebar_collapsed").default(false),
  density: text("density").default("comfortable"), // compact | comfortable
  dashboardLayout: jsonb("dashboard_layout"), // widget order + visibility
  accentColor: text("accent_color"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserPreferenceSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserPreference = z.infer<typeof insertUserPreferenceSchema>;
export type UserPreference = typeof userPreferences.$inferSelect;

// ===================== SHOPS =====================
export const shops = pgTable("shops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  timezone: text("timezone"),
  logo: jsonb("logo"),
  coverImage: jsonb("cover_image"),
  themeColorPrimary: text("theme_color_primary"),
  themeColorAccent: text("theme_color_accent"),
  isMain: boolean("is_main").default(false),
  currency: text("currency").default("UGX"),
  subscriptionPlan: text("subscription_plan").default("trial"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShopSchema = createInsertSchema(shops).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShop = z.infer<typeof insertShopSchema>;
export type Shop = typeof shops.$inferSelect;

// ===================== PHONE BRANDS =====================
export const brands = pgTable("brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const insertBrandSchema = createInsertSchema(brands).omit({ id: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

// ===================== PHONE MODELS =====================
export const models = pgTable("models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandId: varchar("brand_id").notNull().references(() => brands.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const insertModelSchema = createInsertSchema(models).omit({ id: true });
export type InsertModel = z.infer<typeof insertModelSchema>;
export type Model = typeof models.$inferSelect;

// ===================== STORAGE OPTIONS =====================
export const storageOptions = pgTable("storage_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => models.id),
  size: text("size").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const insertStorageOptionSchema = createInsertSchema(storageOptions).omit({ id: true });
export type InsertStorageOption = z.infer<typeof insertStorageOptionSchema>;
export type StorageOption = typeof storageOptions.$inferSelect;

// ===================== DEVICE BASE VALUES =====================
// Owner-editable base values per model for trade-in pricing
export const deviceBaseValues = pgTable("device_base_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  storage: text("storage").notNull(),
  baseValue: integer("base_value").notNull(),
  isActive: boolean("is_active").default(true),
  shopId: varchar("shop_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDeviceBaseValueSchema = createInsertSchema(deviceBaseValues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDeviceBaseValue = z.infer<typeof insertDeviceBaseValueSchema>;
export type DeviceBaseValue = typeof deviceBaseValues.$inferSelect;

// ===================== PRODUCTS =====================
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category"),
  brand: text("brand"),
  model: text("model"),
  price: integer("price").notNull().default(0),
  costPrice: integer("cost_price").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  sku: text("sku"),
  imageUrl: text("image_url"),
  shopId: varchar("shop_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ===================== CONDITION QUESTIONS =====================
// Structured questions for the trade-in wizard (no free-text)
export const conditionQuestions = pgTable("condition_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // 'screen', 'body', 'functionality', 'security'
  question: text("question").notNull(),
  options: jsonb("options").notNull(), // Array of { value: string, label: string, deduction: number }
  sortOrder: integer("sort_order").default(0),
  isRequired: boolean("is_required").default(true),
  isCritical: boolean("is_critical").default(false), // If true, certain answers = instant rejection
  isActive: boolean("is_active").default(true),
});

export const insertConditionQuestionSchema = createInsertSchema(conditionQuestions).omit({
  id: true,
});

export type InsertConditionQuestion = z.infer<typeof insertConditionQuestionSchema>;
export type ConditionQuestion = typeof conditionQuestions.$inferSelect;

// Option type for condition questions
export const conditionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  deduction: z.number(), // Percentage deduction from base value (0-100)
  isRejection: z.boolean().optional(), // If true, selecting this = instant rejection
});

export type ConditionOption = z.infer<typeof conditionOptionSchema>;

// ===================== TRADE-IN ASSESSMENTS =====================
// Full trade-in record with wizard answers and scoring
export const tradeInAssessments = pgTable("trade_in_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeInNumber: text("trade_in_number").notNull().unique(),
  
  // Device info
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  storage: text("storage"),
  color: text("color"),
  imei: text("imei").notNull(),
  serialNumber: text("serial_number"),
  
  // Customer info
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  customerId: varchar("customer_id"),
  
  // Scoring & Valuation
  baseValue: integer("base_value").notNull(),
  conditionAnswers: jsonb("condition_answers").notNull(), // { questionId: selectedOptionValue }
  conditionScore: integer("condition_score").notNull(), // 0-100 after deductions
  calculatedOffer: integer("calculated_offer").notNull(),
  finalOffer: integer("final_offer"), // Can be adjusted by staff
  
  // Decision & Status
  decision: text("decision").notNull(), // 'auto_accept', 'auto_reject', 'manual_review', 'accepted', 'rejected'
  rejectionReasons: jsonb("rejection_reasons"), // Array of reasons if rejected
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  
  // Payout
  payoutMethod: text("payout_method"), // 'Cash', 'MTN', 'Airtel', 'Credit'
  payoutReference: text("payout_reference"),
  payoutCompletedAt: timestamp("payout_completed_at"),

  // Linking to sale or repair
  linkedSaleId: varchar("linked_sale_id"),
  linkedRepairId: varchar("linked_repair_id"),

  // Inventory (when accepted)
  deviceInventoryId: varchar("device_inventory_id"),

  // Meta
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'completed', 'cancelled'
  shopId: varchar("shop_id"),
  processedBy: varchar("processed_by"),
  attachments: jsonb("attachments"), // optional images/files attached to the assessment
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTradeInAssessmentSchema = createInsertSchema(tradeInAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTradeInAssessment = z.infer<typeof insertTradeInAssessmentSchema>;
export type TradeInAssessment = typeof tradeInAssessments.$inferSelect;

// ===================== BLOCKED IMEIS =====================
// Track blocked/blacklisted IMEIs and duplicate attempts
export const blockedImeis = pgTable("blocked_imeis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imei: text("imei").notNull().unique(),
  reason: text("reason").notNull(), // 'duplicate', 'blacklisted', 'stolen', 'icloud_locked'
  blockedAt: timestamp("blocked_at").defaultNow(),
  blockedBy: varchar("blocked_by"),
  notes: text("notes"),
  shopId: varchar("shop_id"),
});

export const insertBlockedImeiSchema = createInsertSchema(blockedImeis).omit({
  id: true,
  blockedAt: true,
});

export type InsertBlockedImei = z.infer<typeof insertBlockedImeiSchema>;
export type BlockedImei = typeof blockedImeis.$inferSelect;

// ===================== TRADE-IN AUDIT LOGS =====================
// Comprehensive audit trail for trade-ins
export const tradeInAuditLogs = pgTable("trade_in_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeInId: varchar("trade_in_id").notNull(),
  action: text("action").notNull(), // 'created', 'reviewed', 'approved', 'rejected', 'offer_adjusted', 'payout_completed', 'linked_to_sale'
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  userId: varchar("user_id"),
  userName: text("user_name"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertTradeInAuditLogSchema = createInsertSchema(tradeInAuditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertTradeInAuditLog = z.infer<typeof insertTradeInAuditLogSchema>;
export type TradeInAuditLog = typeof tradeInAuditLogs.$inferSelect;

// ===================== ACTIVITY LOGS =====================
// Cross-cutting audit for auth, sales, closures, and staffing
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  userName: text("user_name"),
  role: text("role"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: varchar("entity_id"),
  details: text("details"),
  metadata: jsonb("metadata"),
  shopId: varchar("shop_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// ===================== SCORING RULES =====================
// Configurable scoring thresholds
export const scoringRules = pgTable("scoring_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  minScore: integer("min_score").notNull(),
  maxScore: integer("max_score").notNull(),
  decision: text("decision").notNull(), // 'auto_accept', 'auto_reject', 'manual_review'
  multiplier: decimal("multiplier", { precision: 5, scale: 2 }).default("1.00"), // Applied to calculated offer
  isActive: boolean("is_active").default(true),
  shopId: varchar("shop_id"),
});

export const insertScoringRuleSchema = createInsertSchema(scoringRules).omit({
  id: true,
});

export type InsertScoringRule = z.infer<typeof insertScoringRuleSchema>;
export type ScoringRule = typeof scoringRules.$inferSelect;

// ===================== API SCHEMAS =====================
// Schema for trade-in wizard submission
export const tradeInWizardSchema = z.object({
  // Step 1: Device identification
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  storage: z.string().optional(),
  color: z.string().optional(),
  imei: z.string().min(15, "Valid IMEI required").max(15, "IMEI must be 15 digits"),
  serialNumber: z.string().optional(),
  
  // Step 2: Security checks (critical - can cause instant rejection)
  isIcloudLocked: z.boolean(),
  isGoogleLocked: z.boolean(),
  
  // Step 3: Condition answers (structured)
  conditionAnswers: z.record(z.string(), z.string()), // { questionId: selectedOptionValue }
  
  // Step 4: Customer info
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(10, "Valid phone number required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  
  // Step 5: Payout (only if accepted)
  payoutMethod: z.enum(["Cash", "MTN", "Airtel", "Credit"]).optional(),
  
  // Optional: Link to sale or repair
  linkedSaleId: z.string().optional(),
  linkedRepairId: z.string().optional(),

  // Optional: attachments (photos/docs)
  attachments: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      filename: z.string(),
      contentType: z.string(),
      size: z.number(),
      uploadedAt: z.string(),
    })
  ).optional(),
});

export type TradeInWizardInput = z.infer<typeof tradeInWizardSchema>;

// Schema for manual review
export const tradeInReviewSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  finalOffer: z.number().optional(),
  reviewNotes: z.string().optional(),
  rejectionReasons: z.array(z.string()).optional(),
});

export type TradeInReviewInput = z.infer<typeof tradeInReviewSchema>;

// ===================== LEADS / FOLLOW-UPS =====================
// Apple-style leads table: captures customer leads, assignment, follow-up schedule, and history
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  source: text("source"), // e.g., 'walk-in', 'phone', 'website', 'referral'
  notes: text("notes"),
  assignedTo: varchar("assigned_to"), // user id
  priority: text("priority").default("normal"), // 'low' | 'normal' | 'high'
  status: text("status").default("new"), // 'new' | 'contacted' | 'in_progress' | 'won' | 'lost'
  nextFollowUpAt: timestamp("next_follow_up_at"),
  followUpHistory: jsonb("follow_up_history"), // array of { by, at, note, result }
  createdBy: varchar("created_by"),
  createdByName: text("created_by_name"),
  shopId: varchar("shop_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Audit logs for lead actions
export const leadAuditLogs = pgTable("lead_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  action: text("action").notNull(), // 'created', 'assigned', 'updated', 'follow_up', 'closed'
  userId: varchar("user_id"),
  userName: text("user_name"),
  details: text("details"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertLeadAuditLogSchema = createInsertSchema(leadAuditLogs).omit({ id: true, timestamp: true });
export type InsertLeadAuditLog = z.infer<typeof insertLeadAuditLogSchema>;
export type LeadAuditLog = typeof leadAuditLogs.$inferSelect;
