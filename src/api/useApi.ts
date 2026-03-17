import { useCallback } from "react";
import { apiRequest, ApiRequestOptions } from "./apiClient";
import { ApiEndpointKey } from "./apiEndpoints";
import { useAuth } from "../auth/AuthContext";
import { useApp } from "../context/AppContext";
import { useSessionReset } from "../auth/useSessionReset";

export function useApi() {
  const { token, user } = useAuth();
  const {
    event,
    apiMode,
    getApiBaseUrls,
    markApiReachable,
    markApiUnreachable,
  } = useApp();
  const resetSession = useSessionReset();

  const request = useCallback(
    async (endpoint: ApiEndpointKey, options: ApiRequestOptions) => {
      if (!token || !user?.id || !event?.id) {
        await resetSession();
        return {
          response: undefined,
          payload: null,
          data: null,
          unauthorized: true,
          mode: apiMode,
          baseUrl: undefined,
        };
      }

      return apiRequest(endpoint, options, {
        baseUrls: getApiBaseUrls(),
        onBaseUrlReachable: markApiReachable,
        onBaseUrlUnreachable: markApiUnreachable,
        mode: apiMode,
        token,
        userId: user.id,
        eventId: event.id,
        onUnauthorized: resetSession,
      });
    },
    [
      token,
      user?.id,
      event?.id,
      resetSession,
      apiMode,
      getApiBaseUrls,
      markApiReachable,
      markApiUnreachable,
    ],
  );

  const requestPublic = useCallback(
    async (
      endpoint: ApiEndpointKey,
      options: ApiRequestOptions,
      preferredBaseUrl?: string | null,
    ) =>
      apiRequest(endpoint, options, {
        baseUrls: getApiBaseUrls(preferredBaseUrl),
        onBaseUrlReachable: markApiReachable,
        onBaseUrlUnreachable: markApiUnreachable,
        mode: apiMode,
      }),
    [apiMode, getApiBaseUrls, markApiReachable, markApiUnreachable],
  );

  return { request, requestPublic };
}
