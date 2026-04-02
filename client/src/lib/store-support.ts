export const STORE_WHATSAPP_NUMBER = "+256756524407";

const WHATSAPP_BASE = "https://wa.me/256756524407";

export function createWhatsAppUrl(message?: string) {
  if (!message) return WHATSAPP_BASE;
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

export function formatStoreStatus(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return "Pending";

  return normalized
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeStorePhoneInput(value: string) {
  return value.replace(/\s+/g, "");
}

export function isValidStorePhoneInput(value: string) {
  const normalized = normalizeStorePhoneInput(value);
  return /^\+256\d{9}$/.test(normalized);
}
