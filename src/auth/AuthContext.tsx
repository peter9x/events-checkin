import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
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
  clearSession: () => Promise<void>;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  isRestoring: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const storedRemember = await SecureStore.getItemAsync(
          "checkin.rememberMe"
        );
        if (storedRemember === "true") {
          const storedToken = await SecureStore.getItemAsync(
            "checkin.authToken"
          );
          const storedUser = await SecureStore.getItemAsync("checkin.user");
          if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            setRememberMe(true);
          }
        }
      } catch {
        // Ignore restore failures to keep auth usable.
      } finally {
        setIsRestoring(false);
      }
    };

    restore();
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      rememberMe,
      isRestoring,
      setRememberMe,
      setSession: async (nextUser: User, nextToken: string) => {
        setUser(nextUser);
        setToken(nextToken);
        if (rememberMe) {
          await SecureStore.setItemAsync("checkin.rememberMe", "true");
          await SecureStore.setItemAsync("checkin.authToken", nextToken);
          await SecureStore.setItemAsync(
            "checkin.user",
            JSON.stringify(nextUser)
          );
        } else {
          await SecureStore.deleteItemAsync("checkin.rememberMe");
          await SecureStore.deleteItemAsync("checkin.authToken");
          await SecureStore.deleteItemAsync("checkin.user");
        }
      },
      clearSession: async () => {
        setUser(null);
        setToken(null);
        await SecureStore.deleteItemAsync("checkin.rememberMe");
        await SecureStore.deleteItemAsync("checkin.authToken");
        await SecureStore.deleteItemAsync("checkin.user");
      },
    }),
    [token, user, rememberMe, isRestoring]
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
