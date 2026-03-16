import { useCallback } from "react";
import { apiRequest, ApiRequestOptions } from "./apiClient";
import { useAuth } from "../auth/AuthContext";
import { useApp } from "../context/AppContext";
import { useSessionReset } from "../auth/useSessionReset";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export function useApi() {
  const { token, user } = useAuth();
  const { event } = useApp();
  const resetSession = useSessionReset();

  const request = useCallback(
    async (path: string, options: ApiRequestOptions) => {
      if (!token || !user?.id || !event?.id) {
        await resetSession();
        return {
          response: undefined,
          payload: null,
          unauthorized: true,
        };
      }

      return apiRequest(path, options, {
        baseUrl: API_BASE_URL,
        token,
        userId: user.id,
        eventId: event.id,
        onUnauthorized: resetSession,
      });
    },
    [token, user?.id, event?.id, resetSession],
  );

  return { request };
}
