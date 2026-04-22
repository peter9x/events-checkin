import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import {
  ApiEnvironmentState,
  ApiMode,
  getApiBaseUrlCandidates,
  getApiEnvironmentSnapshot,
  getConfiguredApiBaseUrls,
  getInitialApiEnvironmentState,
  markApiBaseUrlReachable,
  markApiBaseUrlUnreachable,
  normalizeApiBaseUrl,
  resetApiEnvironment,
  resolveApiMode,
  setConfiguredApiBaseUrls as setGlobalConfiguredApiBaseUrls,
  setPreferredApiMode as setGlobalPreferredApiMode,
} from "../api/apiEndpoints";
import {
  getDefaultMqttSettings,
  mergeMqttSettings,
  MqttSettings,
  MqttSettingsOverrides,
} from "../mqtt/mqttConfig";

export type AppProfile = {
  name: string;
  email: string;
};

export type AppEvent = {
  id: string | number;
  name: string;
};

export type AppStats = Record<string, unknown> | null;

type ApplyLoginConnectionSettingsInput = {
  endpoint?: string | null;
  mqttSettingsOverrides?: MqttSettingsOverrides | null;
};

type AppContextValue = {
  profile: AppProfile | null;
  event: AppEvent | null;
  stats: AppStats;
  apiMode: ApiMode;
  activeApiBaseUrl?: string;
  sessionApiBaseUrl?: string;
  onlineApiBaseUrl?: string;
  localApiBaseUrl?: string;
  mqttSettings: MqttSettings;
  isHydrating: boolean;
  setProfileFromUser: (user: Record<string, unknown> | null) => void;
  setEvent: (event: AppEvent | null) => void;
  setStats: (stats: AppStats) => void;
  clearAppState: () => void;
  applyStatsFromResponse: (payload: unknown) => void;
  setSessionApiBaseUrl: (baseUrl: string | null | undefined) => void;
  resetApiState: (baseUrl?: string | null) => void;
  getApiBaseUrls: (preferredBaseUrl?: string | null) => string[];
  markApiReachable: (baseUrl: string) => void;
  markApiUnreachable: (baseUrl: string) => void;
  applyLoginConnectionSettings: (
    input: ApplyLoginConnectionSettingsInput,
  ) => Promise<string | null>;
};

