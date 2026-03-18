export type ApiMode = "online" | "local";

export type ApiEndpointKey =
  | "authQr"
  | "authValidate"
  | "checkinValidation"
  | "checkinSearch"
  | "checkinConfirm";

export type ApiEnvironmentState = {
  activeBaseUrl?: string;
  sessionBaseUrl?: string;
  lockToLocal: boolean;
};

export type ApiEnvironmentSnapshot = ApiEnvironmentState & {
  mode: ApiMode;
  onlineBaseUrl?: string;
  localBaseUrl?: string;
};

const DEFAULT_LOCAL_API_BASE_URL = "http://10.10.1.46:8000";

const API_ENDPOINTS: Record<ApiEndpointKey, string> = {
  authQr: "/auth/qr",
  authValidate: "/auth/validate",
  checkinValidation: "/checkin/validation",
  checkinSearch: "/checkin/search/",
  checkinConfirm: "/checkin/confirm",
};

export const normalizeApiBaseUrl = (value: string | undefined | null) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  return withProtocol.replace(/\/+$/, "");
};

const isSameBaseUrl = (left: string | undefined, right: string | undefined) => {
  if (!left || !right) {
    return false;
  }
  return left.toLowerCase() === right.toLowerCase();
};

const getRemotePathSuffix = (baseUrl: string | undefined) => {
  if (!baseUrl) {
    return "";
  }

  try {
    const parsed = new URL(baseUrl);
    return parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
  } catch {
    return "";
  }
};

export const getConfiguredApiBaseUrls = () => {
  const onlineBaseUrl = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  const onlinePathSuffix = getRemotePathSuffix(onlineBaseUrl);
  const inferredLocalBaseUrl = `${DEFAULT_LOCAL_API_BASE_URL}${onlinePathSuffix}`;
  const localBaseUrl =
    normalizeApiBaseUrl(process.env.EXPO_PUBLIC_LOCAL_API_URL) ??
    inferredLocalBaseUrl;

  return {
    onlineBaseUrl,
    localBaseUrl,
  };
};

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

export const resolveApiMode = (baseUrl: string | undefined): ApiMode => {
  const { localBaseUrl } = getConfiguredApiBaseUrls();

  if (isSameBaseUrl(baseUrl, localBaseUrl)) {
    return "local";
  }

  if (!baseUrl) {
    return "online";
  }

  try {
    const parsed = new URL(baseUrl);
    return isLikelyLocalHost(parsed.hostname) ? "local" : "online";
  } catch {
    return "online";
  }
};

