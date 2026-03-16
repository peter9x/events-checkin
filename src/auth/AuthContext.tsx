import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";

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
    } catch {
      // Ignore persistence errors to avoid blocking logout.
    }
  }, [canUseSecureStore]);

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
        const storedSessionExpiresAt = parseStoredNumber(
          await SecureStore.getItemAsync("checkin.sessionExpiresAt"),
        );

        const hasStoredSession = Boolean(storedToken && storedUser);
        const shouldRestore = hasStoredSession && storedSessionType === "qr";

        if (storedSessionExpiresAt && storedSessionExpiresAt <= Date.now()) {
          await clearStoredSession();
          return;
        }

        if (shouldRestore && storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setSessionExpiresAt(storedSessionExpiresAt ?? null);
        } else if (hasStoredSession) {
          await clearStoredSession();
        }
      } catch {
        // Ignore restore failures to keep auth usable.
      } finally {
        setIsRestoring(false);
      }
    };

    restore();
  }, [canUseSecureStore, clearStoredSession]);

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
      setSessionExpiresAt(null);
      return;
    }
    const timer = setTimeout(() => {
      void clearStoredSession();
      setUser(null);
      setToken(null);
      setSessionExpiresAt(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [sessionExpiresAt, clearStoredSession]);

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
      ) => {
        setUser(nextUser);
        setToken(nextToken);
        setSessionExpiresAt(expiresAt);
        try {
          const available = await canUseSecureStore();
          if (!available) {
            return;
          }
          await SecureStore.setItemAsync("checkin.authToken", nextToken);
          await SecureStore.setItemAsync("checkin.user", JSON.stringify(nextUser));
          await SecureStore.setItemAsync("checkin.sessionType", "qr");
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
        setSessionExpiresAt(null);
        try {
          await clearStoredSession();
        } catch {
          // Ignore persistence errors to avoid blocking logout.
        }
      },
    }),
    [token, user, isRestoring, sessionExpiresAt, canUseSecureStore, clearStoredSession]
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
