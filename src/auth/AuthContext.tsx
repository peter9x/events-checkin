import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useApp } from "../context/AppContext";

type User = {
  id?: string | number;
  name?: string;
  email?: string;
  [key: string]: unknown;
};

type AuthState = {
  token: string | null;
  user: User | null;
};

type AuthContextValue = AuthState & {
  setQrSession: (
    user: User,
    token: string,
    expiresAt: number | null,
    apiBaseUrl: string | null,
  ) => Promise<void>;
  clearSession: () => Promise<void>;
  isRestoring: boolean;
  sessionExpiresAt: number | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const { setProfileFromUser, setSessionApiBaseUrl, resetApiState, clearAppState } =
    useApp();

  const canUseSecureStore = useCallback(async () => {
    try {
      return await SecureStore.isAvailableAsync();
    } catch {
      return false;
    }
  }, []);

  const parseStoredNumber = (value: string | null) => {
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  };

  const clearStoredSession = useCallback(async () => {
    try {
      const available = await canUseSecureStore();
      if (!available) {
        return;
      }
      await SecureStore.deleteItemAsync("checkin.rememberMe");
      await SecureStore.deleteItemAsync("checkin.authToken");
      await SecureStore.deleteItemAsync("checkin.user");
      await SecureStore.deleteItemAsync("checkin.sessionType");
      await SecureStore.deleteItemAsync("checkin.sessionExpiresAt");
      await SecureStore.deleteItemAsync("checkin.apiBaseUrl");
    } catch {
      // Ignore persistence errors to avoid blocking logout.
    } finally {
      setSessionApiBaseUrl(null);
    }
  }, [canUseSecureStore, setSessionApiBaseUrl]);

  useEffect(() => {
    const restore = async () => {
      try {
        const available = await canUseSecureStore();
        if (!available) {
          return;
        }
        const storedToken = await SecureStore.getItemAsync("checkin.authToken");
        const storedUser = await SecureStore.getItemAsync("checkin.user");
        const storedSessionType =
          await SecureStore.getItemAsync("checkin.sessionType");
        const storedApiBaseUrl = await SecureStore.getItemAsync(
          "checkin.apiBaseUrl",
        );
        const storedSessionExpiresAt = parseStoredNumber(
          await SecureStore.getItemAsync("checkin.sessionExpiresAt"),
        );

        const hasStoredSession = Boolean(storedToken && storedUser);
        const shouldRestore = hasStoredSession && storedSessionType === "qr";

        if (storedSessionExpiresAt && storedSessionExpiresAt <= Date.now()) {
          await clearStoredSession();
          clearAppState();
          return;
        }

        if (shouldRestore && storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          setToken(storedToken);
          setUser(parsedUser);
          const nextApiBaseUrl = storedApiBaseUrl?.trim() || null;
          setSessionApiBaseUrl(nextApiBaseUrl);
          setProfileFromUser(parsedUser as Record<string, unknown>);
          setSessionExpiresAt(storedSessionExpiresAt ?? null);
        } else if (hasStoredSession) {
          await clearStoredSession();
        } else {
          resetApiState();
        }
      } catch {
        // Ignore restore failures to keep auth usable.
      } finally {
        setIsRestoring(false);
      }
    };

    restore();
  }, [
    canUseSecureStore,
    clearAppState,
    clearStoredSession,
    resetApiState,
    setProfileFromUser,
    setSessionApiBaseUrl,
  ]);

  useEffect(() => {
    if (!sessionExpiresAt) {
      return;
    }
    const now = Date.now();
    const remaining = sessionExpiresAt - now;
    if (remaining <= 0) {
      void clearStoredSession();
      setUser(null);
      setToken(null);
      setProfileFromUser(null);
      setSessionExpiresAt(null);
      clearAppState();
      return;
    }
    const timer = setTimeout(() => {
      void clearStoredSession();
      setUser(null);
      setToken(null);
      setProfileFromUser(null);
      setSessionExpiresAt(null);
      clearAppState();
    }, remaining);
    return () => clearTimeout(timer);
  }, [clearAppState, sessionExpiresAt, clearStoredSession, setProfileFromUser]);

  const value = useMemo(
    () => ({
      token,
      user,
      isRestoring,
      sessionExpiresAt,
      setQrSession: async (
        nextUser: User,
        nextToken: string,
        expiresAt: number | null,
        nextApiBaseUrl: string | null,
      ) => {
        setUser(nextUser);
        setToken(nextToken);
        setSessionApiBaseUrl(nextApiBaseUrl);
        setProfileFromUser(nextUser as Record<string, unknown>);
        setSessionExpiresAt(expiresAt);
        try {
          const available = await canUseSecureStore();
          if (!available) {
            return;
          }
          await SecureStore.setItemAsync("checkin.authToken", nextToken);
          await SecureStore.setItemAsync("checkin.user", JSON.stringify(nextUser));
          await SecureStore.setItemAsync("checkin.sessionType", "qr");
          if (nextApiBaseUrl) {
            await SecureStore.setItemAsync("checkin.apiBaseUrl", nextApiBaseUrl);
          } else {
            await SecureStore.deleteItemAsync("checkin.apiBaseUrl");
          }
          if (expiresAt) {
            await SecureStore.setItemAsync(
              "checkin.sessionExpiresAt",
              String(expiresAt),
            );
          } else {
            await SecureStore.deleteItemAsync("checkin.sessionExpiresAt");
          }
        } catch {
          // Ignore persistence errors to avoid blocking login.
        }
      },
      clearSession: async () => {
        setUser(null);
        setToken(null);
        setProfileFromUser(null);
        setSessionExpiresAt(null);
        try {
          await clearStoredSession();
        } catch {
          // Ignore persistence errors to avoid blocking logout.
        }
        clearAppState();
      },
    }),
    [
      token,
      user,
      isRestoring,
      sessionExpiresAt,
      canUseSecureStore,
      clearStoredSession,
      clearAppState,
      setProfileFromUser,
      setSessionApiBaseUrl,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
