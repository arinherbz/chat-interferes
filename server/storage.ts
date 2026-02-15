import { 
  type User, type InsertUser, users,
  type Brand, type InsertBrand, brands,
  type Model, type InsertModel, models,
  type StorageOption, type InsertStorageOption, storageOptions,
  type DeviceBaseValue, type InsertDeviceBaseValue, deviceBaseValues,
  type ConditionQuestion, type InsertConditionQuestion, conditionQuestions,
  type TradeInAssessment, type InsertTradeInAssessment, tradeInAssessments,
  type BlockedImei, type InsertBlockedImei, blockedImeis,
  type TradeInAuditLog, type InsertTradeInAuditLog, tradeInAuditLogs,
  type Lead, type InsertLead, leads,
  type LeadAuditLog, type InsertLeadAuditLog, leadAuditLogs,
  type ScoringRule, type InsertScoringRule, scoringRules,
  type ActivityLog, type InsertActivityLog, activityLogs,
  type Shop, type InsertShop, shops,
  type Product, type InsertProduct, products,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, sql as sqlFn } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  setUserStatus(id: string, status: "active" | "disabled"): Promise<User | undefined>;
  touchUserActivity(id: string, activity?: { lastLogin?: boolean }): Promise<void>;
  
  // Brands
  getBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  
  // Models
  getModels(brandId?: string): Promise<Model[]>;
  getModel(id: string): Promise<Model | undefined>;
  createModel(model: InsertModel): Promise<Model>;
  
  // Storage Options
  getStorageOptions(modelId?: string): Promise<StorageOption[]>;
  getStorageOption(id: string): Promise<StorageOption | undefined>;
  createStorageOption(option: InsertStorageOption): Promise<StorageOption>;
  
  // Device Base Values
  getDeviceBaseValues(shopId?: string): Promise<DeviceBaseValue[]>;
  getDeviceBaseValue(brand: string, model: string, storage: string, shopId?: string): Promise<DeviceBaseValue | undefined>;
  findDeviceBaseValueAnyStatus(brand: string, model: string, storage: string, shopId?: string): Promise<DeviceBaseValue | undefined>;
  upsertDeviceBaseValue(value: InsertDeviceBaseValue): Promise<DeviceBaseValue>;
  createDeviceBaseValue(value: InsertDeviceBaseValue): Promise<DeviceBaseValue>;
  updateDeviceBaseValue(id: string, value: Partial<InsertDeviceBaseValue>): Promise<DeviceBaseValue | undefined>;
  deleteDeviceBaseValue(id: string): Promise<boolean>;
  
  // Condition Questions
  getConditionQuestions(): Promise<ConditionQuestion[]>;
  createConditionQuestion(question: InsertConditionQuestion): Promise<ConditionQuestion>;
  updateConditionQuestion(id: string, question: Partial<InsertConditionQuestion>): Promise<ConditionQuestion | undefined>;
  
  // Trade-In Assessments
  getTradeInAssessments(shopId?: string): Promise<TradeInAssessment[]>;
  getTradeInAssessment(id: string): Promise<TradeInAssessment | undefined>;
  getTradeInByImei(imei: string): Promise<TradeInAssessment | undefined>;
  createTradeInAssessment(assessment: InsertTradeInAssessment): Promise<TradeInAssessment>;
  updateTradeInAssessment(id: string, assessment: Partial<InsertTradeInAssessment>): Promise<TradeInAssessment | undefined>;
  getNextTradeInNumber(): Promise<string>;
  upsertDeviceBaseValue(value: InsertDeviceBaseValue): Promise<DeviceBaseValue>;
  upsertDeviceBaseValue(value: InsertDeviceBaseValue): Promise<DeviceBaseValue>;
  
  // Blocked IMEIs
  getBlockedImei(imei: string): Promise<BlockedImei | undefined>;
  createBlockedImei(blocked: InsertBlockedImei): Promise<BlockedImei>;
  
  // Trade-In Audit Logs
  getTradeInAuditLogs(tradeInId: string): Promise<TradeInAuditLog[]>;
  getAllTradeInAuditLogs(shopId?: string, limit?: number): Promise<TradeInAuditLog[]>;
  createTradeInAuditLog(log: InsertTradeInAuditLog): Promise<TradeInAuditLog>;
  
  // Scoring Rules
  getScoringRules(shopId?: string): Promise<ScoringRule[]>;
  createScoringRule(rule: InsertScoringRule): Promise<ScoringRule>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;

  // Shops
  getShop(id: string): Promise<import("@shared/schema").Shop | undefined>;
  getShops(): Promise<import("@shared/schema").Shop[]>;
  createShop(shop: import("@shared/schema").InsertShop): Promise<import("@shared/schema").Shop>;
  updateShop(id: string, data: Partial<import("@shared/schema").InsertShop>): Promise<import("@shared/schema").Shop | undefined>;
}

