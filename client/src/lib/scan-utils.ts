// ===================== IMEI/SERIAL VALIDATION UTILITIES =====================

// IMEI validation using Luhn algorithm
export function validateIMEI(imei: string): { valid: boolean; error?: string } {
  // Remove any spaces or dashes
  const cleaned = imei.replace(/[\s-]/g, "");
  
  // IMEI must be exactly 15 digits
  if (!/^\d{15}$/.test(cleaned)) {
    return { valid: false, error: "IMEI must be exactly 15 digits" };
  }
  
  // Luhn algorithm check
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleaned[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  if (checkDigit !== parseInt(cleaned[14], 10)) {
    return { valid: false, error: "Invalid IMEI checksum - possible fake device" };
  }
  
  return { valid: true };
}

// Serial number format validation (Apple & Samsung patterns)
export function validateSerialFormat(serial: string, brand?: string): { valid: boolean; error?: string; detectedBrand?: string } {
  const cleaned = serial.trim().toUpperCase();
  
  // Apple serial patterns (12-17 characters, alphanumeric)
  const applePattern = /^[A-Z0-9]{11,17}$/;
  const isAppleLike = applePattern.test(cleaned) && !cleaned.includes("RZ") && !cleaned.includes("RF");
  
  // Samsung serial patterns (typically starts with RF or RZ, 11-15 chars)
  const samsungPattern = /^(RF|RZ|R[0-9])[A-Z0-9]{9,13}$/;
  const isSamsungLike = samsungPattern.test(cleaned);
  
  // Detect brand from serial
  let detectedBrand: string | undefined;
  if (isSamsungLike) detectedBrand = "Samsung";
  else if (isAppleLike) detectedBrand = "Apple";
  
  // If brand is specified, check for mismatch
  if (brand && detectedBrand && brand.toLowerCase() !== detectedBrand.toLowerCase()) {
    return { 
      valid: false, 
      error: `Serial format suggests ${detectedBrand}, but ${brand} was selected - possible mismatch`,
      detectedBrand 
    };
  }
  
  // Basic format validation
  if (cleaned.length < 8 || cleaned.length > 20) {
    return { valid: false, error: "Serial number length is unusual" };
  }
  
  // Check for suspicious patterns (all same char, sequential numbers)
  if (/^(.)\1+$/.test(cleaned)) {
    return { valid: false, error: "Suspicious serial: all same characters" };
  }
  
  if (/^(012345|123456|234567|654321)/.test(cleaned)) {
    return { valid: false, error: "Suspicious serial: sequential numbers" };
  }
  
  return { valid: true, detectedBrand };
}

// Detect if scanned value is IMEI or Serial
export function detectScanType(scanned: string): { type: "imei" | "serial" | "unknown"; value: string; confidence: number } {
  const cleaned = scanned.replace(/[\s-]/g, "");
  
  // IMEI: exactly 15 digits
  if (/^\d{15}$/.test(cleaned)) {
    const imeiValid = validateIMEI(cleaned);
    return { 
      type: "imei", 
      value: cleaned, 
      confidence: imeiValid.valid ? 100 : 70 
    };
  }
  
  // IMEI with check: 16 digits (IMEI + extra check digit)
  if (/^\d{16}$/.test(cleaned)) {
    return { type: "imei", value: cleaned.slice(0, 15), confidence: 80 };
  }
  
  // Serial: alphanumeric, typically 8-20 chars
  if (/^[A-Z0-9]{8,20}$/i.test(cleaned)) {
    return { type: "serial", value: cleaned.toUpperCase(), confidence: 85 };
  }
  
  // Mixed or unknown
  return { type: "unknown", value: scanned, confidence: 30 };
}

// Extract device info from IMEI TAC (Type Allocation Code - first 8 digits)
// This is a simplified version - in production, you'd query a TAC database
export function extractDeviceFromTAC(imei: string): { brand?: string; model?: string; confidence: number } {
  const tac = imei.slice(0, 8);
  
  // Common TAC prefixes (simplified - real implementation would use API)
  const tacDatabase: Record<string, { brand: string; model?: string }> = {
    // Apple (examples)
    "35389011": { brand: "Apple", model: "iPhone 13" },
    "35407710": { brand: "Apple", model: "iPhone 14" },
    "35844111": { brand: "Apple", model: "iPhone 15" },
    "35678109": { brand: "Apple", model: "iPhone 12" },
    // Samsung (examples)
    "35450010": { brand: "Samsung", model: "Galaxy S23" },
    "35328310": { brand: "Samsung", model: "Galaxy S22" },
    "35472710": { brand: "Samsung", model: "Galaxy A54" },
    // Tecno (examples)
    "86741903": { brand: "Tecno" },
    // Infinix (examples)
    "86471804": { brand: "Infinix" },
  };
  
  // Check first 8, then 7, then 6 digits
  for (let len = 8; len >= 6; len--) {
    const prefix = tac.slice(0, len);
    for (const [key, value] of Object.entries(tacDatabase)) {
      if (key.startsWith(prefix)) {
        return { ...value, confidence: len === 8 ? 95 : len === 7 ? 80 : 60 };
      }
    }
  }
  
  // Try to detect brand from common prefixes
  if (tac.startsWith("35")) {
    return { brand: "Apple or Samsung", confidence: 40 };
  }
  if (tac.startsWith("86")) {
    return { brand: "Chinese brand (Tecno/Infinix/Xiaomi)", confidence: 40 };
  }
  
  return { confidence: 0 };
}

// Text-to-speech utility
export function speakText(text: string, rate: number = 0.9): void {
  if (!("speechSynthesis" in window)) {
    console.warn("Text-to-speech not supported");
    return;
  }
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  
  // Try to find a good voice
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find(v => v.lang.startsWith("en-"));
  if (englishVoice) {
    utterance.voice = englishVoice;
  }
  
  window.speechSynthesis.speak(utterance);
}

// Speak IMEI/Serial in a clear format
export function speakScannedValue(value: string, type: "imei" | "serial"): void {
  let spokenText: string;
  
  if (type === "imei") {
    // Break IMEI into groups for clarity: XXX XXX XXX XXX XXX
    const groups = value.match(/.{1,3}/g) || [value];
    spokenText = `IMEI scanned: ${groups.join(" ")}`;
  } else {
    // Spell out serial character by character with pauses
    spokenText = `Serial scanned: ${value.split("").join(" ")}`;
  }
  
  speakText(spokenText, 0.8);
}

// Fake device detection heuristics
export interface FakeDeviceCheck {
  isSuspicious: boolean;
  reasons: string[];
  severity: "low" | "medium" | "high";
}

export function checkForFakeDevice(
  imei: string,
  serial: string | undefined,
  selectedBrand: string,
  selectedModel: string
): FakeDeviceCheck {
  const reasons: string[] = [];
  let severity: "low" | "medium" | "high" = "low";
  
  // IMEI checksum validation
  const imeiCheck = validateIMEI(imei);
  if (!imeiCheck.valid) {
    reasons.push(imeiCheck.error || "Invalid IMEI checksum");
    severity = "high";
  }
  
  // TAC-based brand detection
  const tacInfo = extractDeviceFromTAC(imei);
  if (tacInfo.brand && tacInfo.confidence > 50) {
    const tacBrandLower = tacInfo.brand.toLowerCase();
    const selectedBrandLower = selectedBrand.toLowerCase();
    
    if (!tacBrandLower.includes(selectedBrandLower) && !selectedBrandLower.includes(tacBrandLower.split(" ")[0])) {
      reasons.push(`IMEI suggests ${tacInfo.brand}, but ${selectedBrand} was selected`);
      severity = severity === "high" ? "high" : "medium";
    }
  }
  
  // Serial format validation if provided
  if (serial) {
    const serialCheck = validateSerialFormat(serial, selectedBrand);
    if (!serialCheck.valid) {
      reasons.push(serialCheck.error || "Invalid serial format");
      severity = severity === "low" ? "medium" : severity;
    }
  }
  
  // Check for known fake patterns
  if (/^0{5,}/.test(imei) || /^1{5,}/.test(imei)) {
    reasons.push("IMEI starts with repeated zeros or ones - common fake pattern");
    severity = "high";
  }
  
  // Check for blacklisted IMEI prefixes (examples)
  const blacklistedPrefixes = ["00000000", "12345678", "99999999"];
  if (blacklistedPrefixes.some(prefix => imei.startsWith(prefix))) {
    reasons.push("IMEI matches known fake device pattern");
    severity = "high";
  }
  
  return {
    isSuspicious: reasons.length > 0,
    reasons,
    severity,
  };
}

// Model mismatch detection
export function detectModelMismatch(
  imei: string,
  selectedBrand: string,
  selectedModel: string
): { mismatch: boolean; suggestion?: { brand?: string; model?: string }; message?: string } {
  const tacInfo = extractDeviceFromTAC(imei);
  
  if (!tacInfo.brand || tacInfo.confidence < 50) {
    return { mismatch: false }; // Can't determine
  }
  
  const tacBrandLower = tacInfo.brand.toLowerCase();
  const selectedBrandLower = selectedBrand.toLowerCase();
  
  // Check brand mismatch
  if (!tacBrandLower.includes(selectedBrandLower) && !selectedBrandLower.includes(tacBrandLower.split(" ")[0])) {
    return {
      mismatch: true,
      suggestion: { brand: tacInfo.brand, model: tacInfo.model },
      message: `IMEI suggests this is a ${tacInfo.brand}${tacInfo.model ? ` ${tacInfo.model}` : ""}, not ${selectedBrand} ${selectedModel}`,
    };
  }
  
  // Check model mismatch (if we have model info)
  if (tacInfo.model && !selectedModel.toLowerCase().includes(tacInfo.model.toLowerCase().split(" ").pop() || "")) {
    return {
      mismatch: true,
      suggestion: { brand: tacInfo.brand, model: tacInfo.model },
      message: `IMEI suggests this is ${tacInfo.model}, not ${selectedModel}`,
    };
  }
  
  return { mismatch: false };
}
