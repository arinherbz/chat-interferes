export const TRADE_IN_DEVICE_TYPES = ["phone", "tablet", "laptop", "other"] as const;

export type TradeInDeviceType = (typeof TRADE_IN_DEVICE_TYPES)[number];
export type TradeInIdentifierType = "imei" | "serial";

interface InferTradeInDeviceTypeInput {
  deviceType?: string | null;
  brand?: string | null;
  model?: string | null;
  storage?: string | null;
}

const LAPTOP_KEYWORDS = [
  "macbook",
  "thinkpad",
  "latitude",
  "elitebook",
  "probook",
  "notebook",
  "laptop",
  "xps",
  "zenbook",
  "vivobook",
  "chromebook",
  "surface laptop",
  "surface book",
];

const TABLET_KEYWORDS = [
  "ipad",
  "tablet",
  "tab ",
  "tabs",
  "galaxy tab",
  "surface go",
];

export function isTradeInDeviceType(value: string | null | undefined): value is TradeInDeviceType {
  return !!value && (TRADE_IN_DEVICE_TYPES as readonly string[]).includes(value);
}

export function inferTradeInDeviceType(input: InferTradeInDeviceTypeInput): TradeInDeviceType {
  if (isTradeInDeviceType(input.deviceType)) {
    return input.deviceType;
  }

  const fingerprint = [input.brand, input.model, input.storage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (LAPTOP_KEYWORDS.some((keyword) => fingerprint.includes(keyword))) {
    return "laptop";
  }

  if (TABLET_KEYWORDS.some((keyword) => fingerprint.includes(keyword))) {
    return "tablet";
  }

  return "phone";
}

export function getTradeInIdentifierType(deviceType: TradeInDeviceType): TradeInIdentifierType {
  return deviceType === "phone" || deviceType === "tablet" ? "imei" : "serial";
}

export function getTradeInIdentifierLabel(deviceType: TradeInDeviceType): string {
  return getTradeInIdentifierType(deviceType) === "imei" ? "IMEI Number" : "Serial Number";
}
