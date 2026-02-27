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
  setSession: (user: User, token: string) => Promise<void>;
  setQrSession: (
    user: User,
    token: string,
    expiresAt: number | null,
  ) => Promise<void>;
  clearSession: () => Promise<void>;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  isRestoring: boolean;
  sessionType: "password" | "qr" | null;
  sessionExpiresAt: number | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [sessionType, setSessionType] = useState<"password" | "qr" | null>(null);
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
        const storedRemember = await SecureStore.getItemAsync(
          "checkin.rememberMe",
        );
        const storedToken = await SecureStore.getItemAsync("checkin.authToken");
        const storedUser = await SecureStore.getItemAsync("checkin.user");
        const storedSessionType =
          await SecureStore.getItemAsync("checkin.sessionType");
        const storedSessionExpiresAt = parseStoredNumber(
          await SecureStore.getItemAsync("checkin.sessionExpiresAt"),
        );

        const shouldRestore =
          Boolean(storedToken && storedUser) &&
          (storedRemember === "true" || storedSessionType === "qr");

        if (storedSessionExpiresAt && storedSessionExpiresAt <= Date.now()) {
          await clearStoredSession();
          return;
        }

        if (shouldRestore && storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setRememberMe(storedRemember === "true");
          setSessionType(
            storedSessionType === "qr" ? "qr" : storedSessionType ? "password" : null,
          );
          setSessionExpiresAt(storedSessionExpiresAt ?? null);
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
      setSessionType(null);
      setSessionExpiresAt(null);
      return;
    }
    const timer = setTimeout(() => {
      void clearStoredSession();
      setUser(null);
      setToken(null);
      setSessionType(null);
      setSessionExpiresAt(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [sessionExpiresAt, clearStoredSession]);

  const value = useMemo(
    () => ({
      token,
      user,
      rememberMe,
      isRestoring,
      sessionType,
      sessionExpiresAt,
      setRememberMe,
      setSession: async (nextUser: User, nextToken: string) => {
        setUser(nextUser);
        setToken(nextToken);
        setSessionType("password");
        setSessionExpiresAt(null);
        try {
          const available = await canUseSecureStore();
          if (!available) {
            return;
          }
          if (rememberMe) {
            await SecureStore.setItemAsync("checkin.rememberMe", "true");
            await SecureStore.setItemAsync("checkin.authToken", nextToken);
            await SecureStore.setItemAsync(
              "checkin.user",
              JSON.stringify(nextUser)
            );
            await SecureStore.setItemAsync("checkin.sessionType", "password");
            await SecureStore.deleteItemAsync("checkin.sessionExpiresAt");
          } else {
            await clearStoredSession();
          }
        } catch {
          // Ignore persistence errors to avoid blocking login.
        }
      },
      setQrSession: async (
        nextUser: User,
        nextToken: string,
        expiresAt: number | null,
      ) => {
        setUser(nextUser);
        setToken(nextToken);
        setSessionType("qr");
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
        setSessionType(null);
        setSessionExpiresAt(null);
        try {
          await clearStoredSession();
        } catch {
          // Ignore persistence errors to avoid blocking logout.
        }
      },
    }),
    [token, user, rememberMe, isRestoring, sessionType, sessionExpiresAt]
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
