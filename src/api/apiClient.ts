import { getDeviceId } from "../device/deviceInfo";

export type ApiQueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: Record<string, unknown> | null;
  query?: Record<string, ApiQueryValue>;
  includeAuth?: boolean;
  includeContext?: boolean;
};

export type ApiRequestContext = {
  baseUrl: string | undefined;
  token?: string | null;
  userId?: string | number | null;
  eventId?: string | number | null;
  onUnauthorized?: () => void | Promise<void>;
};

type ApiResult<T = unknown> = {
  response: Response | undefined;
  payload: T | null;
  unauthorized: boolean;
};

const joinUrl = (baseUrl: string, path: string) => {
  if (!baseUrl) {
    return path;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (baseUrl.endsWith("/") && path.startsWith("/")) {
    return `${baseUrl.slice(0, -1)}${path}`;
  }
  if (!baseUrl.endsWith("/") && !path.startsWith("/")) {
    return `${baseUrl}/${path}`;
  }
  return `${baseUrl}${path}`;
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

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions,
  context: ApiRequestContext,
): Promise<ApiResult<T>> {
  const {
    method = "GET",
    headers,
    body,
    query,
    includeAuth = true,
    includeContext = true,
  } = options;
  const { baseUrl, token, userId, eventId, onUnauthorized } = context;

  if (!baseUrl) {
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

  const isGet = method === "GET";
  let requestUrl = joinUrl(baseUrl, path);
  let requestBody: string | undefined;

  if (isGet) {
    requestUrl = appendQuery(requestUrl, {
      ...query,
      ...(includeContext ? contextPayload : {}),
    });
  } else {
    const payload = {
      ...(body ?? {}),
      ...(includeContext ? contextPayload : {}),
    };
    requestBody = JSON.stringify(payload);
    if (!nextHeaders["Content-Type"]) {
      nextHeaders["Content-Type"] = "application/json";
    }
    requestUrl = appendQuery(requestUrl, query);
  }

  const response = await fetch(requestUrl, {
    method,
    headers: nextHeaders,
    body: requestBody,
  });

  const payload = await response.json().catch(() => null);
  const unauthorized = response.status === 401;

  if (unauthorized && onUnauthorized) {
    await onUnauthorized();
  }

  return { response, payload: payload as T, unauthorized };
}
