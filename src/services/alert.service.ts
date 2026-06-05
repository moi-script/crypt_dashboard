import { apiClient, withFallback } from "./api.client";
import { demoStore } from "./mock/demoStore";
import type { Alert, CreateAlertInput } from "@/models/alert.model";

export const alertService = {
  getAll: () =>
    withFallback<Alert[]>(
      () => apiClient.get<Alert[]>("/alerts"),
      () => demoStore.getAlerts(),
    ),

  create: (input: CreateAlertInput) =>
    withFallback<Alert>(
      () => apiClient.post<Alert>("/alerts", input),
      () => demoStore.createAlert(input),
    ),

  toggle: (id: string, active: boolean) =>
    withFallback<Alert>(
      () => apiClient.patch<Alert>(`/alerts/${id}`, { active }),
      () => demoStore.toggleAlert(id, active),
    ),

  remove: (id: string) =>
    withFallback<void>(
      () => apiClient.del<void>(`/alerts/${id}`),
      () => demoStore.deleteAlert(id),
    ),
};
