import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  setProfileFromUser: (user: Record<string, unknown> | null) => void;
  setEvent: (event: AppEvent | null) => void;
  setStats: (stats: AppStats) => void;
  clearAppState: () => void;
  applyStatsFromResponse: (payload: unknown) => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

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
  const { token } = useAuth();
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [event, setEvent] = useState<AppEvent | null>(null);
  const [stats, setStats] = useState<AppStats>(null);

  const setProfileFromUser = useCallback(
    (nextUser: Record<string, unknown> | null) => {
      setProfile(normalizeProfile(nextUser));
    },
    [],
  );

  const clearAppState = useCallback(() => {
    setProfile(null);
    setEvent(null);
    setStats(null);
  }, []);

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

  const value = useMemo(
    () => ({
      profile,
      event,
      stats,
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
      clearAppState,
      applyStatsFromResponse,
      setProfileFromUser,
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
