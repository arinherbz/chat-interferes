import { 
  type User, type InsertUser, users,
  type UserPreference, type InsertUserPreference, userPreferences,
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
  type Device, type InsertDevice, devices,
  type Customer, type InsertCustomer, customers,
  type Sale, type InsertSale, sales,
  type Repair, type InsertRepair, repairs,
  type Expense, type InsertExpense, expenses,
  type Closure, type InsertClosure, closures,
  type Order, type InsertOrder, orders,
  type OrderItem, type InsertOrderItem, orderItems,
  type Delivery, type InsertDelivery, deliveries,
  type Receipt, type InsertReceipt, receipts,
  type Notification, type InsertNotification, notifications,
} from "@shared/schema";
import { db, pool, sqliteClient } from "./db";
import { eq, and, desc, sql as sqlFn, inArray, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  setUserStatus(id: string, status: "active" | "disabled"): Promise<User | undefined>;
  touchUserActivity(id: string, activity?: { lastLogin?: boolean }): Promise<void>;
  getUserPreferences(userId: string): Promise<UserPreference | undefined>;
  upsertUserPreferences(userId: string, data: Partial<InsertUserPreference>): Promise<UserPreference>;
  
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

  // Customers
  getCustomers(shopId?: string): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  incrementCustomerPurchases(id: string): Promise<void>;

  // Devices
  getDevices(shopId?: string): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined>;

  // Sales
  getSales(shopId?: string): Promise<Sale[]>;
  createSale(sale: InsertSale): Promise<Sale>;

  // Orders
  getOrders(filters?: { shopId?: string; status?: string; assignedStaffId?: string }): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;

  // Deliveries
  getDeliveries(filters?: { status?: string; assignedRiderId?: string }): Promise<Delivery[]>;
  getDeliveryByOrderId(orderId: string): Promise<Delivery | undefined>;
  updateDelivery(id: string, data: Partial<InsertDelivery>): Promise<Delivery | undefined>;
  upsertDelivery(data: InsertDelivery): Promise<Delivery>;

  // Receipts
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  getReceiptsByOrderId(orderId: string): Promise<Receipt[]>;

  // Notifications
  getNotifications(shopId?: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;

  // Repairs
  getRepairs(shopId?: string): Promise<Repair[]>;
  createRepair(repair: InsertRepair & { repairNumber: string }): Promise<Repair>;
  updateRepair(id: string, data: Partial<InsertRepair>): Promise<Repair | undefined>;

  // Expenses
  getExpenses(shopId?: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;

  // Closures
  getClosures(shopId?: string): Promise<Closure[]>;
  createClosure(closure: InsertClosure): Promise<Closure>;
  updateClosure(id: string, data: Partial<InsertClosure>): Promise<Closure | undefined>;
}

export class DatabaseStorage implements IStorage {
  private stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const cleaned: Partial<T> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    }
    return cleaned;
  }

  private normalizeBoolean(value: boolean | null | undefined): boolean | undefined {
    if (value === null || value === undefined) return undefined;
    return value;
  }

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

  async getUserPreferences(userId: string): Promise<UserPreference | undefined> {
    try {
      const [pref] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
      return pref;
    } catch {
      return undefined;
    }
  }

  async upsertUserPreferences(userId: string, data: Partial<InsertUserPreference>): Promise<UserPreference> {
    try {
      const sanitized = this.stripUndefined(data as Record<string, unknown>);
      const existing = await this.getUserPreferences(userId);
      if (existing) {
        const [updated] = await db
          .update(userPreferences)
          .set({ ...sanitized, updatedAt: new Date() })
          .where(eq(userPreferences.userId, userId))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(userPreferences)
        .values({
          userId,
          ...sanitized,
        })
        .returning();
      return created;
    } catch {
      return {
        id: `fallback-${userId}`,
        userId,
        theme: "system",
        currency: "UGX",
        dateFormat: "PPP",
        timezone: "UTC",
        defaultBranchId: null,
        sidebarCollapsed: false,
        density: "comfortable",
        dashboardLayout: null,
        accentColor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserPreference;
    }
  }

  // ==================== BRANDS ====================
  async getBrands(): Promise<Brand[]> {
    return db.select().from(brands).where(eq(brands.isActive, true)).orderBy(brands.sortOrder, brands.name);
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand;
  }

  async createBrand(brand: InsertBrand): Promise<Brand> {
    const values = { ...brand, isActive: this.normalizeBoolean(brand.isActive) } as InsertBrand;
    const [created] = await db.insert(brands).values(values).returning();
    return created;
  }

  async updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined> {
    const values = { ...data, isActive: this.normalizeBoolean(data.isActive) } as Partial<InsertBrand>;
    const [updated] = await db.update(brands).set(values).where(eq(brands.id, id)).returning();
    return updated;
  }

  async deleteBrand(id: string): Promise<boolean> {
    await db.delete(brands).where(eq(brands.id, id));
    return true;
  }

  // ==================== MODELS ====================
  async getModels(brandId?: string): Promise<Model[]> {
    if (brandId) {
      return db.select().from(models).where(and(eq(models.brandId, brandId), eq(models.isActive, true))).orderBy(models.sortOrder, models.name);
    }
    return db.select().from(models).where(eq(models.isActive, true)).orderBy(models.sortOrder, models.name);
  }

  async getModel(id: string): Promise<Model | undefined> {
    const [model] = await db.select().from(models).where(eq(models.id, id));
    return model;
  }

  async createModel(model: InsertModel): Promise<Model> {
    const values = { ...model, isActive: this.normalizeBoolean(model.isActive) } as InsertModel;
    const [created] = await db.insert(models).values(values).returning();
    return created;
  }
  
  async updateModel(id: string, data: Partial<InsertModel>): Promise<Model | undefined> {
    const values = { ...data, isActive: this.normalizeBoolean(data.isActive) } as Partial<InsertModel>;
    const [updated] = await db.update(models).set(values).where(eq(models.id, id)).returning();
    return updated;
  }

  async deleteModel(id: string): Promise<boolean> {
    await db.delete(models).where(eq(models.id, id));
    return true;
  }

  // ==================== STORAGE OPTIONS ====================
  async getStorageOptions(modelId?: string): Promise<StorageOption[]> {
    if (modelId) {
      return db.select().from(storageOptions).where(and(eq(storageOptions.modelId, modelId), eq(storageOptions.isActive, true))).orderBy(storageOptions.sortOrder, storageOptions.size);
    }
    return db.select().from(storageOptions).where(eq(storageOptions.isActive, true)).orderBy(storageOptions.sortOrder, storageOptions.size);
  }

  async getStorageOption(id: string): Promise<StorageOption | undefined> {
    const [option] = await db.select().from(storageOptions).where(eq(storageOptions.id, id));
    return option;
  }

  async createStorageOption(option: InsertStorageOption): Promise<StorageOption> {
    const values = { ...option, isActive: this.normalizeBoolean(option.isActive) } as InsertStorageOption;
    const [created] = await db.insert(storageOptions).values(values).returning();
    return created;
  }

  async updateStorageOption(id: string, data: Partial<InsertStorageOption>): Promise<StorageOption | undefined> {
    const values = { ...data, isActive: this.normalizeBoolean(data.isActive) } as Partial<InsertStorageOption>;
    const [updated] = await db.update(storageOptions).set(values).where(eq(storageOptions.id, id)).returning();
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
    const values = await this.getDeviceBaseValues(shopId);
    return values.find((value) =>
      value.brand === brand &&
      value.model === model &&
      value.storage === storage &&
      value.isActive !== false,
    );
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
    const values = { ...value, isActive: this.normalizeBoolean(value.isActive) } as InsertDeviceBaseValue;
    const [created] = await db.insert(deviceBaseValues).values(values).returning();
    return created;
  }

  async updateDeviceBaseValue(id: string, value: Partial<InsertDeviceBaseValue>): Promise<DeviceBaseValue | undefined> {
    const values = { ...value, isActive: this.normalizeBoolean(value.isActive), updatedAt: new Date() } as Partial<InsertDeviceBaseValue>;
    const [updated] = await db.update(deviceBaseValues)
      .set(values)
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
    const values = { ...question, isActive: this.normalizeBoolean(question.isActive) } as InsertConditionQuestion;
    const [created] = await db.insert(conditionQuestions).values(values).returning();
    return created;
  }

  async updateConditionQuestion(id: string, question: Partial<InsertConditionQuestion>): Promise<ConditionQuestion | undefined> {
    const values = { ...question, isActive: this.normalizeBoolean(question.isActive) } as Partial<InsertConditionQuestion>;
    const [updated] = await db.update(conditionQuestions)
      .set(values)
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
    if (sqliteClient && !pool) {
      const id = (globalThis as any).crypto?.randomUUID?.() || `product-${Date.now()}`;
      sqliteClient
        .prepare(`
          INSERT INTO products (
            id, name, category, brand, model, slug, description, condition, ram, storage, specs,
            featured, is_published, is_flash_deal, flash_deal_price, flash_deal_ends_at, popularity,
            price, cost_price, stock, min_stock, sku, image_url, shop_id, created_at, updated_at
          ) VALUES (
            @id, @name, @category, @brand, @model, @slug, @description, @condition, @ram, @storage, @specs,
            @featured, @isPublished, @isFlashDeal, @flashDealPrice, @flashDealEndsAt, @popularity,
            @price, @costPrice, @stock, @minStock, @sku, @imageUrl, @shopId, @createdAt, @updatedAt
          )
        `)
        .run({
          id,
          name: product.name,
          category: product.category ?? null,
          brand: product.brand ?? null,
          model: product.model ?? null,
          slug: product.slug ?? null,
          description: product.description ?? null,
          condition: product.condition ?? "New",
          ram: product.ram ?? null,
          storage: product.storage ?? null,
          specs: product.specs ? JSON.stringify(product.specs) : null,
          featured: Number(Boolean(product.featured)),
          isPublished: product.isPublished === false ? 0 : 1,
          isFlashDeal: Number(Boolean(product.isFlashDeal)),
          flashDealPrice: product.flashDealPrice ?? null,
          flashDealEndsAt: product.flashDealEndsAt ? new Date(product.flashDealEndsAt as any).toISOString() : null,
          popularity: product.popularity ?? 0,
          price: product.price ?? 0,
          costPrice: product.costPrice ?? 0,
          stock: product.stock ?? 0,
          minStock: product.minStock ?? 0,
          sku: product.sku ?? null,
          imageUrl: product.imageUrl ?? null,
          shopId: product.shopId ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      const [created] = await db.select().from(products).where(eq(products.id, id));
      return created;
    }

    const normalizedProduct = this.stripUndefined({
      ...product,
      featured: product.featured === undefined ? undefined : Number(Boolean(product.featured)),
      isPublished: product.isPublished === undefined ? undefined : Number(Boolean(product.isPublished)),
      isFlashDeal: product.isFlashDeal === undefined ? undefined : Number(Boolean(product.isFlashDeal)),
    }) as typeof product;
    const [created] = await db.insert(products).values(normalizedProduct).returning();
    return created;
  }

  async updateProduct(id: string, data: Partial<import("@shared/schema").InsertProduct>): Promise<import("@shared/schema").Product | undefined> {
    if (sqliteClient && !pool) {
      const existing = await this.getProduct(id);
      if (!existing) return undefined;
      const next = { ...existing, ...data };
      sqliteClient
        .prepare(`
          UPDATE products SET
            name = @name,
            category = @category,
            brand = @brand,
            model = @model,
            slug = @slug,
            description = @description,
            condition = @condition,
            ram = @ram,
            storage = @storage,
            specs = @specs,
            featured = @featured,
            is_published = @isPublished,
            is_flash_deal = @isFlashDeal,
            flash_deal_price = @flashDealPrice,
            flash_deal_ends_at = @flashDealEndsAt,
            popularity = @popularity,
            price = @price,
            cost_price = @costPrice,
            stock = @stock,
            min_stock = @minStock,
            sku = @sku,
            image_url = @imageUrl,
            shop_id = @shopId,
            updated_at = @updatedAt
          WHERE id = @id
        `)
        .run({
          id,
          name: next.name,
          category: next.category ?? null,
          brand: next.brand ?? null,
          model: next.model ?? null,
          slug: next.slug ?? null,
          description: (next as any).description ?? null,
          condition: (next as any).condition ?? "New",
          ram: (next as any).ram ?? null,
          storage: (next as any).storage ?? null,
          specs: (next as any).specs ? JSON.stringify((next as any).specs) : null,
          featured: Number(Boolean((next as any).featured)),
          isPublished: (next as any).isPublished === false ? 0 : 1,
          isFlashDeal: Number(Boolean((next as any).isFlashDeal)),
          flashDealPrice: (next as any).flashDealPrice ?? null,
          flashDealEndsAt: (next as any).flashDealEndsAt ? new Date((next as any).flashDealEndsAt).toISOString() : null,
          popularity: (next as any).popularity ?? 0,
          price: next.price ?? 0,
          costPrice: next.costPrice ?? 0,
          stock: next.stock ?? 0,
          minStock: next.minStock ?? 0,
          sku: next.sku ?? null,
          imageUrl: next.imageUrl ?? null,
          shopId: next.shopId ?? null,
          updatedAt: new Date().toISOString(),
        });
      const [updated] = await db.select().from(products).where(eq(products.id, id));
      return updated;
    }

    const normalizedData = this.stripUndefined({
      ...data,
      featured: data.featured === undefined ? undefined : Number(Boolean(data.featured)),
      isPublished: data.isPublished === undefined ? undefined : Number(Boolean(data.isPublished)),
      isFlashDeal: data.isFlashDeal === undefined ? undefined : Number(Boolean(data.isFlashDeal)),
    }) as Partial<import("@shared/schema").InsertProduct>;
    const [updated] = await db.update(products).set({ ...normalizedData, updatedAt: new Date() }).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    await db.delete(products).where(eq(products.id, id));
    return true;
  }

  // ==================== DEVICES ====================
  async getDevices(shopId?: string): Promise<Device[]> {
    if (shopId) {
      return db.select().from(devices).where(eq(devices.shopId, shopId)).orderBy(desc(devices.addedAt));
    }
    return db.select().from(devices).orderBy(desc(devices.addedAt));
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const [created] = await db.insert(devices).values(device).returning();
    return created;
  }

  async updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined> {
    const [updated] = await db.update(devices).set({ ...data, updatedAt: new Date() }).where(eq(devices.id, id)).returning();
    return updated;
  }

  // ==================== CUSTOMERS ====================
  async getCustomers(shopId?: string): Promise<Customer[]> {
    if (shopId) {
      return db.select().from(customers).where(eq(customers.shopId, shopId)).orderBy(customers.name);
    }
    return db.select().from(customers).orderBy(customers.name);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async incrementCustomerPurchases(id: string): Promise<void> {
    await db
      .update(customers)
      .set({
        totalPurchases: sqlFn`${customers.totalPurchases} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));
  }

  // ==================== SALES ====================
  async getSales(shopId?: string): Promise<Sale[]> {
    if (shopId) {
      return db.select().from(sales).where(eq(sales.shopId, shopId)).orderBy(desc(sales.createdAt));
    }
    return db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const [created] = await db.insert(sales).values(sale).returning();
    return created;
  }

  // ==================== ORDERS ====================
  async getOrders(filters?: { shopId?: string; status?: string; assignedStaffId?: string }): Promise<Order[]> {
    const clauses = [];
    if (filters?.shopId) clauses.push(eq(orders.shopId, filters.shopId));
    if (filters?.status) clauses.push(eq(orders.status, filters.status));
    if (filters?.assignedStaffId) clauses.push(eq(orders.assignedStaffId, filters.assignedStaffId));

    if (clauses.length > 0) {
      return db.select().from(orders).where(and(...clauses)).orderBy(desc(orders.createdAt));
    }
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return order;
  }

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    if (items.length > 0) {
      await db.insert(orderItems).values(items.map((item) => ({ ...item, orderId: created.id })));
    }
    return created;
  }

  async updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updated] = await db
      .update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.productName));
  }

  // ==================== DELIVERIES ====================
  async getDeliveries(filters?: { status?: string; assignedRiderId?: string }): Promise<Delivery[]> {
    const clauses = [];
    if (filters?.status) clauses.push(eq(deliveries.status, filters.status));
    if (filters?.assignedRiderId) clauses.push(eq(deliveries.assignedRiderId, filters.assignedRiderId));

    if (clauses.length > 0) {
      return db.select().from(deliveries).where(and(...clauses)).orderBy(desc(deliveries.scheduledAt));
    }
    return db.select().from(deliveries).orderBy(desc(deliveries.scheduledAt));
  }

  async getDeliveryByOrderId(orderId: string): Promise<Delivery | undefined> {
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId));
    return delivery;
  }

  async updateDelivery(id: string, data: Partial<InsertDelivery>): Promise<Delivery | undefined> {
    const [updated] = await db.update(deliveries).set(data).where(eq(deliveries.id, id)).returning();
    return updated;
  }

  async upsertDelivery(data: InsertDelivery): Promise<Delivery> {
    const existing = await this.getDeliveryByOrderId(data.orderId);
    if (existing) {
      const [updated] = await db
        .update(deliveries)
        .set(data)
        .where(eq(deliveries.orderId, data.orderId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(deliveries).values(data).returning();
    return created;
  }

  // ==================== RECEIPTS ====================
  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const [created] = await db.insert(receipts).values(receipt).returning();
    return created;
  }

  async getReceiptsByOrderId(orderId: string): Promise<Receipt[]> {
    return db.select().from(receipts).where(eq(receipts.orderId, orderId)).orderBy(desc(receipts.createdAt));
  }

  // ==================== NOTIFICATIONS ====================
  async getNotifications(shopId?: string): Promise<Notification[]> {
    if (shopId) {
      return db.select().from(notifications).where(eq(notifications.shopId, shopId)).orderBy(desc(notifications.createdAt));
    }
    return db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values({ ...notification, read: Number(Boolean(notification.read)) } as unknown as InsertNotification)
      .returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db
      .update(notifications)
      .set({ read: Number(true) } as unknown as Partial<InsertNotification>)
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  // ==================== REPAIRS ====================
  async getRepairs(shopId?: string): Promise<Repair[]> {
    if (shopId) {
      return db.select().from(repairs).where(eq(repairs.shopId, shopId)).orderBy(desc(repairs.createdAt));
    }
    return db.select().from(repairs).orderBy(desc(repairs.createdAt));
  }

  async createRepair(repair: InsertRepair & { repairNumber: string }): Promise<Repair> {
    const [created] = await db.insert(repairs).values(repair).returning();
    return created;
  }

  async updateRepair(id: string, data: Partial<InsertRepair>): Promise<Repair | undefined> {
    const [updated] = await db.update(repairs).set({ ...data, updatedAt: new Date() }).where(eq(repairs.id, id)).returning();
    return updated;
  }

  // ==================== EXPENSES ====================
  async getExpenses(shopId?: string): Promise<Expense[]> {
    if (shopId) {
      return db.select().from(expenses).where(eq(expenses.shopId, shopId)).orderBy(desc(expenses.date));
    }
    return db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [created] = await db.insert(expenses).values(expense).returning();
    return created;
  }

  // ==================== CLOSURES ====================
  async getClosures(shopId?: string): Promise<Closure[]> {
    if (shopId) {
      return db.select().from(closures).where(eq(closures.shopId, shopId)).orderBy(desc(closures.date));
    }
    return db.select().from(closures).orderBy(desc(closures.date));
  }

  async createClosure(closure: InsertClosure): Promise<Closure> {
    const [created] = await db.insert(closures).values(closure).returning();
    return created;
  }

  async updateClosure(id: string, data: Partial<InsertClosure>): Promise<Closure | undefined> {
    const [updated] = await db.update(closures).set({ ...data, updatedAt: new Date() }).where(eq(closures.id, id)).returning();
    return updated;
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
