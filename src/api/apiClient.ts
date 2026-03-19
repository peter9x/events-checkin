import { getDeviceId, getDeviceInfoPayload } from "../device/deviceInfo";
import {
  ApiEndpointKey,
  ApiMode,
  buildApiUrl,
} from "./apiEndpoints";

export type ApiQueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions = {
  attr?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: Record<string, unknown> | null;
  query?: Record<string, ApiQueryValue>;
  includeAuth?: boolean;
  includeContext?: boolean;
  includeDeviceInfo?: boolean;
};

export type ApiRequestContext = {
  baseUrls?: string[];
  onBaseUrlReachable?: (baseUrl: string) => void;
  onBaseUrlUnreachable?: (baseUrl: string) => void;
  token?: string | null;
  userId?: string | number | null;
  eventId?: string | number | null;
  onUnauthorized?: () => void | Promise<void>;
  mode?: ApiMode;
};

type ApiResult<T = any> = {
  response: Response | undefined;
  payload: T | null;
  data: unknown;
  unauthorized: boolean;
  mode: ApiMode;
  baseUrl: string | undefined;
};

type ApiAttemptFailure = {
  baseUrl: string;
  requestUrl: string;
  reason: string;
};

export class ApiNetworkError extends Error {
  attempts: ApiAttemptFailure[];

  constructor(message: string, attempts: ApiAttemptFailure[]) {
    super(message);
    this.name = "ApiNetworkError";
    this.attempts = attempts;
  }
}

const DEFAULT_API_TIMEOUT_MS = 5000;

const resolveTimeoutMs = () => {
  const configured = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_API_TIMEOUT_MS;
  }
  return configured;
};

const API_TIMEOUT_MS = resolveTimeoutMs();

const isPrivateIpv4 = (hostname: string) => {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const numbers = parts.map((part) => Number(part));
  if (numbers.some((number) => Number.isNaN(number) || number < 0 || number > 255)) {
    return false;
  }

  if (numbers[0] === 10) {
    return true;
  }
  if (numbers[0] === 192 && numbers[1] === 168) {
    return true;
  }

  return numbers[0] === 172 && numbers[1] >= 16 && numbers[1] <= 31;
};

const isLikelyLocalHost = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  if (normalized.startsWith("127.")) {
    return true;
  }

  return isPrivateIpv4(normalized);
};

const preferHttpsForRemoteBaseUrl = (baseUrl: string) => {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" || isLikelyLocalHost(parsed.hostname)) {
      return baseUrl;
    }

    parsed.protocol = "https:";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return baseUrl;
  }
};

const getErrorReason = (error: unknown) => {
  if (error instanceof Error) {
    const details = [error.name, error.message].filter(Boolean).join(": ").trim();
    return details || "Unknown error";
  }

  return String(error);
};

const appendQuery = (
  url: string,
  params: Record<string, ApiQueryValue> | undefined,
) => {
  if (!params) {
    return url;
  }

  const [base, existingQuery] = url.split("?");
  const searchParams = new URLSearchParams(existingQuery ?? "");

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  if (!queryString) {
    return base;
  }
  return `${base}?${queryString}`;
};

const readPayloadAttr = (payload: unknown, attr?: string) => {
  if (!attr) {
    return payload;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return (payload as Record<string, unknown>)[attr] ?? null;
};

export async function apiRequest<T = any>(
  endpoint: ApiEndpointKey,
  options: ApiRequestOptions,
  context: ApiRequestContext,
): Promise<ApiResult<T>> {
  const {
    attr,
    method = "GET",
    headers,
    body,
    query,
    includeAuth = true,
    includeContext = true,
    includeDeviceInfo = true,
  } = options;
  const {
    baseUrls,
    token,
    userId,
    eventId,
    onUnauthorized,
    onBaseUrlReachable,
    onBaseUrlUnreachable,
    mode = "online",
  } = context;
  const baseUrlCandidates = (baseUrls ?? []).filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  if (baseUrlCandidates.length === 0) {
    throw new Error("API base URL is not configured.");
  }

  const nextHeaders: Record<string, string> = { ...(headers ?? {}) };
  if (includeAuth && token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  const deviceId = includeContext ? await getDeviceId() : null;
  const contextPayload = includeContext
    ? {
        device_id: deviceId,
        user_id: userId ?? undefined,
        event_id: eventId ?? undefined,
      }
    : {};
  const deviceInfoPayload = includeDeviceInfo
    ? await getDeviceInfoPayload()
    : {};

  const isGet = method === "GET";
  let requestBody: string | undefined;

  if (isGet) {
    requestBody = undefined;
  } else {
    requestBody = JSON.stringify({
      ...(body ?? {}),
      ...deviceInfoPayload,
      ...(includeContext ? contextPayload : {}),
    });
    if (!nextHeaders["Content-Type"]) {
      nextHeaders["Content-Type"] = "application/json";
    }
  }

  const isNetworkUnreachableError = (error: unknown) => {
    if (!(error instanceof Error)) {
      return false;
    }

    if (error.name === "AbortError") {
      return true;
    }

    if (error.name === "TypeError") {
      return true;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes("network request failed") ||
      message.includes("failed to fetch") ||
      message.includes("load failed") ||
      message.includes("internet connection appears to be offline") ||
      message.includes("network connection was lost") ||
      message.includes("could not connect to the server") ||
      message.includes("cannot connect to host") ||
      message.includes("not connected to internet") ||
      message.includes("timed out") ||
      message.includes("network")
    );
  };

  let lastError: unknown;
  const failedAttempts: ApiAttemptFailure[] = [];

  for (const baseUrl of baseUrlCandidates) {
    const requestBaseUrl = preferHttpsForRemoteBaseUrl(baseUrl);
    const urlWithPath = buildApiUrl(requestBaseUrl, endpoint);

    const requestUrl = isGet
      ? appendQuery(urlWithPath, {
          ...query,
          ...deviceInfoPayload,
          ...(includeContext ? contextPayload : {}),
        })
      : appendQuery(urlWithPath, query);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(requestUrl, {
        method,
        headers: nextHeaders,
        body: requestBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      onBaseUrlReachable?.(baseUrl);
      const payload = await response.json().catch(() => null);
      const data = readPayloadAttr(payload, attr);
      const unauthorized = response.status === 401;

      if (unauthorized && onUnauthorized) {
        await onUnauthorized();
      }

      return {
        response,
        payload: payload as T,
        data,
        unauthorized,
        mode,
        baseUrl,
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (!isNetworkUnreachableError(error)) {
        throw error;
      }

      failedAttempts.push({
        baseUrl,
        requestUrl,
        reason: getErrorReason(error),
      });
      onBaseUrlUnreachable?.(baseUrl);
    }
  }

  const lastReason = getErrorReason(lastError);
  const attemptsSummary = failedAttempts
    .map(
      ({ requestUrl, reason }, index) =>
        `${index + 1}. ${requestUrl} -> ${reason}`,
    )
    .join(" | ");

  throw new ApiNetworkError(
    `API request failed after ${failedAttempts.length} attempt(s). Timeout: ${API_TIMEOUT_MS}ms. Last error: ${lastReason}.${attemptsSummary ? ` Attempts: ${attemptsSummary}` : ""}`,
    failedAttempts,
  );
}
