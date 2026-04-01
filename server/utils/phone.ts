import { HttpError } from "./api-response";

export function normalizeUgPhoneNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, "Phone number is required");
  }

  const digits = trimmed.replace(/\s+/g, "");
  if (digits.startsWith("+256")) {
    return digits;
  }

  if (digits.startsWith("256")) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `+256${digits.slice(1)}`;
  }

  throw new HttpError(400, "Phone numbers must include +256");
}

