import type { CurrentUser } from "@fwp/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { api } from "./api";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  /** Stores the user returned by login/register without another round trip. */
  setUser: (user: CurrentUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const meQueryKey = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: meQueryKey,
    queryFn: () => api.get<{ user: CurrentUser | null }>("/auth/me"),
    staleTime: 5 * 60 * 1000,
  });

  const setUser = useCallback(
    (user: CurrentUser | null) => queryClient.setQueryData(meQueryKey, { user }),
    [queryClient],
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    // Drop every cached response that belonged to the previous user.
    queryClient.clear();
    queryClient.setQueryData(meQueryKey, { user: null });
  }, [queryClient]);

  const value = useMemo(
    () => ({ user: data?.user ?? null, isLoading, setUser, logout }),
    [data, isLoading, setUser, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
