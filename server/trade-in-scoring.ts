import type { ConditionOption, TradeInAssessment, ConditionQuestion, DeviceBaseValue } from "../shared/schema";
import type { TradeInDeviceType } from "../shared/trade-in-profile";

// ===================== IMEI VALIDATION =====================
export function validateIMEI(imei: string): { valid: boolean; error?: string } {
  // Fast validation: length and numeric check using char codes
  if (imei.length !== 15) return { valid: false, error: 'IMEI must be exactly 15 digits' };
  let i = 0;
  for (; i < 15; i++) {
    const c = imei.charCodeAt(i);
    if (c < 48 || c > 57) return { valid: false, error: 'IMEI must contain only digits' };
  }

  // Luhn algorithm (optimized using char codes)
  let sum = 0;
  for (let j = 0; j < 14; j++) {
    let digit = imei.charCodeAt(j) - 48;
    if (j % 2 === 1) {
      digit = digit * 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  if (checkDigit !== imei.charCodeAt(14) - 48) return { valid: false, error: 'Invalid IMEI checksum' };
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

export interface TradeInQuestionDefinition {
  id: string;
  category: string;
  question: string;
  options: ConditionOption[];
  sortOrder: number;
  isRequired: boolean;
  isCritical: boolean;
  isActive: boolean;
  deviceTypes: TradeInDeviceType[];
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

  for (let qi = 0; qi < questions.length; qi++) {
    const question = questions[qi];
    const selectedValue = answers[question.id];
    if (!selectedValue) continue;

    // Build a small lookup to avoid O(n) find on each question
    const map: Record<string, ConditionOption> = Object.create(null);
    const opts = question.options;
    for (let oi = 0; oi < opts.length; oi++) {
      const o = opts[oi];
      map[o.value] = o;
    }

    const selectedOption = map[selectedValue];
    if (!selectedOption) continue;

    const d = selectedOption.deduction;
    if (d > 0) {
      totalDeduction += d;
      deductions.push({ question: question.question, deduction: d });
    }
    if (selectedOption.isRejection) {
      rejections.push(question.question + ': ' + selectedOption.label);
    }
  }

  const score = 100 - totalDeduction;
  return { score: score < 0 ? 0 : score, deductions, rejections };
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

// ===================== STANDARD CONDITION QUESTIONS =====================
export const STANDARD_CONDITION_QUESTIONS: TradeInQuestionDefinition[] = [
  {
    id: "security-activation-lock",
    category: "security",
    question: "Can the device be fully signed out and factory reset?",
    options: [
      { value: "yes", label: "Yes - Ready for reset", deduction: 0, isRejection: false },
      { value: "no", label: "No - Lock or account still active", deduction: 100, isRejection: true },
    ],
    sortOrder: 1,
    isRequired: true,
    isCritical: true,
    isActive: true,
    deviceTypes: ["phone", "tablet", "laptop", "other"],
  },
  {
    id: "security-managed-lock",
    category: "security",
    question: "Is the device tied to FRP, MDM, BIOS, or company management?",
    options: [
      { value: "no", label: "No - Not restricted", deduction: 0, isRejection: false },
      { value: "yes", label: "Yes - Still restricted", deduction: 100, isRejection: true },
    ],
    sortOrder: 2,
    isRequired: true,
    isCritical: true,
    isActive: true,
    deviceTypes: ["phone", "tablet", "laptop", "other"],
  },
  {
    id: "display-surface",
    category: "display",
    question: "What is the display condition?",
    options: [
      { value: "perfect", label: "Perfect - Clean display", deduction: 0, isRejection: false },
      { value: "light_wear", label: "Light wear - Fine marks only", deduction: 5, isRejection: false },
      { value: "visible_wear", label: "Visible wear - Deep scratches", deduction: 15, isRejection: false },
      { value: "cracked", label: "Cracked or chipped display", deduction: 40, isRejection: false },
      { value: "faulty", label: "Black spots, lines, flicker, or dead display", deduction: 60, isRejection: false },
    ],
    sortOrder: 10,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet", "laptop", "other"],
  },
  {
    id: "display-touch",
    category: "display",
    question: "Does the touchscreen respond correctly?",
    options: [
      { value: "yes", label: "Yes - Fully responsive", deduction: 0, isRejection: false },
      { value: "partial", label: "Partially responsive", deduction: 25, isRejection: false },
      { value: "no", label: "No - Touch not working", deduction: 50, isRejection: false },
    ],
    sortOrder: 11,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet"],
  },
  {
    id: "body-back",
    category: "body",
    question: "What is the body or rear panel condition?",
    options: [
      { value: "perfect", label: "Perfect - Clean body", deduction: 0, isRejection: false },
      { value: "minor_wear", label: "Minor wear - Light scratches", deduction: 5, isRejection: false },
      { value: "visible_damage", label: "Visible damage - Dents or gouges", deduction: 15, isRejection: false },
      { value: "cracked", label: "Cracked or broken housing", deduction: 30, isRejection: false },
    ],
    sortOrder: 20,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet", "other"],
  },
  {
    id: "body-frame",
    category: "body",
    question: "What is the frame, hinge, or chassis condition?",
    options: [
      { value: "perfect", label: "Perfect - No dents or bending", deduction: 0, isRejection: false },
      { value: "minor_wear", label: "Minor wear - Small scuffs", deduction: 5, isRejection: false },
      { value: "moderate_wear", label: "Moderate wear - Visible dents", deduction: 12, isRejection: false },
      { value: "heavy_damage", label: "Heavy damage - Bent frame or hinge issue", deduction: 30, isRejection: false },
    ],
    sortOrder: 21,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet", "laptop", "other"],
  },
  {
    id: "functionality-power",
    category: "functionality",
    question: "Does the device power on and stay stable?",
    options: [
      { value: "yes", label: "Yes - Starts normally", deduction: 0, isRejection: false },
      { value: "slow", label: "Yes - Slow, freezing, or unstable", deduction: 15, isRejection: false },
      { value: "no", label: "No - Does not power on", deduction: 70, isRejection: false },
    ],
    sortOrder: 30,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet", "laptop", "other"],
  },
  {
    id: "functionality-battery",
    category: "functionality",
    question: "What is the battery condition?",
    options: [
      { value: "excellent", label: "Excellent - Strong battery life", deduction: 0, isRejection: false },
      { value: "good", label: "Good - Noticeable wear only", deduction: 5, isRejection: false },
      { value: "fair", label: "Fair - Needs charge often", deduction: 15, isRejection: false },
      { value: "poor", label: "Poor - Very weak battery", deduction: 25, isRejection: false },
      { value: "damaged", label: "Swollen or damaged battery", deduction: 40, isRejection: false },
    ],
    sortOrder: 31,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet", "laptop", "other"],
  },
  {
    id: "functionality-cameras",
    category: "functionality",
    question: "Do all cameras work correctly?",
    options: [
      { value: "all_working", label: "Yes - All cameras working", deduction: 0, isRejection: false },
      { value: "minor_issue", label: "Minor issue - One camera affected", deduction: 15, isRejection: false },
      { value: "major_issue", label: "Major issue - Multiple cameras affected", deduction: 30, isRejection: false },
    ],
    sortOrder: 32,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet"],
  },
  {
    id: "functionality-audio",
    category: "functionality",
    question: "Do speakers, microphone, and media audio work?",
    options: [
      { value: "all_working", label: "All working", deduction: 0, isRejection: false },
      { value: "minor_issue", label: "One audio function has issues", deduction: 10, isRejection: false },
      { value: "major_issue", label: "Multiple audio functions have issues", deduction: 20, isRejection: false },
    ],
    sortOrder: 33,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet", "laptop", "other"],
  },
  {
    id: "functionality-buttons",
    category: "functionality",
    question: "Do all buttons, ports, and key controls work?",
    options: [
      { value: "all_working", label: "Everything works", deduction: 0, isRejection: false },
      { value: "minor_issue", label: "Minor issue - One control or port affected", deduction: 10, isRejection: false },
      { value: "major_issue", label: "Major issue - Several controls or ports affected", deduction: 20, isRejection: false },
    ],
    sortOrder: 34,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet", "other"],
  },
  {
    id: "functionality-biometric",
    category: "functionality",
    question: "Does Face ID, Touch ID, or fingerprint unlock work?",
    options: [
      { value: "working", label: "Working", deduction: 0, isRejection: false },
      { value: "not_working", label: "Not working", deduction: 15, isRejection: false },
      { value: "na", label: "Not available on this device", deduction: 0, isRejection: false },
    ],
    sortOrder: 35,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet"],
  },
  {
    id: "functionality-keyboard-trackpad",
    category: "functionality",
    question: "Do the keyboard and trackpad work correctly?",
    options: [
      { value: "all_working", label: "Yes - Fully working", deduction: 0, isRejection: false },
      { value: "minor_issue", label: "Minor issue - A few keys or gestures affected", deduction: 15, isRejection: false },
      { value: "major_issue", label: "Major issue - Keyboard or trackpad failing", deduction: 35, isRejection: false },
    ],
    sortOrder: 36,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["laptop"],
  },
  {
    id: "functionality-ports-webcam",
    category: "functionality",
    question: "Do ports, Wi-Fi, webcam, and charging work correctly?",
    options: [
      { value: "all_working", label: "Yes - Fully working", deduction: 0, isRejection: false },
      { value: "minor_issue", label: "Minor issue - One function affected", deduction: 12, isRejection: false },
      { value: "major_issue", label: "Major issue - Multiple functions affected", deduction: 28, isRejection: false },
    ],
    sortOrder: 37,
    isRequired: true,
    isCritical: false,
    isActive: true,
    deviceTypes: ["laptop"],
  },
  {
    id: "accessories-included",
    category: "accessories",
    question: "What accessories are included?",
    options: [
      { value: "full", label: "Primary charger and key accessories included", deduction: 0, isRejection: false },
      { value: "partial", label: "Some accessories included", deduction: 5, isRejection: false },
      { value: "none", label: "No accessories included", deduction: 10, isRejection: false },
    ],
    sortOrder: 40,
    isRequired: false,
    isCritical: false,
    isActive: true,
    deviceTypes: ["phone", "tablet", "laptop", "other"],
  },
];

export function getConditionQuestionsForDeviceType(deviceType: TradeInDeviceType): ConditionQuestion[] {
  return STANDARD_CONDITION_QUESTIONS
    .filter((question) => question.deviceTypes.includes(deviceType))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((question) => ({
      id: question.id,
      category: question.category,
      question: question.question,
      options: question.options as any,
      sortOrder: question.sortOrder,
      isRequired: question.isRequired,
      isCritical: question.isCritical,
      isActive: question.isActive,
    })) as ConditionQuestion[];
}

export const DEFAULT_CONDITION_QUESTIONS = getConditionQuestionsForDeviceType("phone");

// ===================== DEFAULT BASE VALUES =====================
// Sample base values for common devices (2018-2025 lineup)
// The DB type `DeviceBaseValue` contains DB-managed fields (id, createdAt, etc.).
// For the in-code seed list we omit those and use a narrower spec type.
type DeviceBaseValueSpec = Omit<DeviceBaseValue, "id" | "createdAt" | "shopId" | "isActive" | "updatedAt">;
export const DEFAULT_BASE_VALUES: DeviceBaseValueSpec[] = [
  // Apple iPhones (2018-2025)
  { brand: "Apple", model: "iPhone 17 Pro Max", storage: "512GB", baseValue: 5600000 },
  { brand: "Apple", model: "iPhone 17 Pro Max", storage: "256GB", baseValue: 5100000 },
  { brand: "Apple", model: "iPhone 17 Pro", storage: "256GB", baseValue: 4700000 },
  { brand: "Apple", model: "iPhone 17 Pro", storage: "128GB", baseValue: 4400000 },
  { brand: "Apple", model: "iPhone 17 Plus", storage: "256GB", baseValue: 4000000 },
  { brand: "Apple", model: "iPhone 17 Plus", storage: "128GB", baseValue: 3700000 },
  { brand: "Apple", model: "iPhone 17", storage: "256GB", baseValue: 3600000 },
  { brand: "Apple", model: "iPhone 17", storage: "128GB", baseValue: 3300000 },
  { brand: "Apple", model: "iPhone 16 Pro Max", storage: "512GB", baseValue: 5200000 },
  { brand: "Apple", model: "iPhone 16 Pro Max", storage: "256GB", baseValue: 4700000 },
  { brand: "Apple", model: "iPhone 16 Pro", storage: "256GB", baseValue: 4300000 },
  { brand: "Apple", model: "iPhone 16 Pro", storage: "128GB", baseValue: 4000000 },
  { brand: "Apple", model: "iPhone 16 Plus", storage: "256GB", baseValue: 3600000 },
  { brand: "Apple", model: "iPhone 16 Plus", storage: "128GB", baseValue: 3300000 },
  { brand: "Apple", model: "iPhone 16", storage: "256GB", baseValue: 3200000 },
  { brand: "Apple", model: "iPhone 16", storage: "128GB", baseValue: 2900000 },
  { brand: "Apple", model: "iPhone 15 Pro Max", storage: "512GB", baseValue: 4500000 },
  { brand: "Apple", model: "iPhone 15 Pro Max", storage: "256GB", baseValue: 4200000 },
  { brand: "Apple", model: "iPhone 15 Pro", storage: "256GB", baseValue: 3800000 },
  { brand: "Apple", model: "iPhone 15 Pro", storage: "128GB", baseValue: 3500000 },
  { brand: "Apple", model: "iPhone 15", storage: "256GB", baseValue: 3200000 },
  { brand: "Apple", model: "iPhone 15", storage: "128GB", baseValue: 3000000 },
  { brand: "Apple", model: "iPhone 14 Pro Max", storage: "256GB", baseValue: 3000000 },
  { brand: "Apple", model: "iPhone 14 Pro", storage: "256GB", baseValue: 2700000 },
  { brand: "Apple", model: "iPhone 14", storage: "128GB", baseValue: 2200000 },
  { brand: "Apple", model: "iPhone 13 Pro Max", storage: "256GB", baseValue: 2400000 },
  { brand: "Apple", model: "iPhone 13 Pro", storage: "128GB", baseValue: 2000000 },
  { brand: "Apple", model: "iPhone 13", storage: "128GB", baseValue: 1600000 },
  { brand: "Apple", model: "iPhone 12 Pro Max", storage: "256GB", baseValue: 1800000 },
  { brand: "Apple", model: "iPhone 12 Pro", storage: "128GB", baseValue: 1500000 },
  { brand: "Apple", model: "iPhone 12", storage: "128GB", baseValue: 1200000 },
  { brand: "Apple", model: "iPhone 11 Pro Max", storage: "256GB", baseValue: 1200000 },
  { brand: "Apple", model: "iPhone 11 Pro", storage: "128GB", baseValue: 950000 },
  { brand: "Apple", model: "iPhone 11", storage: "64GB", baseValue: 750000 },
  { brand: "Apple", model: "iPhone XR", storage: "64GB", baseValue: 550000 },
  { brand: "Apple", model: "iPhone XS Max", storage: "256GB", baseValue: 650000 },
  { brand: "Apple", model: "iPhone XS", storage: "128GB", baseValue: 500000 },
  { brand: "Apple", model: "iPhone X", storage: "64GB", baseValue: 400000 },

  // Samsung Galaxy S / A Series (2019-2025)
  { brand: "Samsung", model: "Galaxy S24 Ultra", storage: "512GB", baseValue: 4200000 },
  { brand: "Samsung", model: "Galaxy S24 Ultra", storage: "256GB", baseValue: 3800000 },
  { brand: "Samsung", model: "Galaxy S24+", storage: "256GB", baseValue: 3300000 },
  { brand: "Samsung", model: "Galaxy S24", storage: "256GB", baseValue: 2800000 },
  { brand: "Samsung", model: "Galaxy S23 Ultra", storage: "256GB", baseValue: 3000000 },
  { brand: "Samsung", model: "Galaxy S23+", storage: "256GB", baseValue: 2400000 },
  { brand: "Samsung", model: "Galaxy S23", storage: "128GB", baseValue: 1900000 },
  { brand: "Samsung", model: "Galaxy S22 Ultra", storage: "256GB", baseValue: 2200000 },
  { brand: "Samsung", model: "Galaxy S22+", storage: "128GB", baseValue: 1700000 },
  { brand: "Samsung", model: "Galaxy S22", storage: "128GB", baseValue: 1300000 },
  { brand: "Samsung", model: "Galaxy S21 Ultra", storage: "256GB", baseValue: 1500000 },
  { brand: "Samsung", model: "Galaxy S21", storage: "128GB", baseValue: 950000 },
  { brand: "Samsung", model: "Galaxy S20 FE", storage: "128GB", baseValue: 850000 },
  { brand: "Samsung", model: "Galaxy S10", storage: "128GB", baseValue: 600000 },
  { brand: "Samsung", model: "Galaxy A55", storage: "256GB", baseValue: 1400000 },
  { brand: "Samsung", model: "Galaxy A35", storage: "128GB", baseValue: 1000000 },
  { brand: "Samsung", model: "Galaxy A15", storage: "128GB", baseValue: 600000 },
  { brand: "Samsung", model: "Galaxy A14", storage: "64GB", baseValue: 400000 },

  // Tecno (2020-2025)
  { brand: "Tecno", model: "Camon 30 Premier", storage: "512GB", baseValue: 950000 },
  { brand: "Tecno", model: "Camon 30 Pro", storage: "256GB", baseValue: 800000 },
  { brand: "Tecno", model: "Camon 30", storage: "256GB", baseValue: 700000 },
  { brand: "Tecno", model: "Camon 20 Pro", storage: "256GB", baseValue: 600000 },
  { brand: "Tecno", model: "Camon 20", storage: "128GB", baseValue: 450000 },
  { brand: "Tecno", model: "Spark 20 Pro", storage: "256GB", baseValue: 450000 },
  { brand: "Tecno", model: "Spark 20", storage: "128GB", baseValue: 320000 },
  { brand: "Tecno", model: "Spark 10 Pro", storage: "128GB", baseValue: 280000 },
  { brand: "Tecno", model: "Spark 10", storage: "64GB", baseValue: 220000 },

  // Infinix (2020-2025)
  { brand: "Infinix", model: "Zero 30", storage: "256GB", baseValue: 850000 },
  { brand: "Infinix", model: "Note 40 Pro", storage: "256GB", baseValue: 750000 },
  { brand: "Infinix", model: "Note 40", storage: "256GB", baseValue: 650000 },
  { brand: "Infinix", model: "Hot 40 Pro", storage: "128GB", baseValue: 420000 },
  { brand: "Infinix", model: "Hot 40", storage: "128GB", baseValue: 320000 },
  { brand: "Infinix", model: "Hot 12", storage: "64GB", baseValue: 200000 },
];
