import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  tradeInWizardSchema, 
  tradeInReviewSchema,
  type ConditionOption,
} from "@shared/schema";
import { 
  validateIMEI, 
  processTradeIn,
  DEFAULT_CONDITION_QUESTIONS,
  DEFAULT_BASE_VALUES,
} from "./trade-in-scoring";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ===================== TRADE-IN API =====================
  
  // Get all condition questions for the wizard
  app.get("/api/trade-in/questions", async (req: Request, res: Response) => {
    try {
      let questions = await storage.getConditionQuestions();
      
      // If no questions exist, seed with defaults
      if (questions.length === 0) {
        for (const q of DEFAULT_CONDITION_QUESTIONS) {
          await storage.createConditionQuestion(q);
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
          await storage.createDeviceBaseValue({ ...v, isActive: true, shopId: shopId || null });
        }
        values = await storage.getDeviceBaseValues(shopId);
      }
      
      res.json(values);
    } catch (error) {
      console.error("Error fetching base values:", error);
      res.status(500).json({ error: "Failed to fetch base values" });
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
        shopId: req.body.shopId || null,
        processedBy: req.body.processedBy || null,
      });
      
      // Create audit log
      await storage.createTradeInAuditLog({
        tradeInId: assessment.id,
        action: "created",
        newState: assessment,
        userId: req.body.processedBy,
        userName: req.body.processedByName || "System",
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
      
      const updated = await storage.updateTradeInAssessment(id, {
        decision,
        status: decision === "accepted" ? "approved" : "rejected",
        finalOffer: finalOffer || existing.calculatedOffer,
        reviewNotes,
        rejectionReasons: rejectionReasons || null,
        reviewedBy: req.body.reviewedBy,
        reviewedAt: new Date(),
      });
      
      // Create audit log
      await storage.createTradeInAuditLog({
        tradeInId: id,
        action: "reviewed",
        previousState,
        newState: updated,
        userId: req.body.reviewedBy,
        userName: req.body.reviewedByName || "Manager",
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
        userId: req.body.completedBy,
        userName: req.body.completedByName || "Staff",
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
