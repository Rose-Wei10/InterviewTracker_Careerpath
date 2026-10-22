import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5001/api",
  timeout: 60000,
});
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: { field: string; message: string }[] }
      | undefined;
    return (
      data?.errors?.map((e) => `${e.field}: ${e.message}`).join("; ") ||
      data?.message ||
      "Unable to connect. Please try again."
    );
  }
  return error instanceof Error ? error.message : "Something went wrong";
}
