import type { ConditionOption, TradeInAssessment } from "@shared/schema";

// ===================== IMEI VALIDATION =====================
export function validateIMEI(imei: string): { valid: boolean; error?: string } {
  // IMEI must be exactly 15 digits
  if (!/^\d{15}$/.test(imei)) {
    return { valid: false, error: "IMEI must be exactly 15 digits" };
  }
  
  // Luhn algorithm check for IMEI validity
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(imei[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  if (checkDigit !== parseInt(imei[14], 10)) {
    return { valid: false, error: "Invalid IMEI checksum" };
  }
  
  return { valid: true };
}

// ===================== CONDITION SCORING =====================
export interface ConditionAnswer {
  questionId: string;
  selectedValue: string;
  deduction: number;
  isRejection: boolean;
}

export interface ScoringResult {
  conditionScore: number; // 0-100, 100 being perfect condition
  calculatedOffer: number;
  decision: "auto_accept" | "auto_reject" | "manual_review";
  rejectionReasons: string[];
  deductionBreakdown: { question: string; deduction: number }[];
}

// Default scoring thresholds
const SCORING_THRESHOLDS = {
  AUTO_ACCEPT_MIN_SCORE: 70, // Score >= 70 = auto accept
  AUTO_REJECT_MAX_SCORE: 30, // Score <= 30 = auto reject
  // Between 30-70 = manual review
};

export function calculateConditionScore(
  answers: Record<string, string>,
  questions: { id: string; question: string; options: ConditionOption[] }[]
): { score: number; deductions: { question: string; deduction: number }[]; rejections: string[] } {
  let totalDeduction = 0;
  const deductions: { question: string; deduction: number }[] = [];
  const rejections: string[] = [];
  
  for (const question of questions) {
    const selectedValue = answers[question.id];
    if (!selectedValue) continue;
    
    const selectedOption = question.options.find(opt => opt.value === selectedValue);
    if (selectedOption) {
      if (selectedOption.deduction > 0) {
        totalDeduction += selectedOption.deduction;
        deductions.push({ question: question.question, deduction: selectedOption.deduction });
      }
      if (selectedOption.isRejection) {
        rejections.push(`${question.question}: ${selectedOption.label}`);
      }
    }
  }
  
  // Score is 100 minus total deductions, capped at 0
  const score = Math.max(0, 100 - totalDeduction);
  
  return { score, deductions, rejections };
}

export function determineDecision(
  score: number,
  rejectionReasons: string[],
  isIcloudLocked: boolean,
  isGoogleLocked: boolean,
  isDuplicateImei: boolean,
  isInvalidImei: boolean
): { decision: "auto_accept" | "auto_reject" | "manual_review"; reasons: string[] } {
  const allRejectionReasons = [...rejectionReasons];
  
  // Critical rejection rules
  if (isIcloudLocked) {
    allRejectionReasons.push("Device has iCloud lock enabled");
  }
  if (isGoogleLocked) {
    allRejectionReasons.push("Device has Google FRP lock enabled");
  }
  if (isDuplicateImei) {
    allRejectionReasons.push("Duplicate IMEI - device already processed");
  }
  if (isInvalidImei) {
    allRejectionReasons.push("Invalid IMEI number");
  }
  
  // If any critical rejection reasons, auto reject
  if (allRejectionReasons.length > 0) {
    return { decision: "auto_reject", reasons: allRejectionReasons };
  }
  
  // Score-based decision
  if (score >= SCORING_THRESHOLDS.AUTO_ACCEPT_MIN_SCORE) {
    return { decision: "auto_accept", reasons: [] };
  }
  
  if (score <= SCORING_THRESHOLDS.AUTO_REJECT_MAX_SCORE) {
    return { decision: "auto_reject", reasons: ["Condition score too low for trade-in"] };
  }
  
  return { decision: "manual_review", reasons: [] };
}

export function calculateOffer(baseValue: number, conditionScore: number): number {
  // Apply condition score as a percentage multiplier
  // Score of 100 = 100% of base value
  // Score of 50 = 50% of base value
  const multiplier = conditionScore / 100;
  return Math.round(baseValue * multiplier);
}

export function processTradeIn(
  baseValue: number,
  answers: Record<string, string>,
  questions: { id: string; question: string; options: ConditionOption[] }[],
  isIcloudLocked: boolean,
  isGoogleLocked: boolean,
  isDuplicateImei: boolean,
  isInvalidImei: boolean
): ScoringResult {
  // Calculate condition score
  const { score, deductions, rejections } = calculateConditionScore(answers, questions);
  
  // Determine decision
  const { decision, reasons } = determineDecision(
    score,
    rejections,
    isIcloudLocked,
    isGoogleLocked,
    isDuplicateImei,
    isInvalidImei
  );
  
  // Calculate offer (even for rejections, for informational purposes)
  const calculatedOffer = calculateOffer(baseValue, score);
  
  return {
    conditionScore: score,
    calculatedOffer,
    decision,
    rejectionReasons: reasons,
    deductionBreakdown: deductions,
  };
}

// ===================== DEFAULT CONDITION QUESTIONS =====================
// These are seeded into the database for new shops
export const DEFAULT_CONDITION_QUESTIONS = [
  // Security (Critical)
  {
    category: "security",
    question: "Is iCloud/Find My iPhone enabled?",
    options: [
      { value: "no", label: "No - Account signed out", deduction: 0, isRejection: false },
      { value: "yes", label: "Yes - Account still active", deduction: 100, isRejection: true },
    ] as ConditionOption[],
    sortOrder: 1,
    isRequired: true,
    isCritical: true,
    isActive: true,
  },
  {
    category: "security",
    question: "Is Google FRP (Factory Reset Protection) enabled?",
    options: [
      { value: "no", label: "No - Account removed", deduction: 0, isRejection: false },
      { value: "yes", label: "Yes - Account still linked", deduction: 100, isRejection: true },
      { value: "na", label: "N/A - Apple device", deduction: 0, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 2,
    isRequired: true,
    isCritical: true,
    isActive: true,
  },
  
  // Screen Condition
  {
    category: "screen",
    question: "What is the screen condition?",
    options: [
      { value: "perfect", label: "Perfect - No scratches or marks", deduction: 0, isRejection: false },
      { value: "minor_scratches", label: "Minor scratches (not visible when screen is on)", deduction: 5, isRejection: false },
      { value: "visible_scratches", label: "Visible scratches (seen when screen is on)", deduction: 15, isRejection: false },
      { value: "cracked", label: "Cracked screen", deduction: 40, isRejection: false },
      { value: "broken", label: "Screen not working / Black screen", deduction: 60, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 3,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  {
    category: "screen",
    question: "Does the touchscreen respond correctly?",
    options: [
      { value: "yes", label: "Yes - Fully responsive", deduction: 0, isRejection: false },
      { value: "partially", label: "Partially - Some areas unresponsive", deduction: 25, isRejection: false },
      { value: "no", label: "No - Touchscreen not working", deduction: 50, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 4,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  
  // Body Condition
  {
    category: "body",
    question: "What is the back panel condition?",
    options: [
      { value: "perfect", label: "Perfect - Like new", deduction: 0, isRejection: false },
      { value: "minor_wear", label: "Minor wear - Small scratches", deduction: 5, isRejection: false },
      { value: "visible_damage", label: "Visible damage - Dents or deep scratches", deduction: 15, isRejection: false },
      { value: "cracked", label: "Cracked back", deduction: 25, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 5,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  {
    category: "body",
    question: "What is the frame/edge condition?",
    options: [
      { value: "perfect", label: "Perfect - No dents or scratches", deduction: 0, isRejection: false },
      { value: "minor_wear", label: "Minor wear - Small scuffs", deduction: 3, isRejection: false },
      { value: "moderate_wear", label: "Moderate wear - Visible dents", deduction: 10, isRejection: false },
      { value: "heavy_damage", label: "Heavy damage - Bent frame", deduction: 30, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 6,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  
  // Functionality
  {
    category: "functionality",
    question: "Does the device power on?",
    options: [
      { value: "yes", label: "Yes - Powers on normally", deduction: 0, isRejection: false },
      { value: "slow", label: "Yes but slow / freezes", deduction: 15, isRejection: false },
      { value: "no", label: "No - Does not power on", deduction: 70, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 7,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  {
    category: "functionality",
    question: "What is the battery health?",
    options: [
      { value: "excellent", label: "Excellent (85%+)", deduction: 0, isRejection: false },
      { value: "good", label: "Good (70-84%)", deduction: 5, isRejection: false },
      { value: "fair", label: "Fair (50-69%)", deduction: 15, isRejection: false },
      { value: "poor", label: "Poor (below 50%)", deduction: 25, isRejection: false },
      { value: "swollen", label: "Battery swollen/damaged", deduction: 40, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 8,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  {
    category: "functionality",
    question: "Do all cameras work?",
    options: [
      { value: "all_working", label: "All cameras working", deduction: 0, isRejection: false },
      { value: "front_broken", label: "Front camera not working", deduction: 15, isRejection: false },
      { value: "back_broken", label: "Back camera not working", deduction: 20, isRejection: false },
      { value: "both_broken", label: "Both cameras not working", deduction: 35, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 9,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  {
    category: "functionality",
    question: "Do speakers and microphone work?",
    options: [
      { value: "all_working", label: "All working", deduction: 0, isRejection: false },
      { value: "speaker_issue", label: "Speaker issues", deduction: 10, isRejection: false },
      { value: "mic_issue", label: "Microphone issues", deduction: 10, isRejection: false },
      { value: "both_issues", label: "Both have issues", deduction: 20, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 10,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  {
    category: "functionality",
    question: "Do all buttons work?",
    options: [
      { value: "all_working", label: "All buttons work", deduction: 0, isRejection: false },
      { value: "some_issues", label: "Some buttons stuck/not working", deduction: 10, isRejection: false },
      { value: "major_issues", label: "Power or volume buttons not working", deduction: 20, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 11,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  {
    category: "functionality",
    question: "Does Face ID / Touch ID / Fingerprint work?",
    options: [
      { value: "working", label: "Working", deduction: 0, isRejection: false },
      { value: "not_working", label: "Not working", deduction: 15, isRejection: false },
      { value: "na", label: "N/A - Device doesn't have this feature", deduction: 0, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 12,
    isRequired: true,
    isCritical: false,
    isActive: true,
  },
  
  // Accessories
  {
    category: "accessories",
    question: "What accessories are included?",
    options: [
      { value: "all", label: "Original box, charger, and cable", deduction: 0, isRejection: false },
      { value: "some", label: "Some accessories (charger or cable)", deduction: 0, isRejection: false },
      { value: "none", label: "No accessories", deduction: 0, isRejection: false },
    ] as ConditionOption[],
    sortOrder: 13,
    isRequired: false,
    isCritical: false,
    isActive: true,
  },
];

// ===================== DEFAULT BASE VALUES =====================
// Sample base values for common devices
export const DEFAULT_BASE_VALUES = [
  // Apple iPhones
  { brand: "Apple", model: "iPhone 15 Pro Max", storage: "256GB", baseValue: 4500000 },
  { brand: "Apple", model: "iPhone 15 Pro Max", storage: "512GB", baseValue: 5000000 },
  { brand: "Apple", model: "iPhone 15 Pro", storage: "128GB", baseValue: 3800000 },
  { brand: "Apple", model: "iPhone 15 Pro", storage: "256GB", baseValue: 4200000 },
  { brand: "Apple", model: "iPhone 15", storage: "128GB", baseValue: 3000000 },
  { brand: "Apple", model: "iPhone 15", storage: "256GB", baseValue: 3400000 },
  { brand: "Apple", model: "iPhone 14 Pro Max", storage: "256GB", baseValue: 3500000 },
  { brand: "Apple", model: "iPhone 14 Pro", storage: "128GB", baseValue: 2800000 },
  { brand: "Apple", model: "iPhone 14", storage: "128GB", baseValue: 2200000 },
  { brand: "Apple", model: "iPhone 13 Pro Max", storage: "256GB", baseValue: 2800000 },
  { brand: "Apple", model: "iPhone 13 Pro", storage: "128GB", baseValue: 2200000 },
  { brand: "Apple", model: "iPhone 13", storage: "128GB", baseValue: 1600000 },
  { brand: "Apple", model: "iPhone 12 Pro Max", storage: "256GB", baseValue: 1800000 },
  { brand: "Apple", model: "iPhone 12 Pro", storage: "128GB", baseValue: 1400000 },
  { brand: "Apple", model: "iPhone 12", storage: "64GB", baseValue: 1000000 },
  { brand: "Apple", model: "iPhone 11 Pro Max", storage: "256GB", baseValue: 1200000 },
  { brand: "Apple", model: "iPhone 11 Pro", storage: "64GB", baseValue: 900000 },
  { brand: "Apple", model: "iPhone 11", storage: "64GB", baseValue: 700000 },
  { brand: "Apple", model: "iPhone XS Max", storage: "256GB", baseValue: 700000 },
  { brand: "Apple", model: "iPhone XS", storage: "64GB", baseValue: 500000 },
  { brand: "Apple", model: "iPhone X", storage: "64GB", baseValue: 400000 },
  
  // Samsung Galaxy S Series
  { brand: "Samsung", model: "Galaxy S24 Ultra", storage: "256GB", baseValue: 4000000 },
  { brand: "Samsung", model: "Galaxy S24+", storage: "256GB", baseValue: 3200000 },
  { brand: "Samsung", model: "Galaxy S24", storage: "128GB", baseValue: 2500000 },
  { brand: "Samsung", model: "Galaxy S23 Ultra", storage: "256GB", baseValue: 3000000 },
  { brand: "Samsung", model: "Galaxy S23+", storage: "256GB", baseValue: 2400000 },
  { brand: "Samsung", model: "Galaxy S23", storage: "128GB", baseValue: 1800000 },
  { brand: "Samsung", model: "Galaxy S22 Ultra", storage: "256GB", baseValue: 2200000 },
  { brand: "Samsung", model: "Galaxy S22+", storage: "128GB", baseValue: 1600000 },
  { brand: "Samsung", model: "Galaxy S22", storage: "128GB", baseValue: 1200000 },
  { brand: "Samsung", model: "Galaxy S21 Ultra", storage: "256GB", baseValue: 1500000 },
  { brand: "Samsung", model: "Galaxy S21", storage: "128GB", baseValue: 900000 },
  
  // Samsung Galaxy A Series
  { brand: "Samsung", model: "Galaxy A54", storage: "128GB", baseValue: 800000 },
  { brand: "Samsung", model: "Galaxy A34", storage: "128GB", baseValue: 600000 },
  { brand: "Samsung", model: "Galaxy A14", storage: "64GB", baseValue: 300000 },
  
  // Tecno
  { brand: "Tecno", model: "Camon 20 Pro", storage: "256GB", baseValue: 600000 },
  { brand: "Tecno", model: "Camon 20", storage: "128GB", baseValue: 400000 },
  { brand: "Tecno", model: "Spark 10 Pro", storage: "128GB", baseValue: 350000 },
  { brand: "Tecno", model: "Spark 10", storage: "64GB", baseValue: 250000 },
  
  // Infinix
  { brand: "Infinix", model: "Note 30 Pro", storage: "256GB", baseValue: 500000 },
  { brand: "Infinix", model: "Note 30", storage: "128GB", baseValue: 350000 },
  { brand: "Infinix", model: "Hot 30", storage: "64GB", baseValue: 250000 },
];
