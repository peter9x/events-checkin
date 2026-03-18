import { normalizeApiBaseUrl } from "../api/apiEndpoints";

export type ParsedLoginQr = {
  qrCode: string;
  apiBaseUrl: string | null;
};

export const normalizeExpiry = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    if (value > 1e12) {
      return value;
    }
    return Date.now() + value * 1000;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      if (asNumber > 1e12) {
        return asNumber;
      }
      return Date.now() + asNumber * 1000;
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

export const getFirstNonEmptyString = (
  source: Record<string, unknown>,
  keys: string[],
) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
};

export const parseLoginQrValue = (rawValue: string): ParsedLoginQr => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error("QR Code inválido.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { qrCode: trimmed, apiBaseUrl: null };
  }

  if (typeof parsed === "string") {
    const plainQr = parsed.trim();
    if (!plainQr) {
      throw new Error("QR Code inválido.");
    }
    return { qrCode: plainQr, apiBaseUrl: null };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { qrCode: trimmed, apiBaseUrl: null };
  }

  const payload = parsed as Record<string, unknown>;
  const uuid = getFirstNonEmptyString(payload, ["uuid", "qr_code", "qrCode"]);
  if (!uuid) {
    throw new Error("QR Code inválido: UUID em falta.");
  }

  const endpointRaw = getFirstNonEmptyString(payload, [
    "endpoint",
    "url",
  ]);

  if (!endpointRaw) {
    return { qrCode: uuid, apiBaseUrl: null };
  }

  const normalizedEndpoint = normalizeApiBaseUrl(endpointRaw);
  if (!normalizedEndpoint) {
    throw new Error("QR Code inválido: endpoint inválido.");
  }

  return { qrCode: uuid, apiBaseUrl: normalizedEndpoint };
};