type StoredConnectionConfig = {
  onlineApiBaseUrl?: string;
  localApiBaseUrl?: string;
  preferredApiMode?: ApiMode;
  mqttSettings?: Partial<MqttSettings>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const EVENT_STORAGE_KEY = "checkin.event";
const CONNECTION_STORAGE_KEY = "checkin.connectionConfig";

const resolveModeBaseUrl = (
  mode: ApiMode,
  baseUrls: { onlineBaseUrl?: string; localBaseUrl?: string },
) => (mode === "local" ? baseUrls.localBaseUrl : baseUrls.onlineBaseUrl);

function normalizeProfile(
  user: Record<string, unknown> | null,
): AppProfile | null {
  if (!user) {
    return null;
  }
  const nameValue =
    (typeof user.name === "string" && user.name.trim()) ||
    [user.firstname, user.lastname]
      .filter((value) => typeof value === "string" && value.trim())
      .join(" ")
      .trim();
  const emailValue = typeof user.email === "string" ? user.email.trim() : "";

  if (!nameValue && !emailValue) {
    return null;
  }

  return {
    name: nameValue || "Team Member",
    email: emailValue,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [event, setEventState] = useState<AppEvent | null>(null);
  const [stats, setStats] = useState<AppStats>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [apiState, setApiState] = useState<ApiEnvironmentState>(() =>
    getInitialApiEnvironmentState(),
  );
  const [preferredApiMode, setPreferredApiModeState] = useState<ApiMode>("online");
  const [mqttSettings, setMqttSettings] = useState<MqttSettings>(() =>
    getDefaultMqttSettings(),
  );

  const canUseSecureStore = useCallback(async () => {
    try {
      return await SecureStore.isAvailableAsync();
    } catch {
      return false;
    }
  }, []);

  const setProfileFromUser = useCallback(
    (nextUser: Record<string, unknown> | null) => {
      setProfile(normalizeProfile(nextUser));
    },
    [],
  );

  const persistEvent = useCallback(
    async (nextEvent: AppEvent | null) => {
      try {
        const available = await canUseSecureStore();
        if (!available) {
          return;
        }
        if (!nextEvent) {
          await SecureStore.deleteItemAsync(EVENT_STORAGE_KEY);
        } else {
          await SecureStore.setItemAsync(
            EVENT_STORAGE_KEY,
            JSON.stringify(nextEvent),
          );
        }
      } catch {
        // Ignore persistence errors.
      }
    },
    [canUseSecureStore],
  );

  const persistConnectionConfig = useCallback(
    async (nextConfig: StoredConnectionConfig) => {
      try {
        const available = await canUseSecureStore();
        if (!available) {
          return;
        }
        await SecureStore.setItemAsync(
          CONNECTION_STORAGE_KEY,
          JSON.stringify(nextConfig),
        );
      } catch {
        // Ignore persistence errors.
      }
    },
    [canUseSecureStore],
  );

  const setEvent = useCallback(
    (nextEvent: AppEvent | null) => {
      setEventState(nextEvent);
      void persistEvent(nextEvent);
    },
    [persistEvent],
  );

  const clearAppState = useCallback(() => {
    const baseUrls = getConfiguredApiBaseUrls();
    const modeBaseUrl = resolveModeBaseUrl(preferredApiMode, baseUrls);

    setProfile(null);
    setEvent(null);
    setStats(null);
    setApiState(getInitialApiEnvironmentState(modeBaseUrl ?? null));
  }, [preferredApiMode, setEvent]);

  useEffect(() => {
    let isActive = true;

    const restoreState = async () => {
      const defaultMqttSettings = getDefaultMqttSettings();
      const defaultBaseUrls = getConfiguredApiBaseUrls();
      let nextPreferredMode: ApiMode = "online";
      let nextMqttSettings = defaultMqttSettings;
      let nextBaseUrls = defaultBaseUrls;

      try {
        const available = await canUseSecureStore();
        if (!available) {
          if (isActive) {
            setGlobalConfiguredApiBaseUrls(defaultBaseUrls);
            setGlobalPreferredApiMode(nextPreferredMode);
            setMqttSettings(defaultMqttSettings);
            setApiState((currentState) =>
              resetApiEnvironment(
                currentState,
                resolveModeBaseUrl(nextPreferredMode, defaultBaseUrls) ?? null,
              ),
            );
          }
          return;
        }

        const [storedEvent, storedConnectionConfig] = await Promise.all([
          SecureStore.getItemAsync(EVENT_STORAGE_KEY),
          SecureStore.getItemAsync(CONNECTION_STORAGE_KEY),
        ]);

        if (storedEvent && isActive) {
          const parsedEvent = JSON.parse(storedEvent) as AppEvent;
          if (parsedEvent?.id !== undefined && parsedEvent?.id !== null) {
            setEventState(parsedEvent);
          }
        }

        if (storedConnectionConfig) {
          const parsedConfig = JSON.parse(
            storedConnectionConfig,
          ) as StoredConnectionConfig;
          const nextOnlineApiBaseUrl =
            normalizeApiBaseUrl(parsedConfig.onlineApiBaseUrl) ??
            defaultBaseUrls.onlineBaseUrl;
          const nextLocalApiBaseUrl =
            normalizeApiBaseUrl(parsedConfig.localApiBaseUrl) ??
            defaultBaseUrls.localBaseUrl;
          nextBaseUrls = {
            onlineBaseUrl: nextOnlineApiBaseUrl,
            localBaseUrl: nextLocalApiBaseUrl,
          };

          if (parsedConfig.preferredApiMode === "online") {
            nextPreferredMode = "online";
          }
          if (parsedConfig.preferredApiMode === "local") {
            nextPreferredMode = "local";
          }

          if (parsedConfig.mqttSettings) {
            nextMqttSettings = mergeMqttSettings(defaultMqttSettings, {
              mqtt_protocol: parsedConfig.mqttSettings.protocol,
              mqtt_server: parsedConfig.mqttSettings.server,
              mqtt_port: parsedConfig.mqttSettings.port,
              mqtt_user: parsedConfig.mqttSettings.user,
              mqtt_pass: parsedConfig.mqttSettings.pass,
              mqtt_ssl: parsedConfig.mqttSettings.ssl,
            });
          }
        }
      } catch {
        // Ignore restore failures.
      } finally {
        if (isActive) {
          setGlobalConfiguredApiBaseUrls(nextBaseUrls);
          setGlobalPreferredApiMode(nextPreferredMode);
          setPreferredApiModeState(nextPreferredMode);
          setMqttSettings(nextMqttSettings);
          setApiState((currentState) =>
            resetApiEnvironment(
              currentState,
              currentState.sessionBaseUrl ??
                resolveModeBaseUrl(nextPreferredMode, nextBaseUrls) ??
                null,
            ),
          );
          setIsHydrating(false);
        }
      }
    };

    void restoreState();
    return () => {
      isActive = false;
    };
  }, [canUseSecureStore]);

  const applyStatsFromResponse = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "stats")) {
      const maybeStats = (payload as { stats?: AppStats }).stats ?? null;
      setStats(maybeStats);
    }
  }, []);

  const setSessionApiBaseUrl = useCallback((baseUrl: string | null | undefined) => {
    const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
    if (normalizedBaseUrl) {
      const resolvedMode = resolveApiMode(normalizedBaseUrl);
      setGlobalPreferredApiMode(resolvedMode);
      setPreferredApiModeState(resolvedMode);
    }

    setApiState((currentState) =>
      resetApiEnvironment(currentState, normalizedBaseUrl),
    );
  }, []);

  const resetApiState = useCallback((baseUrl?: string | null) => {
    setApiState((currentState) => resetApiEnvironment(currentState, baseUrl));
  }, []);

  const markApiReachable = useCallback((baseUrl: string) => {
    const mode = resolveApiMode(baseUrl);
    setGlobalPreferredApiMode(mode);
    setPreferredApiModeState(mode);
    setApiState((currentState) => markApiBaseUrlReachable(currentState, baseUrl));
  }, []);

  const markApiUnreachable = useCallback((baseUrl: string) => {
    setApiState((currentState) =>
      markApiBaseUrlUnreachable(currentState, baseUrl),
    );
  }, []);

  const getApiBaseUrlsForRequest = useCallback(
    (preferredBaseUrl?: string | null) =>
      getApiBaseUrlCandidates(apiState, preferredBaseUrl),
    [apiState],
  );

  const applyLoginConnectionSettings = useCallback(
    async ({ endpoint, mqttSettingsOverrides }: ApplyLoginConnectionSettingsInput) => {
      const normalizedEndpoint = normalizeApiBaseUrl(endpoint);
      const currentBaseUrls = getConfiguredApiBaseUrls();

      let nextPreferredMode = preferredApiMode;
      let nextOnlineApiBaseUrl = currentBaseUrls.onlineBaseUrl;
      let nextLocalApiBaseUrl = currentBaseUrls.localBaseUrl;

      if (normalizedEndpoint) {
        nextPreferredMode = resolveApiMode(normalizedEndpoint);
        if (nextPreferredMode === "local") {
          nextLocalApiBaseUrl = normalizedEndpoint;
        } else {
          nextOnlineApiBaseUrl = normalizedEndpoint;
        }
      }

      setGlobalConfiguredApiBaseUrls({
        onlineBaseUrl: nextOnlineApiBaseUrl,
        localBaseUrl: nextLocalApiBaseUrl,
      });

      const nextMqttSettings = mergeMqttSettings(
        mqttSettings,
        mqttSettingsOverrides,
      );
      const resolvedBaseUrls = getConfiguredApiBaseUrls();
      const resolvedApiBaseUrl =
        normalizedEndpoint ??
        resolveModeBaseUrl(nextPreferredMode, resolvedBaseUrls) ??
        null;

      setGlobalPreferredApiMode(nextPreferredMode);
      setPreferredApiModeState(nextPreferredMode);
      setMqttSettings(nextMqttSettings);
      setApiState((currentState) =>
        resetApiEnvironment(currentState, resolvedApiBaseUrl),
      );

      await persistConnectionConfig({
        onlineApiBaseUrl: resolvedBaseUrls.onlineBaseUrl,
        localApiBaseUrl: resolvedBaseUrls.localBaseUrl,
        preferredApiMode: nextPreferredMode,
        mqttSettings: nextMqttSettings,
      });

      return resolvedApiBaseUrl;
    },
    [mqttSettings, persistConnectionConfig, preferredApiMode],
  );

  const apiSnapshot = getApiEnvironmentSnapshot(apiState);

  const value = useMemo(
    () => ({
      profile,
      event,
      stats,
      apiMode: apiSnapshot.mode,
      activeApiBaseUrl: apiSnapshot.activeBaseUrl,
      sessionApiBaseUrl: apiSnapshot.sessionBaseUrl,
      onlineApiBaseUrl: apiSnapshot.onlineBaseUrl,
      localApiBaseUrl: apiSnapshot.localBaseUrl,
      mqttSettings,
      isHydrating,
      setProfileFromUser,
      setEvent,
      setStats,
      clearAppState,
      applyStatsFromResponse,
      setSessionApiBaseUrl,
      resetApiState,
      getApiBaseUrls: getApiBaseUrlsForRequest,
      markApiReachable,
      markApiUnreachable,
      applyLoginConnectionSettings,
    }),
    [
      profile,
      event,
      stats,
      apiSnapshot.mode,
      apiSnapshot.activeBaseUrl,
      apiSnapshot.sessionBaseUrl,
      apiSnapshot.onlineBaseUrl,
      apiSnapshot.localBaseUrl,
      mqttSettings,
      isHydrating,
      clearAppState,
      applyStatsFromResponse,
      setProfileFromUser,
      setEvent,
      setSessionApiBaseUrl,
      resetApiState,
      getApiBaseUrlsForRequest,
      markApiReachable,
      markApiUnreachable,
      applyLoginConnectionSettings,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