export class DatabaseStorage implements IStorage {
  // ==================== USERS ====================
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async listUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.name);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async setUserStatus(id: string, status: "active" | "disabled"): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async touchUserActivity(id: string, activity?: { lastLogin?: boolean }): Promise<void> {
    const updates: Partial<InsertUser> = { lastActiveAt: new Date() };
    if (activity?.lastLogin) {
      updates.lastLoginAt = new Date();
    }
    await db.update(users)
      .set(updates)
      .where(eq(users.id, id));
  }

  // ==================== BRANDS ====================
  async getBrands(): Promise<Brand[]> {
    // For SQLite boolean columns are stored as integers (1/0)
    const activeVal = pool ? true : 1;
    return db.select().from(brands).where(eq(brands.isActive, activeVal)).orderBy(brands.sortOrder, brands.name);
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand;
  }

  async createBrand(brand: InsertBrand): Promise<Brand> {
    const [created] = await db.insert(brands).values(brand).returning();
    return created;
  }

  async updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined> {
    const [updated] = await db.update(brands).set({ ...data }).where(eq(brands.id, id)).returning();
    return updated;
  }

  async deleteBrand(id: string): Promise<boolean> {
    await db.delete(brands).where(eq(brands.id, id));
    return true;
  }

  // ==================== MODELS ====================
  async getModels(brandId?: string): Promise<Model[]> {
    const activeVal = pool ? true : 1;
    if (brandId) {
      return db.select().from(models).where(and(eq(models.brandId, brandId), eq(models.isActive, activeVal))).orderBy(models.sortOrder, models.name);
    }
    return db.select().from(models).where(eq(models.isActive, activeVal)).orderBy(models.sortOrder, models.name);
  }

  async getModel(id: string): Promise<Model | undefined> {
    const [model] = await db.select().from(models).where(eq(models.id, id));
    return model;
  }

  async createModel(model: InsertModel): Promise<Model> {
    const [created] = await db.insert(models).values(model).returning();
    return created;
  }
  
  async updateModel(id: string, data: Partial<InsertModel>): Promise<Model | undefined> {
    const [updated] = await db.update(models).set({ ...data }).where(eq(models.id, id)).returning();
    return updated;
  }

  async deleteModel(id: string): Promise<boolean> {
    await db.delete(models).where(eq(models.id, id));
    return true;
  }

  // ==================== STORAGE OPTIONS ====================
  async getStorageOptions(modelId?: string): Promise<StorageOption[]> {
    const activeVal = pool ? true : 1;
    if (modelId) {
      return db.select().from(storageOptions).where(and(eq(storageOptions.modelId, modelId), eq(storageOptions.isActive, activeVal))).orderBy(storageOptions.sortOrder, storageOptions.size);
    }
    return db.select().from(storageOptions).where(eq(storageOptions.isActive, activeVal)).orderBy(storageOptions.sortOrder, storageOptions.size);
  }

  async getStorageOption(id: string): Promise<StorageOption | undefined> {
    const [option] = await db.select().from(storageOptions).where(eq(storageOptions.id, id));
    return option;
  }

  async createStorageOption(option: InsertStorageOption): Promise<StorageOption> {
    const [created] = await db.insert(storageOptions).values(option).returning();
    return created;
  }

  async updateStorageOption(id: string, data: Partial<InsertStorageOption>): Promise<StorageOption | undefined> {
    const [updated] = await db.update(storageOptions).set({ ...data }).where(eq(storageOptions.id, id)).returning();
    return updated;
  }

  async deleteStorageOption(id: string): Promise<boolean> {
    await db.delete(storageOptions).where(eq(storageOptions.id, id));
    return true;
  }

  // ==================== DEVICE BASE VALUES ====================
  async getDeviceBaseValues(shopId?: string): Promise<DeviceBaseValue[]> {
    if (shopId) {
      return db.select().from(deviceBaseValues)
        .where(eq(deviceBaseValues.shopId, shopId))
        .orderBy(deviceBaseValues.brand, deviceBaseValues.model);
    }
    return db.select().from(deviceBaseValues)
      .orderBy(deviceBaseValues.brand, deviceBaseValues.model);
  }

  async getDeviceBaseValue(brand: string, model: string, storage: string, shopId?: string): Promise<DeviceBaseValue | undefined> {
    const conditions = [
      eq(deviceBaseValues.brand, brand),
      eq(deviceBaseValues.model, model),
      eq(deviceBaseValues.storage, storage),
      eq(deviceBaseValues.isActive, true),
    ];
    if (shopId) {
      conditions.push(eq(deviceBaseValues.shopId, shopId));
    }
    const [value] = await db.select().from(deviceBaseValues).where(and(...conditions));
    return value;
  }

  async findDeviceBaseValueAnyStatus(brand: string, model: string, storage: string, shopId?: string): Promise<DeviceBaseValue | undefined> {
    const conditions = [
      eq(deviceBaseValues.brand, brand),
      eq(deviceBaseValues.model, model),
      eq(deviceBaseValues.storage, storage),
    ];
    if (shopId) {
      conditions.push(eq(deviceBaseValues.shopId, shopId));
    }
    const [value] = await db.select().from(deviceBaseValues).where(and(...conditions));
    return value;
  }

  async upsertDeviceBaseValue(value: InsertDeviceBaseValue): Promise<DeviceBaseValue> {
    const existing = await this.findDeviceBaseValueAnyStatus(value.brand, value.model, value.storage, value.shopId || undefined);
    if (existing) {
      const updated = await this.updateDeviceBaseValue(existing.id, value);
      return updated ?? existing;
    }
    return this.createDeviceBaseValue(value);
  }

  async createDeviceBaseValue(value: InsertDeviceBaseValue): Promise<DeviceBaseValue> {
    const [created] = await db.insert(deviceBaseValues).values(value).returning();
    return created;
  }

  async updateDeviceBaseValue(id: string, value: Partial<InsertDeviceBaseValue>): Promise<DeviceBaseValue | undefined> {
    const [updated] = await db.update(deviceBaseValues)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(deviceBaseValues.id, id))
      .returning();
    return updated;
  }

  async deleteDeviceBaseValue(id: string): Promise<boolean> {
    const result = await db.delete(deviceBaseValues).where(eq(deviceBaseValues.id, id));
    return true;
  }

  // ==================== CONDITION QUESTIONS ====================
  async getConditionQuestions(): Promise<ConditionQuestion[]> {
    return db.select().from(conditionQuestions)
      .where(eq(conditionQuestions.isActive, true))
      .orderBy(conditionQuestions.sortOrder);
  }

  async createConditionQuestion(question: InsertConditionQuestion): Promise<ConditionQuestion> {
    const [created] = await db.insert(conditionQuestions).values(question).returning();
    return created;
  }

  async updateConditionQuestion(id: string, question: Partial<InsertConditionQuestion>): Promise<ConditionQuestion | undefined> {
    const [updated] = await db.update(conditionQuestions)
      .set(question)
      .where(eq(conditionQuestions.id, id))
      .returning();
    return updated;
  }

  // ==================== TRADE-IN ASSESSMENTS ====================
  async getTradeInAssessments(shopId?: string): Promise<TradeInAssessment[]> {
    if (shopId) {
      return db.select().from(tradeInAssessments)
        .where(eq(tradeInAssessments.shopId, shopId))
        .orderBy(desc(tradeInAssessments.createdAt));
    }
    return db.select().from(tradeInAssessments)
      .orderBy(desc(tradeInAssessments.createdAt));
  }

  async getTradeInAssessment(id: string): Promise<TradeInAssessment | undefined> {
    const [assessment] = await db.select().from(tradeInAssessments)
      .where(eq(tradeInAssessments.id, id));
    return assessment;
  }

  async getTradeInByImei(imei: string): Promise<TradeInAssessment | undefined> {
    const [assessment] = await db.select().from(tradeInAssessments)
      .where(eq(tradeInAssessments.imei, imei))
      .orderBy(desc(tradeInAssessments.createdAt))
      .limit(1);
    return assessment;
  }

  async createTradeInAssessment(assessment: InsertTradeInAssessment): Promise<TradeInAssessment> {
    const [created] = await db.insert(tradeInAssessments).values(assessment).returning();
    return created;
  }

  async updateTradeInAssessment(id: string, assessment: Partial<InsertTradeInAssessment>): Promise<TradeInAssessment | undefined> {
    const [updated] = await db.update(tradeInAssessments)
      .set({ ...assessment, updatedAt: new Date() })
      .where(eq(tradeInAssessments.id, id))
      .returning();
    return updated;
  }

  async getNextTradeInNumber(): Promise<string> {
    const [result] = await db.select({ count: sqlFn`COUNT(*)::int` }).from(tradeInAssessments);
    const count = (result?.count as number) || 0;
    return `TI-${String(10001 + count).padStart(5, '0')}`;
  }

  // ==================== BLOCKED IMEIs ====================
  async getBlockedImei(imei: string): Promise<BlockedImei | undefined> {
    const [blocked] = await db.select().from(blockedImeis)
      .where(eq(blockedImeis.imei, imei));
    return blocked;
  }

  async createBlockedImei(blocked: InsertBlockedImei): Promise<BlockedImei> {
    const [created] = await db.insert(blockedImeis).values(blocked).returning();
    return created;
  }

  // ==================== TRADE-IN AUDIT LOGS ====================
  async getTradeInAuditLogs(tradeInId: string): Promise<TradeInAuditLog[]> {
    return db.select().from(tradeInAuditLogs)
      .where(eq(tradeInAuditLogs.tradeInId, tradeInId))
      .orderBy(desc(tradeInAuditLogs.timestamp));
  }

  async getAllTradeInAuditLogs(shopId?: string, limit: number = 100): Promise<TradeInAuditLog[]> {
    return db.select().from(tradeInAuditLogs)
      .orderBy(desc(tradeInAuditLogs.timestamp))
      .limit(limit);
  }

  async createTradeInAuditLog(log: InsertTradeInAuditLog): Promise<TradeInAuditLog> {
    const [created] = await db.insert(tradeInAuditLogs).values(log).returning();
    return created;
  }

  // ==================== SCORING RULES ====================
  async getScoringRules(shopId?: string): Promise<ScoringRule[]> {
    if (shopId) {
      return db.select().from(scoringRules)
        .where(and(eq(scoringRules.shopId, shopId), eq(scoringRules.isActive, true)));
    }
    return db.select().from(scoringRules)
      .where(eq(scoringRules.isActive, true));
  }

  async createScoringRule(rule: InsertScoringRule): Promise<ScoringRule> {
    const [created] = await db.insert(scoringRules).values(rule).returning();
    return created;
  }

  // ==================== ACTIVITY LOGS ====================
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async getActivityLogs(limit: number = 200): Promise<ActivityLog[]> {
    return db.select().from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  // ==================== LEADS ====================
  async getLeads(shopId?: string): Promise<import("@shared/schema").Lead[]> {
    if (shopId) {
      return db.select().from(leads).where(eq(leads.shopId, shopId)).orderBy(desc(leads.createdAt));
    }
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<import("@shared/schema").Lead | undefined> {
    const [l] = await db.select().from(leads).where(eq(leads.id, id));
    return l;
  }

  async createLead(lead: import("@shared/schema").InsertLead): Promise<import("@shared/schema").Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  async updateLead(id: string, data: Partial<import("@shared/schema").InsertLead>): Promise<import("@shared/schema").Lead | undefined> {
    const [updated] = await db.update(leads).set({ ...data, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
    return updated;
  }

  async addLeadFollowUp(leadId: string, followUp: { by?: string; byName?: string; note?: string; result?: string; at?: Date; nextFollowUpAt?: Date | null }): Promise<import("@shared/schema").Lead | undefined> {
    const existing = await this.getLead(leadId);
    if (!existing) return undefined;
    const history = Array.isArray(existing.followUpHistory) ? [...existing.followUpHistory] : [];
    const entry = {
      by: followUp.by || null,
      byName: followUp.byName || null,
      note: followUp.note || null,
      result: followUp.result || null,
      at: (followUp.at || new Date()).toISOString(),
    } as any;
    history.push(entry);
    const updates: any = { followUpHistory: history, updatedAt: new Date() };
    if (followUp.nextFollowUpAt) updates.nextFollowUpAt = followUp.nextFollowUpAt;
    const [updated] = await db.update(leads).set(updates).where(eq(leads.id, leadId)).returning();
    return updated;
  }

  // ==================== LEAD AUDIT LOGS ====================
  async createLeadAuditLog(log: import("@shared/schema").InsertLeadAuditLog): Promise<import("@shared/schema").LeadAuditLog> {
    const [created] = await db.insert(leadAuditLogs).values(log).returning();
    return created;
  }

  async getLeadAuditLogs(leadId: string): Promise<import("@shared/schema").LeadAuditLog[]> {
    return db.select().from(leadAuditLogs).where(eq(leadAuditLogs.leadId, leadId)).orderBy(desc(leadAuditLogs.timestamp));
  }

  // ==================== PRODUCTS ====================
  async getProducts(shopId?: string): Promise<import("@shared/schema").Product[]> {
    if (shopId) {
      return db.select().from(products).where(eq(products.shopId, shopId)).orderBy(products.name);
    }
    return db.select().from(products).orderBy(products.name);
  }

  async getProduct(id: string): Promise<import("@shared/schema").Product | undefined> {
    const [p] = await db.select().from(products).where(eq(products.id, id));
    return p;
  }

  async createProduct(product: import("@shared/schema").InsertProduct): Promise<import("@shared/schema").Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: string, data: Partial<import("@shared/schema").InsertProduct>): Promise<import("@shared/schema").Product | undefined> {
    const [updated] = await db.update(products).set({ ...data, updatedAt: new Date() }).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    await db.delete(products).where(eq(products.id, id));
    return true;
  }

  // ==================== SHOPS ====================
  async getShop(id: string): Promise<import("@shared/schema").Shop | undefined> {
    const [shop] = await db.select().from(shops).where(eq(shops.id, id));
    return shop;
  }

  async getShops(): Promise<import("@shared/schema").Shop[]> {
    return db.select().from(shops).orderBy(shops.name);
  }

  async createShop(shop: import("@shared/schema").InsertShop): Promise<import("@shared/schema").Shop> {
    const [created] = await db.insert(shops).values(shop).returning();
    return created;
  }

  async updateShop(id: string, data: Partial<import("@shared/schema").InsertShop>): Promise<import("@shared/schema").Shop | undefined> {
    const [updated] = await db.update(shops).set({ ...data, updatedAt: new Date() }).where(eq(shops.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
