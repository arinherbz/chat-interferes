import { 
  type User, type InsertUser, users,
  type DeviceBaseValue, type InsertDeviceBaseValue, deviceBaseValues,
  type ConditionQuestion, type InsertConditionQuestion, conditionQuestions,
  type TradeInAssessment, type InsertTradeInAssessment, tradeInAssessments,
  type BlockedImei, type InsertBlockedImei, blockedImeis,
  type TradeInAuditLog, type InsertTradeInAuditLog, tradeInAuditLogs,
  type ScoringRule, type InsertScoringRule, scoringRules,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql as sqlFn } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Device Base Values
  getDeviceBaseValues(shopId?: string): Promise<DeviceBaseValue[]>;
  getDeviceBaseValue(brand: string, model: string, storage: string, shopId?: string): Promise<DeviceBaseValue | undefined>;
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
}

export const storage = new DatabaseStorage();