const uniqueBaseUrls = (urls: (string | undefined)[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  urls.forEach((url) => {
    if (!url) {
      return;
    }

    const key = url.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(url);
  });

  return result;
};

export const getApiEnvironmentSnapshot = (
  state: ApiEnvironmentState,
): ApiEnvironmentSnapshot => {
  const { onlineBaseUrl, localBaseUrl } = getConfiguredApiBaseUrls();
  const fallbackBaseUrl = state.sessionBaseUrl ?? onlineBaseUrl ?? localBaseUrl;
  const activeBaseUrl = state.activeBaseUrl ?? fallbackBaseUrl;

  return {
    ...state,
    activeBaseUrl,
    mode: resolveApiMode(activeBaseUrl),
    onlineBaseUrl,
    localBaseUrl,
  };
};

export const getInitialApiEnvironmentState = (
  sessionBaseUrl?: string | null,
): ApiEnvironmentState => ({
  activeBaseUrl: normalizeApiBaseUrl(sessionBaseUrl) ?? undefined,
  sessionBaseUrl: normalizeApiBaseUrl(sessionBaseUrl) ?? undefined,
  lockToLocal: false,
});

export const getApiBaseUrlCandidates = (
  state: ApiEnvironmentState,
  preferredBaseUrl?: string | null,
) => {
  const snapshot = getApiEnvironmentSnapshot(state);
  const normalizedPreferred = normalizeApiBaseUrl(preferredBaseUrl);

  if (snapshot.lockToLocal) {
    return uniqueBaseUrls([
      normalizedPreferred && resolveApiMode(normalizedPreferred) === "local"
        ? normalizedPreferred
        : undefined,
      snapshot.mode === "local" ? snapshot.activeBaseUrl : undefined,
      snapshot.sessionBaseUrl &&
      resolveApiMode(snapshot.sessionBaseUrl) === "local"
        ? snapshot.sessionBaseUrl
        : undefined,
      snapshot.localBaseUrl,
    ]);
  }

  const onlineCandidates = uniqueBaseUrls([
    normalizedPreferred && resolveApiMode(normalizedPreferred) === "online"
      ? normalizedPreferred
      : undefined,
    snapshot.mode === "online" ? snapshot.activeBaseUrl : undefined,
    snapshot.sessionBaseUrl &&
    resolveApiMode(snapshot.sessionBaseUrl) === "online"
      ? snapshot.sessionBaseUrl
      : undefined,
    snapshot.onlineBaseUrl,
  ]);
  const localCandidates = uniqueBaseUrls([
    normalizedPreferred && resolveApiMode(normalizedPreferred) === "local"
      ? normalizedPreferred
      : undefined,
    snapshot.mode === "local" ? snapshot.activeBaseUrl : undefined,
    snapshot.sessionBaseUrl &&
    resolveApiMode(snapshot.sessionBaseUrl) === "local"
      ? snapshot.sessionBaseUrl
      : undefined,
    snapshot.localBaseUrl,
  ]);

  return uniqueBaseUrls([...onlineCandidates, ...localCandidates]);
};

export const markApiBaseUrlReachable = (
  state: ApiEnvironmentState,
  baseUrl: string,
): ApiEnvironmentState => {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return state;
  }

  const nextMode = resolveApiMode(normalizedBaseUrl);
  if (state.lockToLocal && nextMode !== "local") {
    return state;
  }

  return {
    ...state,
    activeBaseUrl: normalizedBaseUrl,
  };
};

export const markApiBaseUrlUnreachable = (
  state: ApiEnvironmentState,
  baseUrl: string,
): ApiEnvironmentState => {
  const snapshot = getApiEnvironmentSnapshot(state);
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);

  if (!normalizedBaseUrl || !isSameBaseUrl(snapshot.activeBaseUrl, normalizedBaseUrl)) {
    return snapshot;
  }

  const currentMode = resolveApiMode(normalizedBaseUrl);
  const fallback = getApiBaseUrlCandidates(snapshot).find(
    (candidate) => !isSameBaseUrl(candidate, normalizedBaseUrl),
  );

  if (!fallback) {
    return snapshot;
  }

  const nextMode = resolveApiMode(fallback);
  const nextLockToLocal =
    snapshot.lockToLocal || (currentMode === "online" && nextMode === "local");

  if (nextLockToLocal && nextMode !== "local") {
    return snapshot;
  }

  return {
    ...snapshot,
    activeBaseUrl: fallback,
    lockToLocal: nextLockToLocal,
  };
};

export const resetApiEnvironment = (
  state: ApiEnvironmentState,
  sessionBaseUrl?: string | null,
): ApiEnvironmentState => {
  const normalizedSessionBaseUrl =
    sessionBaseUrl === undefined
      ? state.sessionBaseUrl
      : normalizeApiBaseUrl(sessionBaseUrl);

  return {
    activeBaseUrl: normalizedSessionBaseUrl,
    sessionBaseUrl: normalizedSessionBaseUrl,
    lockToLocal: false,
  };
};

export const buildApiPath = (endpoint: ApiEndpointKey) => API_ENDPOINTS[endpoint];

export const buildApiUrl = (baseUrl: string, endpoint: ApiEndpointKey) => {
  const path = buildApiPath(endpoint);

  if (baseUrl.endsWith("/") && path.startsWith("/")) {
    return `${baseUrl.slice(0, -1)}${path}`;
  }

  if (!baseUrl.endsWith("/") && !path.startsWith("/")) {
    return `${baseUrl}/${path}`;
  }

  return `${baseUrl}${path}`;
};
