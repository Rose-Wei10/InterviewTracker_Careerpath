import { useAuth } from "@clerk/clerk-react";
import { useMemo } from "react";
import { api } from "../services/api";
// Fetch a fresh Clerk token per request, rather than caching an expiring JWT.
export function useApi() {
  const { getToken, userId } = useAuth();
  return useMemo(
    () => ({
      userId,
      async get<T>(url: string, params?: object) {
        const token = await getToken();
        return (
          await api.get<T>(url, {
            params,
            headers: { Authorization: `Bearer ${token}` },
          })
        ).data;
      },
      async post<T>(url: string, data: unknown) {
        const token = await getToken();
        return (
          await api.post<T>(url, data, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).data;
      },
      async patch<T>(url: string, data: unknown) {
        const token = await getToken();
        return (
          await api.patch<T>(url, data, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).data;
      },
      async remove(url: string) {
        const token = await getToken();
        await api.delete(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
      },
      async csv(params: object) {
        const token = await getToken();
        return (
          await api.get("/applications/export", {
            params,
            responseType: "blob",
            headers: { Authorization: `Bearer ${token}` },
          })
        ).data as Blob;
      },
    }),
    [getToken, userId],
  );
}
