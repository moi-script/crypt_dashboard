import { apiClient, tokenStore, withFallback, NetworkError } from "./api.client";
import { demoStore } from "./mock/demoStore";
import type { AuthResponse, Credentials, User } from "@/models/auth.model";

export const authService = {
  register: (creds: Credentials) =>
    withFallback<AuthResponse>(
      () => apiClient.post<AuthResponse>("/auth/register", creds),
      () => demoStore.authResponse(creds.email),
    ),

  login: (creds: Credentials) =>
    withFallback<AuthResponse>(
      () => apiClient.post<AuthResponse>("/auth/login", creds),
      () => demoStore.authResponse(creds.email),
    ),

  me: () =>
    withFallback<User>(
      () => apiClient.get<User>("/auth/me"),
      () => demoStore.authResponse("demo@terminal.dev").user!,
    ),

  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      // ignore network failures on logout — clearing tokens locally is enough
      if (!(err instanceof NetworkError)) {
        /* swallow */
      }
    } finally {
      tokenStore.clear();
    }
  },
};
