import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ORGANIZER" | "STAFF" | "ATTENDEE";
}

export const SESSION_QUERY_KEY = ["auth-session"] as const;

export function useSessionQuery(enabled = true) {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => apiFetch<SessionUser>("/auth/session"),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}
