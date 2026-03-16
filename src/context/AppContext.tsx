import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../auth/AuthContext";

export type AppProfile = {
  name: string;
  email: string;
};

export type AppEvent = {
  id: string | number;
  name: string;
};

export type AppStats = Record<string, unknown> | null;

type AppContextValue = {
  profile: AppProfile | null;
  event: AppEvent | null;
  stats: AppStats;
  isHydrating: boolean;
  setProfileFromUser: (user: Record<string, unknown> | null) => void;
  setEvent: (event: AppEvent | null) => void;
  setStats: (stats: AppStats) => void;
  clearAppState: () => void;
  applyStatsFromResponse: (payload: unknown) => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const EVENT_STORAGE_KEY = "checkin.event";

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
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [event, setEventState] = useState<AppEvent | null>(null);
  const [stats, setStats] = useState<AppStats>(null);
  const [isHydrating, setIsHydrating] = useState(true);

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

  const setEvent = useCallback(
    (nextEvent: AppEvent | null) => {
      setEventState(nextEvent);
      void persistEvent(nextEvent);
    },
    [persistEvent],
  );

  const clearAppState = useCallback(() => {
    setProfile(null);
    setEvent(null);
    setStats(null);
  }, [setEvent]);

  useEffect(() => {
    let isActive = true;
    const restoreEvent = async () => {
      try {
        const available = await canUseSecureStore();
        if (!available) {
          return;
        }
        const storedEvent = await SecureStore.getItemAsync(EVENT_STORAGE_KEY);
        if (storedEvent && isActive) {
          const parsed = JSON.parse(storedEvent) as AppEvent;
          if (parsed?.id !== undefined && parsed?.id !== null) {
            setEventState(parsed);
          }
        }
      } catch {
        // Ignore restore failures.
      } finally {
        if (isActive) {
          setIsHydrating(false);
        }
      }
    };

    restoreEvent();
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

  useEffect(() => {
    if (!token) {
      clearAppState();
    }
  }, [token, clearAppState]);

  useEffect(() => {
    setProfileFromUser(user as Record<string, unknown> | null);
  }, [user, setProfileFromUser]);

  const value = useMemo(
    () => ({
      profile,
      event,
      stats,
      isHydrating,
      setProfileFromUser,
      setEvent,
      setStats,
      clearAppState,
      applyStatsFromResponse,
    }),
    [
      profile,
      event,
      stats,
      isHydrating,
      clearAppState,
      applyStatsFromResponse,
      setProfileFromUser,
      setEvent,
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
