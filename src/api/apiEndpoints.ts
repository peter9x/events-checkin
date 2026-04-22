export type ApiMode = "online" | "local";

export type ApiEndpointKey =
  | "authQr"
  | "authValidate"
  | "authLogout"
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

export type ConfiguredApiBaseUrls = {
  onlineBaseUrl?: string;
  localBaseUrl?: string;
};

const DEFAULT_LOCAL_API_BASE_URL = "http://10.10.5.10";
const DEFAULT_PREFERRED_MODE: ApiMode = "online";

const API_ENDPOINTS: Record<ApiEndpointKey, string> = {
  authQr: "/auth/qr",
  authValidate: "/auth/validate",
  authLogout: "/auth/logout",
  checkinValidation: "/checkin/validation",
  checkinSearch: "/checkin/search",
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

const getEnvConfiguredApiBaseUrls = (): ConfiguredApiBaseUrls => {
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

let configuredApiBaseUrls = getEnvConfiguredApiBaseUrls();
let preferredApiMode: ApiMode = DEFAULT_PREFERRED_MODE;

const getBaseUrlForMode = (
  mode: ApiMode,
  baseUrls: ConfiguredApiBaseUrls,
) => (mode === "local" ? baseUrls.localBaseUrl : baseUrls.onlineBaseUrl);

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
    return preferredApiMode;
  }

  try {
    const parsed = new URL(baseUrl);
    return isLikelyLocalHost(parsed.hostname) ? "local" : "online";
  } catch {
    return preferredApiMode;
  }
};

export const getConfiguredApiBaseUrls = () => configuredApiBaseUrls;

export const setConfiguredApiBaseUrls = (
  nextValues: Partial<ConfiguredApiBaseUrls>,
) => {
  const merged = {
    ...configuredApiBaseUrls,
    ...nextValues,
  };
  const normalizedOnline = normalizeApiBaseUrl(merged.onlineBaseUrl);
  const onlinePathSuffix = getRemotePathSuffix(normalizedOnline);
  const fallbackLocalBaseUrl = `${DEFAULT_LOCAL_API_BASE_URL}${onlinePathSuffix}`;
  const normalizedLocal =
    normalizeApiBaseUrl(merged.localBaseUrl) ?? fallbackLocalBaseUrl;

  configuredApiBaseUrls = {
    onlineBaseUrl: normalizedOnline,
    localBaseUrl: normalizedLocal,
  };
};

export const setPreferredApiMode = (mode: ApiMode) => {
  preferredApiMode = mode;
};

export const getPreferredApiMode = () => preferredApiMode;

export const getApiEnvironmentSnapshot = (
  state: ApiEnvironmentState,
): ApiEnvironmentSnapshot => {
  const { onlineBaseUrl, localBaseUrl } = getConfiguredApiBaseUrls();
  const normalizedSessionBaseUrl = normalizeApiBaseUrl(state.sessionBaseUrl);
  const normalizedActiveBaseUrl = normalizeApiBaseUrl(state.activeBaseUrl);

  const mode =
    resolveApiMode(normalizedSessionBaseUrl ?? normalizedActiveBaseUrl) ??
    preferredApiMode;
  const modeBaseUrl = getBaseUrlForMode(mode, { onlineBaseUrl, localBaseUrl });
  const activeBaseUrl =
    normalizedSessionBaseUrl ?? normalizedActiveBaseUrl ?? modeBaseUrl;

  return {
    ...state,
    sessionBaseUrl: normalizedSessionBaseUrl,
    activeBaseUrl,
    mode,
    onlineBaseUrl,
    localBaseUrl,
  };
};

export const getInitialApiEnvironmentState = (
  sessionBaseUrl?: string | null,
): ApiEnvironmentState => {
  const normalizedSessionBaseUrl = normalizeApiBaseUrl(sessionBaseUrl);
  if (normalizedSessionBaseUrl) {
    setPreferredApiMode(resolveApiMode(normalizedSessionBaseUrl));
  }

  return {
    activeBaseUrl: normalizedSessionBaseUrl ?? undefined,
    sessionBaseUrl: normalizedSessionBaseUrl ?? undefined,
    lockToLocal: false,
  };
};

export const getApiBaseUrlCandidates = (
  state: ApiEnvironmentState,
  preferredBaseUrl?: string | null,
) => {
  const normalizedPreferred = normalizeApiBaseUrl(preferredBaseUrl);
  if (normalizedPreferred) {
    return [normalizedPreferred];
  }

  const snapshot = getApiEnvironmentSnapshot(state);
  const modeBaseUrl =
    snapshot.mode === "local" ? snapshot.localBaseUrl : snapshot.onlineBaseUrl;
  const selectedBaseUrl =
    snapshot.sessionBaseUrl ?? snapshot.activeBaseUrl ?? modeBaseUrl;

  return selectedBaseUrl ? [selectedBaseUrl] : [];
};

export const markApiBaseUrlReachable = (
  state: ApiEnvironmentState,
  baseUrl: string,
): ApiEnvironmentState => {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return state;
  }

  setPreferredApiMode(resolveApiMode(normalizedBaseUrl));

  return {
    ...state,
    activeBaseUrl: normalizedBaseUrl,
  };
};

export const markApiBaseUrlUnreachable = (
  state: ApiEnvironmentState,
  baseUrl: string,
): ApiEnvironmentState => {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return state;
  }

  const normalizedActiveBaseUrl = normalizeApiBaseUrl(state.activeBaseUrl);
  if (!isSameBaseUrl(normalizedBaseUrl, normalizedActiveBaseUrl)) {
    return state;
  }

  return {
    ...state,
    activeBaseUrl: normalizeApiBaseUrl(state.sessionBaseUrl),
  };
};

export const resetApiEnvironment = (
  state: ApiEnvironmentState,
  sessionBaseUrl?: string | null,
): ApiEnvironmentState => {
  const normalizedSessionBaseUrl =
    sessionBaseUrl === undefined
      ? normalizeApiBaseUrl(state.sessionBaseUrl)
      : normalizeApiBaseUrl(sessionBaseUrl);

  if (normalizedSessionBaseUrl) {
    setPreferredApiMode(resolveApiMode(normalizedSessionBaseUrl));
  }

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
