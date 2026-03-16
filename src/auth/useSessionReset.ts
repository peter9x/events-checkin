import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "./AuthContext";
import { useCheckin } from "../checkin/CheckinContext";
import { useApp } from "../context/AppContext";

export function useSessionReset() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const { clearAppState } = useApp();
  const { setRegistration, clearRecentCheckins } = useCheckin();

  return useCallback(async () => {
    await clearSession();
    clearAppState();
    setRegistration(null);
    clearRecentCheckins();
    router.replace("/login");
  }, [clearSession, clearAppState, setRegistration, clearRecentCheckins, router]);
}
